# E93 - Facilities: status

Branch `claude/e93`, base f22a7e87. R range R3750-R3799. Spec: [SPEC.md](SPEC.md). Plan: docs/dev/plans/E93.md on
origin/claude/plan-130.

## Done

| Commit | What | Tests |
| --- | --- | --- |
| C1 | data: config.mjs `FACILITIES`; facilities.mjs (cleaning, marks, lifetime, the room's and the projects' actions, cost, Overflow shut); the GM store `facilityUses`; the world setting `facilityClosed`; projects.mjs completion row `facility`; a secret project's `facility` kept in the GMs' half (PROJECT_SECRET_WHILE_SECRET and the world-secrets rule) | R3750-R3752 (tier 1) |
| C6 | five Overflow states: Lockdown, Insomnia, Toll, Jitters, Power cut (config.mjs OVERFLOW.effects, overflow.mjs readers); Insomnia read by rest.mjs and sheet-audit.mjs `restCovers` | R3753 (tier 1), E93-T1 (tier 2) |
| C3 | the bridge road `facility.use`: bridge-wire, bridge-table row (`rolled` kind `facility`, named by the action), run bridge-runs-acts.mjs `handleFacilityUse` with facilities-gm.mjs's helpers (offer in the GMs' room, limit, cost, effects, trace, card); roll-draw.mjs: the statistic from the GMs' copy of the action, the record names it, Jitters' die, no draw for an action not in the room; the ask `requestFacilityUse`; the window (action-rest.mjs, action-facilities.mjs); `facility` a write reason (GM's alone) | E93-T2 (tier 2), the GMs' roll-list fixture `situation: "facility"`, scenario 33 E93-A (legal), scenario 30 "forgeries of a room action" (2 checks), flow `facility` |

| C2+C4 | Room Setup's Facilities tab and the two editors (facility-editor.mjs), the tile named Facilities, the Projects window's line, the handbooks (EN, PL), LIVE-E93-01..03 | R3754 (tier 1), E93-T3 (tier 2) |

## State

E93 is done as far as this round goes (pushed: afdc430 C1-C3 and c0ad643 C2+C4). Not built, and said below: the
timed and item effects of goal (5), and a scenario of its own for the stage (scenario 33's E93-A, 30's forgeries and
the tier-2 tests cover the roads). Next on this branch: E69, then E74.

## Mutants (12.11, on a worktree of c0ad643)

Nine, each one line, each run against the test named for it: the limit dropped, a GM's action with no roll let
through, the roll's `named` binding dropped, Lockdown ignored, the difficulty ignored (E93-T2); a lifetime read as
for good, Power cut ignored (E93-T3); Insomnia ignored (E93-T1); Jitters' die dropped (the roll-list fixture test).
All nine killed. Not run as mutants: the draw's room check in roll-draw.mjs (scenario 30 measures it, 7 min a run).

## What a console can still do (watched, not caught)

- ~~Under Toll a GM's action costs 2 actions; the roller's browser pays both before the roll, and the GM's draw sees one
  payment, not its size. A console paying one under Toll rolls all the same.~~ Fixed (the coordinator's item of
  12.11.2026): the GM's draw of a GM's room action needs a payment of its whole price as the GM reads it - one action, the
  Toll's more (facilities.mjs `facilityCost` with overflow.mjs `overflowFacilityToll`) - and a ticket keeps the size of
  the write that paid it, a Burst covering any price (roll-draw.mjs `paymentSize`, `ticketCovers`). A payment of less
  draws no roll, so its `facility.use` names no drawn roll and is refused. R3757 (tier 1); scenario 30, "under Toll the
  GM draws no roll of a GM's room action on a console's payment of one action, and draws it on a payment of two".
  The other paid things of the Facilities tile, read for the same gap:
  - a completed project's action: its price is taken by the GM in the run (bridge-runs-acts.mjs `handleFacilityUse`,
    `spendAction` on the GM, refused when too few), never the console's;
  - the two rests: not drawn, judged by the sheet audit, which covers a rest's gains only when the write took the rest's
    whole `actionCost` or a Burst (sheet-audit.mjs `restCovers`); Toll does not raise them (Q-E93-4's default).
  What stays open, as for every roll: with the GM's draw off (an older Daggerheart build, or Daggerheart 2.12 since
  1.2.106) no roll is drawn and no ticket is read, so the price is the roller's browser's; that is the trust model's
  "a roll not drawn".
