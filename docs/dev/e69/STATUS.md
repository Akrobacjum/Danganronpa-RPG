# E69 - the Infiltrate tile: status

Branch `claude/e93` (E69 follows E93 on it). R numbers from R3750-R3799. Spec: [SPEC.md](SPEC.md).

## Done

| Commit | What | Tests |
| --- | --- | --- |
| C1 | config.mjs `INFILTRATE`; `ACTIONS.listen` labelled Infiltrate (EN, PL), its hint naming the seven rows, `variants`; the window's rows (action-listen.mjs `infiltrateRows`), Listen greyed with its reason in a room with no neighbour; Tail Someone and Dash rows greyed "Not built yet" | R3755, R3756 (tier 1) |

| C2 | `crossingSettled` on the primary GM (crossing-settle.mjs), scheduled from the GMs' record of every crossing | E69-T2 (tier 2), LIVE-E69-04 |
| C5 | Dash: the bridge road `dash.settle`, the GM granting the band's free crossings off its record of the Leg roll | E69-T3 (tier 2), scenario 33 E69-A, scenario 30 "forgeries of a Dash" |
| C3+C4 | Tail Someone: the bridge road `tail.start` (the effect, Leg or Shadow, a GM's pick on E68's card; the Shadow against 15), the GM store `tails`, the cards from `crossingSettled` and the ends (lost, the day, a body, a Dash; silent on a death or an incident); action-tail.mjs, tail-gm.mjs | E69-T4 (tier 2), scenario 33 E69-B, scenario 30 "forgeries of a tail" |
| C9 (part) | the player handbook's Infiltrate tile, Tail Someone and Dash, EN and PL | check text |

## Next

E74 (Doors and Keep Watch) on this branch. Not in this round of E69 (C6 and C7 built for 1.2.113, below; C8 stays Q-E69-4's
own stage): the GM handbook's section (written for 1.2.113 in 9.5), E53's ledger counters (Q-E69-5), a Reroll
branch for a tail (`settleTail`) and a Dash.

## 1.2.113: C6, C7, C8 (the fix line of 13.11.2026; the audit A113-C5-2)

The owner's decision of 13.11.2026: every change from the audit goes in 1.2.113. The audit found C6, C7 and C8 absent with
no owner agreement to leave them out. Built from the plan's rows 10.11 (a) and (b), C6-C9, LIVE-E69-03 and Q-E69-2/-3.
R numbers R6020-R6026.

