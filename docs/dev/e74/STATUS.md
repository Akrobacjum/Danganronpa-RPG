# E74 - Doors and Keep Watch in the Infiltrate tile: status

Branch `claude/e93` (E74 follows E69 on it). R numbers from R3750-R3799. Plan: docs/dev/plans/E74.md on
origin/claude/plan-130.

## Done

| Commit | What | Tests |
| --- | --- | --- |
| C1+C2 | The barricade's part of the doors' rules (movement.mjs `barricadedFrom`, beside `restrictedFrom`, which the passages' glow reads alone; a new reason `barricaded`, a rule code of the GMs' audit); Shut the Door: `INFILTRATE.shut` (Body, `maxExits` 2), the bridge road `door.shut`, the GM store `barricades`, the public flag `ROOM_FLAGS.barricaded` (DA47), the barricade down when its author leaves, at the time of day's end and an Eclipse's start, and at the season reset; the row in the Infiltrate window (action-doors.mjs, doors-gm.mjs) | E74-T1 (tier 2), scenario 33 E74-A, scenario 30 "forgeries of Shut the Door" |
| C3 | Force the Door: `INFILTRATE.force` (Body; a lock and a seal at 18), the bridge road `door.force`; one roll against everything that holds the door at once - a barricade by its strength (a tie holds), a GM's or a bedroom's lock and a seal at 18, a critical all; a lock broken until repaired (`setRoomBroken`), a seal lifted for its time of day (`liftSeal`); the banging in the rooms next to either room with no name, who it was to the two rooms, the bedroom owner's card - on a pass and on a miss with Despair | E74-T2 (tier 2), scenario 30 "forgeries of Force the Door" |

## Next

C4 Pick the Lock, C5 Repair the Lock, C6 Keep Watch, C7 the rest of the registration, C8 handbooks and shots.

## Not built in C1+C2 (said, not hidden)

- The "Someone tries to get in" card to the author: an honest walk is refused on the walker's own browser by the
  veto, which tells no GM; a card needs a request to the primary from the veto, not written in this round.
- The neutral Remnant a barricade leaves, and Force the Door's Evident one (DA30).
- Force the Door has no legal control in scenario 33 (Aiko's room in the harness has no neighbour); tier 2's E74-T2 is
  its legal road, judged by `G.judge` as the primary judges a player's packet.
- known-leaks.json's row for the public flag (DA47): the file holds only leaks a harness run reproduced (its `about`),
  and no scenario barricades a room while 72-canary reads; the flag holds `true` and nothing else.
- E53's ledger counters (Q-E74-5).

## Defaults taken, owner to confirm

- "Open exits" are the room's neighbours a GM's lock does not shut (`openExits`); a seal or a barricade next door is not
  counted out.
- A barricade's strength is the roll's total whatever it is (no threshold to put one up); a critical adds nothing.
- Not in an Eclipse (the barricade would come down at its start anyway), not by a character the GMs hold dead, one
  barricade a room (its author may put it up again, which replaces the strength).
- The Mastermind is stopped by a barricade like anyone; a GM moving a token is not.
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

## Blockers

None.

## Shots

Not taken for C1+C2 yet: the Infiltrate window's new row (planned with C8, the seven rows).
