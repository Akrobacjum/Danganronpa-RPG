# STATUS-GAPS - work line gaps-a (claude/gaps-a)

Base: fa73b601 (claude/fervent-sagan-gme4vt: main 1.2.106 + the E97/E98 line). Four Known gaps of the 1.2.105 release
notes, one commit each, red test first. Written 12.11.2026.

## for the coordinator

| Gap | Commit | Test(s) | Red | Green |
| --- | --- | --- | --- | --- |
| G1 lastChapter names Season setup | 45bc8a0d | R3660 (tier 1) | at fa73b601: `window [false,false]`, `between [true,true,false]`; 1 passed, 1 failed | 2 passed, 0 failed |
| G3 a11y() lists Details | fbe2214a | R3661 (tier 1) | at 45bc8a0d: the report named no Details (`listed 0`); 1 passed, 1 failed | 2 passed, 0 failed |
| G2 Legacy "Pochodzenie" whole | 3f885f86 | R3662 (tier 0), R606 adjusted, style-sweep `--tables` heads check | at fbe2214a: R3662 `legacyOrigin false`; Chromium: "Pochodzenie" cut by 20 px, pl legacy at 1280x720, 1366x768, 1920x1080 | R3662 + R606 3 passed; `--tables` green, 0 heads cut |
| G4 Event panel steady empty region | b40f98d7, fix 1111185c + 82edb6eb | R3663 (tier 1), R1401 | at 3f885f86: `empty: null`, `again.same false`, no CSS, no lang key; 1 passed, 1 failed. CI 43198461948 shard 1: R1401 and R3663 red inside 01's incident and trial (see "G4 after CI") | with R3462, R1430, R1394, R1401: 6 passed; local shard 1/8 green |
| G5 61 D5 and the clock beat | 60119b3e (in 1.2.107 as d220d7a7) | 61 D5, cluster.mjs packet log | 3 in parallel 6 of 6 red, every section `clockBeat` | 3 in parallel 3/3, alone 3/3, 113/113 each |

Head, CI and the full local runs: see "Runs" at the end.

### G1 - DRPG.Chapter.lastChapter

- EN: "Chapter {n} is the last of a season. Reset the season in Season setup rather than moving on to chapter {next}."
- PL: "Rozdział {n} jest ostatnim w sezonie. Zamiast przechodzić do rozdziału {next}, zresetuj sezon w Ustawieniach
  sezonu." The Polish names the window in the locative ("w Ustawieniach sezonu"), as DRPG.Safeword.kept and
  DRPG.Fog.secretDoor.detail already do for the same window; the title itself is "Ustawienia sezonu". If the owner
  wants the nominative ("w oknie Ustawienia sezonu"), it is a one-word change and R3660's `window[1]` check.
- GM handbook EN/PL, chapter 6's sentence: now "reset the season in **Season setup**" / "zresetuj sezon w
  **Ustawieniach sezonu**". chapter.mjs's comment beside `lastChapter` no longer says "Between sessions".
- Swept: lang/en.json, lang/pl.json, all six handbooks, scripts: no other text sends a GM to Between sessions to
  reset a season (section 16 and the GM panel table already say Season setup).

### G3 - game.drpg.a11y() and Details

- a11y.mjs `detailsRows` (exported) reads, at the moment the report is asked, every `.drpg-action-details-toggle`
  inside the module's surfaces: the name a screen reader reads (`accessibleName`), the window's title, open or shut
  (`aria-expanded`), and "out of step" when its box disagrees (open and `inert`, shut and reachable, or no box).
  `a11yReport` appends one line per Details after its usual first line; with no Details drawn its output is unchanged
  (the tier-2 "every control ... has a name" test still reads `carry no name` only).
