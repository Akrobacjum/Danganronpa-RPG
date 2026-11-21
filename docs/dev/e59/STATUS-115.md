# E59 on the 1.2.115 line - status

Branch `claude/e59-115`, from `main` at 9e7e3d78 (the 1.2.114 release tree). Started 14.11.2026 on the coordinator's
brief: the owner's consistency (code - handbooks - texts; the code inside itself; the behaviour, sounds and the
mechanics meshing). R numbers: R7160-R7199, R7160-R7182 taken. The 1.2.113 part of the stage is STATUS.md, GATES.md,
WINDOWS.md and GAPS.md beside this file.

## Items

| Item | State | Where |
| --- | --- | --- |
| 1 - the map of chains | done: 35 mechanics in five groups, each with its start, its writes, its readers, what the table sees and hears, its handbook sections and keys; the sound table | CHAINS.md parts 1-2 |
| 2 - each link walked, each break with evidence | done: 49 breaks (B-H1..8, B-R1..10, B-M1..9, B-T1..9, B-S1..13), each with file:line and its kind | CHAINS.md part 3 |
| 3 - the cheap breaks fixed, red first | done for 25 of them (B-T8 and B-S11 in part), in 14 commits; 12 listed (not in proportion here), 12 asked in 8 questions for the owner with their defaults (Q-115-1..8) | CHAINS.md part 3's states, part 4 |
| 4 - guards where a break class can recur | done: R7161 (every setting a music state reads is watched), R7163 (one answer to who is in a room), R7165 (every clean-up miss sounds), R7167 (a student's sound goes where its card goes), R7170 (the voice's words in every handbook and lang value), plus a test per fix | tests-tier0.mjs, tests-tier1.mjs (R7166) |

## How the map was read

