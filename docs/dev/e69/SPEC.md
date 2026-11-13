# E69 - the Infiltrate tile: the stage spec

Written 12.11.2026 on claude/e93 after E93, from docs/dev/plans/E69.md (origin/claude/plan-130) and the code at c0ad643.
R range shared with E93 on this branch: R3750-R3799.

## Commits, as built in this round

| C | What | Tests |
| --- | --- | --- |
| C1 | config.mjs `INFILTRATE` (listen, tail, dash), `ACTIONS.listen.label` "Infiltrate" (DA27), its hint naming the seven rows (DA48), `variants`; the tile's window one list of rows without groups (DA28), the first usable row picked; the Listen row greyed with its reason when the room has no neighbour (it was a refusal after the click) | R3755 (tier 1), E69-T1 (tier 2) |
| C2 | `crossingSettled` on the primary GM (crossing-settle.mjs, Q-E69-6's default) | planned |
| C5 | Dash | planned |
| C3, C4 | Tail Someone and its cards | planned |

## Defaults taken (owner to confirm)

- The tile keeps the ear glyph of `listen` (tools/glyphs.json has it; no new glyph drawn in this round).
- Listen's description (`DRPG.Config.ACTIONS.listen.description`) is the owner's approved text of batch B01a and is
  left as it is; the label and the hint change.
- Until Tail Someone and Dash are built, their rows stand in the window greyed with "Not built yet" - honest on a
  branch, never shipped so.
- Dash's bands (the plan names 0-3 free crossings by band, no numbers): a miss 0, 12+ 1, 18+ 2, a critical 3.
