# E111 for 1.2.115 - the case's copy on the server, and Clear the plan: status

Line: `claude/e111-115`. Kept as the work goes, so a restart loses nothing. Every number says where and how it was
measured; what was not measured says so.

## History of the line

| Commit | What |
| --- | --- |
| e1afdd84, 6116f17d | the first design: an encrypted copy in a world setting, under a GM passphrase (pushed) |
| 9daba1a2 | the 1.2.115 assembly merged in (4fb0667a) |
| 18df17c4 | the passphrase copy taken out whole: the owner, through the coordinator, 14.11.2026: "Bez hasel prosze - niech to bedzie dostepne dla kont gmow po prostu" |
| 08eb5c3f | the copy as a file on the server (this design) |
| 17f112c2 | Clear the plan (the owner: "Brakuje mi tez w planerze zagadki opcji zresetowania zawartosci/wyczyszczenia recznie") |
| 36868715 | a quiet read that takes nothing does nothing; no copy while the suite holds the stores (found by scenario 61 B2, B3) |

## The server copy: what was built

| Item of the coordinator's design | State | Where | Answered by |
| --- | --- | --- | --- |
| 1. a file on the server, FilePicker upload into the world's folder, 128-bit name, overwritten | done | case-copy.mjs `writeServerCopy`, `newCopyName`, `copyFolder` | R7347; 34 A1, C2 |
| 2. the name stored nowhere a player reads; GMs find it by listing (FILES_BROWSE) | done | case-copy.mjs `listCopies` (the names stay in this GM's memory) | R7347; 34 A2, A3 |
| 3. depends on enforced.mjs `playerFiles`: switch off, or Player/Trusted/an account with FILES_BROWSE or FILES_UPLOAD, writes nothing and tells the GMs; the health check says it | done | case-copy.mjs `filesRefusal`, `filesPrivate`, `tellRefused` | R7345; 34 B1, B2 |
| 4. primary only, debounced, never unhydrated, read before write; several files read and merged, the newest written on | done | `copyRefusal`, `scheduleCopy` (15 s / 60 s), `writeServerCopy` lists and merges first, then asks the hydration again | R7346; 34 A4, D1, D2, E1-E3 |
| 5. health check: found or not, when and by whom, the refusal | done | gm-stores.mjs `gmStoreHealth` row `caseCopy` | 34 B1, E2 |
| 6. hosts with another source, and the file served without login: LIVE rows, said plainly in the handbook and the trust draft | done | AUDIT 9.2 rows 549-551 (LIVE-E111-01..03); GM handbook 14.8 and 22.14 EN/PL; TRUST-DRAFT.md | `check live` |
| 7. no passphrase UI: a state line and "Write the copy now" | done | gm-stores.mjs `openCaseWindow`, `copyLineText` | R7348 |
| 8. tests red first, a FilePicker stand-in in the harness and its README | done | cluster.mjs case "files", lib/shim.mjs `FilePickerImpl`, client-entry.mjs `bus.files` and `fetch`; README "What the harness cannot do" | R7345-R7348, 34 (14 checks) |

Kept from the first design: `caseFileNow` (gm-stores.mjs, the one builder of the case file; `backupCase` saves it),
`restoreCase(file, { quiet })` (no toast, the stores not marked restored), the primary's debounce, the second
hydration check, scenario 34's shape and file name (a scenario's number is how it is found).

Decisions taken on a default (each with its reason):
- **Not compressed**: the file is no world setting sent to every browser, and Restore from a file takes it as it
  stands (a GM can download it from the server as a backup).
