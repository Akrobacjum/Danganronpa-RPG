# E52 - status

Base: bc158f09 (line B's branch = main 12ff1b62 + E20). Spec: STAGE.md (the owner's yes 30.10.2026; Q-1..Q-8 on their defaults; D24/D25's text not given - the spec's reading).

## Commits
| C | sha | QUICK |
| --- | --- | --- |
| C1 | e785e582 | QUICK GREEN at bc158f09+edits: lint/check/gate ok; prose ok; t01 ok; own(3) ok; scen 76 ok; scen 74 ok (logs /c/Users/chrob/quick-runs/bc158f09-1205); R1537 (t0, E52-03), R1538, R1539 (t1, E52-01, -02) red first on assertions; with R130, R217, R556: 7 passed, 0 failed |
| C2 (MARKED) | 4022cd83 | QUICK GREEN at e785e582+edits: lint/check/gate ok; prose ok; t01 ok; own(10) ok; scen 30 ok; scen 83 ok (logs /c/Users/chrob/quick-runs/e785e582-1233); mutants 6/6 killed (m1, m2, m6 R1542; m3 R1540; m4, m5 R1543); R1540-R1544 red first on assertions, E52-T1 red (no runContract); after: 11 passed, 0 failed |
| C3 | 1de03286 | QUICK GREEN at 4022cd83+edits: lint/check/gate ok; prose ok; t01 ok; own(5) ok; scen 75 ok (logs /c/Users/chrob/quick-runs/4022cd83-207); R1545-R1548 (t1, E52-09..13), R1549 (t0, anchors) red first on assertions; with R38, R509, R534, R591, R807, R808, R1537, R1538, R1541, R539: 16 passed, 0 failed |
| C3 fix | 2c635111, 5d16b968 | CI on 1de03286 red in suite 1/8 on R1546: scenario 01 runs tiers 0-1 three times in one page and enforced.mjs says a missing entry once per load per row id; 2c635111 (own key) still red, 5d16b968 (own id stamp) CI green; a temporary twice-in-one-page run: red on 2c635111, green on 5d16b968 |
| C4 | d8e8f68b | QUICK GREEN at 5d16b968+edits: lint/check/gate ok; prose ok; t01 ok; own(12) ok; scen 66 ok (logs /c/Users/chrob/quick-runs/5d16b968-1556); R1550-R1553 (t1), E52-T2 (t2) red first on assertions (R1553 expected [20,0], measured [20,20]); with R1541: 10 passed, 0 failed |
| C5 | 4f9edb60 | QUICK GREEN at d8e8f68b+edits: lint/check/gate ok; prose ok; t01 ok; own(6) ok; scen 13 ok (logs /c/Users/chrob/quick-runs/d8e8f68b-2270); R1554-R1556 (t1, E52-17, -18) red first on assertions; with "nothing is repainting the page": 5 passed, 0 failed |
| C6 | c46612a7 | QUICK GREEN at 4f9edb60+edits: lint/check/gate ok; prose ok; t01 ok; own(9) ok; scen 40 ok; scen 72 ok (logs /c/Users/chrob/quick-runs/4f9edb60-3334); R1557, R1558, R1561 (t1), R1559, R1560 (t0) red first on assertions (5 failed); with R220: 7 passed, 0 failed; R1560 also checks a planted surface |

