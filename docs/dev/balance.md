# Balance: what the table measures before a number changes

A developer's document (E53 C3, 15.11.2026; English only, the coordinator's Q10). The GM handbook says how to switch the
log on and read it; this says what it records, how to read it and which questions sessions 0 bring it.

## The rule it serves

D21: numbers are rebalanced on session data, and no rule number changes in E53. Since 05.10.2026 (D21b) a rule change
before 1.3.0 comes with a before/after entry. The owner's answer to Q-E53-3 (15.11.2026): the log is behind a world
switch, off by default, and it records; it never tunes.

## What the log holds

`scripts/balance-log.mjs`, kept in the GM store `balanceLog` (gm-stores.mjs `balanceLogStore`): every GM holds it, no
player's browser does, it goes with the case's backup, and no season's reset cuts it. Nothing clears it yet (not built;
ask for it before a session that needs a fresh log).

| Kind | Written by | When | Fields |
| --- | --- | --- | --- |
| `roll` | the primary GM | each action roll it draws for a player (roll-draw.mjs, after the GMs' record of the roll), while **The balance log records the rolls** is on | the action, the statistic, the total, the Hope and Fear dice, the flat modifiers' sum, the advantage die (faces, sign), the critical, Hope or Fear, and the chapter, day and time of day |
| `note` | any GM | `game.drpg.balanceNote(text)`, while the switch is on | the words (up to 2000 characters), the chapter, who wrote it |

A roll the GM did not draw is not in it: a roll thrown with no GM connected, an item's or a damage roll, Daggerheart's
own rolls. The log holds what the GMs hold.

## How to read it

`game.drpg.balanceReport()` on a GM prints, per action:

- the rolls counted, and, under 20 of them, "too few to read" instead of a rate;
- for an action with a first band or a difficulty in config.mjs (`thresholdOf`: the first band's `min`, else `dc`), how
  many landed (the total at that number, or a critical) against the rate **the exact count** gives for the same flat
  modifiers and advantage die, averaged over the rolls;
- the Hope, Fear and critical split against the exact count's (45.8%, 45.8%, 8.3% for two d12).

**The exact count** is every throw of the two d12 counted (144, times the advantage die's faces where one was thrown),
not a sample: a critical is matching dice and lands whatever the total. It is `exactCount` in balance-log.mjs, held by
R7542 to E64's own counts (a first band at 11 lands 104 throws of 144, at 12: 94). It is what the plan called "the
simulation"; no simulation exists in this repository (read 15.11.2026), and an exact count needs none.

What it cannot say: a GM's ruling (an Observe's hit, a Dynamic action's difficulty, a Facilities action's difficulty)
is not a number in config.mjs, so those actions read "no fixed difficulty to land at" and only their Hope and Fear.

## The rules' before and after

The entries D21b asks for are the repository's, not a world's, and they stand where the change was made. E64's table
is the first set: docs/dev/e64/STATUS.md, "Before and after" (the owner, 12.11.2026: "E53 imports it"). A later stage
that changes a rule number adds its row there, or a table of its own linked from here.

## Questions for sessions 0

Each is a reading of the log, or of the table, to bring back; none changes a number by itself.

1. Do the actions land as often as the exact count says, action by action, once 20 rolls of each are in? A gap that
   stays after 50 rolls is worth a question, not a change.
2. Is Hope against Fear near even (45.8% each, 8.3% critical)? A table far from it is reading a die, a modifier or a
   Call that the count does not know: name it.
3. E64's S02-57, the three things to watch on Role reversal (docs/dev/e64/STATUS.md, "S02-57"): read them at the table
   and write each as a `balanceNote`.
4. Which actions were never rolled in a session? An action nobody takes is a balance question too.
5. The rows of E64's table marked "default taken, owner to confirm": did any of them read wrong at the table?

## Not measured

Nothing of this has run at a table: the log has recorded no session (15.11.2026). The headless tests hold that it
writes only with the switch on and on the primary GM (tier 2 "E53-T1"), and what the exact count and the report
compute (R7542).
