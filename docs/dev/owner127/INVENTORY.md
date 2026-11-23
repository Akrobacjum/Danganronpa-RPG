# OWNER-127-CENTRE: which action result cards take the middle

The owner, at the table on 22.11.2026: "Zauwazylem ze nie wszystkie akcje wyswietlaja powiadomienie na srodku (np
facilities). Do naprawienia juz w 1.2.127."

## How it was read

- **When:** 22.11.2026, on `claude/ui-123` from origin/main 2e28785a (v1.2.126).
- **How:** a read-only agent drew a first inventory from the source. Every row this stage changes was then read again in
  the code by hand before it was flagged, and every row that already centred is as 1.2.124 left it (R8673).
- **What decides the middle:** a card asks by a name of `scripts/notice-centre.mjs` `CENTRED_NOTICES`, and
  `centredNotice` honours the name for a GM's card, or for a card read by its own writer.
- **Who it reaches:** a GM's browser draws no whispered card at all (popup.mjs's catch-all), so a card the primary GM
  writes to a student's owners centres for those owners alone.

Key to the columns:

- **Writer** - P is the acting player's browser; GM is the primary GM, in its bridge run.
- **Before** - whether the card centred on 2e28785a.
- **After** - whether it centres from this stage on.

## 1. The acting player's result card

