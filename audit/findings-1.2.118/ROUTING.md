# What is already being fixed (the coordinator's list, 20.11.2026 21:25Z)

The owner asked that the audit always know what is already being fixed, so that nothing is fixed twice. The
coordinator sends a line for each finding routed and each branch merged; this file keeps them. The report marks
these as "skierowane" (routed) or "naprawione w 1.2.119 (gałąź, sha)", not as open work for 1.2.120, and re-checks
them after the release from the merged code (section 18). What is listed here is the coordinator's statement, not
the audit's reading: the audit's own reading of the diffs is `lines-119.json`.

## Merged into the assembly (asm-119)
| Branch | sha | What |
| --- | --- | --- |
| claude/trial-119 | cdcb27f9 | Dive and Scrum never close early; an empty camp's turn runs with no speaker; the Closing music plays from the speak step on |
| claude/planlook-119 | 240a5d94 | the Planner's type colours, square routed arrows with a bundle and ports per source, the deduction/counter/solution kinds and the trial modes each in a distinct hue |
| claude/sheet-119 | 54b4a756 (asm a086b3a5, 21:39Z) | any item can be thrown away except a Truth Bullet or a bedroom key (inventory.mjs onlyCopied); sheet-audit.mjs itemFindings no longer flags an honest discard of an unbroken item; R7906, S119-T7, scenario 40, 9.2 item 675 LIVE-S119-03. An owner request |
| claude/sheet-119 | f5319776 | the effect pile; Hope/Despair applied after Dice So Nice everywhere |
| claude/facilities-119 | 782baaa0 (asm de96c5be, 21:31Z) | the Facilities rows end on what the action gives (action-facilities.mjs effectWords/effectsWords, timed-effects.mjs timedWhat); the GM's text effect is named "a message from the GM"; R7843. An owner request |
| claude/fog-119 | ef1a6064 (asm 5a0424c2, 21:34Z; comment fix caf01e3f) | the voice tile under the veil: visibility.mjs voiceVeiledHere, voice-tile.mjs personOf/channelCount, R7864, 9.2 item 690 LIVE-F119-03 - domain-comm-c-voice-1 |
| claude/fog-119 | fc190a65 | the discovery cut-ahead guard (gm-store stampOver/floorOf); Hide all counts studentActors only (ledgerRooms); a Spectator's walk is not an Eclipse crossing (judgeArrival) - MAP-17 / domain-map-b-movement-1 |

