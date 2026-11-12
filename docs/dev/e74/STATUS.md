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
| C5 (part) | Room Setup's Doors tab: the **Broken** column (Q-E74-4's default: the Locked column kept beside it), ticked for a lock a Force the Door or a breach forced; unticked and applied, the lock is mended (`setRoomBroken`). GM handbook EN and PL | E74-T5 (tier 2) |
| C5 | Repair the Lock: `PASSAGE_PRESETS.repairLock` (Hand, Trivial), offered in Start New where a door of the builder's room has a broken lock, judged at the approval (doors-gm.mjs `repairLockRefusal`: broken, a door of the builder's room, one project a lock), its completion row "repairsLock" mending the lock (undone by a Reroll); a GM's repair by hand removes a project under way | E74-T8 (tier 2) |
| C7 | The Reroll replays a Dash, a tail, a barricade, a forced door, a picked lock, a watch and a GM's room action (infiltrate-reroll.mjs), from facts the GMs' runs write on the roll's row; what cannot be taken back is said on its line | E74-T6, E74-T7 (tier 2) |
| Item 3 | The "Someone tries to get in" card (bridge road `door.knock`, from the walker's veto, one card a barricade a quarter minute, no name); the Remnants (a barricade's subtle, a force's evident where heard, a pick's by DA30's bands); the watcher held to the post (the primary's Eclipse sighting puts a walk out of it back, code `onWatch`); a watch missed with Despair marks a Sanity | E74-T9 (tier 2), scenario 33 E74-B, scenario 30 "forgeries of a knock" |

## Next

The coordinator's next word.

## Mutants (12.11, on a worktree of 32b4c1a)

Five, each one line, each run against the test named for it: a barricade giving to a roll of its strength (E74-T2); a
barricade picked as a lock (E74-T3); the two-door limit dropped (E74-T1); a GM's move stopped by a barricade (E74-T1); a
crossing out of the post not told (E74-T4). All five killed. And one of E69's: a critical tail lost to any Dash (E69-T4),
killed.

## Not built (said, not hidden)

