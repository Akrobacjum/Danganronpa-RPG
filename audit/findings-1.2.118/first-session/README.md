# Eleven reader files of the first auditor session, finished after 775a4ee1

The first session's readers went on writing after the branch head the second session started from (775a4ee1), until
the account's limit refused the rest at about 18:52-19:15 UTC on 20.11.2026. These eleven files are complete (each
reader replied with its summary; each file parses; none holds a banned word, a long dash or a model's name). They stand
in this folder, not beside the others, because the second session regrouped the remaining work and some of its file
names would be the same with other contents. Read them by what they hold, not by their numbers:

| File | What it holds | Count |
| --- | --- | --- |
| `old-1.2.42-ui.json` | every finding of `audit/findings-1.2.42/ui.md` and its live checks, settled | 22 items of 22 |
| `old-1.1.88-1.2.13-A.json` | the four findings of AUDIT-1.1.88 and section A of AUDIT-1.2.13 (A1 to A26) | 30 items of 30 |
| `live-items-07.json` | AUDIT 9.2 items 219 to 252 (lines 1093-1126 of the file as it was at 282e8f10) | 34 |
| `live-items-08.json` | AUDIT 9.2 items 253 to 273 (lines 1127-1147) | 21 |
| `live-items-09.json` | AUDIT 9.2 items 274 to 292 (lines 1148-1166) | 19 |
| `stages-20.json` | E61, E62, E92, E94 (the 1.2.109 train) | grades 8, 7, 8, 8 |
| `stages-21.json` | E64, E72, E91 (1.2.110), E93, E69, E74 (1.2.111) | grades 8, 9, 9, 8, 8, 6 |
| `controls-05-murder-body-death.json` | murder-rules, murder-ui, action-murder, body, death, body-tile, events, anonymity: 24 surfaces, 77 controls | 10 findings |
| `controls-06-gm-panel-campaign.json` | gm-panel, gm-campaign, gm-students, gm-team-dialog, chapter, rules, explain, handbooks, diagnostics, enforced, requirements, assignments: 22 surfaces, 120 controls | 7 findings |
| `domain-case-e-trial-scene-vote.json` | trial-scene, trial-zones, trial-zones-ui, zone-geometry, zone-machine, vote, verdict, anonymity, mask-gm, mastermind: 8 536 lines read whole | 1 blocker, 5 minor, 1 nit |
| `domain-case-f-planner-stores.json` | case-copy, case-hints, case-layout, case-map, case-realize, case-schema, case-summary, case-trial, case-view, gm-store, gm-stores, world-secrets, pre-session-note: 8 522 lines read whole | 2 major, 5 minor, 2 nit |

These two controls files have no live-refresh block (the first session ran that as a pass of its own, not started).
Nothing in them has been through the second reader (section 11.2, U1). Three of their findings to refute first, each
"read", none run: a killer behind a "?" is still named in every player's Actors list (domain-case-e, blocker);
two counters that refute each other send the case map's layout into endless recursion (domain-case-f, major);
every read of the case's server copy runs Restore's preview, which clones a whole store once a row (domain-case-f, major).

## What the first session's base run measured, and what stopped it

`npm test` on b5a29e73, started 17:18 UTC beside ten readers on the same four cores (load about 3.7):

- lint 416 files 0 problems, check 25 parts green, gate self-test 37/37;
- inside 01-runtests, tiers 0-1 twice (parts A and B): 1776 passed, 0 failed, 16 skipped each time;
- 01-runtests itself: RED, "timed out after 6480 s", no results file - tier 2 has no verdict from this run;
- twelve scenarios green: 00, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21 (21 with its one expected red);
- the run was stopped at the two-hour limit of its background task, inside 30-security: 41 scenarios have no verdict.

Alone, before the readers started, tiers 0-1 took 549.2 s (`node run-tests.mjs --tier 1`: 1791 ran, 1776 passed,
0 failed, 16 skipped, 0 red) and `npm run quick` 108.6 s. A base run started beside ten readers is likely to end the
same way: the suite's eight shards one at a time (`DRPG_SUITE_SHARD=i/8 node run-all.mjs suite`, then
`node suite-merge.mjs <dir>`) and the scenarios one at a time are the road that fits a loaded machine.