| # | Action - road | Poster | Writer | Before | After |
| --- | --- | --- | --- | --- | --- |
| 1 | Search - an item found | action-search.mjs `performSearch` -> action-report.mjs `report` | P | yes | yes |
| 2 | Search - nothing found | action-search.mjs `searchNothing` -> `report` | P | yes | yes |
| 3 | Search - a token refused | action-search.mjs `searchUnclaimed` -> `report` | P | yes | yes |
| 4 | Search - something specific, sent | action-search.mjs `searchSpecific` -> `report` | P | yes | yes |
| 5 | Observe - the attempt (its roll) | action-observe.mjs `settleObserveRoll` (`rollCardFlags`) | P | yes | yes |
| 6 | Observe - a Truth Bullet copied | observe.mjs `createFind` | GM | no | **yes** |
| 7 | Observe - a miss | observe.mjs `chargeObserveMiss` | GM | no | **yes** |
| 8 | Observe - a trace already held | observe.mjs `alreadyHeld` | GM | no | **yes** |
| 9 | Observe - a secret project noticed | observe.mjs `shareFoundProject` | GM | no | **yes** |
| 10 | Analyze - the attempt (bullet, hint, stash, passage) | action-analyze.mjs (`rollCardFlags`) | P | yes | yes |
| 11 | Analyze - a bullet identified | analyze.mjs `identify` | GM | no | **yes** |
| 12 | Analyze - a bullet locked | analyze.mjs `lockOut` | GM | no | **yes** |
| 13 | Analyze - a stash found | stash-reach.mjs `resolveStashSearch` | GM | no | **yes** |
| 14 | Analyze - no stash (missed, none, no room) | stash-reach.mjs `resolveStashSearch` (`STASH_MISS`) | GM | no | **yes** |
| 15 | Analyze - a passage found, or nothing | passages-gm.mjs `resolvePassageSearch` | GM | no | **yes** |
| 16 | Work on Project | action-project.mjs `workOnProject` -> `report` | P | yes | yes |
| 17 | Sabotage | action-project.mjs `performSabotage` -> `report` | P | yes | yes |
| 18 | Dynamic action | action-dynamic.mjs `performDynamic` -> `report` | P | yes | yes |
| 19 | Rest - short or long | rest.mjs `takeRest` | P | no | **yes** |
| 20 | A room action (Facilities, Rest's menu) | facilities-gm.mjs `tellUse` | GM | no | **yes** |
| 21 | Listen | action-listen.mjs `performListen` (`rollCardFlags`) | P | yes | yes |
| 22 | Echoes | action-listen.mjs `performEchoes` | P | no | **yes** |
| 23 | Tail - unseen / noticed | action-tail.mjs `tailCard` | P | yes | yes |
| 24 | Dash | action-listen.mjs `performDash` (`rollResultCard`) | P | yes | yes |
| 25 | Shut the Door | action-doors.mjs `performShut` (`rollResultCard`) | P | yes | yes |
| 26 | Force the Door | action-doors.mjs `doorCard` | P | yes | yes |
| 27 | Pick the Lock | action-doors.mjs `doorCard` | P | yes | yes |
| 28 | Keep Watch | action-watch.mjs `performWatch` (`rollResultCard`) | P | yes | yes |
| 29 | Palm - Steal, the player's card (sent) | palm.mjs `performPalm` -> `report` | P | yes | yes |
| 30 | Palm - a Steal's verdict | palm.mjs `stealFromPerson` | GM | no | **yes** |
| 31 | Palm - Plant, the player's card (sent) | palm.mjs `resolvePlant` -> `report` | P | yes | yes |
| 32 | Palm - a Plant's verdict | palm.mjs `plantOnPerson` | GM | no | **yes** |
| 33 | Frisk unseen - the player's card (sent) | frisk.mjs `performFrisk` -> `report` | P | yes | yes |
| 34 | Frisk unseen - what was seen | frisk.mjs `friskPerson` | GM | no | **yes** |
| 35 | Frisk unseen - a Reroll's replay | frisk.mjs `replayRummage` | GM | no | **yes** |
| 36 | Frisk openly - shown, forced, missed, walked away, interrupted | frisk.mjs `endAsk` | GM | no | **yes** |
| 37 | Frisk openly - refused, no answer | frisk.mjs `noYes` | GM | no | **yes** |
| 38 | Frisk openly - force, the player's card (sent) | frisk.mjs `performFriskOpenly` -> `report` | P | yes | yes |
| 39 | Tamper - erase, reshape | cleanup.mjs `report` | GM | yes | yes |
| 40 | Tamper - a Misleading Trail, Move the Body (Stage Six) | cleanup.mjs `resolveStageSix` | GM | no | **yes** |
| 41 | Direct Murder - the opening roll scored | murder-rules.mjs `announceOpening` | GM | no | **yes** |
| 42 | Direct Murder - a killer's own Stage 4 went through | murder-rules.mjs `resolveKillerOpening` | GM | no | **yes** |
| 43 | Every crisis action (Use an Item, Leave a Clue, Secure a Trace, Self-Defence, Survive, Role Reversal, Strike, Pin, Keep Distance, the weapon swing (`weaponAttack`), Finishing Blow, Escape Together, Double Role Reversal, Crime Partners, Averted Eyes) | murder-rules.mjs `announceCrisis` (the card and its hidden copy) | GM | no | **yes** |
| 44 | Use an Item | use-items.mjs `useItem` | P | no | **yes** |
| 45 | Use an Item creatively - the GM's ruling | use-items.mjs `grantItemEffect` | GM (the ruling GM) | no | **yes** |
| 46 | A stash rifled - what was taken | stash-reach.mjs `stealFromVault` | GM | no | **yes** |

### Counts

- **Centred before:** 21 of the 46 rows (rows 1-5, 10, 16-18, 21, 23-29, 31, 33, 38, 39).
- **Centred after:** 46 of 46.
- **Newly centred:** 25 rows (marked **yes**: 6-9, 11-15, 19, 20, 22, 30, 32, 34-37, 40-46).
- **Byte-for-byte rule:** what each card says is unchanged; only the ask is added. R8675's rule for a Despair's trace
  stands.
- **Crisis cards:** a crisis action's card reaches every seat of the incident with its result (each seat waits on the
  turn), and so takes the middle on each of their screens.

**Actions with no card of their own:**

- **Move:** `performAction` answers null; a crossing's card is a receipt (below).
- **Conceal Intent, Hide Traces:** sub-rolls of Work on Project; their lines are on its card, row 16.
- **Hide:** there is no Hide action in the code.

## 2. Kept in the corner on purpose