- The report's lines are English, like the rest of that console report (CLAUDE.md: diagnostics stay English).
- Handbook EN/PL, the console table's `a11y()` row, and api.mjs's note say so.
- Not measured: a real screen reader; the report in a real Foundry with an action window open (headless: a stand-in
  `.drpg-panel` with the module's own `detailsHtml`).

### G2 - Passages' Origin head under Legacy

- Measured in Chromium (style harness, probe 08's Polish capture made with `DRPG_CAPTURE_LANG=pl` into a scratch
  folder, not committed): under Legacy with its pixel face "Pochodzenie" is 143.5 px of text in a 130 px column
  (12 px padding), 20 px past the cell (scrollWidth 149 / 129), cut by "Kto zna". Under the glass it stands 2 px into its
  own padding, inside the cell; under Legacy without the pixel face it fits.
- Fix (components.css, Legacy only, this tab only): Origin 156, Rooms 150 -> 143, Who knows 156 -> 137. Sum stays 1162
  (R606's room at 1280x720 is 1169). The glass's widths are untouched (R3662 holds them: 150,96,110,130,156,130,134,256).
- Read after, `node audit/style-sweep.mjs --tables --pl-windows <dir>`: en/pl x glass/legacy x 1280x720, 1366x768,
  1920x1080: 0 heads cut, 0 buttons past their cell, 0 cells past the body, windows the same size as before
  (1198x704 at 1280x720). A scratch word-break reading: no word breaks that did not break before (Legacy's Polish
  state cell "przesunęła" already broke at the base and still does - not this gap). Screenshot read by eye (not
  committed): the head whole; Aiko's chip in the narrower Who knows column now puts its × on a second line.
- style-sweep `--tables` gained a heads check with its control (Origin forced to 30 px must read a cut head: read).
- R606 now reads only unthemed rules (it would otherwise read the Legacy Origin rule as the glass's).
- Not this change, found while measuring: `node audit/style-sweep.mjs --only rooms-passages` reads 48 differences from
  audit/style-baseline.json - the same 48 at fbe2214a without the change (kit tabs' colours, icon buttons, select
  overflow). The baseline looks stale since an earlier stage; not accepted here.
- To run the Chromium pass in this container Playwright needed `--chromium /opt/pw-browsers/chromium` (the bundled
  headless shell version is not installed here).

### G4 - the Event panel, empty

- Fitted in a small change. events.mjs `renderEvents`: while the Event window is shown, the panel stands with no
  card - emptied in place, the same element, `role="status"`, aria-live polite once swept, named by
  DRPG.Events.region ("Event panel" / "Panel zdarzeń"); the next card is drawn into the same element.
- danganronpa.css: `body #drpg-events.drpg-events:empty { margin: 0; position: absolute; }`, and the forced-colours
  border skips an empty panel (`#drpg-events:not(:empty)`).
- Read in Chromium on audit/glass-harness.html (scratch script): GM and player, both themes, 1366x768, 1280x720,
  1920x1080, 393x852 and 1024x768 (20 readings): the empty panel 0 px tall, margin 0, no border (also with forced
  colours emulated), no animation; no block moved against no panel; the glass's panes the same and no event pane; a
  card drawn and emptied again moves nothing against the empty panel. With the margin rule alone, a GM's stacked page
  put the right column 14 px lower (glass) / 4 px (Legacy) - the stack's flex gap - hence `position: absolute`.
- Reduced motion: the empty region adds no motion; the cards' own animations were already off under reduced motion.
- What "no layout jump when the first card arrives" can and cannot mean here: the empty region itself causes no
  jump (above), but the first card still takes its own height when it lands, because E49 A6 (the owner's 10.11) makes
  the panel as tall as its cards with no reserved band. On a GM's stacked page what stands under the panel moves
  down by that card, as before this change. Reserving the room would undo E49 A6; not done, and a question for the
  owner if wanted.
- Not measured: a screen reader announcing the first card into the standing region (LIVE-E48-06 still stands);
  the real Foundry layout around `#ui-top`.

### G5 - scenario 61 part D5 (the coordinator's item of 12.11)

- Reading confirmed. Measured here: two runs of 61 in parallel 2 of 2 green; three in parallel 3 of 3 red, then with
  the store name in the packet log 3 of 3 red again - 6 of 6 red, every section D5 counted `clockBeat` (222 bytes,
  from gm and gm2 to gma, and gma's own back). The window at risk is from D's copy of the primary's storage to the
  returning browser's hello (about 11 s alone); the beat is every 60 s (hud-elapsed.mjs `CLOCK_BEAT_MS`), so a slow
  run puts a beat inside it and the copy is honestly one beat behind.
- Fix (harness only): cluster.mjs's packet log records the `store` a packet names; D5 counts a `gms.state` to or from
  the returning browser as a failure unless its store's world-A section in the primary's storage now differs from the
  copy taken before world B. Any other section, or one the log cannot name, still fails D5.
- Control (a scratch copy of the scenario, not committed): the returning browser's world-A `gmRemnants` section
  deleted before it comes back - D5 FAILS, `unexplained` naming `remnants` (gm, gm2 -> gma, 1148 bytes).
- After the fix: three in parallel 3 of 3 green (113/113 each; the last one's D5 detail `movedOn ["clockBeat"]`,
  4 states, 0 unexplained); alone three times 3 of 3 green (113/113 each, D5 with no section sent: `states 0`, no beat in the window).

### G4 after CI

CI run 43198461948 (89e2c656) went red in suite shard 1 only: R1401 and R3663 failed inside 01-runtests' parts A1
(an incident open) and A2 (inside a Class Trial); the plain tiers 0-1 run here had been green (1231 passed).
- R3663 read an empty panel through `renderEvents`, which cannot be empty where the world draws a card. It now
  drives events.mjs `paintEvents` (the drawing, split out of `renderEvents`) with cards of its own.
- R1401 read the panel in front of the rail on a desk: a real fault the standing panel exposed. `renderEvents`
  checked the panel's place only on a change of cards (the rail is rebuilt and appended at its column's end), and
  narrow.mjs `restoreDesk` put the panel back by a neighbour recorded while it stood before the clock. Fixed in
  both places (`paintEvents` places it before the same-cards return; `restoreDesk` puts it after the rail).
- Measured with a scratch scenario (not committed) running R1401 and R3663 plain, in A1 and in A2: red at 60119b3e
  (A1, A2: 2 failed each), green after both fixes; `DRPG_SUITE_SHARD=1/8 node run-all.mjs suite` here: 21/21
  checks, suite 1234 passed, 0 failed, 16 skipped (1469 s, at 1111185c's code).
- 1111185c was pushed with `check registry` red (R3663's renamed row; a chained command did not stop on it);
  82edb6eb regenerates the registry, quick green there.

## Runs

- Head: 82edb6eb (then this STATUS commit, `[skip ci]`).
- CI: fbe2214a green (run 43195351645, all 21 jobs). 89e2c656 red (run 43198461948: suite 1/8, R1401 and R3663, fixed
  above). The runs of 60119b3e, 1111185c and 82edb6eb were cancelled while queued, on the owner's decision of 12.11
  relayed by the coordinator (CI once a release, on the train's PR head), so the head has no CI result; the local
  readings above stand in for it: quick green at 82edb6eb, tiers 0-1 1231 passed 0 failed at b40f98d7, shard 1/8
  green at 1111185c's code, 61 alone and in parallel green at 60119b3e.

### Not touched

tools/stages.json (the registry rows read "E97" as their stage, from the current stage list - the coordinator
registers this line); root README; dh-dice and dh-relay; no waiver. No screenshots in git.