Five read-only reading agents (no harness run, no edit), one per group of mechanics, then each break this line fixed or
asked about read again by hand at both ends before it was changed. Two of the agents' readings were corrected by that
re-read: B-H1 (the Bounty's pay-back after a zero) is written on purpose in despair.mjs `returnOwed`'s header, and B-M3
(the warm scene under the hold) is written on purpose in cleanup.mjs `freshSceneBonus`; both became listed or a
question, not a fix. B-S11's second half (the case summary as a sixth sequence) was not verified and is left.

## The commits

| Commit | Breaks | Test |
| --- | --- | --- |
| 10d07d9b | B-T3 the Final Trial's Level Ups | R7160 |
| 73a28152 | B-S1 the vote's music | R7161 |
| 9bd4f615 | B-R1 the projects' sight copy | R7162 |
| 9edb4f66 | B-R7 who is in a room | R7163 |
| b6a2be34 | B-R6 the banging's room name | R7164 |
| 4a5865ed | B-M5 a missed trail's sound | R7165 |
| 83fde695 | B-T8 a Panic Round's double sound | R7166 |
| e8d8df60 | B-S4 a Truth Bullet's and a Level Up's sound | R7167 |
| 697abbd5 | B-S6 the Spectator's talk switch | R7168 |
| a3b69001 | B-S12 the Sound window's Test | R7169 |
| cd81893a | B-S2, B-S7, B-S8, B-S9, B-T5 the voice in the handbooks and lang | R7170 |
| 3f3a9eb7 | B-T4, B-T9, B-H5, B-H8, B-R9, B-R6's quote, B-S11 (half), B-S13 (handbooks) | text |
| 9f649b06 | B-M7 the Traces tab's rule, B-S10 the sound hints | R7171 |
| 227b1b86 | B-M8 the trap victim's failure text | text |
| c990b6f0 | five older source readers brought to the changes above | R3812, R311, R1453, R1157, R827 |

Each break's commit is cited in its row of CHAINS.md. One commit per break, except cd81893a and 3f3a9eb7, which change
the same paragraphs of the handbooks for several breaks each; their messages name every break.

## The second pass (the coordinator's word of 14.11.2026)

Merged `claude/fervent-sagan-gme4vt` (534306dc: E56 part 2, the tooltip sweep; one conflict, the registry, regenerated).
Then every break that needs no Foundry and no design closed, red first, R7172-R7181:

| Commit | Breaks | Test |
| --- | --- | --- |
| 0d3fd126 | B-T6 the trial's end closes its vote (checked first: End the trial refuses nothing for an open vote) | R7172 |
| 9abdf454 | B-R5 Shut the Door's row shut before it costs anything | R7173 |
| a2138850 | B-M2 a waiting discovery announces the body where it lies | R7174 |
| 38349f27, a40dae28 | B-T1 the floor's mute knows a player by every student (a40dae28 moves a docblock: 38349f27 was pushed with quick red on the comments part, read through a grep that matched "RED") | R7175 |
| 3ca4b201 | B-H1 a Bounty of last season gives nothing back | R7176 |
| 70f9a808 | B-R2 the Remnant card live | R7177 |
| 29b620d6 | B-R3 the door and facility traces' icons | R7178 |
| 3c6694bb | B-R4 the diagnostics' Neutral count | R7179 |
| f7a1f029 | B-R10 the bedroom sound's label | text |
| 1bce99a6 | B-H2, B-H3 (Q-115-1) the darkening veiled, the Eclipse's end public during an incident | R7180 |
| 9e575ffb | B-S5, B-S3 (Q-115-8) the Eclipse wins over the talk switch; the messenger documented | R7181 |
| 8be5bbce | B-M9 (Q-115-6) GM 14.4's doc line | text |
| 96d1c168 | B-T2 (Q-115-7) the tick named "In the hall" | text |
| 95e0af72 | B-H7 (Q-115-4) one name, the Despair Pools; a glossary row | text |
| 0f68a072 | B-H4, B-R8, B-T7, B-T8 (Q-115-3) GM 17 names the silent moments; the player's share is PH 16 (the message says PH 14 by mistake) | text |

Left: B-M4 is Q-115-9 (new, a design question); B-H6 and B-M6 are E109's (H20, H11); B-S11's "five rows" half is
unverified. The registry stamps R7160-R7171 E56 (the tool stamps the first stage not shipped, and a written row keeps
its stamp); R7172 on are stamped E59 with `--stage E59`. Not hand-edited. (Read again 21.11.2026, STG-99: the registry
stamped all of R7160-R7182 E56 - the `--stage E59` stamp did not hold. tools/registry.mjs `SINCE_CORRECTED` now stamps
them, and R6750-R6756, E59.)

## For E83 (so it does not count these twice)

Stage defects found and fixed here, each its stage's own: B-T3 (E05 fix r2-G1's rule A left out of the Final Trial's
batch, E42 C1c), B-S1 (E110 part 3's vote state without its watch), B-T8 (E110 part 3), B-T5/B-S2 (E110 C2's handbooks
half-updated), B-S6 (E92 C6), B-S8 (E62 C3b's renaming left in the plan's rows), B-S12 (E62 C3b's `fallsBackTo` not in
the Test), B-R1 (E101 R2's copy), B-R7 (E92 C1's Spectator rule not in the door and breach cards).

## Beside other lines

