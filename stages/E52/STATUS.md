# E52 - status

Base: bc158f09 (line B's branch = main 12ff1b62 + E20). Spec: STAGE.md (the owner's yes 30.10.2026; Q-1..Q-8 on their defaults; D24/D25's text not given - the spec's reading).

## Commits
| C | sha | QUICK |
| --- | --- | --- |
| C1 | e785e582 | QUICK GREEN at bc158f09+edits: lint/check/gate ok; prose ok; t01 ok; own(3) ok; scen 76 ok; scen 74 ok (logs /c/Users/chrob/quick-runs/bc158f09-1205); R1537 (t0, E52-03), R1538, R1539 (t1, E52-01, -02) red first on assertions; with R130, R217, R556: 7 passed, 0 failed |

## Open
- C1 note: R1537's reader also found `ui.sidebar.toggleExpanded`/`changeTab` (foundry-windows.mjs) - a row added; hook rows added now with presence-only probes
- C1 note, outside the file list: projects-ui.mjs (tray menu mark `Symbol.for`), audit/harness/client-entry.mjs (`DhCountdowns` a class with the menu builder), requirements.mjs (the newer-system warning names a row only on `present === false`), its two lines "changes or relies on" EN/PL
- C1 gap: hook rows have no "fired" mark yet - C3 (E52-09)
- C1 gap: R1537 reads only literal hook names and misses an override reached through a parameter declared elsewhere - the review
- C1 gap: "door, light and sound icons keep Foundry's colour" is the audit's reading (S01-50), not measured on a canvas - C7 LIVE