## Open
- C1 note: R1537's reader also found `ui.sidebar.toggleExpanded`/`changeTab` (foundry-windows.mjs) - a row added; hook rows added now with presence-only probes
- C1 note, outside the file list: projects-ui.mjs (tray menu mark `Symbol.for`), audit/harness/client-entry.mjs (`DhCountdowns` a class with the menu builder), requirements.mjs (the newer-system warning names a row only on `present === false`), its two lines "changes or relies on" EN/PL
- C1 gap: hook rows have no "fired" mark yet - C3 (E52-09)
- C1 gap: R1537 reads only literal hook names and misses an override reached through a parameter declared elsewhere - the review
- C1 gap: "door, light and sound icons keep Foundry's colour" is the audit's reading (S01-50), not measured on a canvas - C7 LIVE
- C2 note: on the test world no row fails and 9 are unknown (8 hook rows; Isometric - the harness's token class is `Object`)
- C2 note: C1's R1537-R1539 relabelled from stage E67 to E52 in the registry
- C2 tools: mut.sh's `python3 -I` reads fog.mjs as cp1250 on this machine; m4 applied only with `-X utf8` (a wrapper in scratch) - the orchestrator (tools)
- C2 gap: the notice and Pre-season lines put each row's English fallback text inside a translated sentence - C7 / the review
- C2 gap: a real Foundry (LIVE-E52-01), doors and floors on a real canvas not measured - C7
- C3 behaviour: the GM's microphone block and the trial's block write nothing when Foundry has no `BROADCAST_AUDIO` permission; the GM is told why (`gmNoBlock` EN/PL). The harness registers `core.rtcClientSettings` and `BROADCAST_AUDIO`; the LiveKit separate-window row is checked only while voice is on (registering it at start broke R807, R808)
- C3 gap (closed in C4): Pre-season's unchecked places are one counted line with the list folded under it; failed rows stay on their own lines
- C3 gap: sheet anchors are read after sheet.mjs's own render listener; not measured on a real sheet, nor that every part of sheet.mjs skips a missing anchor - C7 LIVE / the review / E66
- C3 gap: the table rows point to B-E52-2, B-E52-3; AUDIT 9.2 items come in C7
- C3 gap: the kit's `stripComments` blanks real code in sheet.mjs's `tidySidebar`, so R1549 reads with `blankComments` - the review; `icons/fvtt.png` no row (no code uses it); the A/V default-settings names are v13's from memory (unknown where a Foundry lacks them)
- C3 wall: 3.8 h (13750 s) for 326k tokens - the longest commit so far
- C3 lesson: a test whose state lives per page load (a once-per-load message) fails when scenario 01 runs the tiers again in the same page - give it its own id
- C4 gap: the window, Copy report into a real clipboard and Show again not measured on a real Foundry (LIVE-E52-04) - C7
- C4 gap: R1551 stands a player in on the GM's client, so the fog part's read of the "discovery" store is left out; a real player's report not measured - the review
- C4 gap: clearing `recommendsSilenced` assumes v14 keeps client settings in localStorage as "<module>.<key>" - not measured
- C4 gap: the report block and the folded line in both themes at a table's size not measured; outside the file list: fog.mjs (`diagnoseFog` takes `gm`), music.mjs (`diagnoseMusic` takes `toChat`)
- C5 gap: theme fonts, the click trace's bubble phase and the 5-frame warm-up not measured in a real browser; the warm-up length is a choice - C7 LIVE
- C5 correction: 4f9edb60's message says the harness has "no document.fonts, no canvas"; it has a `document.fonts` stand-in holding no faces, and canvas was not checked - the review
- C5 gap: the tier-1 test "nothing is repainting the page" still fails when an unnamed big inline sheet is on the page - the review
- C6 for E66: tools/api-surface.json's `$comment` says how a rename is recorded - the new name in `keys`, the old one stays on `game.drpg` under `aliases` with its target, the stage it came in and the release it is kept until; at that release it moves to `removed`
- C6 question for the owner (default: no end set, the aliases stay): the old aliases (E70's names; exportLedger, importLedger, isSilenced, musicDialog, currentRoom) have no release for removal
- C6 gap: the two new actor warnings not seen on a real Foundry (who sees them, how often a looping macro repeats one) - C7 LIVE
- C6 gap: R1560 leaves `suiteRolling` out by name (the runner adds it to `game.drpg` during a run) - the review
- C6 note, outside the file list: tests-kit.mjs (`env.tools`: an installed module has no tools/), call-world.mjs (the comments were there, not in call-effects.mjs), eclipse.mjs (a comment wrongly said a Morning Eclipse places freely), module.mjs (the "1.2.0 migration" label)
