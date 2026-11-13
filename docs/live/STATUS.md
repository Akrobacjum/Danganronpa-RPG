# docs/live - status (work line claude/live-pack)

Updated 12.11.2026 (second push: the owner's answers). Built on `main` at 235c3210 (1.2.107). Nothing outside `docs/live/` was changed.

## 1.2.111 draft refreshed (13.11.2026, day)

- **1.2.111 (U1-U11)**, the release plan as the coordinator settled it on 13.11 (the owner merged the old 1.2.111 and
  1.2.112 into one; `claude/e93`'s `v1.2.113.md` is stale): U3 the case planner (`claude/e97-98` c598d3cb: autosave on
  a node's close, planned Remnants of other types, a planned room for a Key slot, a planned Autopsy sent at the body's
  discovery, planned minigames, E99's summary step), U4 floating text fields (`claude/float-text` a63fe324, with
  REVIEW-111's F1-F3 fixed there), U5 radios, checkboxes and four Known gaps (`claude/gaps-radio` 30e65075), U6 the
  project token icon (unchanged), U7 S17-31 (the commits on `claude/e93`, a player's console reads `Countdowns`), U8
  module.zip without macros (`claude/e59-c5a`), U9-U11 Facilities, Infiltrate and the doors (E93, E69, E74; the same
  steps as before, once U3-U5). `claude/e59-c5b` and `claude/r3551` change nothing a table checks on its own, so no
  check. U1 and U2 (trial exit, entry blink, Edit campaign silence) have no code on origin: `claude/trial-exit` comes
  after 1.2.110 ships; their steps stay as they were.
- LIVE-E69-04 points at U10, LIVE-E93-01..03 at U9. V1-V2 stay 1.2.112 (E100, E101).
- Pack: 70 checks, 14 of them drafts; check-coverage green.

## Settled in code, and drafts of the next releases (13.11.2026, night)

- **The three items block N had from the coordinator's words only**, read in code on main (1.2.109):
  - *Zakończ rozdział*: **confirmed**, already in 1.2.109, at the foot of Edit campaign (`scripts/gm-campaign.mjs:104`
    `endChapterPart`, drawn at `:217`) and of Season setup (`scripts/season-setup.mjs:825`); on `claude/e64` the
    chapter-end window gains two columns and Collect / Clear Faint (`chapter.mjs:1990` `chapterEndForm` there). N3 rewritten.
  - Day boards "never from Edit campaign": **corrected** - in 1.2.109 they play on any clock write that raises the day,
    Edit campaign included (`scripts/transitions.mjs:68-85` `transitionFor`, `:113-123` `onClockHeard`); the morning
    line is typed in Edit campaign (`gm-campaign.mjs:190` `morningLineRow`). The change is on the 1.2.111 list and on no
    pushed branch at 01:00 (none changes transitions.mjs, sequence.mjs or gm-campaign.mjs against main). N6 rewritten,
    with a step that records the behaviour per version.
  - The board's frame: **not found in code** on any branch; N6 asks only to look and describe.
- **1.2.111 draft (U1-U6)**: code exists only for E93 Facilities, E69 Infiltrate and E74 (`claude/e93`, last merged
  with main at 1.2.108) and the project token icon (`claude/project-token-icon`). The trial exit and entry blink, Edit
  campaign without animations, the planner's autosave, Autopsy, planned locations, minigames, floating text fields and
  S17-31 were on no pushed branch at 00:35 UTC; U1 and U2 are steps to confirm when the code exists, the rest have no
  check yet. LIVE-E69-04 and LIVE-E93-01..03 now point at U4 and U3. The radio look (`claude/e101`) is V2 step 8.
- **Drafts** (`[szkic]` in the heading, codes T = 1.2.110, U = 1.2.111, V = 1.2.112), a section per release after block
  N, each to be checked against its release notes when it ships. A draft may settle no LIVE id yet; check-coverage.mjs
  now allows that for `[szkic]` headings only and prints how many there are.

## Update for 1.2.109 and 1.2.110 (12.11.2026, late evening)

At the coordinator's request: the pack brought up to date for 1.2.109 (shipped, on main at 421f2395) and 1.2.110 (to
ship the same night). main was merged into this branch first (7f08d295, `git merge-tree` clean before it), so the pack
now reads main's AUDIT 9.2: **496** LIVE ids, 19 more than 1.2.107's 477 (E61-01, E61-06, E61-08, E62-01, E73-01..05,
E92-01..04, E94-01..03, E99-01, E99-04, E99-05). `check-coverage.mjs` caught the move at once (34 failures: rows in
"branches" that the tree's audit now has) before the update.

- **New block N** at the top of SESJA-0.pl.md (before A): eleven checks, N1-N11, about two hours, one GM and one
  player (a second GM or Assistant for N10): versions and the diagnose rows for the "verified" bump (N1); Daggerheart
  2.12.8 rolls drawn by the GM, criticals, the "GM rzuca twoimi kośćmi" line and perf()/rollFlags() (N2); the End the
  chapter button (N3); the trial's entry and the verdict's cut-in with fps() and the microphone (N4); the clock's turns
  and flashes (N5); the day's boards, their frame and where the morning line is typed (N6); the Spectator (N7); E64's
  rules and the Level Up window (N8); E72's Monocub moves and the dead's voice room, with E100's Move tile (N9); the trial
  hall's zones and the case schema in the console (N10); first opens, openTimes() and perf()/fps() (N11).
- **Ids moved into block N**: the 18 new ids a table can settle (E73-01 went to L1, the sandbox; E61-06 to K3, the
  two-floor scene), and seven older ones whose subject block N now covers best: E76-01 (N1), E76-02 and E76-04 (N2),
  E09-05 and E11-08 (N3), E19-05 (N9), E41-01 (N11). The old steps that said "(po wydaniu E61/E64/E73/E99)" now point
  to block N.
- **Branch ids left**: 5 (E64-01 on `claude/e64`, now mapped to N8; E69-04 and E93-01..03 on `claude/e93`).
- **What block N could not read in code**: three things in the coordinator's list - the day's boards started from the
  curtain clock and the GM panel's top (never from Edit campaign), the board's frame and the End the chapter button -
  were on no branch readable at 23:50 (main, dh-212b, e62-c3, perf-open-b, e64, e72, e100, e101, gaps-108 searched for
  their strings and commits). N3 and N6 are written from his description and say so; the owner records what 1.2.110
  actually shows. Whether `openTimes()` (perf-open-b) is in 1.2.110 was not known; N11 asks to run it only if present.

```
audit 9.2: 496 LIVE ids; unnumbered items (9.2 and section 7): 28; open branches: 5 LIVE ids
ids: covered 450, partial 29, not-coverable 17
unnumbered: covered 23, partial 1, not-coverable 4
branches: after-release 5
pack: 56 checks
check-coverage: every id exactly once, every check in the pack, every id named in its check's section
```

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
