# E52 - status

Base: bc158f09 (line B's branch = main 12ff1b62 + E20). Spec: STAGE.md (the owner's yes 30.10.2026; Q-1..Q-8 on their defaults; D24/D25's text not given - the spec's reading).

## Commits
| C | sha | QUICK |
| --- | --- | --- |
| C1 | e785e582 | QUICK GREEN at bc158f09+edits: lint/check/gate ok; prose ok; t01 ok; own(3) ok; scen 76 ok; scen 74 ok (logs /c/Users/chrob/quick-runs/bc158f09-1205); R1537 (t0, E52-03), R1538, R1539 (t1, E52-01, -02) red first on assertions; with R130, R217, R556: 7 passed, 0 failed |
| C2 (MARKED) | 4022cd83 | QUICK GREEN at e785e582+edits: lint/check/gate ok; prose ok; t01 ok; own(10) ok; scen 30 ok; scen 83 ok (logs /c/Users/chrob/quick-runs/e785e582-1233); mutants 6/6 killed (m1, m2, m6 R1542; m3 R1540; m4, m5 R1543); R1540-R1544 red first on assertions, E52-T1 red (no runContract); after: 11 passed, 0 failed |
| C3 | 1de03286 | QUICK GREEN at 4022cd83+edits: lint/check/gate ok; prose ok; t01 ok; own(5) ok; scen 75 ok (logs /c/Users/chrob/quick-runs/4022cd83-207); R1545-R1548 (t1, E52-09..13), R1549 (t0, anchors) red first on assertions; with R38, R509, R534, R591, R807, R808, R1537, R1538, R1541, R539: 16 passed, 0 failed |

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
- C3 gap: Pre-season's "not known to work" line lists about two dozen places on every world (table-only checks, hooks not seen firing yet) - C4 / the review
- C3 gap: sheet anchors are read after sheet.mjs's own render listener; not measured on a real sheet, nor that every part of sheet.mjs skips a missing anchor - C7 LIVE / the review / E66
- C3 gap: the table rows point to B-E52-2, B-E52-3; AUDIT 9.2 items come in C7
- C3 gap: the kit's `stripComments` blanks real code in sheet.mjs's `tidySidebar`, so R1549 reads with `blankComments` - the review; `icons/fvtt.png` no row (no code uses it); the A/V default-settings names are v13's from memory (unknown where a Foundry lacks them)
- C3 wall: 3.8 h (13750 s) for 326k tokens - the longest commit so far
