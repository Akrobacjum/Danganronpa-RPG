# S0-CARDS: what each result card says its roll did (E129, line DESP)

The owner, 23.11.2026: "Zamiast tego niech one rezultatu akcji jasno mowia graczowi, co jest skutkiem jego wyniku i
dzialan, w tym krytyka." Built on `claude/desp-122` from 4e5d2e8b, 23.11.2026. The rows are line UI's inventory,
docs/dev/owner127/INVENTORY.md; what each road gives is REFUNDS.md here.

## The lines

One builder, action-report.mjs `rollEffectLines` / `rollEffectsHtml`, writes a list under a roll's dice
(`drpg-roll-effects`). Each line names a rule and what this roll fell into. None names a resource's new value: the GM's
Hope write and the card are not ordered (dice-hold.mjs draws the write when the dice land), so "your Hope is now N" could
be read before it is true.

| The roll | EN | PL |
| --- | --- | --- |
| main, with Hope | With Hope: you earn 1 Hope. | Z Hope: dostajesz 1 Hope. |
| main, a critical | A critical: you earn 2 Hope. Unlike plain Daggerheart, it restores no Sanity. | Krytyk: dostajesz 2 Hope. Inaczej niż w czystym Daggerheart nie przywraca Sanity. |
| main, with Despair | With Despair: you earn no Hope, and its point of Despair goes to the pool of the Monokuma who watches you. | Z Despair: nie dostajesz Hope, a punkt Despair z tego rzutu trafia do puli Monokumy, który cię pilnuje. |
| supporting (a cover, staying unseen, a concealment) | Your roll of {trait} only supports the action, so it earns no Hope. | Rzut na {trait} tylko wspiera akcję, więc nie daje Hope. |
| supporting, with Despair | ... and: Its point of Despair still goes to the pool of the Monokuma who watches you. | ... i: Jego punkt Despair i tak trafia do puli Monokumy, który cię pilnuje. |

The numbers come from placeholders (`CRITICAL.hope`, and Daggerheart's 1), as plural families. A price given back after
the dice (`giveBackAfterRoll`; the owner's "c" keeps it) is now said on a card of its own, in the corner as every
refusal is: "{what} comes back to you, as the action did not go ahead." / "{what} wraca do ciebie, bo akcja nie doszła
do skutku.", with the roll's lines under it.

What a card already said of a give-back stays as it was: Work on Project's critical ("A critical gives you the action
back."), a Tamper's give-back (`backLine`), a Stage 6 attempt's. R8675's rule holds: the lines are read off the roll
alone, so a Despair with a trace placed and one without say the same (R8885).

## The 46 rows

| Rows | Cards | Since S0-CARDS |
| --- | --- | --- |
| 1-4, 16-18, 29, 31, 33, 38 | the acting player's card through action-report.mjs `report` | the main roll's line; a Palm's and an unseen Frisk's cover too (`supportRolls`); a project's two concealments and Hide Traces under their own line |
| 5, 10, 21, 23 | Observe's, Analyze's, Listen's and Tail's roll cards (`rollHead`) | the line of each roll the card shows; Tail's staying unseen as supporting |
| 24-28 | Dash, Shut, Force the Door, Pick the Lock, Keep Watch (`rollResultCard`) | the main roll's line; Pick the Lock's cover as supporting |
| 39, 40 | Tamper's card, Stage 6's (cleanup.mjs, on the GM) | the roll's line, read off the roll as the GMs' record holds it |
| 6-9, 11-15, 30, 32, 34-37, 46 | the GM's verdicts that follow an attempt (a bullet copied, a stash found, a steal's take, what a Frisk saw) | unchanged: no roll of their own; the attempt's card before them says its roll's lines |
| 19, 20, 22, 44, 45 | Rest, a room action, Echoes, Use an Item and a creative use's ruling | unchanged: Rest and Echoes throw no dice; the room action's and an item's cards already list what they gave (Hope, a move, Health) |
| 41-43 | the opening roll, a killer's Stage 4, every crisis action | unchanged: open, a question below |

## Not done, and why

- **Crisis and opening rolls (rows 41-43).** Whether an incident's rolls earn Hope as an action's do is the incident's
  own rule, and this line did not read it to the end. A line there could state a rule the code does not run (M2). Asked
  in the report.
- **A concealment's critical Sanity (T1).** Tamper's concealment critical gives 1 Sanity back through the GM
  (`coverGiveBack`); whether its card says so was not read.
- **Hope at its maximum.** The rule's line says "you earn 1 Hope" even when Hope is full and Daggerheart does not raise
  it. A line read off the sheet at the card's time would race the GM's write (above); not built.
- **Two readings of "supporting".** The card reads the roller's `rollTrait` (`remember: false`, not the opening); the GM's
  draw reads the key (`SPENDS_NO_CALL`, or no key). R8381 holds every keyed `remember: false` roll to that list; a keyless
  roll thrown with `remember` on would earn no Hope on the GM and be called a main roll here. None was found; not measured.
