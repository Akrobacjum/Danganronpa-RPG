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
| DA44 | Keep Watch's hindrance die (the owner's option A, 12.11.2026): a victim's running watch of 18 or more, or a critical, puts one hindrance die on the killer's opening roll. The primary reads it when it asks the killer's browser (the invitation carries `hindrance: 1`, nothing of the watch) and when it draws the roll (roll-draw.mjs `situationReading`); the killer's window names it "a hindrance die" ("kość utrudnienia") with no cause (watch-gm.mjs `openingHindrance`, call-effects.mjs `armOwnHindrance`, roll-dialog.mjs). Player handbook EN and PL | E74-T10 (tier 2), a `MODIFIER_FIXTURES` row (tier 2's "every legal modifier the GM lists is scored without an alarm") |
| DA9 | Pick the Lock's pass, as the plan has it (the owner, 12.11.2026: "Wole zgodnie z planem"): an open is a pass for the picker alone to the room beyond, kept by the GMs (`lockpickStore`) and copied to its owner (`lockpickCopy`, read by the owner's veto); nobody is walked in. It lets its holder past a lock, a bedroom and a seal of that one room (movement.mjs `holdsPass`), ends when they leave the room after entering, is lost at the time of day's end if not used, and a Reroll below 15 takes back one not used (lockpick-gm.mjs, infiltrate-reroll.mjs). Texts and player handbook EN and PL | E74-T11 (tier 2), scenario 33 E74-C, scenario 30 "a forged pass"; E74-T3 and E74-T6 read the pass now |
| Item 3 | The "Someone tries to get in" card (bridge road `door.knock`, from the walker's veto, one card a barricade a quarter minute, no name); the Remnants (a barricade's subtle, a force's evident where heard, a pick's by DA30's bands); the watcher held to the post (the primary's Eclipse sighting puts a walk out of it back, code `onWatch`); a watch missed with Despair marks a Sanity | E74-T9 (tier 2), scenario 33 E74-B, scenario 30 "forgeries of a knock" |

## Next

The coordinator's next word.

## Mutants (12.11, on a worktree of 32b4c1a)

Five, each one line, each run against the test named for it: a barricade giving to a roll of its strength (E74-T2); a
barricade picked as a lock (E74-T3); the two-door limit dropped (E74-T1); a GM's move stopped by a barricade (E74-T1); a
crossing out of the post not told (E74-T4). All five killed. And one of E69's: a critical tail lost to any Dash (E69-T4),
killed.

## Not built (said, not hidden)

- ~~Keep Watch's hindrance die (DA44)~~: built after the owner's answer of 12.11.2026, option A (the row DA44 above).
- Force the Door has no legal control in scenario 33 (Aiko's room in the harness has no neighbour); tier 2's E74-T2 is
  its legal road, judged by `G.judge` as the primary judges a player's packet.
- E53's ledger counters (Q-E74-5).
- ~~Pick the Lock's pass (DA9)~~: built as the plan has it after the owner's answer of 12.11.2026 (the row DA9 above).
  Read where the plan was not exact, then confirmed by the owner (12.11.2026, 13:25 Warsaw, through the coordinator:
  "tak", "tak"): "that room" is the room the lock opens; a pass in use is kept until its holder leaves that room. A pass
  not used is lost at the time of day's end (the plan's own words).
