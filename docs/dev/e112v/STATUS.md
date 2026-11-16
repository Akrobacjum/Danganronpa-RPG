# E112v - status (16.11.2026)

Line claude/e112v-118 from a1d294ef. The design and the survey: DESIGN.md beside this file.

| Commit | What |
| --- | --- |
| af52c6eb | DESIGN.md, before any code |
| dd9a56ed | the veil without Foundry's `hidden` (mask-gm.mjs, visibility.mjs, utils.mjs), R7700-R7705, tier 2 and scenario 21 rewritten, AUDIT 9.2 items 600-601 |
| 6989ed8f | known leak `foundry-veiled-token-actor` narrowed to the flag (known-leaks.json, scenario 21's check, docs/dev/e43/README-CHAPTER.md) |
| 9e9a224c | a token this browser's module hides gives it no sight (visibility.mjs `installSightRule`, `givesNoSight`; patches.mjs `token-sight`; R7706, R7707), and scenario 21's check of a GM's hidden on a veiled token (M4) |

## The acceptance rows

| Id | Promise | How it is checked | Status |
| --- | --- | --- | --- |
| V1 | the veil writes no `hidden` on a token document | R7700; tier 2 "E112 - the opening veils ..." (each token's own `hidden` untouched, the lights' writes the flag alone); scenario 21 'road' (not hidden on any browser) | ANSWERED |
| V2 | while veiled, the killer's own token is a vision source for its owner | R7701 on a stand-in of the one input the veil touched (L1's reading: hidden is no source); a real canvas is LIVE-E112V-01 | ANSWERED on the stand-in; LIVE |
| V3 | a victim's, a bystander's and a Spectator's browser do not draw it; the killer's, the killers' side's and GMs' do | R7702 (verdicts, the Spectator's red first); scenario 21 'road' (drawn on p3 alone of the three players, on the harness's model of Foundry's refresh) | ANSWERED headless; LIVE-E112V-01 (b), (c) |
| V4 | the ruler follows the same rule | R7703 (the killers' side red first); scenario 21 'road' (`rulerShownTo` true on p3 alone) | ANSWERED headless |
| V5 | the veil's flag-only write asks the verdicts again | R7704 | ANSWERED; scenario 21 does not measure it (M3 survived there: the incident's write runs a whole pass at the open) |
| V6 | a `hidden` on a veiled token is a GM's | R7705; `show()` keeps it: scenario 21 'road', a GM's hidden kept on the owner's canvas (on the harness's model; on v14 a hidden token is drawn for its owner anyway, L1) | ANSWERED |
| V7 | a world updated mid-opening from 1.2.116-1.2.117 loses the veil's `hidden` | tier 2 "E112v - a veil written by 1.2.116 ..." | ANSWERED |
| V8 | the known leak closes | known-leaks.json, scenario 21 | NOT AS WRITTEN: narrowed to the flag (DESIGN.md section 3; Q1 to the coordinator) |
| V9 | a token the module hides gives this browser no sight (the coordinator's answer to Q2) - the veiled killer's, and another room's with the room rule on - and the killer keeps their own | R7706 (the predicate, equal to `tokenShownTo`'s "hide"), R7707 (the wrapper on a stand-in class; the killer's own veiled token a source), R7701; the real class and canvas LIVE-E112V-01 (d) | ANSWERED headless; LIVE. The characters' default ownership: OPEN, the owner's |
| V10 | Isometric's silhouettes under the veil | R7407 unchanged (matches `visible = false`, which the module writes); LIVE-E112V-02 | LIVE |

## Mutants (on a copy of the tree, the definitions outside the repository)

| Mutant | Run | Result |
| --- | --- | --- |
| M1 `veilPatch` writes `hidden` again | R7700, R7701 | KILLED (both) |
| M2 the Spectator's line above the veil | R7702 | KILLED |
| M3 `movePass` ignores the flag | scenario 21 | SURVIVED (the incident write's own pass) |
| M3b the same | R7704 | KILLED |
| M4 `show()` overrules a GM's `hidden` on a veiled token | R7700-R7705, R7405, both veil tier-2 tests | SURVIVED at dd9a56ed (no reader) |
| M4s the same, after 9e9a224c | scenario 21 | KILLED (the GM's-hidden check) |
| M10 `givesNoSight` never hides | R7706 | KILLED |
| M11 the wrap ignores the rule | R7707 | KILLED |
| M12 the wrap hides every token | R7707 | KILLED |
| M5 `hiddenByGm` keeps the flag's exception | R7705 | KILLED |
| M6 the settle converts no held 1.2.116 row | tier 2 E112v | KILLED |
| M7 a road (b) lift writes `hidden` | tier 2 E112 veil | KILLED |
| M8 a 1.2.116 lift forgets its kept `hidden` | tier 2 E112v | KILLED |
| M9 the veil branch shows every stranger | scenario 21 | KILLED |

## Runs

At 9e9a224c, the suite in 8 shards (`DRPG_SUITE_SHARD=i/8 node run-all.mjs suite`, one after another on 4 cores): shard 1
green (22/22; suite 1763 passed, 0 failed, 16 skipped, 2312 s), shards 2-5 green (227/0/1, 227/0/1, 226/0/2, 225/0/3).
The container restarted during shard 6; shards 6-8 were run again and `suite-merge.mjs` follows: its reading is written
here when it has run.