- A Reroll of a Facilities roll: not measured. Nothing in E93 replays a use after a Reroll; what reroll.mjs does with a
  roll of `actionKey` "facility" was not read or run in this round.
 Built since (E74 C7, the coordinator's item 2): reroll.mjs hands these keys to infiltrate-reroll.mjs, which replays
  each from the facts the GMs' run wrote on the roll's row; E74-T6 and E74-T7 (tier 2), red at a123ff1. What stands when
  the new roll is lower: a door forced, a lock picked, a room action's effects - each said on its line.

## Test results

| When | What | Result |
| --- | --- | --- |
| 12.11, C1 | R3750-R3752 on a worktree of f22a7e87 with only tests-tier1.mjs copied in (the red reading) | 3 failed: the module does not exist |
| 12.11, C1 | R3750-R3752 on the tree | 3 passed (after two of my test mistakes were fixed: the cap of 8 actions, `null ?? "kept"`) |
| 12.11, C6 | R3753, E93-T1 red before the code; green after | the 26 overflow tests of tiers 0-1 and 83 rest tests of tier 2 green |
| 12.11, C3 | tiers 0-1 at afdc430 | 1161 passed, 0 failed (after five tests of mine and R1448 were fixed), 16 skipped, 1 red (older) |
| 12.11, C3 | scenarios at afdc430 | 30, 33 and the 27 others that name a changed file (10-88, without 01 and 84) all green |
| 12.11, C2+C4 | tiers 0-1 at b271ae1 | 1163 passed, 0 failed, 16 skipped, 1 red (older); own tier 2: 8 passed |
| 12.11, C2+C4 | scenarios at b271ae1 | 30, 33, 40, 41, 50, 66, 74, 76 green |
| 12.11, Toll's price | R3757 at 30ad52a's code (the test alone) | 1 passed, 1 failed: "roll-draw.mjs exports no paymentSize or ticketCovers" |
| 12.11, Toll's price | scenario 30 at 30ad52a's code | 283/285, 1 failed: "under Toll ..." - the one-action payment drawn ("messageId":"ie8zhAQnPzsU06kC") |
| 12.11, Toll's price | R3757; scenario 30; tier 2 by name ("E93-T", "every legal modifier", "payment", "paid", "ticket") | 2 passed; 284/285, the one its Foundry-limit red; 55 ran, 58 passed, 0 failed, 1 skipped |
| 12.11, Toll's price | lint; check.mjs; tiers 0-1 | 0 problems; 17 parts green; 1182 ran, 1166 passed, 0 failed, 16 skipped, 1 red (older) |
| 12.11, Toll's price | scenarios 83, 33, 40 (the drawn rolls' roads) | 110/110, 79/79, 88/88 |

## The owner's answers (DRPG-D1, 12.11.2026)

The owner's answers on the decisions page DRPG-D1, 12.11.2026, through the coordinator. **Approved** as they stand:

- Q-E93-1: the "costs an action" switch is a completed project's action's only; Work keeps its cost.
- Q-E93-2: a room's GM actions are listed only to a character standing in the room. They are region flags, which every
  browser holds, so a console reads them anywhere - the same as a room's description today.
- Q-E93-4: Toll raises the room actions only, not the rests.
- Q-E93-5: "for those present" is read on the GM at the moment of use.
- A Relief's free Short Rest is not barred by Insomnia (it is a Call paid in Hope).
- A GM's room action always costs an action (the 08.11 switch is a project's action's alone, Q-E93-1).
- The tile's hint (`DRPG.Config.ACTIONS.rest.hint`) is left as it was: it speaks of the rests only.
- The project manager's button in the Edit cell after the pen; no new column.

**Changed** by the owner, each built red first (progress below, "This round's changes"):

- Q-E93-6, "Akcja projektu tez zostawia slad": a project's room action leaves a faint Subtle trace too; the rests none.
  **Built** (E93-T4).
- The five new Overflow states, "Wlaczone w losowaniu": they start ticked, in the draw by default; the handbooks say each
  older state now comes up less often. **Built** (R3753).
- A secret project's insiders, "Dostaja": they get its action, on their browsers only. **Built** (scenario 33 E93-B).
- Q-E93-3, "Dodajemy teraz": the timed effects and the effects that needed a new mechanism. In progress.

## This round's changes (the owner's DRPG-D1 answers, 12.11.2026)

