# E69 - the Infiltrate tile: status

Branch `claude/e93` (E69 follows E93 on it). R numbers from R3750-R3799. Spec: [SPEC.md](SPEC.md).

## Done

| Commit | What | Tests |
| --- | --- | --- |
| C1 | config.mjs `INFILTRATE`; `ACTIONS.listen` labelled Infiltrate (EN, PL), its hint naming the seven rows, `variants`; the window's rows (action-listen.mjs `infiltrateRows`), Listen greyed with its reason in a room with no neighbour; Tail Someone and Dash rows greyed "Not built yet" | R3755, R3756 (tier 1) |

## Next

C2 `crossingSettled`, C5 Dash, C3/C4 Tail Someone and its cards, C9 the handbooks. Not in this round: C6 (the
eavesdrop on LiveKit), C7 (Echoes), C8 (murder privacy, Q-E69-4's default: its own stage).

## Defaults taken, owner to confirm

See SPEC.md: the ear glyph kept, Listen's approved description kept, the "Not built yet" rows, Dash's bands.

## Test results

| When | What | Result |
| --- | --- | --- |
| 12.11, C1 | R3755 before the config; R3756 on a worktree of c0ad643 | red: the labels and table missing; "infiltrateRows is not a function" |
| 12.11, C1 | R3755, R3756, R1161 and the 27 tier-2 Listen tests on the tree | green (31 passed) |

## Blockers

None.
