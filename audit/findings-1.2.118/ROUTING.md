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
| claude/sheet-119 | f5319776 | the effect pile; Hope/Despair applied after Dice So Nice everywhere |
| claude/facilities-119 | 782baaa0 (asm de96c5be, 21:31Z) | the Facilities rows end on what the action gives (action-facilities.mjs effectWords/effectsWords, timed-effects.mjs timedWhat); the GM's text effect is named "a message from the GM"; R7843. An owner request |
| claude/fog-119 | fc190a65 | the discovery cut-ahead guard (gm-store stampOver/floorOf); Hide all counts studentActors only (ledgerRooms); a Spectator's walk is not an Eclipse crossing (judgeArrival) - MAP-17 / domain-map-b-movement-1 |

## Pushed, merge pending the final report
| Branch | sha | What |
| --- | --- | --- |
| claude/plan-119 | 3b73017a | case map Move up/down (caseMapGraph) - controls-03-investigation-planner-1; the bullet removal cascade, a prune of gone refs, a gone-ref box; keepLive `whileEditing`, a token/region/scene watch and typed fields - refresh-01-04-1 for the case dashboard only; the refutes recursion in depthOf (working set) - first-session domain-case-f-planner-stores-1 |
| claude/day-119 | d76fdbbc | masks end before every advance, so the day board no longer names the masked (stages-25 E118-1); the Support/Call confirmation via nameAsSeen (mask) - domain-comm-b-calls-1; a card's words after the mask ends stay cut (f5c8f041) - domain-core-b-secret-1; the GM's Despair Call public card (90f1c51c) - domain-comm-b-calls-2; the veil in the room pickers: seenHere/veiledFromHere on the hand-over (Give/Share/Show), Palm, Tail, a Hope Call's room target and the Monocub's room student - domain-map-c-rooms-1. By design unchanged: countsAsPresent and othersInRoom (they feed rules); whole-cast lists (Despair Call, Tamper) still name the veiled killer; nameAsSeen does not learn the veil |

## In progress (by Saturday 10:00, else 1.2.120)
- F on fog-119: the voice tile under the veil (voice.mjs placeVoices) - domain-comm-c-voice-1.
- C1 on claude/season-119: Reset the season is dead (controls-10-setup-config-1, domain-case-g-death-chapter-1, stages-17 E49-1); Season setup's Save writes the stale clock and safeword (controls-10-setup-config-2); the checklist's live rows (controls-10-setup-config-3), only if time allows.
- S on sheet-119: discarding items that are not broken (an owner request, not a finding).
- P on claude/sound-119: Sound > Effects add/remove per file (owner request).

## Deferred to 1.2.120 (known; kept in the report as open)
- The victim's target number omits the masked killer's defence (murder-rules crisisDefense) - domain-case-a-incident-1.
- keepLive rule 1 windows: the Remnant card, the Mastermind Hope box, the Students window, the Sound window, the notice history.
- Pruning deleted actors' ledger rows.
- D's leftover: the sheet's Palm tile lights when the veiled killer is the only other person in the room (pressing it names no one).
- Stages E39, E40, E43, E53, E58, E83.