- ~~The owner's warning at the next entry, from `crossingSettled` (DA30): it is sent at once, wherever the owner is.~~ Built
  after the audit of 1.2.113 (A113-C5-1): at once when the owner stands in the room, else kept in the GMs' store
  `lockNoticeStore` and told at their next entry (a settled crossing or a GM's move of the token; arrival-notices.mjs).
- A door forced, a lock picked whose pass was used, and a room action's effects are not taken back by a lower Reroll;
  each line says so. A pass not used is taken back.

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

The owner's answers of 12.11.2026 (about 11:20 Warsaw, through the coordinator): the barricade's rules below (its strength
the roll, a tie holds, none in an Eclipse, one a room, the Mastermind stopped, forcing allowed in an Eclipse) "Zgoda";
Keep Watch at Body 12 "Zgoda"; DA44 option A and DA9 "Wole zgodnie z planem" (built, above). Marked **confirmed** where
they answer a row; the rest stay defaults.

- "Open exits" are the room's neighbours a GM's lock does not shut (`openExits`); a seal or a barricade next door is not
  counted out.
- A barricade's strength is the roll's total whatever it is (no threshold to put one up); a critical adds nothing. **Confirmed.**
- Not in an Eclipse (the barricade would come down at its start anyway), not by a character the GMs hold dead, one
  barricade a room (its author may put it up again, which replaces the strength). **Confirmed** (none in an Eclipse, one a room).
- The Mastermind is stopped by a barricade like anyone; a GM moving a token is not. **Confirmed.**
- Keep Watch keeps a watch at a Body roll of 12 or more, and a miss keeps none. **Confirmed by the owner, 12.11.2026: "Zgoda".**
- Force the Door: a barricade gives only to a roll above its strength (a tie holds); forcing is allowed in an Eclipse
  (**both confirmed**);
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
| 12.11, DA44 | E74-T10 on the tree before the code | failed: "watch-gm.mjs has no openingHindrance" |
| 12.11, DA44 | E74-T10 on the tree; with R291 and "every legal modifier the GM lists is scored without an alarm" | 5 passed; 7 passed |
| 12.11, DA9 | E74-T11 on the tree before the code | failed: "there is no lockpick-gm.mjs" |
| 12.11, DA9 | E74-T11; E74-T1..T11 and E69-T* | 5 passed; 16 passed, 2 failed (E74-T3 and E74-T6, which read the walk-through: intended, they read the pass now), then 6 passed for the two |
| 12.11, DA44 and DA9 | tiers 0-1 | 1161 passed, 4 failed (R160: the new socket's flow; R220 and R553: the pick's token write gone; R603: `restrictedFrom`'s first line read by shape), all intended, then 1165 passed, 0 failed, 16 skipped, 1 red (older) |
| 12.11, DA44 and DA9 | own tier 2 by name ("opening", "roll window", "E74-T", "E69-T", "E93-T", "every legal modifier", "Reroll") | 203 ran: 205 passed, 0 failed, 2 skipped, 0 red |
| 12.11, DA44 and DA9 | scenario 33 with E74-C | 79/79 |
| 12.11, DA44 and DA9 | every scenario but 01 and 84, at 4780019's tree (two streams, 61 alone after) | all 34 green; 61 113/113; only the expected reds each names |
| 12.11 | CI at 4780019 (run 43211351923) | cancelled while queued, by the owner's decision of 12.11 (through the coordinator): every push carries "[skip ci]", CI runs once on the release's head; the local checks above stand in for it |
| 12.11, mutants | the watch's term dropped from the GM's draw; the invitation's `hindrance` dropped; the owner's veto not reading its copy | killed by E74-T10 and the fixture test; by E74-T10; by scenario 33 E74-C (78/79) |

## Pushed

To 4780019 (C1-C7, item 3, the owner's answers of 12.11: DA44 and DA9) and the STATUS and notes commits after it.

## Blockers

None.

## Shots

Round 3 (12.11, after the owner's answers on DA9 and DA44): https://claude.ai/artifact/4tScC3eidUminXuJTjkS6X - Pick the Lock's
window with its new texts (the pass: "for you alone, until you leave the room beyond"), both themes, EN and PL, at scale 2.
Headless harness in audit/style-harness.html: not Foundry, no Font Awesome, no window frame. Not shown: the card after an open,
and the roll window's "a hindrance die" line (the harness draws no Daggerheart roll window); their texts are measured by
E74-T10 and E74-T11 and scenario 33 E74-C.

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
