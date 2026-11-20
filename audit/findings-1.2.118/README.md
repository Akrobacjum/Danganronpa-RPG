# Raw findings of the repeated audit (1.2.118)

Written by the readers of the audit of main at b5a29e73 (1.2.118), 20.11.2026, as `audit/findings-1.2.42/` was for
the audit of 1.2.42. English, one JSON file a reader. The report that reads them is `audit/AUDIT-1.2.42.md`, part I
(sections 10-18, Polish); its section 11 is the method and the vocabulary (statuses, severities, confidence, the five
classes of evidence).

A file here is a reading, not a verdict: every finding in the report went through a second reader whose task was to
refute it (section 11.2, U1), and what did not survive is marked so in the report, not removed here.

| Files | What |
| --- | --- |
| `old-*.json` | the items of the three earlier audits (1.1.88, 1.2.13, 1.2.42) settled against today's code |
| `live-readings-*.json` | every recorded reading on a real Foundry or at a real table, taken from the papers |
| `live-items-NN.json` | the live-check list (AUDIT 9.2), item by item |
| `domain-*.json` | the static re-read of every non-test script, by group of files |
| `controls-*.json` | the controls pass: label, handler, effect, audience |
| `probe-*.json` | the evidence of the harness probes 42 and 43, as run for this audit |

No reader ran the harness: one base run was made centrally, and the probes ran one at a time.

## Stan wznowienia (resume state, 20.11.2026, ~19:30Z)

The first auditor session stopped at ~18:52Z on 20.11.2026 (its usage limit). This audit is continued by a second
session from branch head `775a4ee1`. Read from the branch, not from memory:

**Done (on the branch):**

| Lane (section 11.5) | Planned readers | Files on the branch | Coverage |
| --- | ---: | --- | --- |
| K1 old items | 14 | `old-1.2.42-{case,comms,core,despair,items,map,rolls,text}` (8) | 8 of the 9 domains of `findings-1.2.42/`; each file's `items` equals its `count_expected` |
| K1 the 9.2 list | 22 | `live-readings-e58`, `live-readings-other`, `live-items-01..06` (8) | 9.2 items 15-218 (204 of 577, lines 831-1092), each chunk 34/34 |
| K3 stages | 26 | `stages-22..25` (4) | the 16 newest stages, E108-E118 (shipped[82:98] of `tools/stages.json`) |
| K2 domains | 27 | `domain-case-a..d` (4) | 27 files, 45 090 lines of 226 282 (258 non-test scripts) |
| K4 controls | 15 | `controls-01..04` (4) | trial console, trial zones / verdict / Mastermind, investigation / planner, traces / Observe: 77 surfaces, 342 controls |
| probes | - | `audit/harness/probes/42-press-controls.mjs`, `43-stale-windows.mjs` (code only) | not run for the record: no `probe-*.json` here |
| report | - | `AUDIT-1.2.42.md`: header, reading guide, section 11 | sections 10 and 12-18 not written; no "Stan 1.2.118" notes in part II |

