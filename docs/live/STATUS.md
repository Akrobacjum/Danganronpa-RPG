# docs/live - status (work line claude/live-pack)

Updated 12.11.2026 (second push: the owner's answers). Built on `main` at 235c3210 (1.2.107). Nothing outside `docs/live/` was changed.

## What is here

| File | What |
| --- | --- |
| `SESJA-0.pl.md` | the pack, in Polish: 45 checks in 13 blocks, ordered as a session runs (A before the players, B joining, C the first day, D Eclipse and the murder, E discovery and investigation, F the Class Trial, G execution and chapter end, H a second GM, J edge cases, Z the end-of-session reads, I screens, P performance and voice, K hardware outside a normal table, L the local gate); each check with weight, time, who, steps, pass, fail, what to capture and the ids it settles |
| `coverage.json` | every id, exactly once, mapped to its check: `ids` (AUDIT 9.2), `unnumbered` (numbered checks of 9.2 and section 7 without an id), `branches` (ids on open branches), `checks` (the pack's 45) |
| `check-coverage.mjs` | plain Node; holds `coverage.json` to the audit and to the pack (its header says what it fails on) |
| `RESULTS-TEMPLATE.md` | the form filled in at the table, one row per check, plus a failure block and the console reads |

## Counts

`node docs/live/check-coverage.mjs`, 12.11.2026:

```
audit 9.2: 477 LIVE ids; unnumbered items (9.2 and section 7): 28; open branches: 20 LIVE ids
ids: covered 431, partial 29, not-coverable 17
unnumbered: covered 23, partial 1, not-coverable 4
branches: after-release 20
pack: 45 checks
check-coverage: every id exactly once, every check in the pack, every id named in its check's section
```

- **LIVE ids in AUDIT 9.2: 477** - an item counts when its bold title starts with a LIVE id (459 numbered items and the
  18 `B-E20-n` / `B-E52-n` items at the end). Ids named only inside another item (LIVE-E42-01, never written;
  LIVE-E81-DZ6-1..7, renamed LIVE-E81-14..20; LIVE-E30 as a prefix) are not items.
- **Covered 431, partial 29, not coverable 17.** "Partial" means the session settles the part that can be done on this
  table and version; the row's `stays` says what is left (mostly: a comparison with an older release or another
  Daggerheart build, a second scene with floors, a second session). "Not coverable" means the item is about a world
  or version the table no longer has (ten migration items whose upgrade already ran on the owner's world, two
  superseded version checks), or a table the session will not have (14-15 people, a newcomer on a new world, a slow
  server, a phone the owner dropped on 11.11).
- **Unnumbered: 28** - section 7's 14 (9.2 keeps them "w mocy"), 9.2's items 15-24 (no id) and 448-451 (four decision
  notes numbered as items; not-coverable, "not a check").
- **Branch ids: 20** - E61 (01, 06, 08), E64-01, E69-04, E73 (01-05), E92 (01-04), E93 (01-03), E99 (01, 04, 05), each
  placed at the check where it belongs and marked "po wydaniu E..".

What a check settles is what its steps ask; whether the owner can do all of a check at session 0 is a different
question - the pack says which blocks hang on the story reaching a murder (D-G) and which need people the table may not
have (H, K).

## How the pack was checked

- `node docs/live/check-coverage.mjs` green, and three planted faults each caught (a doubled key in the raw JSON, an
  id removed, an id pointed at a check whose section does not name it), restored after.
- Every `game.drpg.*` command the pack names was looked up in `scripts/api.mjs` (runTests, perf, fps, counters, a11y,
  diagnose, relayGuard, gmStoreStatus, rollFlags, sheetWrites, diagnoseDiceLook, diagnoseVoice, voicePlan, styleSnapshot,
  diagnoseStyles, diagnoseWindows, traceClicks, fogAnimations, diagnoseFog, whyBlack, whatIsHere, checkRegions, fogPeek,
  whySlow, tokensLeft, safeword, openMessenger, publicRoll, killCharacter, passages.audit). `moveAudit`'s default "log"
  read in settings.mjs (Z1 relies on it). Console one-liners copied from the AUDIT items are as the audit writes them;
  the ones the pack adds (the `-=`/`==` probe in A5, the `liveProbe` flag in F1, the token census in E1) were not run
  on a Foundry - there is none here.
- `node tools/check.mjs dashes` before the push.

## The owner's answers (12.11.2026, through the coordinator) and what changed

The owner answered the six questions of the first draft: "1. Tak 2. Tak 3. Najnowsza 4. tak 5. Chyba gma, chyba dwa
pietra 6. Tak".

| Question | Answer | In the pack |
| --- | --- | --- |
| 1. Does session 0 reach a murder and a Class Trial? | yes | D-G are in the plan, not conditional; "N" in the results if the story still stops short |
| 2. A second GM or Assistant GM? | yes | H is in the plan; E1 and E2's second-GM steps no longer "if there is one" |
| 3. Which Foundry build? | the newest v14 | A1 step 1 has the GM write the exact build first (`game.version`); the 14.365 / 14.370 question dropped; LIVE-E76-01 and LIVE-E90-01 carry a note "read the build in A1", LIVE-E75-04/05 reasons no longer name a build |
| 4. A5 on a duplicate? | yes | A5 opens in bold: only on a Forge duplicate, never the real world; K3 and K4 likewise |
| 5. H81-01 details | "probably the GM's browser, probably two floors" | C7 step 4: the GM crosses a tunnel between two floors both ways, then the player; fallback on one floor if the world has no such tunnel; marked as the owner's recollection, not a measurement (also the note on LIVE-H81-01) |
| 6. Screen reader, tablet, Firefox? | yes | K1 and K2 are in the plan and raised to [ważne]; each names its device; "Kto jest potrzebny" lists which checks each person serves |

The time plan now totals: before the session 2-3 h (A, A5 on the duplicate 45-60 min of it); session 0 with the players
5-7 h (B, C, D, E, F, G, P, Z, with H alongside); separate evenings 3-4 h (J, I, K); about 10-14 h in all, without the
optional local gate (L, about 60 min with no people). The pack says what to drop first if the evening runs short.

No id changed its check or status with these answers: the counts above stand (check-coverage output after the update is
the same).

## For the coordinator

- **Position numbers collide across branches.** e92 and e93 both add items 475-478, e61-62 and e64 both 488-489, e73
  488-495; main already has 475-481 for E76. Whoever merges renumbers; `check-coverage.mjs` keys on ids, not positions,
  so it is not affected, but the pack's "poz." lines are generated from main and will need regenerating.
- **LIVE-E61-06** is named in `docs/dev/e61/STATUS.md` (C7, the floors' cross-section) but is not an item of that
  branch's AUDIT 9.2; mapped to K3 as after-release. **LIVE-E99-02 and -03** do not exist on either branch that has
  E99 (01, 04, 05 only); maybe intended, not checked.
- **Superseded items still listed as open in 9.2:** LIVE-E75-05 (14.369/2.10.11, replaced in substance by LIVE-E76-01),
  LIVE-E77-09 (says itself it is replaced by LIVE-E78-13), LIVE-E24-09 (says it is replaced by LIVE-E95-05 except the
  combat-tracker part), LIVE-E16-02 (its collapse half withdrawn in E60 C5c). The pack keeps them, marked.
- **Items 448-451 of 9.2** are decisions and fix-round notes, numbered in the live-check list; counted as unnumbered,
  not-coverable.
- **LIVE-E33-05** needs a world copy from before 1.2.63 and `world-manifest.mjs` / `perf-baseline.mjs` run at the table;
  the item says the 1.2.56 copy "is lost". Only `perf()` itself is in the pack (P1, partial).
- **LIVE-E37-04** is unused (D197, notes 1.2.97) and **LIVE-E42-01** never written (Q-E42-3); neither is an item, so
  neither is counted.
- `perf()` whispers its report to the caller, which `audit/perf-baseline.json` says keeps it off the campaign world for
  the baseline; the GM handbook's section 20 recipe tells the GM to run it at the table. The pack follows the handbook
  and warns about the chat card.