## Merged later
| Branch | sha | What |
| --- | --- | --- |
| claude/day-119 | d76fdbbc (asm 68214026, 21:50Z) | masks end before every advance (the boards); a Call's confirmation, refusals and card name a masked student "?"; words kept under a mask stay cut after it ends unless revealed; the veil's room pickers (seenHere: hand-over, Palm, Tail, Hope Call room target, Monocub). R7880, R7881, R7883 (R7882 removed). Assembly tier 1 before this merge: 1805 passed, 0 failed, 16 skipped (the coordinator's reading) |

| claude/sound-119 | 28778c8e (asm 6507f0ca, 22:14Z) | Sound > Effects lists each event's own files, each in its own text box (edit replaces, empty removes), Play and Remove per file; the tab is a keepLive region that redraws on any GM's change and holds while typing. R7833-R7835, P119-S1, 9.2 item 685 LIVE-P119-01. An owner request; the coordinator notes it takes the Effects tab off the rule-1 list - the audit's reading: "holds while typing" is still rule 1 under D-A1 unless the tab asks for whileEditing, to be re-checked after the release. The sticky glass header showing a row through it is old, not fixed |
| claude/plan-119 | a13d89fa (asm c3b60999, line of 21.11 00:08Z) | CTRL-10 case map Move up/down; the bullet removal cascade, a prune of gone refs, a gone-ref box; REFR-05 for the Planner only (`whileEditing`; a focused select still holds the redraw; the Table keeps its own rule); CASE-20 refute loop ended (R7800-R7802; 9.2 item 695, LIVE-C119-01). Note for the re-check: C1 changed the staging of one E09 C3 tier-2 test (a focused text field no longer holds the dashboard's redraw, so the test now stages with the row's visibility select) |

## Pushed, merge pending the final report
| Branch | sha | What |
| --- | --- | --- |
| claude/plan-119 | 3b73017a (merged later as a13d89fa, see above) | case map Move up/down (caseMapGraph) - controls-03-investigation-planner-1; the bullet removal cascade, a prune of gone refs, a gone-ref box; keepLive `whileEditing`, a token/region/scene watch and typed fields - refresh-01-04-1 for the case dashboard only; the refutes recursion in depthOf (working set) - first-session domain-case-f-planner-stores-1 |
| claude/day-119 | d76fdbbc | masks end before every advance, so the day board no longer names the masked (stages-25 E118-1); the Support/Call confirmation via nameAsSeen (mask) - domain-comm-b-calls-1; a card's words after the mask ends stay cut (f5c8f041) - domain-core-b-secret-1; the GM's Despair Call public card (90f1c51c) - domain-comm-b-calls-2; the veil in the room pickers: seenHere/veiledFromHere on the hand-over (Give/Share/Show), Palm, Tail, a Hope Call's room target and the Monocub's room student - domain-map-c-rooms-1. By design unchanged: countsAsPresent and othersInRoom (they feed rules); whole-cast lists (Despair Call, Tamper) still name the veiled killer; nameAsSeen does not learn the veil |

## In progress (by Saturday 10:00, else 1.2.120)
- claude/season-119 pushed e3c41870 (21.11 00:08Z), the line's report pending.
- C1 on claude/season-119: Reset the season is dead (controls-10-setup-config-1, domain-case-g-death-chapter-1, stages-17 E49-1); Season setup's Save writes the stale clock and safeword (controls-10-setup-config-2); the checklist's live rows (controls-10-setup-config-3), only if time allows.

## Deferred to 1.2.120 (known; kept in the report as open)
- The victim's target number omits the masked killer's defence (murder-rules crisisDefense) - domain-case-a-incident-1.
- keepLive rule 1 windows: the Remnant card, the Mastermind Hope box, the Students window, the Sound window, the notice history.
- Pruning deleted actors' ledger rows.
- D's leftover: the sheet's Palm tile lights when the veiled killer is the only other person in the room (pressing it names no one).
- Stages E39, E40, E43, E53, E58, E83.

## Released
- v1.2.119 published 21.11.2026 01:53Z (not a prerelease), tag at main e515907d (PR #69 merged; its tree equals 7a1f8740). The audit's re-check of the merged code: section 18.3 of the report and `recheck-119.json`.

## Not audit findings (recorded so they are not raised twice)
- Owner decision "A" (21.11 01:30Z): in 1.2.120 an INFRA line makes release.yml reuse a green ci.yml run for the same tree hash instead of rerunning CI.

## Release map (owner, 21.11.2026 02:25Z)
- 1.2.120: the blockers and majors still open after the audit's v1.2.119 re-check, plus the refresh pattern (the owner's rule "Zawsze odswiezamy okna od razu przy zmianie").
- 1.2.121: all the rest of the findings (minors and nits).
- E39, E40, E43, E53, E58, E83 move to the L1 release (planned 1.2.122); L1 resumes after 29.11.2026.

## 1.2.120 lines (launched 21.11.2026 02:37-02:39Z from main e515907d; reports due Sunday 22.11 12:00 Warsaw)
| Line | Branch | R range | Takes |
| --- | --- | --- | --- |
| M1 | claude/mask-120 | R7910-7929 | CORE-20 and N119-4 (the two-GM served card), N119-2 (Ghost Bet), N119-3 (Bounty), N119-1 (a room action's card under the veil) |
| M2 | claude/veil-120 | R7930-7949 | DOC-01; STG-03 and N119-5 (End chapter with next morning); COMM-20 (the camera dock's relabel; LIVE-F119-03 stays a live check) |
| K | claude/rules-120 | R7950-7969 | CASE-16 (decided, D-A9: the GM judges the full number; the victim or a third sees the number they can know and a note that a hidden defence is added, with no value and no name), CASE-17, STG-01, CASE-18 |
| R1 | claude/refresh-120 | R7970-7989 | UI-17, REFR-05's remainder, REFR-01, the notice history's Close (probe 42 group C), the E09 C3 test's staging; widened by the owner (21.11 ~02:45Z) to every `keepLive` window in 1.2.120, not only the named ones |
| R2 | claude/setup-120 | R7990-8009 | REFR-03, REFR-04, REFR-02's remainder and N119-7, probe 42 group C entries in Room setup and the Season checklist |
| P | claude/move-120 | R8010-8019 | N119-6 |
| I | claude/infra-120 | R8020-8029 | release.yml reuses a green CI run for the same tree (owner decision A) |

Not routed to 1.2.120 (they go to 1.2.121 with the rest): every minor and nit, the rest of probe 42's group C, and unifying the two veil predicates.

## The owner's table report on v1.2.119 (21.11.2026 ~02:50Z), all to line P (claude/move-120) for 1.2.120
- OWN-119-1: the planner's edges cross node boxes; the nodes should spread to make lanes, with no edge over a node. New: no finding of this audit names it.
- OWN-119-2: the column sorts other than Manual do nothing - at the table (the owner, ~02:55Z) not even in the FIRST column; line P's top item. New as a finding. Past the first column it shares N119-6's cause (case-view.mjs:115, :167 place a node by its inputs' height); why the first column ignores the sort is not read by this audit. Cause found by the owner at the table (~03:00Z): the sort takes effect only after the dashboard's Save, so it is an apply-at-once / refresh defect of the investigation dashboard, not a layout one in column 1. Routed: line P applies the sort at once and lists the planner's other controls that wait for Save; R1 covers the dashboard's redraw of writes made while it is open.
- OWN-119-3: hovering a planner node turns it light cream with unreadable text (styles/components.css:3664, the node's `:hover` rule: `background: var(--drpg-kit-hover-bg)`). New: no finding of this audit names it; the static contrast checks did not cover the hover state of a node.

## Not audit findings (continued)
- The coordinator updates CLAUDE.md's one sentence on release.yml calling ci.yml (now: or reuses a green run of the same tree, audit/gate/reuse-ci.mjs) at the 1.2.120 assembly - the owner's "opcja 1" (21.11 ~02:55Z).

## Release map changed (owner, 21.11.2026 ~03:05Z) - supersedes the map of 02:25Z
- 1.2.120: an urgent small release - line P (the planner: the sort applies at once without Save, a white hover, Move and sort in every column, edges around nodes) and a new line F (claude/fog-120, R8030-8049): OWN-119-4 "Mgla u GMa nie odswieza sie wcale" - the GM's fog does not refresh at all on v1.2.119; the line checks first whether 1.2.119's F119 commits 2c87b5b9 / 09c3a3f8 caused it.
- 1.2.121: the majors lines M1, M2, K, R1, R2 and I.
- 1.2.122: the rest of the audit (minors and nits).
- 1.2.123: L1 with E39, E40, E43, E53, E58, E83.
- OWN-119-4 is new to this audit's findings. The re-check's batch 04 (`recheck-119.json`, MAP-19) read 2c87b5b9 as changing `ledgerRooms` (fog.mjs:1527) to count students' rows only; whether that or 09c3a3f8 stops the GM's fog from refreshing was not read by the audit.
- (owner, ~03:15Z) The map shifted by one is confirmed. New owner ask OWN-119-5 for 1.2.120, line H (claude/tokenhud-120, R8050-8069): Foundry's Token HUD - remove combat, target, movement action, assign status, both bar inputs and elevation; keep visibility, sort, lock and configure; restyle to the module's icons and look ("dalej oryginalne ikony foundry ... nie pasuje do reszty modulu"). 1.2.120 = P + H (+ F if ready). A feature ask, not an audit finding; the 1.2.120 re-check will hold H to this list.
- (owner, ~03:45Z) OWN-119-4 closed by the owner as not reproducible ("possibly something out of sync between module updates"; no Mastermind was chosen, so the 26.08 Mastermind rule does not explain it; the Fog tab's Mastermind column was already disabled since E91 C4). Line F's claude/fog-120 28707f0f ships in 1.2.120 as hardening: the dissolve's busy flag released in `finally` plus a 1750 ms bound (R8030), `diagnoseFog().dissolve`, GM handbook 20.3, AUDIT 9.2 item 700 (LIVE-F120-01) on that line; scenario 97 phase K reads the GMs' fog with no manual repaint. The audit records the closing as the owner's; the cause was not measured. The 1.2.120 re-check reads the hardening's claims.
- (coordinator, ~04:03Z) claude/hopebox-120 a5661b39 (from e515907d, R1's session) -> 1.2.120: the Mastermind's Give Hope box lost its pool select, amount and Give on the first live redraw (any actor write with the window open) - `openMastermindDialog`'s `keepLive` build returned the box's inside, and live.mjs puts the build's first element where the region stood. Red first on e515907d, a tier-2 test, mutant killed. The same fix also sits on claude/refresh-120 (1.2.121). **Not found by this audit.** By reading: `scripts/mastermind.mjs` did not change between b5a29e73 and e515907d and live.mjs's `element.replaceWith(next)` (live.mjs:171) is the same, so the defect most likely stood on 1.2.118 too (not run there). The audit wrote the Hope box only as a rule-1 surface (REFR-05); neither the controls pass nor probe 43 saw the box lose its controls. The class to look for elsewhere: a `keepLive` build whose first element is not the region itself.
- (coordinator, ~04:08Z) claude/setup-120 now eccaf195 (R2: `recountTokenCells` skips a count the GM is typing; the count field keyed `token:<room>`) -> 1.2.121. The 1.2.120 assembly started from e515907d with fog-120 be44650c, tokenhud-120 b022fde1, hopebox-120 a5661b39, move-120 2a45c693 (P's item 4 to follow). 9.2 numbers on main: H's LIVE-H120-01 is item 698, F's LIVE-F120-01 item 700; the audit's 701 and up untouched.
- (coordinator, ~04:14Z) claude/refresh-120 aa3c5de9 (1.2.121) adds a `mastermind` row to probe 08's WINDOWS and its capture (audit/windows/mastermind.html). R1 ran temporary copies of probes 42 and 44 (not committed): on refresh-120 56 of 56 regions return the region; on e515907d with the new probe 08 row, probe 44 reports the Hope box ("NOT THE REGION: .drpg-mm-live -> <p class=\"notes\">"). So probe 44 goes red on the defect it was written for, which the audit's own run could not show (the window was not in the list). Probe 08 leaves a world-dump difference after that window (gmMastermind, gmPassageAccess stamps); R1 left it as a note (a clean dump would need gmStoreHold).

## 1.2.120 released, 1.2.121 assembling (coordinator, 21.11.2026)
- v1.2.120 published 06:22:59Z, tag at main 03ee8de9 (PR #70): lines P (move-120 1fc4219a), H (tokenhud-120 b022fde1), F (fog-120 be44650c), hopebox-120 a5661b39; stage E120; R8010-R8014, R8030-R8031, R8050-R8053; 9.2 items 696 (LIVE-P120-01), 698 (LIVE-H120-01), 700 (LIVE-F120-01). The audit's check of it: AUDIT 18.6, `recheck-120.json`.
- ~06:50Z: the 1.2.121 assembly (asm-121 from 03ee8de9) merges infra-120 c6bb8143, mask-120 b9903de3, veil-120 575de480, rules-120 d0986d5b, setup-120 eccaf195, refresh-120 d3153c04 and claude/audit-119 at 2927f16a (clean; check live green with 575 items). The coordinator added probe 44's row to audit/harness/README.md in the assembly; probes/README.md's row is on this branch (48673032). The lines' "1.2.120" in comments, test names and handbook notes now say 1.2.121 (88 lines, d1b68bb0); tier-2 names "1.2.121 CASE-16/-17/-18", "1.2.121 STG-01".
- Where the report says "1.2.120" for the majors (CASE-16, REFR-01 and the rest) read 1.2.121, and for E39, E40, E43, E53, E58, E83 read 1.2.123 (AUDIT 18.6 says so once; the older sentences stay as written).
- (coordinator, ~06:52Z) 9.2 numbers for the 1.2.121 lines' table checks: LIVE-M121-01, LIVE-M121-02, LIVE-K121-01, LIVE-R121-01, LIVE-R121-02 take 710-714 (agreed by the audit). The audit keeps 701-709 reserved and has used none of them.

## After the check of 1.2.120 (coordinator, 21.11.2026 ~06:54Z)
- r120-P-1 -> line P, new branch claude/press-121 from refresh-120 d3153c04: a change ends the press-hold only when it comes from the element pressed; red first in Chromium with a real mouse; ships in 1.2.121. r120-P-2 there too if small. r120-P-3 is covered by R1's select-never-holds in 1.2.121 (to re-check there). r120-P-4 -> 1.2.122.
- r120-F-1 and r120-F-2 -> line F, new branch claude/fog-121 from 03ee8de9; ships in 1.2.121. r120-F-4 only if small, else 1.2.122.
- r120-H-1, H-7, H-2, H-3 -> 1.2.122 (minors).
- r120-F-6 -> R1 in 1.2.121 if its branch covers it. The audit read refresh-120 d3153c04 for it: the box's wait for focus is covered (`whileEditing: true` on `.drpg-mm-live`, R7972); the other half is NOT - `current` is still read once at the window's open (mastermind.mjs:605-606 at d3153c04), the `keepLive` watch still names no store (`actors`, `drpgDespairOwedChanged`), so another GM changing or clearing the Mastermind redraws nothing and Give still converts to the Mastermind of the window's opening.
- Q-A120-1 answered (the owner to line H, 21.11.2026): the player has no Token HUD at all, by intent - "gracz niech nie widzi ustawien tokena wcale", "Chodzi o cale menu. Niech gracz nie ma menu tokena." Recorded as D-A11.
- 7f4a178e merged into asm-121 (0a0a9e5e); 1.2.121 waits for press-121 and fog-121.

- (coordinator, 21.11 08:50Z) asm-121 21bf5d18: CI run 44879555080 on e537947b was red on two items only. (1) Tier 2 E44-T2 asserted the old "a select holds" rule; R1 rewrote it (aa534724), 8/8 on the assembly. (2) Scenario 61-gmstore-case F3: line K's new GM-only cast field `watchDie` is nulled in every copy like `openingTrait`, and F3's withheld list did not name it; the coordinator fixed the scenario (78de5a84), 114/114 locally, no code change. For the 1.2.121 check: read both rewritten checks against what they measured before (a test changed to meet new behaviour must still measure a claim).

## 1.2.122 lines (coordinator, 21.11.2026 08:30Z; started before 1.2.121 ships, the owner's ask)
Base: 21bf5d18 (the 1.2.121 assembly). They take the minor and nit findings still open in `recheck-119.json` (533 by the coordinator's count; the majors are 1.2.121's), split by the file each names (INDEX.json `where`), plus the items of the 1.2.120 check. Reports due Monday 23.11.2026 12:00 Warsaw.
| Line | Branch | R block | Also |
| --- | --- | --- | --- |
| TEXT | claude/text-122 | R8060-8099 | lang texts, config prose |
| CORE | claude/core-122 | R8100-8139 | bridge, settings, migrate, secret, clock, gm-campaign and season, gm-store; REFR-02's rest, r120-F-4 |
| TRIAL | claude/trial-122 | R8140-8179 | |
| INVEST | claude/invest-122 | R8180-8219 | r120-P-3 re-check, P-4, P-5, the Map's small texts |
| MURDER | claude/murder-122 | R8220-8259 | the crisis menu's refresh, one veil predicate for mask-gm and visibility |
| COMM | claude/comm-122 | R8260-8299 | COMM-20's rest |
| ITEMS | claude/items-122 | R8300-8339 | r120-F-6's rest |
| MAP | claude/map-122 | R8340-8379 | r120-F-3 |
| DESP | claude/desp-122 | R8380-8419 | |
| UI | claude/ui-122 | R8420-8459 | r120-H-1..H-8 |
| STG | claude/stg-122 | R8460-8499 | records; the four "E120 - " tier-2 names that shipped in 1.2.121 |
| WORLD | claude/world-122 | R8500-8539 | the small files |
The audit's check of 1.2.121 will give a file:line per finding so it can be routed to these lines by file. Note for the lines: of the open findings in `recheck-119.json`, 246 are "open-unchanged" - their files did not change by 1.2.119 and they were not re-read then; a line should re-read each on its own base before fixing it.

## After the check of 1.2.121 (coordinator, 21.11.2026 ~10:10Z)
- v1.2.121 published 09:35:15Z, tag at main 1eee4d62 (PR #71); release.yml run 44890152504 reused green CI run 44886414447 on the same tree (line I's first use). The audit's check: AUDIT 18.7, `recheck-121.json`.
- r121-M-1 (Listen naming the veiled killer) fixed on claude/desp-122 f652fafc (tier 2 "1.2.122 r121-M-1" red first, 5 mutants killed; `performListen` held by a source read); ships with 1.2.122 (the owner chose no early release). r121-K-1 -> MURDER.
- Lane M, optional follow-ups for 1.2.122 (else 1.2.123): M-2 -> MAP, M-3 -> CORE, M-4 -> UI, M-5 -> DESP, M-6 -> COMM. M-7 done on stg-122 17941a84 (the four tests renamed "1.2.121").
- The owner's default for the rest of the 1.2.121 findings: 1.2.122 ships when its lines are in; what a line does not close goes to 1.2.123.
- (coordinator, ~10:13Z) `recheck-121.json` routed: r121-R-1 (major), R-2, R-3, R-5 (the regressions) -> R1 on claude/refresh-120 (fast-forwarded to 1eee4d62), R8540-R8579, required for 1.2.122; R-6, R-7, R-11 -> R1, optional. R-4 = F-1 -> ITEMS. R-8 -> TEXT; R-9 -> COMM; R-10 and F-5, K-2, K-4 -> STG; K-1 (required) and K-3 -> MURDER; F-4 -> MAP; F-2 and F-3 -> the coordinator at assembly. Optional ones not closed go to 1.2.123.
- (owner, relayed ~10:22Z) 1.2.122 waits for every finding of the 1.2.121 check (all 27 rows of `recheck-121.json` and lane M): every row routed as optional is now required on the same line; F-2 and F-3 stay with the coordinator at assembly.
- (coordinator, ~10:41Z) `unrouted-122.json` (bb96d8dd) routed in full, by file or id prefix. A: CORE REFR-06, REFR-27; INVEST CTRL-10, STG-21; COMM COMM-24, REFR-25; ITEMS STG-100; MAP MAP-19, STG-32; STG DOC-05. B: by prefix (UI, CASE -> INVEST, ITEM, MAP, COMM, ROLL and DESP, CORE, TEXT); DEC-1b and H1b -> MURDER (known-leaks.json first); the other 67 -> STG. C: rows 0-26 TRIAL, 27 INVEST, 28-32 ITEMS, 33-39 UI, 40 COMM. D: each by its file (TEXT 16, CORE 43, TRIAL 15, INVEST 9, MURDER 24, COMM 31, ITEMS 30, MAP 22, DESP 23, UI 22, STG 7, WORLD 42). E: no code release closes the table checks; they stay with L1, and the owner is told. Each line answers per item: fixed, comment corrected, already true, or needs a real table (a proposed LIVE id, not closed). The 1.2.122 check will hold each line's answers to these rows.
- (coordinator, ~12:07Z) probe 43 on 1.2.121 (AUDIT 18.7, `probe-43-121.json`) routed, all required for 1.2.122: Despair Flow's suggested threshold after a death -> ITEMS; the Season checklist's rooms per student after a death -> CORE; the case map's problem count after a Remnant, five views -> INVEST; Sound's Files tab toggle state -> COMM; the harness GM's heap growth over case-map redraws -> INVEST, to measure headless and fix if the module holds it.
- (coordinator, ~14:14Z) probe 43's heap held from window to window (the full run on 1eee4d62 with bcf54c21 still out of an 8 GB heap at investigation--map-lanes) -> INVEST, read-only and measured (counts of hooks, store subscribers and live.mjs registrations at each open and close, heap after gc), 60 minutes; no fix until the audit's per-window numbers (probe 43 since 1b9064e6, on 1eee4d62 and 03ee8de9) and INVEST's agree on a cause. Assembly: all 13 lines and claude/audit-119 2a156dd1 merged into asm-122; 1.2.122 waits on the owner's .claude texts, the full glass-sweep and CI.

## 1.2.122 released (coordinator, 21.11.2026 ~18:50Z)
- v1.2.122 published 18:49Z, tag at main 14bb0d92 (PR #72), not a prerelease; notes .github/release-notes/v1.2.122.md. In since 172a2635: INVEST's a11y observer (ede0cbe7, R8543); Fit to view below 25% down to 5% (f678b5dd, R8542, the owner's request); CI on the release commit's 11 red checks fixed in 668db427 and fcbb2753 (roll-draw.mjs `settleAwayCards` sends awayDecided with the card's words; gm-items.mjs `holdGive` keeps the Give tooltip; nine stale readings in tests, one a race between tier 2 and eb1fb8e1's createItem readying hook). Local gate in record mode: press-live-region passed, the 8 sandbox parts not run.
- Candidates for 1.2.123, not fixed: sheet-audit.mjs `itemMoves` takes a deleted item back into the GMs' sheet mark when a GM's update is judged after the delete (seen in tier 2's race only); INVEST's about 0.5 MB per open on the case windows and +41 MB once on investigation--map-move, not traced.
- The audit's check of 1.2.122 against 1.2.121 (D-A10) started 18:55Z: AUDIT 18.8, `recheck-122.json`.
- (coordinator, ~19:19Z) r122-ITEMS-R-3 (major regression: a hidden stash found with Analyze is never sent to its finder's browser, stash-reach.mjs:241-251 / hidden-stashes.mjs:138-151) -> line ITEMS, claude/items-123 from 14bb0d92; confirmed by the coordinator from the code; a hotfix before Sunday is the owner's call. The audit sends every other regression or blocker as soon as it is confirmed, so one hotfix can carry them all.
- (coordinator, ~19:42Z) the 1.2.122 hotfix list, each on a branch from 14bb0d92, no release until the owner decides: ITEMS (claude/items-123) r122-ITEMS-R-3, ITEMS-R-1, ITEMS-R-2; INVEST (claude/invest-123) r122-H-R1, r122-D-R1; UI (claude/ui-123) r122-E-R1; CORE (claude/core-123) r122-C-1 and r122-lane-B-1 (both secret.mjs, one line); MURDER (claude/murder-123) r122-C-R1. The 56 minor and nit findings and the unanswered asks wait for the next regular release. The audit sends probe 08's action-loot rerun when it has it.
- (owner, relayed ~19:42Z) hotfix 1.2.123 before Sunday with all 9 items (3 major regressions, 5 minor regressions, C-1); the L1 stages E39-E83 move to 1.2.124. The audit checks 1.2.123 as a focused pass when it ships: each of the 9 fixed, nothing new broken around them, and probe 08 alone.
- (owner, relayed ~20:30Z) 1.2.123 carries everything of the audit's check of 1.2.122 (`recheck-122.json`): the hotfix items, the minor and nit findings, the asks not done or partly done; L1 (E39, E40, E43, E53, E58, E83) to 1.2.124. In asm-123 (9d6c9e5a; tier 1 1965/0/16/0) already: E-R1 (UI dcd9d406), C-R1 (MURDER e3d8180d), H-R1 and D-R1 (INVEST ddd42c33, a783e179), C-1 and lane-B-1 (CORE b3d9fb64, 8516ae4b); ITEMS-R-1..R-3 in progress. Routed by line: TEXT A-6, A-7, TEXT-37; STG A-5, STG-82, the STG file split, a decision on tables-editor.mjs's length (A-2); CORE lane-B-2..B-4, CASE-24, CORE-LC1/LC5/LC6, CORE-28, CORE-41, CORE-40's rest, its comment items; WORLD lane-B-5, B-7 (MAP-40), REFR-40, its comment items; TRIAL C-3 (the 22 node buttons), C-5 (REFR-73), C-6, STG-74; MURDER C-2, C-4, REFR-21; INVEST D-2..D-6, CTRL-10, STG-21, CASE-LC4/LC6, group C row 27, probe 43's heap rest, CASE-37's rest, recheck-119 minors on its files; MAP E-3, E-4, E-6, E-7, MAP-15, MAP-19, STG-32, MAP-LC2, MAP-LC6; UI E-1, E-2, r120-H-3, group C rows 33-39; DESP F-1..F-4 with H-7, F-9; ITEMS F-5..F-8, E-5, ITEM-38; COMM G-1..G-8, G-R1, COMM-LC3/LC5/LC6/LC7, COMM-21, COMM-26, COMM-36, CTRL-25, REFR-17, the Sound Files toggle; R1 H-1 with lane-B-6, H-2..H-6, H-8, H-9, r121-R-1; the assembly A-1, A-2 (1.2.122's notes corrected in 1.2.123's). A-4 refuted, skipped; D-1 = D-R1. The audit checked the table against recheck-122.json: no finding missing; r121-R-5 is H-3; the lanes' 61 not_established items are not in it (the coordinator's call).
- (owner, relayed ~20:32Z) whether the number of findings goes down from release to release: the audit of 1.2.123 and after keeps 1.2.122's method (8 lanes, a first reader on the tree and its diff, every commit of each line, a refuter) and the same `counts` block in recheck-123.json, with `commits_read`, the code lines changed (`git diff --shortstat v1.2.122 v1.2.123 -- scripts lang styles templates ':(exclude)scripts/tests*'`), an `origin` for each standing row ("fix": brought in by the release's own fixes; "new-code": other code new in the range; "old": code in the previous tag, unchanged, found only now) and how many of the previous check's rows the release closed, partly closed or left.
- (coordinator, ~20:33Z) the routing table for 1.2.123 confirmed complete. The lanes' 61 `not_established` items stay with the audit (not defects; if the owner wants them as LIVE items, the coordinator folds them into 9.2 in one commit at assembly, from `recheck-122.json`). The 1.2.123 pass also reads the handbooks EN/PL rewrites and covers the press-hold mutant run (`audit/live-press.mjs`), the two 1.2.122 claims left unread. action-loot stays with L1 and 9.2.
- (coordinator, ~20:51Z) lane HB (r122-HB-1..HB-6, the handbooks EN/PL) -> TEXT (claude/text-122), all six in one line so two lines do not write the same handbook files; HB-3 written to the code as it stands (R1's H-8 may change the Debug log after). The 1.2.122 baseline for the owner's trend: 73 rows, 71 standing.