A structural check of the 28 files (each file parses; `items` match `count_expected`; the stage files hold
every stage of their group; the control files' `counts` add up) found nothing to redo. Their content is checked
in the adversarial pass (K8) like every other finding.

**Lost when the first session stopped** (seen in its event log, not recoverable from here): the readers in flight
at 18:52-18:54Z (`live-items-10` to `-20`, `domain-case-g-death-chapter`, and whatever else had not reported) and
the base `npm test` started as a background task in that container. `live-items-07..09` are not on the branch
either. All of them are run again.

**What remains, and its size** (readers follow `BRIEF.md`; at most about 10 at once):

| Lane | Readers | Scope |
| --- | ---: | --- |
| K0 base run | - | one `npm test` on `b5a29e73` (started 19:20Z), then probes 42 and 43 one at a time -> `base-run.json`, `probe-42.json`, `probe-43.json` |
| K1 old items | 6 | `old-1.2.42-ui`; `old-1.1.88`; `old-1.2.13-a` (A, B); `old-1.2.13-b` (C-H and the status part); `old-1.2.42-tasks` (sections 2, 5, 6, 7, 9, 9.1, 9.1a, 9.3-9.3d); the four content tables 3.1-3.4 go to `domain-text-b-lang` |
| K1 the 9.2 list | 12 | `live-items-07..17` (items 219-663, 34 a reader, the last 33); `live-items-18` (the 18 B- items, the 7 known gaps, 9.3's own 18-25, the doubled numbers 475-478, section 7) |
| K3 stages | 22 | `stages-01..21` (the 82 earlier shipped stages, four a reader in `tools/stages.json` order, the last two); `stages-26` (the 7 unshipped: E39 E40 E43 E53 E58 E83 E26) |
| K2/K6 domains | 26 | `domain-case-e..g`, `domain-comm-a..d`, `domain-core-a..e`, `domain-desp-a`, `domain-item-a..c`, `domain-map-a..c`, `domain-roll-a..b`, `domain-ui-a..c`, `domain-text-a-config`, `domain-text-b-lang` (the 25 code readers 4 860-9 816 lines each; every non-test script assigned exactly once, checked by script) |
| K4/K5 controls and refresh | 10 | `controls-05..13` (GM panel and stores; items and the sheet; messages, calls and notices; rolls and actions; HUD and overlays; setup and configuration; map and rooms; projects; the case, death and chapter), each with the live-refresh block per surface; `refresh-01-04` for the surfaces of controls 01-04 |
| K8 adversarial check | about 20 | one refuter per batch of findings (every finding `minor` and above, every old item moved to `fixed`), never the reader that found it |
| K9-K10 report | - | sections 10, 12-18 in Polish, the "Stan 1.2.118" notes in part II, the re-check against 1.2.119 |

One change to the plan of the first session, and why: the live-refresh pass (K5) is folded into the controls
readers, which read the same windows' code; a separate pass would read every window twice. Only the surfaces
already read by controls 01-04 get a refresh-only reader.

**Update, 19:40Z.** The first session pushed eleven more finished files (`first-session/`, merge 0278ef72, read
here): `old-1.2.42-ui`, `old-1.1.88-1.2.13-A`, `live-items-07..09` (9.2 items 219-292), `stages-20` (E61 E62 E92
E94), `stages-21` (E64 E72 E91 E93 E69 E74), two controls files without a refresh block, and two domain files
(trial-scene, zones, vote, verdict, anonymity, mask, Mastermind; the case's planner files, gm-store, gm-stores,
world-secrets, pre-session note). The plan above shrinks by what they hold: no new readers for 1.2.42 UI, 1.1.88's
four findings, 1.2.13 A, 9.2 items 219-292, stages E61-E94 and the two domain groups; their leftovers (assignments,
monokuma, the three spectator files) join `domain-case-g-death-chapter`. The remaining 9.2 items 293-663 are read
in chunks named by their first number (`live-items-293`, `-327`, ... `-561`), so no name repeats one of the first
session's. The running controls-05, -10 and -13 overlap the first session's two controls files in part; they are
left running because they add the refresh block, and the overlap is a second reading for the adversarial pass.
57 readers remain after the ten running.

The base run: the first session's `npm test` beside ten readers timed out in 01-runtests (its README). Mine,
started 19:20Z, gave lint (418 files, 0 problems), check (25 parts, all green) and the gate's self-test (37/37) and
was stopped in the suite; the suite now runs as CI runs it, in eight shards one at a time, then `suite-merge.mjs`,
then the `ci` scenarios one at a time, then probes 42 and 43.

## Stan końcowy (20.11.2026, ~22:40Z)

All the planned readers have written their files and every file has been through its refuter (`verify-*.json`,
`verify-first-session/`). The report is `audit/AUDIT-1.2.42.md` part I, sections 10-18 (14959453 and after). Beside
the reader files: `BRIEF.md` (the readers' brief), `DECISIONS.md` (the owner's calls D-A1..D-A4), `ROUTING.md` (what
the coordinator says is already being fixed for 1.2.119), `lines-119.json` (the audit's own reading of the 1.2.119
diffs), `base-run.json` (the base run), `INDEX.json` (each report ID -> its reader file, its own id, severity and
verdict), `L1-HANDOFF.md` (523 table checks for line L1, by priority), `verify-mask-urgent.json` and
`verify-urgent-2.json` (the identity findings checked first).
