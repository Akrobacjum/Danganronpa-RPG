# E74 - Doors and Keep Watch in the Infiltrate tile: status

Branch `claude/e93` (E74 follows E69 on it). R numbers from R3750-R3799. Plan: docs/dev/plans/E74.md on
origin/claude/plan-130.

## Done

| Commit | What | Tests |
| --- | --- | --- |
| C1+C2 | The barricade's part of the doors' rules (movement.mjs `barricadedFrom`, beside `restrictedFrom`, which the passages' glow reads alone; a new reason `barricaded`, a rule code of the GMs' audit); Shut the Door: `INFILTRATE.shut` (Body, `maxExits` 2), the bridge road `door.shut`, the GM store `barricades`, the public flag `ROOM_FLAGS.barricaded` (DA47), the barricade down when its author leaves, at the time of day's end and an Eclipse's start, and at the season reset; the row in the Infiltrate window (action-doors.mjs, doors-gm.mjs) | E74-T1 (tier 2), scenario 33 E74-A, scenario 30 "forgeries of Shut the Door" |
| C3 | Force the Door: `INFILTRATE.force` (Body; a lock and a seal at 18), the bridge road `door.force`; one roll against everything that holds the door at once - a barricade by its strength (a tie holds), a GM's or a bedroom's lock and a seal at 18, a critical all; a lock broken until repaired (`setRoomBroken`), a seal lifted for its time of day (`liftSeal`); the banging in the rooms next to either room with no name, who it was to the two rooms, the bedroom owner's card - on a pass and on a miss with Despair | E74-T2 (tier 2), scenario 30 "forgeries of Force the Door" |
| C4 | Pick the Lock: `INFILTRATE.pick` (Hand 15, 18 clean; a Shadow 16 cover), the bridge road `door.pick` with both rolls; at a door held by a lock or a seal (never a barricade) an open walks the picker in (the GM's move) and the lock stays locked; the room beyond sees who it was below the cover; a bedroom's owner warned of an open below 18 and of a miss with Despair | E74-T3 (tier 2), scenario 30 "forgeries of Pick the Lock" |
| C6 | Keep Watch: `INFILTRATE.keepWatch` (Body 12, a default), the bridge road `watch.declare`, the GM store `watches`; declared before an Eclipse (struck through in one and before the Night Eclipse, Q-E74-2), the post the watcher's room at the Eclipse's start with a card of who is in it, a card for each settled crossing into or out of it (never which way), a summary at its end (action-watch.mjs, watch-gm.mjs) | E74-T4 (tier 2), scenario 30 "forgeries of Keep Watch" |

## Next

C5 Repair the Lock, C7 the rest of the registration (the Reroll branches, `OWN_PERFORMERS`), C8 shots and the GM
handbook.

## Not built in C1+C2 (said, not hidden)

- The "Someone tries to get in" card to the author: an honest walk is refused on the walker's own browser by the
  veto, which tells no GM; a card needs a request to the primary from the veto, not written in this round.
- The neutral Remnant a barricade leaves, and Force the Door's Evident one (DA30).
- Force the Door has no legal control in scenario 33 (Aiko's room in the harness has no neighbour); tier 2's E74-T2 is
  its legal road, judged by `G.judge` as the primary judges a player's packet.
- known-leaks.json's row for the public flag (DA47): the file holds only leaks a harness run reproduced (its `about`),
  and no scenario barricades a room while 72-canary reads; the flag holds `true` and nothing else.
- E53's ledger counters (Q-E74-5).
- Keep Watch: the watcher held to the post during the Eclipse (`judgeEclipseCrossing`), a Sanity mark for a miss with
  Despair, and the hindrance die an 18+ watch adds to an opening roll (DA44: `LEGAL_ROLL_MODIFIERS`, `expectedFor`,
  `rollOpening`) - not built; the watch's cards are.
- Pick the Lock's pass that lasts until the picker leaves the room (DA9) and is lost without an entry this time of day:
  in this round the pass is used at once - the GM walks the picker in on an open - so there is no `lockpickStore` and no
  player copy. Owner to confirm, or to ask for the stored pass.
- The owner's warning at the next entry, from `crossingSettled` (DA30): the warning is sent at once, wherever the owner
  is.

## Defaults taken, owner to confirm

- "Open exits" are the room's neighbours a GM's lock does not shut (`openExits`); a seal or a barricade next door is not
  counted out.
- A barricade's strength is the roll's total whatever it is (no threshold to put one up); a critical adds nothing.
- Not in an Eclipse (the barricade would come down at its start anyway), not by a character the GMs hold dead, one
  barricade a room (its author may put it up again, which replaces the strength).
- The Mastermind is stopped by a barricade like anyone; a GM moving a token is not.
- Keep Watch keeps a watch at a Body roll of 12 or more (the plan names no number), and a miss keeps none.
- Force the Door: a barricade gives only to a roll above its strength (a tie holds); forcing is allowed in an Eclipse;
  a Chained character may not force; the player's card says "Nothing holds the door" when nothing did (the pull tells).

## Test results

| When | What | Result |
| --- | --- | --- |
| 12.11, C1+C2 | E74-T1 on a worktree of 9b58219 with only tests-tier2.mjs copied in | failed: no doors-gm.mjs |
| 12.11, C1+C2 | E74-T1 on the tree | 5 passed (after the harness's doorless scene was given Room Setup's neighbours in the test) |
| 12.11, C1+C2 | tiers 0-1 | 1162 passed, 3 failed (R163: `isCritical` let through and not read, fixed; R3755, R3756: the new row, intended), 16 skipped, 1 red (older); the three and R164, R218, R472, R213 green after |

| 12.11, C3 | E74-T2 on a worktree of f7d9fb2 with only tests-tier2.mjs copied in | failed: every packet refused (no `door.force`) |
| 12.11, C3 | E74-T2 on the tree | 5 passed |

| 12.11, C4 | E74-T3 on a worktree of 75aeb8d with only tests-tier2.mjs copied in | failed: every packet refused (no `door.pick`) |
| 12.11, C4 | E74-T3 on the tree | 5 passed |
| 12.11, C3 | tiers 0-1 at the C3 tree | 1165 passed, 0 failed, 16 skipped, 1 red (older) |

| 12.11, C1+C2 | the 34 scenarios (all but 01 and 84) at f7d9fb2 | all green |
| 12.11, C6 | E74-T4 on a worktree of 4f21e9e with only tests-tier2.mjs copied in | failed: no watch-gm.mjs |
| 12.11, C6 | E74-T4 on the tree; tiers 0-1 | 5 passed; 1165 passed, 0 failed, 16 skipped, 1 red (older) |

## Blockers

None.

## Shots

Round 1 (12.11, C1-C6): https://claude.ai/artifact/KH6J3QM34VnLosMt9prJpU - the Infiltrate window with its seven rows,
Force the Door's and Pick the Lock's windows (player), Stained Glass and Monokuma Legacy, EN and PL, 1366x768 at scale 2.
Headless harness in audit/style-harness.html: not Foundry, no Font Awesome, no window frame; the cards are not drawn.
Seen there: Shut the Door and Force the Door draw the same door glyph (the module's glyph map, E48's, draws `fa-door-closed`
and `fa-door-open` alike); the plan asks opposite actions to differ - owner to say, no glyph drawn in this round. Seen and
fixed: Force's and Pick's windows had an empty left column (no briefing); they have the row's line now.