| Card | Poster | Why it stays |
| --- | --- | --- |
| Search's specific ask answered | messenger-app.mjs `ruleSearchMiss` and the GM's item windows | the messenger draws its own card |
| An Observe or Analyze ruled on a GM's card | call-gm.mjs `callGm` | a card to the GMs; the player's verdict is rows 6-9, 11-15 |
| Start a new project (proposal sent) | action-project.mjs `startProject` | a receipt; the GM's answer comes later |
| Sabotage's concealment failed, own card | action-project.mjs `concealSabotage` | an intermediate step of row 17 |
| Eavesdropping begun | action-listen.mjs `tellEavesdrop` | a later step of Listen |
| A clean-up's cover against witnesses | cleanup.mjs `concealFromWitnesses` | an intermediate step of row 39 |
| Direct Murder declared, betrayal parked | action-murder.mjs `performDirectMurder`, `performBetrayal` | receipts; rows 41-43 are the results |
| Use an Item creatively, sent | use-items.mjs `useCreatively` | a receipt; row 45 is the result |
| A broken item discarded | use-items.mjs `discardBroken` | a receipt of the player's own discard |
| A crossing made, its price | movement.mjs `chargeForCrossing` | a receipt; Move has no result card |
| A Hope Call's card | calls.mjs `postHopeCallCard` | a Call's receipt (notice-centre.mjs keeps Calls in the corner) |
| A Tail's later steps (the target moved, the tail ended) | tail-gm.mjs `onTailCrossing`, `endTail` | later steps, kept in the corner by 1.2.124 |
| Keep Watch's later steps (start, a crossing, the summary) | watch-gm.mjs | later steps |
| A project finished, a passage built | projects.mjs, passages-gm.mjs | announcements to the table, not one action's result |
| Every refusal (Dynamic refused, a trace not found or reinforced, a stash already rifled, hands full, a crossing with no budget, a Frisk refused early) | action-dynamic.mjs, cleanup.mjs, stash-reach.mjs, movement.mjs, frisk.mjs | refusals stay in the corner (1.2.124) |
| Tool wear, a loaded die, a Call armed, a crossing refunded, tools broken | use-items.mjs, action-pipeline.mjs, call-effects.mjs, movement.mjs, cleanup.mjs | receipts |
| The GMs' records | cleanup.mjs, stash-reach.mjs, passages-gm.mjs, murder-rules.mjs, action-dynamic.mjs | the GMs' own records; a GM's browser draws no whisper |
| The time of day, the messenger's replies | clock, messenger-app.mjs | notice-centre.mjs keeps them in the corner |

## 3. Cards about something that happened TO a player who did not act

These are the coordinator's default to the owner, pending the owner's answer, in a commit of their own (named in the report).

| Card | Poster | Writer | Centred by that commit? |
| --- | --- | --- | --- |
| "You are being tailed" (a Tail noticed), to the target | tail-gm.mjs `startTail` | GM | yes |
| A Steal or a Plant felt, to the victim | palm.mjs `tellPalmVictim` | GM | yes |
| An unseen Frisk felt, to the target | frisk.mjs `friskPerson` | GM | yes |
| An open Frisk's outcome, to the target | frisk.mjs `endAsk` | GM | yes |
| A Sabotage seen or watched, to the room | action-project.mjs `soundSabotage`, `concealSabotage` | P (the saboteur's browser) | **no**: see below |
| A bedroom's lock found broken, to its owner | doors-gm.mjs `bedroomExtra` | GM | already (1.2.124, `lockBroken`) |
| A body found | body.mjs `runDiscovery` | GM | already (`bodyFound`) |

**A Sabotage seen stays in the corner.** Its card is written by the saboteur's browser to the room. The writer rule
never centres a player's card on another player's screen: that rule is what keeps a console from putting a card in the
middle of every screen. Centring it would mean posting it from the primary GM, a change to the Sabotage's road rather
than to its card, which this stage does not make. It is for the owner to ask.

**Other cards to bystanders stay in the corner.** These are the room's witnesses of a Steal, a Plant or a Frisk; the
banging of a forced door; a breach heard; an incident begun, joined or closed; a stash noticed; and a room action's
text to its target. They are not "something done to you" in the owner's three examples.