- **Several files**: every read lists the folder and merges each copy; a write goes to the copy whose `exportedAt` is
  newest; nothing is deleted (Foundry's FilePicker has no delete). 34 E2-E3.
- **"Empty here" notice**: only in a world whose case was recorded before (`caseMark.since`) and where no copy was read;
  a new world's empty planner says nothing.
- **R numbers**: R7340-R7344 keep their registry rows, marked removed (the test rules: a number is never reused);
  the file road's tests are R7345-R7348.
- **Tooltip families**: DRPG.Tips.CaseCopy (the copy, one key) and DRPG.Tips.CasePlan (Clear the plan, three keys),
  out of DRPG.Tips.Gm and DRPG.Tips.Case, whose keys R4753 and R4755 count exactly.
- **A quiet read that takes nothing does nothing** (36868715): `restoreCase({ quiet })` runs a store's `afterRestore`
  only when it took something from it, and the Faint pass only when it took anything; and the copy is neither written
  nor read while the suite holds the stores (`gmStoresQuiet`), whose rows are then a fixture's.

## Red first

- R7345-R7348 on 18df17c4 with this line's tests-tier1.mjs alone (a scratch worktree, `DRPG_REPO=<worktree> node
  run-tests.mjs --tier 1 --only ...`): 4 FAIL (case-copy.mjs not found x3; R7348 no `readServerCopies`). On this line: 4/4.
- Scenario 34, mutants on a scratch copy: M1, `copyRefusal` without the files' refusal - B1, B2 FAIL (a copy written with
  the switch off). M2, a write that lists without reading, and a load that writes before it reads - C1, D1, D2, E3 FAIL
  (the empty browser replaced the copy: the file read `{"plan":{},"schema":{}}`). Unmutated: 14/14.

## Numbers

- The seed world's case as the server copy: 3172 B of JSON (scenario 34's NOTE).
- Scenario 34: 17/17 with phase F, 32.1-33.6 s (three runs here, 4 cores, 14.11.2026).

## Needs a local Foundry

- LIVE-E111-01: the copy on a real v14 server: the folder made, the browse of a folder that does not exist, the same
  file overwritten, the time of a write and a read, after a restart; The Forge and hosts whose source is not "data".
- LIVE-E111-02: who can fetch the file: without login (assumed yes), a player without FILES_BROWSE listing the folder
  (assumed refused), the folder's address in a browser (assumed no listing).
- LIVE-E111-03: the owner's second computer.

## Questions for the owner, each with the default taken

- Q-E111-5: a GM who gives a player FILES_BROWSE while no GM is connected is caught only at the next GM's load or
  write; the file already written stays on the server. Default: tell and refuse from then on; the GM removes an old
  file by hand if a player could have listed it.

(Q-E111-1..3 fell away with the passphrase; Q-E111-4, the registry's stage stamp, is the coordinator's at release.)

## Clear the plan

| Item of the coordinator's design | State | Where | Answered by |
| --- | --- | --- | --- |
| 1. a button in the planner, a chapter picker (the clock's chapter), a confirm that counts what goes | done | investigation.mjs footer `clearPlan` (in both views, Table and Map), `openClearPlan` (drpgWindow with the chapter, then drpgConfirm with a destructive Clear) | R7350, R3967, R1358 |
| 2. only planning data: never a Remnant, Truth Bullet, trace, another chapter or the ticks; a placed one stays and the confirm says so | done | case-schema.mjs `planToClear` (slots `<ch>:<n>`, nodes, `<ch>:meta`; not `<ch>:reveal`, `<ch>:case`, caseTickStore) | R7349; 34 F1, F3 |
| 3. removal by tombstones: clear on A, B (who held the rows) syncs, a fresh GM reads the file - all empty | done | `clearChapterPlan` -> `dropMany` on both stores | 34 F1-F3 (red at 08eb5c3f; mutant: schema not cleared, F1-F3 FAIL) |
| 4. any GM, an Assistant too; never a player | done | GM guards in `clearChapterPlan` and `openClearPlan`; the dashboard is a GM's window | R7350 (read in the source; an Assistant's press not driven headless) |
| 5. texts EN/PL, the handbook, tests | done | DRPG.Investigation.clearPlan.*, DRPG.Tips.CasePlan.*; GM handbook 14.4 EN/PL | `check parity`, `check text`, `check tooltips` |

Placement: the button is in the Investigation window's footer, beside Realization preview, not inside the Key tab or the
Map's tools row: the footer shows in both views, and the planner's own Save stands there. A deviation from "the Key tab
and Map" in the letter, the same window in fact; say if it should move.

## Gate runs (this machine, 4 cores, 14-15.11.2026)

- On the tip 01ff2e30 (code as 36868715): `node run-tests.mjs --tier 1` 1716 ran, 1701 passed, 0 failed, 16 skipped,
  0 red, 555 s wall.
- `DRPG_SUITE_SHARD=1/8 node run-all.mjs suite` on 36868715: 01-runtests 22/22, suite 1704 passed, 0 failed,
  16 skipped, 0 red; 2274.6 s wall (CLAUDE.md's 880 s is 18.10's; not timed apart here).
- `npm run quick`: lint 0 problems, check 24 parts green, gate 37/37; config-prose missing 0, extra 0.
- Scenarios on 36868715: 34-case-seal 17/17; 61-gmstore-case 114/114 (on 17f112c2 it was 112/114, B2 and B3, fixed by
  36868715); on 17f112c2: 00-boot 35/35, 62-investigation 52/52, 72-canary 162/165 with the 3 expected red its known
  leaks name, 0 failed.
- Older tests changed on purpose: R3967 and R1358 (the dashboard's footer gains "clearPlan"); R2063 drove the Polish
  wording off "Kopia sprawy" (the old tile's name).
