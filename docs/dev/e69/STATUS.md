# E69 - the Infiltrate tile: status

Branch `claude/e93` (E69 follows E93 on it). R numbers from R3750-R3799. Spec: [SPEC.md](SPEC.md).

## Done

| Commit | What | Tests |
| --- | --- | --- |
| C1 | config.mjs `INFILTRATE`; `ACTIONS.listen` labelled Infiltrate (EN, PL), its hint naming the seven rows, `variants`; the window's rows (action-listen.mjs `infiltrateRows`), Listen greyed with its reason in a room with no neighbour; Tail Someone and Dash rows greyed "Not built yet" | R3755, R3756 (tier 1) |

| C2 | `crossingSettled` on the primary GM (crossing-settle.mjs), scheduled from the GMs' record of every crossing | E69-T2 (tier 2), LIVE-E69-04 |
| C5 | Dash: the bridge road `dash.settle`, the GM granting the band's free crossings off its record of the Leg roll | E69-T3 (tier 2), scenario 33 E69-A, scenario 30 "forgeries of a Dash" |
| C9 (part) | the player handbook's Infiltrate tile and Dash, EN and PL | check text |

## Next

C3/C4 Tail Someone and its cards (the row stands greyed "Not built yet" until then). Not in this round: C6 (the
eavesdrop on LiveKit), C7 (Echoes), C8 (murder privacy, Q-E69-4's default: its own stage).

## What a console can still do

- A Dash's Reroll: not measured. Nothing in E69 takes back the free crossings of a Dash whose roll is rerolled; what
  reroll.mjs does with a roll of `actionKey` "dash" was not read or run.

## Defaults taken, owner to confirm

See SPEC.md: the ear glyph kept, Listen's approved description kept, the "Not built yet" rows, Dash's bands.

## Test results

| When | What | Result |
| --- | --- | --- |
| 12.11, C1 | R3755 before the config; R3756 on a worktree of c0ad643 | red: the labels and table missing; "infiltrateRows is not a function" |
| 12.11, C1 | R3755, R3756, R1161 and the 27 tier-2 Listen tests on the tree | green (31 passed) |
| 12.11, C1 | tiers 0-1 | 1163 passed, 2 failed (R213, R1404, both fixed), then green alone |
| 12.11, C2 | E69-T2 red at eba2b65 (no module), green on the tree with E17-T6 | 7 passed |
| 12.11, C2 | tiers 0-1 at 5d2e2ab; the 18 scenarios naming movement.mjs | 1164 passed, 1 failed (R1281, fixed); all 18 green |
| 12.11, C5 | E69-T3 red at 5d2e2ab, green on the tree with the bridge's census tests | 14 passed |

## Blockers

None.
