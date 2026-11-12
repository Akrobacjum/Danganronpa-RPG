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

E74 (Doors and Keep Watch) on this branch. Not in this round of E69: C6 (the eavesdrop on LiveKit), C7 (Echoes), C8
(murder privacy, Q-E69-4's default: its own stage), the GM handbook's section, E53's ledger counters (Q-E69-5), a Reroll
branch for a tail (`settleTail`) and a Dash.

## What a console can still do

- A tail's Reroll: not built. A Reroll of either roll does not change the tail the GM keeps; what reroll.mjs does with
  a roll of `actionKey` "tail" or "tailUnseen" was not read or run.
- A tail's cards name the room the target reached by its region name, even a room the tailer never entered (Listen's
  window says "Unexplored room"); a default, owner to confirm.
- A Dash's Reroll: not measured. Nothing in E69 takes back the free crossings of a Dash whose roll is rerolled; what
  reroll.mjs does with a roll of `actionKey` "dash" was not read or run.

## Defaults taken, owner to confirm

See SPEC.md: the ear glyph kept, Listen's approved description kept, Dash's bands. And for Tail Someone:

- A tail cannot be begun in an Eclipse (the gate of a person's action, as Palm and Frisk); one begun keeps sending cards
  through every Eclipse (DA20, DA33). The plan's C3 lists the Eclipse among the target refusals and its goal says cards
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