| Part | What | Tests |
| --- | --- | --- |
| C6 | The eavesdrop: after a good Listen roll (14+, or a critical), the card first (Q-E69-2), then `listen.eavesdrop` asks the primary GM, which reads the roll off its record, keeps a row (gm-stores.mjs `eavesdropStore`, an owner's copy `eavesdropCopy`), and the voice decision sends the listener into the room's channel (voice.mjs `listeningRow`, one rule in `placeVoices` after the Spectators' room, the design of every other voice rule); the microphone blocked by the trial's own BROADCAST_AUDIO write (`settleTrialVoices`, a `trialMuteStore` row); Stop listening on the voice tile (`listen.stop`); the GM's list Who you hear holds a line per listener (glyph `listening`, the button `stop-listening`); a free repeat on the same room in the same time of day; the ends as the plan lists | R6020, R6021, R6022, R6025, R6026; E69-T5; scenarios 30 (a console's packets) and 33 E69-C; LIVE-E69-03 |
| C7 | Echoes: a row of the Infiltrate window, one action, no roll (`listen.echoes`); the nearest room by crossings (doors, stairs, the tunnels the asker knows) with a living student of another player, read on the GM (echoes-gm.mjs); ties at random; struck through in an Eclipse (Q-E69-3) | R6023, R6024, R6026; E69-T6; scenarios 30 and 33 E69-C; LIVE-E69-06 |
| C8 | Built after all (the coordinator, 13.11: the owner's decision of 13.11 overrides Q-E69-4's default). An opening on Hope or a critical of a direct murder hides the killer (mask-gm.mjs, GmStore `maskStore`): their tokens a "?" with the mystery man and one flag `masked`, the look kept by the GMs alone; every cast copy but the killers' holds no killer (incident-store.mjs `castCopyFor`); the victim's whisper says "someone"; another player's sheet of the killer closes (anonymity.mjs `maskedSheetClosed`); the microphone blocked by C6's block with one more reason (`maskMutedIds`); the killer asked to reveal (`mask.reveal`, and a Reveal yourself on the voice tile); ends at the reveal or the next time of day | R6027-R6031; E69-T7; 30-security "the killer behind a ?, read from a console"; LIVE-E69-05 |
| C9 | Handbooks EN and PL: the player handbook's eavesdrop and Echoes, the GM handbook's 9.5 paragraph; AUDIT 9.2 rows LIVE-E69-03 and LIVE-E69-06; no `game.drpg` name added, so no api-surface row | check text, parity, live |

Defaults taken (owner may revise):

- Nobody in the listened room is told, as the 10.11 answer (a) says; but the voice tile's speaker number counts every
  participant of the channel (voice-tile.mjs `channelCount`, R550), so it probably shows the listener as one more. Hiding
  it would tell those browsers who listens; left as it is, measured by LIVE-E69-03 (3).
- The block is lifted `EAVESDROP_GRACE_MS` (4 s) after the move back is sent, so the room does not hear the first words
  while the reconnect runs. A design number; LIVE-E69-03 (5) measures it.
- A free repeat costs no action and no roll and gives no new card (it repeats the channel, not the reading); it is on the
  room listened into, on that scene, in that time of day, whatever ended the first.
- A Reroll of the Listen roll does not end an eavesdrop it earned.
- An eavesdrop cannot begin in an Eclipse, a Class Trial or an incident (the GM refuses; the card still came).
- Echoes does not name the asker's own room; names the room by its region's name even when the asker has not explored
  it (as a tail's card does); refused in an Eclipse, a Class Trial and an incident; with no GM connected nothing is paid.
- The plan's "GM's voice panel" is read as the GM's list Who you hear on the voice tile, the panel a GM has per voice.
- C8: a GM and a Spectator see through the "?" (the coordinator's default), from the documents they hold; the killer's own
  browser shows the "?" too; the mask does not end with the incident, only at the reveal or the next time of day; the
  mask is written before the incident's stage, so the copy the stage sends the victim already holds no killer.
- C8, what stays: a token document keeps its `actorId`, so a console resolves the "?" to the killer (Foundry's limit);
  30-security records it with a note, not a known-leaks.json entry, because a foundryLimit entry needs its paragraph in
  the root README.md, which this line may not edit. LiveKit names the killer among the channel's participants in the
  voice list. Both are LIVE-E69-05.

## What a console can still do

- A tail's Reroll: not built. A Reroll of either roll does not change the tail the GM keeps; what reroll.mjs does with
  a roll of `actionKey` "tail" or "tailUnseen" was not read or run.
 Built since (E74 C7, the coordinator's item 2): reroll.mjs hands these keys to infiltrate-reroll.mjs, which replays
  each from the facts the GMs' run wrote on the roll's row; E74-T6 and E74-T7 (tier 2), red at a123ff1. What stands when
  the new roll is lower: a door forced, a lock picked, a room action's effects - each said on its line.
- A tail's cards name the room the target reached by its region name, even a room the tailer never entered (Listen's
  window says "Unexplored room"); a default, owner to confirm.
- A Dash's Reroll: not measured. Nothing in E69 takes back the free crossings of a Dash whose roll is rerolled; what
  reroll.mjs does with a roll of `actionKey` "dash" was not read or run.

## Defaults taken (default, owner may revise - the coordinator, 12.11)

See SPEC.md: the ear glyph kept, Listen's approved description kept, Dash's bands. And for Tail Someone:

- A tail cannot be begun in an Eclipse (the gate of a person's action, as Palm and Frisk); one begun keeps sending cards
  through every Eclipse (DA20, DA33). **Confirmed by the owner, 12.11.2026: "Tak"** (through the coordinator). The plan's C3 lists the Eclipse among the target refusals and its goal says cards
  "also in every Eclipse": read together as this.
- "Range": the tail is lost when, at the target's settled crossing, the tailer stands in neither the room the target
  left nor the one it reached.
- The day's end is the clock's day (chapter and day), not the time of day.
- On a critical effect roll the card names who stands in the room reached (no Monocub, Monokuma, hidden token or body
  the GMs hold dead), outside an Eclipse only.
- Refused also in an investigation and for a target the GMs hold dead.

## Test results

| When | What | Result |
| --- | --- | --- |
| 12.11, C1 | R3755 before the config; R3756 on a worktree of c0ad643 | red: the labels and table missing; "infiltrateRows is not a function" |
| 12.11, C1 | R3755, R3756, R1161 and the 27 tier-2 Listen tests on the tree | green (31 passed) |
| 12.11, C1 | tiers 0-1 | 1163 passed, 2 failed (R213, R1404, both fixed), then green alone |
| 12.11, C2 | E69-T2 red at eba2b65 (no module), green on the tree with E17-T6 | 7 passed |
| 12.11, C2 | tiers 0-1 at 5d2e2ab; the 18 scenarios naming movement.mjs | 1164 passed, 1 failed (R1281, fixed); all 18 green |
| 12.11, C5 | E69-T3 red at 5d2e2ab, green on the tree with the bridge's census tests | 14 passed |

| 12.11, C3+C4 | E69-T4 red at 33e5379 (no tail-gm.mjs, no `tail.start`), green on the tree | 5 passed |
| 12.11, C3+C4 | tiers 0-1 at the tree before three test changes | 1162 passed, 3 failed (R164, R218, R472: the new road's census rows, fixed), 16 skipped, 1 red (older); the three, R213 and R297 green after |

## Shots

Round 1 (12.11, C1, C3, C5): https://claude.ai/artifact/4Gi76efq58rMpwBPiikjZd - the Infiltrate window and the Tail
Someone window (player), Stained Glass and Monokuma Legacy, EN and PL, 1366x768 at scale 2. Headless harness in
audit/style-harness.html: not Foundry, no Font Awesome, no window frame; the cards themselves are not drawn there.

## Blockers

None.