- Keep Watch's hindrance die on the opening roll at a watch of 18+ (DA44). Not built, for a reason found in the code: a
  drawn roll's dice are the GM's own list (roll-draw.mjs `expectedFor`), and a die the GM adds that the roller's own window
  did not is a difference "named on a card to the roller" (the trust model's layer two). The killer's browser cannot know
  the victim watches (the watch is the GMs'), so the GM's die would be named to the killer - telling them of the watch.
  A question for the owner: tell the killer's window "a hindrance die" without saying why, or roll it on the GM unnamed.
- Force the Door has no legal control in scenario 33 (Aiko's room in the harness has no neighbour); tier 2's E74-T2 is
  its legal road, judged by `G.judge` as the primary judges a player's packet.
- E53's ledger counters (Q-E74-5).
- Pick the Lock's pass that lasts until the picker leaves the room (DA9): the pass is used at once (the GM walks the
  picker in on an open); no `lockpickStore`, no player copy. Default, owner may revise.
- The owner's warning at the next entry, from `crossingSettled` (DA30): it is sent at once, wherever the owner is.
- A door forced, a lock picked and a room action's effects are not taken back by a lower Reroll; each line says so.

## For the coordinator: the known-leaks row of the barricade flag (DA47)

audit/harness/lib/canary.mjs requires a `deferred` or `foundryLimit` row to have its paragraph in audit/harness/README.md,
marked `<!-- leak:<id> -->`; README is not mine to edit, so neither is added. Proposed row (audit/harness/known-leaks.json):

```json
{ "id": "E74-barricade-flag", "findings": ["DA47"], "class": "metadata", "severity": "low",
  "what": "A barricaded room carries one public region flag (movement.mjs ROOM_FLAGS.barricaded, true), which every browser holds: a console reads which rooms are barricaded. Who put it up and how strong it is stay in the GMs' store `barricades`. Public on purpose (the owner's DA47).",
  "deferred": "1.3.x (D27)",
  "detectedBy": [{ "scenario": "33-bridge-paths", "check": "E74-A: ... the room's public flag, which p2's browser reads" }],
  "readme": "leak:E74-barricade-flag",
  "measuredAt": "E74 C2, 12.11.2026: scenario 33 E74-A read roomBarricaded true on p2's browser for Aiko's barricade" }
```

Proposed paragraph for audit/harness/README.md's list of what stays:

> <!-- leak:E74-barricade-flag --> **A barricade's public flag (E74, DA47).** Shut the Door marks its room with one region
> flag every browser holds, so a console can read which rooms are barricaded - never by whom or how strongly, which stay
> the GMs'. The owner chose it (DA47): the room tile shows the barricade after a pull on its door, and the flag is what the
> veto reads to refuse a walk in on the walker's own browser.

With both in, 33's E74-A check would carry `{ knownLeak: "E74-barricade-flag", measured: e74a.p2 === true }`.

## Defaults taken (default, owner may revise - the coordinator, 12.11)

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

| 12.11, C5 | E74-T5 on a worktree of d8905af with only tests-tier2.mjs copied in | failed: "Room setup drew no Broken box" |
| 12.11, C5 | E74-T5 on the tree (after its put-back was made to restore the room's flags whole); tiers 0-1 | 5 passed; 1164 passed, 1 failed (R2010: the Doors tab's new column, intended), green after |

| 12.11, C3-C6 | the 34 scenarios at f64d5f6 | 33 green; 30 RED: its two door forgeries read `ids.scene`, which it has not - Force's read measured nothing, Pick's threw (fixed in 32b4c1a; 30 green after) |
| 12.11, C5 and after | 30, 33, 40, 41, 60, 65, 66, 74, 76, 83 at 97ef581 (those that read vault.mjs, Room Setup's facade, or action-doors.mjs) | all green |

| 12.11, C7 | E74-T6, E74-T7 on a worktree of a123ff1 with only tests-tier2.mjs copied in | failed: every case the no-replay line, no facts on the rows |
| 12.11, C7 | E74-T6, E74-T7 on the tree; tiers 0-1 | 6 passed; 1164 passed, 1 failed (R1161: "Przerzut" is retired, the lines say "Po Rerollu"), green after |
| 12.11, C5 | E74-T8 at 68ec08d / on the tree; tiers 0-1 | "presetApproval is not a function" / 5 passed; 1165 passed, 0 failed |
| 12.11, item 3 | E74-T9 at e337ac9 / on the tree; tiers 0-1 | "undefined is not a function" / 5 passed; 1163 passed, 2 failed (R164: the knock's run, R1441: the Sanity read's census row), green after |
| 12.11 | CI at df3ffb6 (after the E15-T4 fixture fix) | green - the first green run on this branch; every run before it was red on E15-T4 alone, which I had not checked |

## Pushed

To 32b4c1a (C1-C6 and the fixes); the STATUS commits after it.

## Blockers

None.

## Shots

Round 2 (12.11, at 55dab3e): https://claude.ai/artifact/PbPPeXNmoJqYPhz4NiGEDf - the Infiltrate window's rows wearing E48's
drawings under Stained Glass, and Start New offering Repair the Lock (player), both themes, EN and PL. Monokuma Legacy shows
no row icons there: the harness has no Font Awesome; at a table the rows wear Font Awesome's (Shut `fa-road-barrier`, Force
`fa-hand-fist`).

Round 1 (12.11, C1-C6): https://claude.ai/artifact/KH6J3QM34VnLosMt9prJpU - the Infiltrate window with its seven rows,
Force the Door's and Pick the Lock's windows (player), Stained Glass and Monokuma Legacy, EN and PL, 1366x768 at scale 2.
Headless harness in audit/style-harness.html: not Foundry, no Font Awesome, no window frame; the cards are not drawn.
Seen there: Shut the Door and Force the Door drew the same door glyph (`fa-door-closed` and `fa-door-open` are one
drawing). Fixed after the coordinator's note: Shut wears `fa-road-barrier` (Legacy's barrier) and Force `fa-hand-fist`
(Legacy's fist); under Stained Glass the six rows wear E48's own drawings (tail, dash, shut-door, force-door, pick-lock,
keep-watch) through tests-glyphs.mjs `FACE_RULES`, pixel-icons.css regenerated; `node tools/check.mjs glyphs` green. Seen and
fixed: Force's and Pick's windows had an empty left column (no briefing); they have the row's line now. Version 2 of the
page adds Room Setup's Doors tab with the Broken column (GM); seen there in Monokuma Legacy PL: the headers "Zamknięte"
and "Bez prywatności" are cut in their narrow columns. Checked at the base commit f22a7e87 (the Doors tab captured and
shot the same way, Monokuma Legacy PL): already cut there, before the Broken column - not caused by this stage, left as it
is (a Legacy CSS matter outside E74).