| Part | What | Red | Green |
| --- | --- | --- | --- |
| Q-E93-6 | every use of a room action leaves a faint Subtle trace, a project's too (bridge-runs-acts.mjs `handleFacilityUse`); handbooks EN and PL | E93-T4 at 1584394: traces [] | E93-T1..T4 8 passed (4 tests and the runner's 4 checks) |
| The five states | Lockdown, Insomnia, Toll, Jitters and Power cut in the draw by default (config.mjs `OVERFLOW.effects`, `on: true`); GM handbook EN and PL: each older effect now 1 in 13 where the eight were 1 in 8 (the draw is even) | R3753 at 68e4e88: catalogue `on` false | R3753, E15-T4, every test named "verflow" and E93-T*: 41 ran, 45 passed, 0 failed |
| Insiders | a secret project's room action told to its insiders alone, on a veiled private card whose words and meta reach its readers alone (projects.mjs `tellFacility`, read on the insider's browser by facilities.mjs `toldFacility`), as its description is; an action taken off told as none; texts EN and PL | scenario 33 E93-B at 9eddf3d: p1 offered nothing | scenario 33 80/80 (E93-B: p1 offered and uses it; p2's browser: 0 messages, 0 settings name it); mutant sending the card to every player killed (p2: 1 message, 2 settings); tier 2 "secret project", "description", "E93-T", "E44": 78 ran, 81 passed, 0 failed, 1 skipped; tiers 0-1 1166 passed, 0 failed; scenario 72 124/128 (its 4 expected reds) |
| Timed effects 1: the mechanism and +X to a trait | timed-effects.mjs (the GM store `timedEffects` keyed by character, its list written whole; the owner's copy `mineTimedEffects` by the passes' pattern; ends at `timeOfDay` and `day` taken back at `drpgTimeOfDayChanged`); `traitBonus` (the GM picks the statistic, X and the end in the editor; the GM writes the statistic up by X, and down at the end); the sheet's state row shows each as a badge, "+2 Body - until the time of day ends"; texts EN and PL | E93-T5 at db68370: "there is no timed-effects.mjs" | E93-T5 and R161 6 passed; R173 after the store's name (EN, PL); tiers 0-1 1182 ran, 1166 passed, 0 failed; scenario 33 81/81 with E93-C (p1's copy and sheet line, none on p2, ended on the GM); 71 41/41; 72 124/128 (its expected reds) |
| Timed effects 2: a temporary Experience | `experience`: the GM names it (the effect line's text box) and its value X; added to the sheet's Experiences under an id of its own kept on the row, deleted by that id at the end; one with no name is no effect | E93-T6 at e59d373: no kind "experience" | E93-T5, T6 6 passed |
| Timed effects 3: advantage on the next roll | `advantage`: the use arms one Call of advantage on the character from the GM (call-effects.mjs `appendArmedCall`, key "facility"), which the roll window counts, the sheet lists among the armed Calls, and the roll spends; it keeps no row of the timed store, since the armed Calls already end with the next roll and are drawn off the list the GMs hold. That the GM's draw counts it is read in code (roll-draw.mjs `calls` reads `grants` alone), not driven through a draw | E93-T7 at f43bc1d: no kind "advantage" | E93-T7 5 passed |
| Timed effects 4: protection from Despair | `despairShield`: a row that waits until the time of day's or the day's end (the GM's pick); the primary's award of a fresh roll's point (despair-award.mjs `awardRollDespair`, given the message by its chat hook) asks it first (timed-effects.mjs `takeDespairShield`), which stops that point, uses the row up and marks the roll's message `despairShielded`; a Reroll of a marked roll settles no Despair either way (reroll.mjs, read in code, not run). The Sanity a failure costs is not touched | E93-T8 at e1b0ac4: no kind "despairShield" | E93-T8 5 passed: the first roll with Fear gives 0 and is marked, the next gives 1, an unused one ends with the time of day |
| Timed effects 5: crossings in an Eclipse | `eclipseCrossing`: X more crossings for that character until the next Eclipse ends (`endEclipseEffects` at `drpgEclipseChanged` false). Read through one reader beside the store (gm-stores.mjs `timedCrossingsOf`: the GMs' rows on a GM, the owner's copy on a player's) by each per-character judge: eclipse.mjs `eclipseAllowanceFor` (`movesLeft`, the placement table, `judgeEclipseCrossing`, `countCrossingInStep`) and movement.mjs's sighting and veto; a free-placement Eclipse stays free; the announcements keep the Eclipse's own number | E93-T9 at 1abea3a: no kind "eclipseCrossing" | E93-T9 and R161 6 passed |
| Timed effects 6: durability | `durability`: X points of wear off the character's most worn thing as the GMs hold it (inventory.mjs `mendWear`, `itemsHeldNow`), at once, no row kept. **Defaults (open, marked):** a broken thing is passed by - mending it whole stays a Repair project's work; X past that thing's wear is not spread to a second thing; among equals the first on the sheet. One GM write, reason `facility`. The card says the thing and the points, or that nothing is worn | E93-T10 at c17dd14: no durability effect | E93-T10 5 passed; the tier-1 facility tests and R1157 8 passed |
| Timed effects 7: a state ended | `endWounded`, `endBreakdown`: one mark off the state's full track (Health or Sanity) when the character is in it (states.mjs `stateHeld`), at once, no row kept; the primary's hook on the write takes the status off. **Default (open, marked):** the GM's pick is the kind itself - two kinds in the list rather than a third select on every effect line; a character not in the state is told so and nothing is written | E93-T11 at 176eaa5: no kind "endBreakdown" | E93-T11 5 passed; the tier-1 facility tests and R1157 8 passed |
| Timed effects 8: project progress | `projectProgress` (`once`): X progress to the oldest unfinished project the user can see in the room (projects.mjs `projectsAvailableIn`, then `addProgress` on this GM, by the user and the character), at once, no row kept. **Defaults (open, marked):** "oldest" is the first on the board - no creation time is kept, and the board keeps the order projects were made in; only a project tied to this room (one with no room, which Work on Project reaches anywhere, is in no room); an indirect murder is passed by (built by its own Work rolls and their concealment). The card names the project, or says the room has none | E93-T12 at b4285f0: no kind "projectProgress" | E93-T12 5 passed; each of the two filters taken out turns it red (measured 12.11); the tier-1 facility tests and R1157 8 passed |
| Timed effects 9: a stronger next Ultimate | `ultimateBoost`: a row until the time of day's or the day's end, on the sheet. When the character's Ultimate Call is armed (call-effects.mjs `appendArmedCall`, where the GM's road `handleArm` and the player's `armPaidByPlayer` both end), the GM arms one more Call of advantage beside it (key "facility", spent with the same roll) and the row is used up (timed-effects.mjs `boostUltimate`). **Default (open, marked):** "stronger" = a second die of advantage (two dice, the highest kept), as sent 12.11. **Read in code, not run:** the two roads ending in `appendArmedCall`, and the GM's draw throwing two advantage dice from two armed Calls (roll-draw.mjs `diceOf`, the `kh` term) | E93-T13 at 0cb1723: no kind "ultimateBoost" | E93-T13 and E93-T7 6 passed; the tier-1 facility tests, R1157, R161, R220 10 passed |
| Timed effects: the sheet's row | the timed badges in a row of their own under the states' (sheet.mjs `paintStateBadges`, `.drpg-timed-badges` in danganronpa.css: wraps, a badge's words break, `:empty` takes no room); the states' row unchanged (one line, its height reserved, E95). Measured 12.11 in Chromium on the sheet stand-in (`audit/style-harness.html?sheet=parts`, sidebar 275px): before, one badge cut with an ellipsis and, with Breakdown and three, each 31-92px wide ("+2 Bod", "Your next"); after, none cut in either theme or language. Review page (private): https://claude.ai/artifact/SnvMs854ZujQCCSgVB8qQV - not the real sheet: the stand-in, the badges placed by the shoot with the module's classes and the lang texts. Measured, not changed: in Stained Glass the Breakdown badge's content is about a pixel past its box (not visible on the shots; E95's row) | E93-T14 against b1af9a5's sheet.mjs: the line a badge of the states' row, no timed row | E93-T14 and E93-T5 6 passed |
| Timed effects beside the Hope Calls (the owner, 12.11: "w podobnym miejscu co efekty hope calls") | the timed badges moved into the header's stack beside the action pips, where the armed Calls are, as a Call's badge in Hope's colour (sheet.mjs `pendingStack`, now exported; timed-effects.mjs `effectBadges`): what it does on the badge, its end in the tooltip ("From a room action, until the time of day ends"); the row under the states removed with its CSS; a timed badge's words wrap in the stack (`.drpg-timed-badge`). Measured in Chromium on the stand-in, the living student's header added by the shoot with the stand-in's markup: no badge cut, both themes, EN and PL; with an armed Ultimate and three effects the header grows to 303px (Glass) and 200px (Legacy). Review page, same link, before/after: https://claude.ai/artifact/SnvMs854ZujQCCSgVB8qQV. **Open, the owner's call:** the badge's `fa-hourglass-half` has no Stained Glass drawing (Glass's hourglass is the projects', and "one function, one glyph" stands); the stand-in draws no Font Awesome, so neither theme's shot shows the icon | E93-T14 at fbe4453: the badge in the row under the states, none in the stack | E93-T14 5 passed |
| The badge: name, colour, candle (the owner's three asks of 12.11, through the coordinator) | (1) a name of one or two words on the badge (DRPG.Facility.badge.<kind>, EN and PL: "+2 Body", "Experience +2", "Despair shield"/"Tarcza Despair", "Eclipse +2", "Ultimate boost"/"Mocne Ultimate"), what it does and until when in the tooltip ("+2 Body, until the time of day ends"); (2) a white chip (`.drpg-pending-timed`: the sheet's bone ground, ink border and ink text, the header controls' pair), not Hope's gold; (3) Stained Glass wears a candle of its own (tools/glyphs.json glass "timed-effect", FACE_RULES on the badge's fa-hourglass-half; generated by glyph-map.mjs). Measured in Chromium on the sheet stand-in with all five names beside an armed Ultimate: every badge on one line and none cut, both themes, EN and PL (Polish "Doświadczenie +2" was cut in Legacy, so the Polish name keeps "Experience", as the other Polish texts do); "Despair shield" and "Ultimate boost" fill Legacy's 176px stack to its edge. Contrast: ink on chip 14.85:1 (Glass), 12.88:1 (Legacy); chip on the stand-in's ground 17.45:1 and 12.88:1 - the stand-in's ground, not a table's. Legacy keeps Font Awesome's hourglass-half (the stand-in draws no Font Awesome, so the shots show none) | E93-T14 at fce3acc: the whole effect in Hope's gold, the tooltip without it | E93-T14 and E93-T5 6 passed; glyph tests (R3333, R3339, R3349, "glyph") and R3510 32 passed; check glyphs green. The glyph's rule was not shown red alone: its row and its drawing went in together |
| The room action's whispers as E49's card (the coordinator, 12.11: "the facilities' whispered cards take E49's chatCard look") | facilities-gm.mjs's two whispers through `chatCard`: the use's card (`tellUse`) with the Facilities tile's glyph, "{action}: done." as its title and what it did as its list; the GM's text effect a bare card, the GM's words alone. The title is text the card escapes, so the label goes in as typed (it was escaped twice in the first draft: "Tea &amp;amp; cake"; E93-T15 is red with that put back). R3510's table: facilities-gm.mjs `card: 2` where it was `line: 2`. The tail, the watch and the doors' whispers stay the form "line" (read as the coordinator's scope: "the facilities'"). Shots on the same review page (a chat message stand-in: Foundry's chat stylesheet is not there) | R3510 with `card: 2` and E93-T15, both at e469b45: lines, no .drpg-chat-kit | R3510 and E93-T15 green |
| The five states at the draw (the coordinator's check, 12.11) | Toll: the draw takes the whole price (18ee339). Jitters: the draw's situation die. Insomnia: the sheet audit's `restCovers` and the rest window. Power cut: shuts only a completed project's actions, which are not rolled; refused at `facility.use`. **Lockdown was not refused at the draw**: a GM's room action it shut was still drawn on a console's payment, its use refused only after. Now roll-draw.mjs `facilityOfDraw` refuses it (`facilityShut`) | scenario 30 "under Lockdown the GM draws no roll" at ca2a649: drawn (`bIhc75BrTx9f6PSb`) | scenario 30 285/286 (its expected red, a Foundry limit) |
| Must follow E72's merge | The E72 line merges Experience and Ultimate into one Hope Call, "Talent" (the owner's choice, 12.11). `ultimateBoost` reads the Call's key `ultimate` where it is armed (call-effects.mjs `appendArmedCall`); after the merge it must read Talent's key and its texts say Talent. The coordinator reconciles it at the merge | - | - |

## Timed effects (Q-E93-3, "Dodajemy teraz"): the design

The owner's answer of 12.11.2026 (DRPG-D1, through the coordinator) asks for the timed effects and the effects the card
listed as needing a mechanism the module did not have. One shared mechanism, then one effect a commit, red first.

**The mechanism.** A GM store `timedEffects` (gm-stores.mjs), written by the primary alone: a row per effect given,
`{ actorId, kind, n, trait | label | state, until, mark, at, source }`. `until` is one of:

- `timeOfDay`: ends when the time of day it was given in ends (`mark` = chapter, day, time of day);
- `day`: ends when the clock's day changes;
- `nextRoll`: ends with the character's next roll the GM draws (or, for the two that wait on one kind of roll, that roll);
- `eclipse`: ends with the next Eclipse's end.

On the primary, at `drpgTimeOfDayChanged` (and an Eclipse's end) the rows past their end are dropped and what they did is
taken back (a trait's +X written back down, a temporary Experience deleted). Who sees it: the GMs (the store), and the
character's owners through a copy of their own characters' rows (the pattern of the pick's pass, lockpick-gm.mjs), which
the sheet reads. On the sheet: one line under the resources, "Effects", each effect named with what ends it ("+2 Body
until the time of day ends", "advantage on your next roll"). The effects that change a number (a trait, an Experience)
also show in that number itself, which every browser that sees the sheet sees, as any sheet value.

**The effects, as read** (a default where the card's words leave a choice, marked so; owner may revise):

| Effect | Kind | Reading | Ends |
| --- | --- | --- | --- |
| temporary +X to a trait | `traitBonus` | the GM picks the trait and X in the editor; the GM writes the trait up by X | `timeOfDay` or `day`, the GM's pick |
| temporary Experience | `experience` | the GM names it and its value in the editor; added to the sheet's Experiences | `timeOfDay` or `day` |
| advantage on the next trait roll | `advantage` | one die of advantage on the character's next roll the GM draws | `nextRoll` |
| protection from Despair on a roll | `despairShield` | the character's next drawn roll awards no Despair (a default: the roll's Despair to the pool, not the Sanity a failure costs) | `nextRoll` |
| a stronger next Ultimate Hope Call | `ultimateBoost` | the character's next Ultimate Call gives two dice of advantage instead of one (a default reading of "stronger") | that Call |
| a crossing in an Eclipse | `eclipseCrossing` | X more crossings in the next Eclipse | `eclipse` |
| an item's durability | `durability` | X durability back to the character's most worn module item that can wear (a default: no pick in the window) | at once |
| a state removed | `removeState` | the GM picks Wounded or Breakdown in the editor; the use clears the one mark that keeps it (a default: the module's states are read off the tracks) | at once |
| project progress | `projectProgress` | +X to the oldest unfinished project in the room the character can see (a default: no pick in the window) | at once |

The last three are not timed; they are listed here because the card named them with the rest. Each effect is a kind of
`FACILITIES.effects` with its fields in the room-action editor (facility-editor.mjs) and a line on the user's card, EN and
PL.

**Order of building**: the mechanism with `traitBonus`, then `experience`, `advantage`, `despairShield`,
`eclipseCrossing`, `durability`, `removeState`, `projectProgress`, `ultimateBoost` (last: its Call is approved on a GM's
card, the largest of them). Progress is kept in "This round's changes" above.

## Not built in this round (said, not hidden)

The effects that need a mechanism the module does not have: an item's durability, a state removed, temporary +X to a
trait, a temporary Experience, advantage on the next trait roll, a stronger next ultimate Hope Call, protection from
Despair on a roll, a crossing in an Eclipse, project progress (needs a pick of the project). No timed effect exists to
extend (`git grep -i "temporary\|expire" scripts/call-effects.mjs`: nothing at f22a7e87).

## Blockers

None.

## Tokens so far

Not measured: this session has no reading of its own token count.

## Shots

Round 1 (12.11, C2 and C4): https://claude.ai/artifact/2Mw3Hb4WstZZ8mLs9DaxdE - the Facilities window (player), Room Setup's
Facilities tab, the two editors, Despair Flow's Overflow tab (with its five new rows) and the project manager, each in
Stained Glass and Monokuma Legacy, EN and PL, 1366x768 at scale 2. Drawn by the headless harness and shown in
audit/style-harness.html in Chromium: not Foundry, no Font Awesome (icons blank), no Foundry window frame. Seen
there: the rests' sentence "No room on this map is marked for a yet" - an older text with an empty `{kind}`, not this
stage's; left as it is.
