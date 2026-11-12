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
| C3 | E61-A under Stained Glass, rebuilt in round 2 on the owner's review (12.11): the panes stand where they are and the hole they leave closes by their fronts - every edge facing the hole moves along its own normal, at one speed, and each point of the hole is its nearest pane's, so no two panes ever cover one point and a pane takes the room its neighbour's front has not reached; each front carries its pane's glass mirrored across its edge. The panes' colour goes from the Investigation's blue to the trial's pink in eight batches, outer panes first; closed at 900 ms, the trial's cut stands under the pulse with the title (impact sound at 1400 ms), and opens by the same fronts in reverse from 2500 to 3400. Round 1's affine closed plan (`closedPoint`, `closedPlan`) is gone | glass-close.mjs (new: `holeOf`, `holeField`, `paintClosing`, `fieldReading`), glass.mjs (`entryPieces`), sequence.mjs (`drawTrialEntry`), styles |
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