E109's items are not touched; where a break stands beside one, CHAINS.md's row says so (B-H6 beside H20
`Season.resetKeeps`; B-M6 beside H11, Move the Body's floor). No tooltip text changed (the sound hints of B-M5 and
B-S10 are the Sound window's help lines, `.drpg-help`, not tooltips).

## Needs a local Foundry

- The vote's music (B-S1) crossing on a real playlist at the vote's opening with no floor standing, and back at the
  verdict: a Foundry v14 world with a playlist mapped to `trial.vote` and one to `trial.discussion`.
- The Truth Bullet's and the Level Up's sound on two co-owners' browsers (B-S4): two player accounts owning one student,
  both connected, real audio.
- The Spectator's talk switch (B-S6): mark, switch on, unmark, mark again, on a real LiveKit, and the microphone closed.
- The banging (B-R6) and the breach (B-R7) heard at a table: two players in rooms next to a forced door, one who never
  found the forced room.
- The Overflow card veiled and the Eclipse's public end card during an incident (B-H2, B-H3): a v14 world, an
  incident at Stage 6 with a bystander connected, an Eclipse opened and ended, a darkening drawn at that boundary; who
  sees and hears what.
- The Spectator talk switch during an Eclipse (B-S5): a real LiveKit, a Spectator with the switch on, an Eclipse
  started and ended: out of voice, then back in the Spectators' room.
- The door and facility traces' icons on the canvas (B-R3): the harness has no canvas; an analyzed copy of each on a
  real map.
- The live Remnant card (B-R2): a player with the card open while a GM's Analyze identifies their copy.
- The floor's mute for a player with two students (B-T1): a real LiveKit, a Testimony turn of the player's second
  student.

## Test numbers

Measured here (4 cores, 14.11.2026), one harness at a time:

- Baseline `node run-tests.mjs --tier 1` at 9e7e3d78: 1672 passed, 0 failed, 16 skipped, 0 red, 469 s wall.
- Each commit's own tests and the related ones, with `--only` (its message names them and their counts).
- Scenarios run for the changes: 13-murder-signals 87/87 (twice: the music watch, the clean-up's sound),
  93-spectator 18/18 (twice: the sight copy, the talk switch), 76-passages 118 passed, 0 failed, 1 expected red (its
  declared knownLeak `foundry-passage-tunnel`), 87-messenger-sound 36/36.
- Tier 2 run with `--only`: E50-T2 (5), E15-T14, PV-DOORS-T1..T3, E92+E93 (10 with R7163), E74-T2 (5), "a clean-up and
  a body moved ...", "a close then a discovery ..." (6), "a Spectator's microphone ...", "E62 C3b ..." (8).
- `npm run quick` before every push: green each time.
- The full tier 1 at 79ac9342: 1699 ran, 5 failed - five older source readers (R3812, R311, R1453, R1157, R827) read
  lines this line changed on purpose; c990b6f0 brings each to the change (its message says how).
- The full tier 1 at c990b6f0 (the code of the final tip): 1684 passed, 0 failed, 16 skipped, 0 red, 476 s wall
  (1672 at the base plus R7160-R7171).

### The second pass's numbers (4 cores, 14.11.2026)

- The full tier 1 at 8ede7e0b: 1712 ran, 1696 passed, 1 failed (R3510, the card census: two new card sites of
  1bce99a6), 16 skipped; 52f1fe38 pins them.
- The full tier 1 at 52f1fe38 (the code of the final tip): 1697 passed, 0 failed, 16 skipped, 0 red, 470 s wall.
- Scenarios run in the second pass: 18-trial 26/26, 63-class-trial 79/79, 10-murder 45/45, 67-trial-modes 52 passed,
  0 failed, 1 expected red (its declared knownLeak TR30), 86-frame-work 105/105, 13-murder-signals 87/87, 40-flow
  89/89, 81-render-budget 33/33, 41-trial-scene 52/52. Not run: 30-security, 33-bridge-paths, 72-canary (no bridge row
  or world secret changed).

### The last round (the coordinator's word of 14.11.2026)

- Merged the newest `claude/fervent-sagan-gme4vt` (5de59257: E109 round 2, the traits row and slider, owner-115's
  mask). Conflicts: the registry, regenerated; action-listen.mjs, where `shutShutWhy` (B-R5) and owner-115's
  `listenName` were written at the same place - both kept, each with its docblock.
- B-M4 / Q-115-9 built: 17a232ab, R7182 - the third of an incident was there, for the discovery and its sound.
- B-S11's "five rows": a break, fixed b6812f9c - the case summary is a sequence with its own sound.
- 0f68a072's subject says "PH 14"; the section it changed is PH 16 (Interface tips). Not rewritten in history.
- The full tier 1 at b6812f9c (the code of the final tip): 1706 passed, 0 failed, 16 skipped, 0 red, 458 s wall.
