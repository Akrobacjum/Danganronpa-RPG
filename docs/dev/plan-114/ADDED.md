# 1.2.114: the work outside the stages, put into stages

**Moved to 1.2.115 (later on 14.11.2026).** The owner made 1.2.114 a release of its own for the Class Trial changes (E110: "Niech 1.2.114 bedzie etapem na zmiany w class trial"; "Foundry, audyt i cala reszte przesuwamy na 1.2.115"). Everything below, written for 1.2.114, now holds for 1.2.115: the nine stages E56, E109, E59, E39, E40, E43, E53, E58 and E83 are planned for 1.2.115, the ship command for that train is unchanged, and the local gate runs on 1.2.115's release commit. The ship command for 1.2.114 is `node tools/stages.mjs ship E110`.

Written 14.11.2026 by the coordinator, on the owner's instruction of the same day ("Dodaj rzeczy spoza etapow do
etapow 1.2.114"). Before it, four pieces of 1.2.114's work belonged to no stage: the owner's answers to the review
page, the performance baseline, the open live checks and the local gate's parts not run. A piece with no stage has
no row that `ship` closes, so nothing held it to a release. Each now has one.

The counts below were read on the 1.2.113 assembly tree (7819afbf, 14.11.2026), not on 1.2.114's.

| Work | Stage | What is there now | Done when |
| --- | --- | --- | --- |
| The owner's answers to the review page DRPG-Q113 (132 questions in 8 groups, from every 1.2.113 line) | **E109**, new row, `with` E56 | Not answered yet. The page is a private web page, and the answers are read from its `answers` collection | Every "Change" is built or written down as not built, with the reason. Every "Hold" is written down with the owner's note. Every approved default is checked against the code. Needs no Foundry |
| The performance baseline, LIVE-E33-05 | **E53**, which already holds the performance budget | `audit/perf-baseline.json` `status`: `not-measured` | `perf()` and `fps()` run at a table on v14, and their numbers are written into the baseline by its method |
| The open live checks, `audit/AUDIT-1.2.42.md` 9.2 | **E58**, which already holds the final check in the 30099 sandbox | 532 distinct `LIVE-...` ids named from line 699 to the end of the file (`grep -oE` over that range, `sort -u`). Not each one was read to see whether it is still open, so 532 is the size of the list and not a count of open checks | Every id is checked in the sandbox, closed with what it measured, or carried into the 1.3.0 notes as not checked at a table (E58's own rule) |
| The local gate's parts not run, `audit/gate/local-gate.json` | **E58** | 8 parts, each `not-run`, reason `no-server` | Each part has run on a v14 sandbox, or is written as not run with the real error |

## What did not become a stage, and why

**The local gate on the release commit.** `npm run gate:local` binds its record to a commit
(`audit/gate/README.md`). So the run that counts is the one on 1.2.114's release commit, after every stage including
E83. A stage that ships before that commit cannot hold the run. It stays a release step (the release rules, step by step).
E58's runs are rehearsals: they are there to find before the release commit what its run would find.

## The ledger

`tools/stages.json`: E109 sits between E56 and E59, and E59's `with` now names E109. The 1.2.114 train is
E56, E109, E59, E39, E40, E43, E53, E58, E83. `ship` follows a `with` one row only: `ship E56` alone is refused at
E59. The command that writes the train is `node tools/stages.mjs ship E56 E109 E59 E39 E40 E43 E53 E58 E83`. Tried on
this tree with module.json set to 1.2.114 for the try and then put back: 9 rows written, one date. `node tools/stages.mjs
check` passes on this tree: 100 rows, 83 shipped.
