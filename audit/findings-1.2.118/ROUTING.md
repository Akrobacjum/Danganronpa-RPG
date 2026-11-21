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
