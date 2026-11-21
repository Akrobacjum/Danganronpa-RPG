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
