# E61 - status (work line claude/e61-62)

Updated 12.11.2026. The line builds E61, then E62, then E94, on branch `claude/e61-62`; R range R3700-R3749. The plan
is `docs/dev/plans/E61.md` on `claude/plan-130` (read whole); the pattern for look and timing is the owner's approved
mockups MK-R1 and MK-R2 of 05.11 (both read with the Artifact tool, with `mock/seq/e61a.js`, `e61b.js` and `mock.css`;
`DIAGNOSIS.md` is not published on MK-R2 and could not be read: every timing below is the mockups' JS).

## Done (committed on the branch)

| Plan | What | Where |
| --- | --- | --- |
| C1 | The sequence engine: one start per event (`started`, by the event's key), one at a time (a new one or a phase change cuts the running one), Escape in a capture listener registered before foundry-windows.mjs's (it takes the key only while a sequence plays), the still frame under reduced motion, the table's switch (world setting `sequences`, on by default, in the DRPG Settings window's Effects section; since the merge of the 1.2.107 line, its game section's GM list, where that line put it), Foundry tools and Map tools hidden by a body attribute for the span (never `toggleFoundryTools`), the notice stack raised over the host, counters `sequence.*` | scripts/sequence.mjs (new), settings.mjs, settings-window.mjs, module.mjs, styles/danganronpa.css |
| C2 | Two sound slots, `trialStart` (the title's frame) and `verdictCut` (the stamp's), incident rows in EN and PL; the old `verdict` row (played at the vote's count) relabelled "The vote's result" / "Wynik głosowania", key kept (Q-E61-7 default) | config.mjs, lang/*.json |
| C3 | E61-A under Stained Glass, rebuilt in round 3 on the owner's review of round 2 (12.11: the new glass matched the old in neither size, look nor shape): the standing panes keep their exact place and the hole they leave is tiled with new convex panes of the standing panes' corner count and size range, cut by straight lines (`fillHole`); the closed curtain is the curtain's own paint (`curtainPaint`) of the standing and the new panes as one cut, so fill, ink and lead are the curtain's; round 4 (the owner's note on round 3: panes are to slide out from behind the curtain's edge, not scale up): each new pane keeps its size and shape from its first frame and slides out from behind an edge it shares with glass already there - a standing pane, or a new pane that started before it - along that edge's normal, drawn only inside its own place (`slidePlan`, `slideAt`, sequence.mjs `slideCanvas`); generations start when the one before is 70 % through, starts spread outer first within a generation, 860 ms in all; the opening is the reverse onto the trial's cut. The panes' colour goes from the Investigation's blue to the trial's pink in eight batches, outer first; title at 1400 ms, open 2500-3360. Rounds 1 (affine closed plan) and 2 (fronts flooding the hole) are gone | glass-close.mjs (`fillHole`, `slidePlan`, `slideAt`, `visibleAt`, `tilingReading`), glass.mjs (`entryPieces`), sequence.mjs (`drawTrialEntry`), styles |
| C4 | E61-A under Monokuma Legacy (and wherever no curtain is cut): two lids with a red edge, the same title, times, sound, Esc and still frame; no glass code runs | sequence.mjs, danganronpa.css |
| C5 | E61-B, the verdict's cut-in, from a GM's verdict card (`createChatMessage`, a message with `verdictAt`): band 0, portrait 250, votes 900, the stamp's hit 1700, the card's sentence 1950, frame 5 held to 3500, 180 ms fade; variants guilty / not guilty / nobody; two sentenced side by side (Q-E61-3 default). The card carries a new flag `verdictCut: { sentenced, right }` - what its words already say. `verdictBoardElement` is frame 5 alone, for E99. Round 2 (the owner's review): the count's heading and each vote row now come in one after another (320 ms each, 90 ms apart, eased), each bar growing after its row, and the sentence in 380 ms; before, the rows came as one block in 180 ms. Nothing animates under reduced motion | sequence.mjs, verdict.mjs, styles |

## Tests

R3700-R3707 (tier 1); three existing tests' counts moved by what this stage adds, each with a comment beside it:
R3420 (`sequences` is the first key born in the DRPG Settings window; effects 5 -> 6), R1256 (the table's lifetimes 36 ->
37), R60 (sizes in a clamp() for a viewport container 2 -> 6: the sequences' four).

## Test results (12.11.2026)

- Tiers 0-1 whole, headless (`node run-tests.mjs --tier 1`, at d380f7d + CSS): 1182 ran, 1164 passed, 2 failed, 16
  skipped, 1 red (expected). The two failures were R60 and R1256, counts this stage moved; fixed in d03c509 and both
  re-run green by name (3 passed with the runner's own line). R3700-R3707 and R3420 green by name after the last change.
- Mutant: R3703 with the closed plan's growth capped at 0.9 fails (gaps over 0), as it should.
- `node tools/check.mjs` 17/17 green; `npm run lint` green.
- Scenarios that read the files this stage changes (found with `git grep` over audit/harness/scenarios: glass.mjs,
  verdict.mjs, module.mjs, settings.mjs, config.mjs, lang/*.json; 84-viewports left out, it hangs headless), each with
  `node run-all.mjs scenarios --only NN`, at d03c509: 00, 10, 12, 13, 14, 17, 19, 20, 30, 33, 40, 41, 50, 60, 62, 63,
  65, 66, 71, 72, 74, 75, 81, 83, 86, 87, 88 green. 61-gmstore-case failed one check (D5, a browser back in world A
  reads its traces) when run beside a second stream of scenarios, and was green alone, 113/113 - read as load, not this
  stage (no file it reads changed in the store's road); to watch in CI.

## Review shots

Round 1: https://claude.ai/artifact/Xu74bXxVyKqNrr2jQnCHR6 - the entry's and the cut-in's still frames in both themes,
EN and PL, GM and player, 1600x900 and 1366x768 at deviceScaleFactor 2; four recordings (both sequences, both themes)
with frame strips. The glass harness in headless Chromium, not Foundry (the page says what the pictures are not).

Round 2 (the owner's review of round 1): https://claude.ai/artifact/A2Krfqw5VQcMRE1dJnPP5e - the entry under Stained
Glass and Monokuma Legacy as recordings and frame strips, the closed curtain's still frame in both themes at
deviceScaleFactor 2, the verdict cut-in's recording and strip, and the measurements below; Polish captions. The glass
harness in headless Chromium, PL and GM only on the pictures (the page says what they are not).

Round 4 (the owner's note on round 3), the same page republished as version 2: https://claude.ai/artifact/JsXyBFu8skaSKzXME2n3ji -
frame strips every 75 ms of one closing and one opening at 1366x768 and 1920x1080 (drawn with `slideAt` on a held
clock, not filmed), real-time recordings at 1366x768 in both themes, close-ups at 25/50/75 % in both themes, and the
table below. Round 3's page (version 1 of the same address): the entry under Stained
Glass and Monokuma Legacy as recordings and frame strips, close-ups at 25 %, 50 % and 75 % of the closing and the
closed curtain in both themes at deviceScaleFactor 2, and the table below per size and role; Polish captions; what the
pictures are not is on the page.

Glass sweep at 8ab5124 (`--no-notices`): SWEEP GREEN, 2 themes x 2 roles x 25 sizes, 46 with glass, 0 failing. CI moved
to the release train (the coordinator, 12.11): this branch's runs 499, 505 and 508 were cancelled; local checks stand in.

## The owner's acceptance

12.11.2026, after round 5: "Zatwierdzam animacje kurtyny - SUPER!" - the curtain's animation accepted as built at
98e004c, at 1366x768 and 1920x1080 (relayed by the coordinator). Round 4 had been accepted at 1366x768 alone.

## Round 5 results (12.11.2026): 1920x1080's proportions

The owner (12.11): round 4 accepted at 1366x768; at 1920x1080 the animation's panes are a little small and too narrow.
Measured first (Node, the harness's cuts): the new panes' median area was 1.20-1.33 % of the screen at 1920x1080 against
2.19-2.28 % at 1366x768, the 10th percentile 0.11-0.15 % against 0.60-0.70 %, the median aspect (narrowest width over
longest span) 0.38-0.43 against 0.43-0.52. The standing cut is smaller in share too (1.19 % against 2.27 %): it is built of
fixed pixel sizes (glass.mjs `cutSectors`, a step of 230-290 px), so its median is about the same in pixels at every size
(23,805 px² at 1366x768, 24,635 at 1920x1080), and `fillHole` aimed the new panes at that median. Only the new panes are
changed (the owner's note is about the animation); the at-rest cut is not.

- Fix, above 1366x768 only (`REFERENCE_SCREEN`): the target grows with the screen's area (times 1.6); the hole is first
  cut by a grid of two families of lines at the curtain's slants (a cell 1.2 targets); a piece under 0.55 of the target
  is joined with a neighbour or cut again with it; a recut is kept only when it holds the two pieces' area to half a
  pixel; a cell's bits and the later joins are capped at the largest standing pane. Two corners closer than 0.01 px are
  one (0.5 px dropped a real corner and opened a sliver). At 1366x768 and below the fill is round 4's, pane for pane
  (10 seeds, GM and player, compared with 1db3f62's file).
- Over eight seeds (Node): GM 1920x1080 median share 2.27 % against 2.42 % at 1366x768 (0.94), aspect 0.48 against
  0.45; player 2.23 % against 2.14 % (1.04), aspect 0.48 against 0.48. In Chromium, one seed each (the module's): GM
  2.14 % against 2.09 %, player 2.45 % against 1.76 % (one draw swings about a tenth); 10th percentile at 1920x1080 0.16 %
  and 0.41 % (the cracks and wedges between standing panes).
- The 7-size check in Chromium: 0 overlaps in 92 frames, 0 frames at another scale, every pane behind its edge at its
  start, 0 gaps and 0 doubles, in all 14 cases; 0-4 new panes a screen outside the standing range, each in a crack,
  wedge or notch between standing panes.
- R3719 (new): red at 1db3f62 (share ratio 0.489, aspect 0.423 against 0.448), green now. R3703 now allows one pane out
  of range on the 1600x900 cut - a 630 px² chip in a notch between two standing and two new panes that no cut through
  its neighbours' corners or edges splits into two panes in range; the 1366x768 and 1440x900 cuts still hold none.
- Page (version 3 of the same address): 1366x768 and 1920x1080 side by side at 25/50/75 % in both themes, the 75 ms
  strips at both sizes, and the area and aspect table.

## Round 4 results (12.11.2026, 1db3f62)

- The real cut on the glass harness in Chromium, 7 sizes, GM and player: 0 overlapping pairs in each of 92 frames,
  0 frames with a pane drawn at another size, every pane wholly behind its edge (within 1 px) at its start, every point
  of a 6 px grid in exactly one pane; 2-4 generations, a pane's slide 242-400 ms. The end state is round 3's.
- R3718 (new): red at 8ab5124 (no `slidePlan` or `slideAt`; `drawTrialEntry` drew `growPolys`), green at 1db3f62.
  R3716 now reads the slide's frames (what is seen of each pane, its moved copy cut to its place), on the rings and on
  the three cuts. Tiers 0-1 whole: 1246 passed, 0 failed, 16 skipped. Scenarios 14, 74, 75 green.
- Headless recording at 1920x1080 caught 2-3 frames of the closing (software rendering, 51 panes, another test
  running), so the motion is shown as frames drawn on a held clock; smoothness at a table is LIVE-E61-01.

## Round 3 results (12.11.2026)

- The real cut on the glass harness in Chromium, 7 sizes (1280x720 to 2560x1440), GM and player: 0 overlapping pairs
  of panes in each of 92 frames (every 20 ms of the closing and the opening); every point of a 6 px grid in exactly
  one pane; new panes' median area 18,502-35,202 px² beside the standing panes' 19,192-30,618; 0-2 new panes a screen
  outside the standing panes' range (area, corners, angle, width, length for width), each one where the standing
  panes force it: a crack between two standing panes narrower than any pane (8-24 px), a wedge between two of their
  edges (tip 4-10 degrees), a notch at a corner, or a triangle at 1280, where the standing panes are all quads.
  `entryPieces` 125-395 ms once (two more paints of the curtain); not measured at a table (LIVE-E61-01).
- Lead width: the closed curtain is `curtainPaint`, the growing panes are stroked with `paintGlass`'s three strokes
  (1.2, 0.5, 0.7 px). Read from the code, not measured in pixels.
- R3703 and R3716 rewritten for round 3 (R3703 on three cuts the generator made, `E61_CUTS`, read off the harness;
  a ring of like panes was tried first and its range was too narrow to read anything). Red at 8937575 (no `fillHole`,
  no `growPolys`; glass.mjs does not load against round 2's file), green now.

## Round 2 results (12.11.2026, 8937575)

- The curtain on the harness's real cut, both roles, 1280x720 to 2560x1440 (7 sizes): 0 cells a front covers inside a
  standing pane, 0 cells off their own pane's distance, 0 left open at the reach; 69-79 % of the hole's cells have their
  foot inside an edge (the rest are round a corner). `entryPieces` 110-429 ms of main thread once, before the closing,
  headless on 4 cores (one field when the trial's cut is the Investigation's, as on every size read); a frame's paint
  2-4 ms. Not measured at a table (LIVE-E61-01).
- R3703 (rewritten), R3716 and R3717 red at 6049386 (glass-close.mjs absent; the cut-in's rows not animated one by one),
  green at 8937575. R3716's first reading skipped a cell nearer its edge than the field said and missed its own plant;
  fixed so every cell is held to its distance. The tests also found that at 1366x768 the last cells were never
  covered (the reach was taken from float64 distances, the cells kept float32), and the recording that the first frame,
  stamped before the start, eased backwards; both fixed.
- Tiers 0-1 whole, headless: 1245 passed, 0 failed, 16 skipped. Scenarios 14, 74, 75 (the ones reading glass.mjs and the
  stylesheet) green. `node audit/glass-sweep.mjs`: 2 themes x 2 roles x 25 sizes, 46 with glass, 0 failing. Quick gate
  green.

## Added 12.11.2026 (the coordinator's list for 1.2.108)

- Glossary (docs/glossary.json, open entries, forbid nothing): Full-screen sequences / Sekwencje na cały ekran,
  end-of-day board / plansza końca dnia, start-of-day board / plansza początku dnia, the school's mood / nastrój szkoły,
  morning line / zdanie na poranek.
- Player handbook: "Full-screen moments" / "Chwile na cały ekran" (EN, PL).
- World secrets: the `sequences` setting holds a boolean alone, so it has no row of its own; world-secrets.mjs's header
  now names it among the settings that hold nothing the rule keeps out (`everySetting` still reads it). The day boards'
  mood has its row (docs/dev/e94/STATUS.md).
- The setting's hint names everything the switch stops (docs/dev/e62/STATUS.md).
- AUDIT 9.2: LIVE-E61-01 updated for round 5 (1920x1080's proportions); LIVE-E61-06 added (the floors' table check).
- Not built: C6, the four-client scenario (a new layered part of scenario 63 with gm2, three players, reloads during the
  entry and the cut-in): it did not fit this round's time. C7 (the floors): waits on LIVE-E61-06.

## Defaults taken, owner to confirm

- Q-E61-1: a client that loads or reloads after the event plays nothing (the bus's `heard` is read at ready; a card in the log is not created again).
- Q-E61-2: the table's switch off: the sounds still play. Esc: a sound already started plays out.
- Q-E61-3: two sentenced: two portraits side by side, one stamp each.
- Q-E61-4: the Final Trial's verdict gets no cut-in in E61.
- Q-E61-5: the closed curtain opens on its fixed time, never waiting for the hall's canvas.
- Q-E61-6: the floors' cross-section (C7a-C7d) starts with a table check (LIVE-E61-06) that no headless run can make; not started on this line (see Blockers).
- Q-E61-7: the old `verdict` sound row is relabelled "The vote's result"; its key stays.
- Q-E61-9: everyone connected sees both sequences, the GM and the dead included.
- Q-E61-10: under Monokuma Legacy the entry is two lids and the title card.
- Q-E61-12 (new): the stamp and the majority's mark are bone in every variant under Stained Glass. The mockup drew a right verdict's stamp in Hope's gold; since E48 K1 gold means Hope and nothing else (the CSS lint's meaning reads fail it), so the variant is told by its word alone.
- Q-E61-13: settled by the owner's review of round 1 (12.11): the affine closed plan, its seams and its ink are gone; the curtain closes by its edges (C3, round 2).
- The frame times are read in sequence.mjs (`SEQUENCE_TIMES`), not as motion.css tokens: motion.css zeroes its tokens under reduced motion, and the still frame must still stand its 1.5 s / 3 s there.

## Blockers and things not measured

- C7 (floors' cross-section): needs LIVE-E61-06 at a table (what Isometric Perspective and v14 draw with two floors) before any code; the plan's own default says the switcher stays and C7 stops with a note if that check fails. Not started.
- The microphone (A9): the voice tile sits under the host for the sequence's span (3.4 s entry, 3.7 s cut-in); its keybinding still works. Not measured at a table (LIVE-E61-08).
- Cost: `entryPieces` took 134-186 ms of main thread on the harness page (headless, software). Frames at a table: LIVE-E61-01.
- Headless Chromium rasterises in software; the review frames are the harness page with the module's own CSS, not Foundry's.
