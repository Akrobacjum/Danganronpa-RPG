# Danganronpa RPG - GM Handbook

*For the Foundry VTT v14 module "Danganronpa RPG", version 1.2.60, built on the Daggerheart system.*

This is the handbook for the people running the killing game. It follows the order a season is actually built and played: install, set up, run a day, run a murder, run an investigation, run a trial, end the chapter, start again. Where a decision is the GM's to make rather than the module's, the text says so.

> [!NOTE]
> Every number in this handbook is quoted from `scripts/config.mjs`; if a rule ever seems to disagree with what you see at the table, that file is the authority and this document is the commentary.

The glossary stays in English in every language the module speaks: Hope, Despair, Sanity, Health, Truth Bullet, Remnant, Key Remnant, Blackened, Class Trial, Daily Life, Eclipse, Mastermind, Monokuma, Monocub, Ultimate, Vault, Stash, the names of the Calls and the names of the actions. They are the game's proper names.

---

## 1. Installation and dependencies

Install from Foundry's **Add-on Modules** tab with **Install Module** and this manifest URL:

```
https://github.com/Akrobacjum/Danganronpa-RPG/releases/latest/download/module.json
```

Then install the system and the modules below from their own package pages. The module refuses to start without the required one and names it, as "not installed" or "installed, but switched off". A GM is warned about the two recommended ones at every world load, in a window that says what each one does, until they tick its "Do not mention this again on this computer" checkbox; everything works without them. The module never installs anything by itself.

| Needs | Version |
|---|---|
| Foundry VTT | 14.364 or newer (verified on 14.365) |
| Daggerheart (Foundryborne) | 2.6.5 or newer (verified on 2.6.5; a newer version loads and the module tells the GM once per version) |

| Module | Status | Why |
|---|---|---|
| Dice So Nice! | required | Every roll in this game is thrown in front of the table; this is how the duality dice are seen |
| Isometric Perspective | recommended | The academy maps are drawn isometrically; without it the scenes, tokens and Remnants land on a grid the art was never made for. Square maps still work |
| LiveKit AVClient | recommended | Per-room voice: regions become breakout rooms, and moving between rooms moves who can hear you. Without it the whole school talks on one channel |

The module does not use libWrapper. If Isometric Perspective ever asks for it, that module's own page says so.

The module was developed and played on The Forge and works the same on any Foundry v14 host.

**Starting a world.** Make a world on the Daggerheart system, enable the module and its dependencies, then open the GM panel (the **GM** button in the left column, under the clock) and run **Set the season up**. Everything after that is section 2.

**Module settings worth knowing.** Under Foundry's module settings you will find, among others: *Force private player rolls* (every player roll is whispered to that player and the GMs), *Keep character sheets anonymous* (another player's sheet opens redacted), *Search tokens per room*, *Lock the roll window for players*, *Players only see who is in their room*, *Rooms decide what players can see* (the room fog), *Players cannot edit Actions, Hope, Health, Sanity or statistics*, *Crossing rooms costs a Move*, *Rolls grant Despair*, *Replace the Daggerheart Fear tracker*, *Guard token editing from Isometric Perspective*, *Music follows the game state*, *Regional voice*, and the per-browser *Language* and *Theme*. The defaults are the way the game is meant to be played; the switches exist so a table can handle one piece by hand when it wants to.

> [!IMPORTANT]
> Two of these settings start off because each needs something from you first: *Music follows the game state* (playlists mapped in the Sound window) and *Regional voice* (LiveKit AVClient and a working server).


> [!NOTE]
> **What a player's console can and cannot do.** Players' browsers ask yours to make most changes in this game, and Daggerheart does the same for its own rules. Your browser checks each request: who really sent it, whether that player plays the character or may see the project, and whether the room, the stage and the turn allow it. Taking something back is accepted only just after that player rerolled a roll of that character, once for each kind of thing taken back; that shows a roll on their chat card was rerolled, not that the Reroll was paid for. A request that fails changes nothing. Most refusals also tell the player the GM's client refused it and leave a line with their name in the primary GM's Debug log; a few are only logged, and a Daggerheart request of a kind the module does not know at all is noted without a name. For a Daggerheart change you are also warned on screen, and a change Daggerheart does not make for a player puts a card in your chat - usually a sign somebody went around the game, sometimes a Daggerheart feature this module has not met yet, so ask before you conclude. Fear is not rationed: every step a player's Daggerheart asks for lands, one at a time, and if one player's client moves it more than four times in ten seconds you get a note on screen - compare it with the rolls in chat; slower steps are not compared with anything. What is not checked yet: a player's own roll totals; Hope, Stress and Health on their own character, within their limits; the resources of any actor that is not a student, companions included; their own items' charges (not held to the item's maximum) and quantities; countdown ticks, one step each, and any change to a countdown you gave them ownership of; save totals for their own tokens; their party's group roll and tag team entries; and the order of a scene's environments - none of them with a limit on how often. If a Daggerheart feature a player uses stops with that refusal (placing an area, starting a countdown, healing or harming another student with an ability), it asked for something this game keeps to the GM: do it for them. If Daggerheart is newer than the module knows, you are told once what it refuses.

---

## 2. The season setup checklist

**GM panel > Between sessions > Set the season up** (`scripts/season-setup.mjs`). It is a checklist, not a wizard: every row stays on screen with its state showing, so a step you skipped is a step you can still see. A tick means done, a cross means the season needs it, a dash means optional. Rows that can be finished by the module carry **Do it**; rows that need a human carry **Open**, which takes you to the right window. Every row's button closes and reopens the checklist so the marks are current.

Above the list sit three fields saved by **Save**: the campaign name (shown at the top of everyone's screen), the chapter (**1 to 6**, `CHAPTERS_PER_SEASON`), and the **safeword** (blank means the default, "Safe Word"; see section 19).

| Step | What it checks | How to fix it |
|---|---|---|
| Name the campaign | A campaign name exists | Type it in the field above |
| The cast exists | At least one student character actor (Monokumas do not count) | Create the actors |
| At least one Monokuma | A Despair pool exists (every full Gamemaster account holds one) and a character is marked as Monokuma; the row names whichever of the two is missing | **Open** opens Despair Flow (section 7); the Actors list's right-click **Mark as Monokuma** works too |
| Starting Health, Sanity and Hope | Every student has max Health 4 and max Sanity 6 (`STARTING`); until then the character reads as Wounded and in Breakdown at once | **Do it** runs `initCharacter` on every student that is off |
| Everybody has an Ultimate | The Ultimate flag is written on every student | **Open** opens the first sheet that lacks one |
| Everybody has their Experiences | Every student has at least 2 experiences (`STARTING.experiences`, each worth +2) | **Open** opens the first sheet short of them |
| Everybody carries something | Every student holds an opening item (a Usable, Murder Weapon, Cleaning Tool or Tool; keys and Truth Bullets do not count). The guide gives everyone one Tier 2 item tied to their Ultimate (`STARTING.startingItemTier`); what it is, you agree with each player | **Open** opens the item manager |
| Every student has a Monokuma watching | Every student feeds a Despair pool (one never assigned falls back to the first pool), or is set to "- nobody -" on purpose, such as the Mastermind, which counts as watched | **Open** opens Despair Flow |
| The students are split evenly between the pools (optional) | The living cast per pool differs by at most one student | Advice only: **Open** opens Despair Flow, where **Split evenly** deals them out. A cast that will not divide is a decision, not a mistake |
| Sound files (optional) | At least one sound event has a file | **Open** opens the Sound window; the module ships no audio |
| Enough rooms for the cast (optional) | Shared rooms (bedrooms and regions ticked "Not a room" in Room Setup > Doors excluded) against about 1.5 per player (`ROOMS_PER_PLAYER`), rounded by `roomsWantedFor` | Advice only: below the ratio, two private conversations cannot happen at once |
| The map has rooms | The working scene has at least one Region | **Open** opens Room Setup. The row also carries the room-drawing guide and **Check the rooms on this scene** |
| The GM's pointer is private (recommended) | Foundry's cursor sharing is off for the two GM roles | **Do it** edits core's permission matrix; players keep theirs |
| The Mastermind (optional) | A Mastermind is set | **Open** opens the Mastermind window. A season without one is a legal season |

> [!IMPORTANT]
> **How rooms must be drawn** (the guide printed in the row): walls first, then <ins>one named Region per room</ins>, drawn to the walls with snapping on. An unnamed region is not a room and never counts as a neighbour. Neighbours touch along a shared edge and never overlap. A doorway is a gap in the walls, of any width. Two zones means two rooms. The check reports overlaps, borders drawn off their walls and corners off the grid; it never edits the map.

**Pre-season checks** (the button at the bottom) runs three reports in one window: who is still missing starting resources, which scenes with rooms are prepared for room-based visibility, and the anonymity audit (which sheets a player could read that they should not). Green here means the checklist above is complete.

**Character creation numbers** (`config.mjs`):

| Starting | Value |
|---|---|
| Statistics | six - Eye, Head, Body, Leg, Hand, Shadow - with the spread **+2, +1, +1, 0, 0, -1** (`TRAIT_ARRAY`) |
| Health | **4** |
| Sanity | **6** |
| Hope | **2** of a maximum 6 |
| Experiences | two, at **+2** |

---

## 3. The GM panel

`scripts/gm-panel.mjs`. Opened from the **GM** launcher under the clock. The top of the panel is the standing: the campaign name, the clock line ("Chapter 2 · Day 3 · Session 3 · Afternoon", with "· ECLIPSE" appended while one runs), the phase, a **Next time of day** button, the **Next** line, and a table of the living cast with actions left and whether the Free Move is still there. Monokumas and ordinary corpses are not in the table; a Monocub is, because they spend a real budget.

**The Next line** is one instruction, in order of urgency, first match wins:

1. An incident is running - take it to the end (opens the murder tracker).
2. The Eclipse is open - close it once everyone has placed.
3. In a Class Trial: the trial has outlived its chapter (end it); the verdict is in (end the chapter); the vote is counted (deliver the verdict); no floor open (open the debate when ready); otherwise the mode running and who holds it.
4. A body has been found and the Investigation has not started - start it.
5. In an Investigation: every planned Key Remnant found - start the Class Trial; otherwise check the dashboard.
6. Daily Life: "*n* students still have actions to spend", or everyone has spent them - start the Eclipse (opening it refills everyone, closing it moves the clock).

**Do it** beside the line runs the step. The line may point at things that are not tiles (`EXTRA_ACTIONS`): toggling the Eclipse, advancing the clock, the chapter's end, starting the Investigation, the trial console.

**Next time of day** moves the clock without an Eclipse and *does* refill actions, free Moves and search tokens; at Night it also starts the next day and session. It is hidden during an Eclipse (its end advances) and during a trial (the chapter's end does).

The tiles, by section:

| Section | Tiles |
|---|---|
| Right now (always open) | **Students** (alive / dead / Monocub, Hope for Monocubs, and one **Items** button at the foot of the window), **Projects**, **Sound**, **Killing game rules** |
| The case (Daily Life, Investigation, Class Trial) | **Murder** (greyed out during an Eclipse), **Investigation** dashboard, **Class Trial** console |
| Between sessions (collapsed) | **Edit campaign**, **Despair Flow**, **Room Setup**, **Item tables**, **Reset all voice rooms**, **Set the season up**, **The Mastermind**, **End the chapter**, **Reset the season** (red) |
| Diagnostics (collapsed, dim) | **Debug log** - everything this browser has failed at since the page loaded, with Copy and Clear |

**Students** deserves a note: the dropdown only moves flags and is the repair tool for a misclick. The buttons on the right do the real thing - **A character dies**, below, and **Invite as a Monocub**, which turns a dead student into one. Monocub columns (Hope, Despair to Hope donation, Silenced) appear only once a Monocub exists.

> [!CAUTION]
> **A character dies** destroys the character's Truth Bullets (unless you tick *Keep their Truth Bullets*, for a death outside the killing game) and leaves everything else on the body.

---

## 4. The clock

`scripts/clock.mjs`. Season > Chapter > Session > Time of day. One session is one in-fiction day of five times of day: **Morning, Noon, Afternoon, Evening, Night** (`TIMES_OF_DAY`). Advancing past Night rolls the day and the session over together. Chapters never advance on their own; the guide allows stretching a chapter when no murder has happened yet, so the chapter is yours to move (End of chapter, or Edit campaign).

Three **phases**. A canonical chapter is five sessions, as below - but the phase is set by hand:

| Phase | What it means | Sessions in a canonical chapter |
|---|---|---|
| Daily Life | two actions per time of day | three (the third carrying the murder) |
| Investigation | a body was found; Observe and Analyze build Truth Bullets | one |
| Class Trial | - | one |

**What a time-of-day change does**, in order (`applyTimeOfDayChange`):

1. checks the Despair overflow (section 7) - before the restock, because a darkening can shrink the token count;
2. restocks every room's search tokens;
3. clears every Despair Call in force for one time of day (Behind Closed Doors seals, Chained, Silence);
4. ticks Monokuma's motive deadline down by one;
5. announces the new time of day to the table (privately to participants while a murder runs) and redraws everyone's HUD.

> [!IMPORTANT]
> A time-of-day change does **not** refill actions by itself. The budget comes back <ins>when the Eclipse opens</ins> (section 12); the panel's **Next time of day** passes the refill explicitly for tables that skip the Eclipse, and the Edit campaign window has a checkbox for it. Two refills for one boundary is the one thing the table must never be handed.

**Rewinding** (the left chevron on the HUD) steps the clock back one time of day as a correction for a misclick. It is refused while an Eclipse runs (the clock has not moved yet, so there is nothing to step back to; end the Eclipse without advancing from the panel instead). It refills nothing, cancels a pending assembly first, clears the Calls in force, and gives the motive its time of day back.

**Edit campaign** (Between sessions) edits the name, chapter, phase, day, session and time of day, with *Also refill actions and search tokens* off by default.

> [!WARNING]
> Two cautions:
>
> - changing the phase ends the "body found and waiting" record;
> - moving the clock does not end an Eclipse - if one was running you are warned after Apply, and the clock line keeps saying ECLIPSE until you end it from the HUD.

**The HUD** shows all of this to everyone. GMs also get the chevrons: left rewinds, right starts the Eclipse for the next time of day (the tooltip names it), and turns into a play button that ends it. At Night the right chevron's tooltip says it ends the session as well. The HUD also shows how long the current time of day has run (amber at **15 minutes**, red at **30**, frozen while the game is paused). During a Class Trial the time row names the trial's mode instead, the chevrons and the elapsed line step aside, and the debate's countdown sits on the trial's card in the Event panel. The GM's status strip counts who is "Still to act", or "Still placing" during an Eclipse. The **Event panel** under the Despair rail carries the standing events as cards: the safeword's stop, the trial and its vote, the opening roll and the incident (to its participants and the GMs only), a body found, the overflow's darkening, an assembly called and the motive.

---

## 5. Actions and budgets

`config.mjs ACTIONS`, `STARTING`, `scripts/actions.mjs`. Every student gets **2 actions** per time of day and **1 Free Move**. **Wounded** (all Health marked) costs 1 action per time of day; a *Panic* darkening costs 1 more; the two stack but never below **1**. The budget is derived, never stored, so a character who heals mid-day gets the action back at the next refill. **Breakdown** (Sanity at 0) gives disadvantage on every roll.

The ten tiles on the sheet, in the order they are drawn:

| Action | Statistic | Cost | What it does | Numbers |
|---|---|---|---|---|
| Search | Eye or Hand | 1 + a room search token | Loot the room for something you name | 8: Tier 0 (Hidden trace), 12: Tier 1 (Subtle), 18: Tier 2 (Evident); critical: +1 tier and an Obvious trace. Taking a Murder Weapon or Cleaning Tool leaves a Faint Prep Remnant. Failure finds nothing |
| Observe | Eye | 1 | Copy a Remnant into your inventory as a Neutral Truth Bullet | DC from `OBSERVE_DC` (section 14); a failure costs 1 Sanity (`OBSERVE_FAIL_STRESS`) |
| Analyze | Head | 1 | Identify a Neutral Truth Bullet, or ask the GM for a hint | DC from `ANALYZE_DC`; a failure locks that bullet until the chapter ends. Hint mode: 14 a subtle hint, 18 a direct hint, critical: they may ask you one question. Locate a hidden stash: 16 |
| Projects | Hand, Body, Leg or Head | 1 | Push a project in this room, or propose a new one for you to approve | 12: +1 progress, 18: +2; critical: +2 and the action refunded |
| Dynamic | GM's choice | 1 | The player describes something the game has no name for; you set the band | see the bands below |
| Rest | none | 1 (Short) or 2 (Long) | Recover | see below |
| Listen | Shadow | 1 | Learn who is next door, no GM needed | The room is picked before the roll. 14: how many people are in it; 18: who they are, by name; critical: who is in every neighbouring room. The answer is a private card. A neighbour the listener has not discovered is named only "Unexplored room 1, 2...", in the picker and in the answer |
| Palm | Hand, then Shadow | 1 | Take something out of a pocket, or leave something in it | Take: 10 to succeed, 15 on Shadow to stay unseen. Plant: 8, unseen 13 |
| Tamper | Shadow | 1, or 1 Sanity when no action is left | Erase a trace, reshape it, or plant one pointing at somebody else | Uses the Stage 6 rules (section 13). Reaches only traces in your room that you have found (hold a Truth Bullet of), plus, while an incident is open, its Incident traces if you are its victim or one of its killers |
| Direct Murder | none | 1 | Open a direct murder, agreed with you beforehand | Declared in the Eclipse; section 13 |

**Move** is not a tile: dragging the token is the action, and the cost is applied when the token arrives in another room. **Sabotage** is the third branch of the Projects menu.

**Dynamic actions** (`DYNAMIC_THRESHOLDS`). The player's description reaches you as a card in their messenger thread with **Set difficulty** and **Refuse** on it. You pick the band and the statistic; a refusal costs the player nothing. A success leaves a Faint Prep Remnant of the band's visibility:

| Band | Threshold | Tier | Trace |
|---|---|---|---|
| Trivial. Anyone could do it | 8 to 12 | 0 | Obvious |
| Takes practice | 13 to 15 | 1 | Evident |
| Foreign to most people | 16 to 18 | 2 | Subtle |
| Demands very niche expertise | 19 to 21 | 3 | Hidden |

**Rest** (`REST`). A **Long Rest** costs **2 actions**, picks 2 of the three options, **once per session**. A **Short Rest** costs **1 action**, picks 1, **once per time of day**. Each works <ins>only in a room flagged for it</ins> (Room Setup > Rests); the guide puts the Long Rest in the bedrooms, so flag those.

| Option | Long Rest | Short Rest |
|---|---|---|
| Sleep | restores all Health | restores half |
| Meal | restores all Sanity | restores half |
| Breath | grants 2 Hope | grants 1 |

**Sabotage** (`ACTIONS.sabotage`):

| Result | Breaks the project so it needs | Trace |
|---|---|---|
| 12 | a simple repair | Subtle |
| 18 | a complex repair | Evident |
| Critical | a hidden-difficulty repair | Obvious |
| Failure | - | still leaves a Hidden trace |

With somebody else in the room the saboteur also rolls Shadow against **16** to cover what they are doing (`SABOTAGE_CONCEAL`); on Despair they fumble and the sabotage is 1 harder; a Despair result with witnesses is told to the whole table. A sabotaged project is frozen until its repair project is finished.

> [!NOTE]
> The damage is applied by a GM's client - if no GM confirms in time the roll succeeded but the target may not be broken, and the player is told to say so.

**Critical rolls** grant **2 Hope** (`CRITICAL.hope`). A roll with Despair that used the item in the character's hand takes one point of its durability (section 10).

---

## 6. Hope Calls and Despair Calls

### 6.1 Hope Calls (`HOPE_CALLS`)

Spent from the character sheet, whispered to the player. Locked during an Eclipse, under a *Silence* darkening, for a player hit by the *Silence* Despair Call, and for the dead; they stay open in an incident and in a Class Trial. Two of them need your ruling.

| Call | Cost | Effect | Needs the GM |
|---|---|---|---|
| Support | 1 | Give another player advantage on one roll; same room | no |
| Experience | 1 | Add an experience to a roll it genuinely applies to | yes |
| Ultimate | 1 | Advantage on a roll the Ultimate genuinely applies to | yes |
| Contribution | 2 | +1 progress to a project being worked on in your room | no |
| Sprint | 2 | One more room crossing this time of day, free | no |
| Reroll | 3 | Reroll the action; the previous outcome is reverted | no |
| Resolve | 3 | For one roll, choose the statistic yourself | no |
| Burst | 4 | The next action costs nothing, however much it would have cost | no |
| Relief | 4 | Take a Short Rest now: no action, no rest room, does not use up this time of day's | no |
| Loaded Die | 6 | On the next roll one die is set to 12 and the other is thrown; a critical only if that die is 12 too | no |

**Approving Experience and Ultimate.** The player must write what they mean to do with it - an empty box cancels, because the ruling is about the sentence, not the Call. The request lands as a card in the player's messenger thread, visible to the player and every GM, with **Applies** and **Not this time**. Any GM may answer. Nothing is charged until a yes; a refusal or a silence costs the player nothing (the request times out after **five minutes**). If your browser reloads with the question open, the player's client asks again when you reconnect. Once answered, the card becomes a receipt in the thread.

> [!TIP]
> The question is the handbook's own: does the experience or the talent *genuinely* apply here?

### 6.2 Despair Calls (`DESPAIR_CALLS`)

Spent from a Monokuma's sheet, out of the pool that Monokuma draws on, and always announced to the whole table. Locked during an Eclipse and during a Class Trial. A Call that would change nothing is refused before it is paid, and if the effect fails the Despair is refunded.

| Call | Cost | Effect |
|---|---|---|
| Obstacle | 1 | Disadvantage on a player's roll |
| Approval | 1 | Advantage on a player's roll |
| Fuel a Monocub | 1 | 1 Despair becomes 1 Hope for a Monocub, so they can use Confusion |
| Feed the Overflow | 1 | Pour 1 Despair into the overflow |
| Behind Closed Doors | 2 | Seal a room for one time of day |
| Paranoia | 2 | A player loses 2 Sanity |
| Chained | 3 | One player cannot leave their room until the end of the time of day |
| Game Integrity | 3 | Remove 2 progress from a project |
| Patronage | 3 | Add 2 progress to a project |
| Pain | 4 | A player loses 2 Health |
| Silence | 4 | One player cannot spend Hope Calls until the end of the time of day |
| Contraband | 4 | Destroy any one item |
| Public Announcement | 6 | Call everyone to one room at the start of the next time of day |
| Motive | 6 | Announce a motive: a demand, a deadline in times of day, and the price of ignoring it |
| New Rule | 9 | Introduce one new killing game rule |

Obstacle, Approval, Support and a Monocub's Confusion are all "armed" on the target's next roll through the same mechanism; the roll dialog applies it. Seals, Chained and Silence are cleared when the next Eclipse opens, or by the next time-of-day change when no Eclipse is used. A Public Announcement is deferred: the assembly runs on the next boundary, and a rewind cancels it. A **Motive** asks for the demand, a deadline of **1 to 10** times of day (default **3**, `MOTIVE`), and the consequence; it is announced to everyone, ticks down on every time-of-day change (an Eclipse does not count), is announced once more when it comes due, and stays on the board at zero until you withdraw it or the chapter turns. A **New Rule** goes into the killing game rules list, which is shown on every character sheet; edit the wording, withdraw or add rules from **Killing game rules** in the panel.

### 6.3 Rulings, cards and the messenger

Every action that needs a human - Analyze hints, dynamic actions, Direct Murder declarations, project proposals, reshaped traces, trap alerts, the Calls above - arrives as a **card in the messenger** (`scripts/gm-bridge.mjs`, `scripts/messenger.mjs`). The messenger is one shared thread per player: the player and every GM read and write into the same conversation. A GM opens threads from the launcher bottom-right (a roster with unread badges) or by right-clicking a player in Foundry's Players list. A card shows the roll, the player's own words, and a GM-only block with the thresholds; the buttons are GM-only and re-checked on arrival, so a forged click achieves nothing. Once a button is pressed the card is rewritten into a receipt in the thread, so nobody rules twice; you can still answer in words below it. A ruling with no player owner (a Monokuma actor, a trap alert) goes to the GM whisper log instead, with the same buttons.

Two GMs are normal. One of them is the **primary GM** (the connected full Gamemaster with the lowest user id; an Assistant GM only when no full Gamemaster is connected), and that client is the one that writes world state: Despair awards, search tokens, discovery, incident results. An assistant's Despair adjustments are routed to the primary. If something "does nothing", check that a primary GM is connected.

---

## 7. Despair pools, assignments and overflow

`scripts/despair.mjs`, `scripts/assignments.mjs`, `scripts/overflow.mjs`, `config.mjs OVERFLOW`.

**Earning.** When a student's roll lands with the Despair die higher, **+1 Despair** goes to the pool of *that student's* Monokuma (`Rolls grant Despair` setting, written by the primary GM). Reaction rolls - a bare statistic click - pay nothing; a Monokuma actor's own rolls pay nothing. A student assigned to "- nobody -" feeds nobody (useful for a retired or NPC-run character, or the Mastermind at your discretion).

**Pools.** Every full Gamemaster account holds a Despair pool, capped at **12** (`STARTING.despairMax`), and the Monokuma characters spend from them. The Despair widget at the top of the screen shows every pool under its name, a single one included (the name set in Despair Flow, otherwise the account name): everyone sees the counts, GMs also get the steppers. **Despair Flow** (Between sessions) is the one window for the team: which actors are Monokumas, which GM's pool each draws on, pool names, extra pool holders (an Assistant GM can be granted a pool), which Monokuma watches which student (with **Split evenly** and "- nobody -"), and the overflow's tuning. The guide's shape is at least two GMs dividing the students strictly between them, but the module works with one.

**Converting Despair into Hope** (1:1) is a GM ruling from the Students window or the Mastermind window, never a self-service button: it is how a Monocub is fuelled and how a Mastermind stays afloat.

**The overflow.** Despair earned past a full pool used to evaporate; it now collects in one counter shared by every Monokuma. Feed the Overflow pours Despair in on purpose. At the **threshold** (default **20**, editable between 6 and 60; the hint suggests 12 plus half your player count) the counter pays the threshold, keeps the rest, and draws **one** effect at random from those you have ticked, for one time of day. It fires the moment the counter reaches the threshold: the card comes at once and the effect covers the coming time of day. If a darkening is already running, the counter waits for the next boundary. It is checked again when an Eclipse opens and on every time-of-day change, and one boundary pays only once. Saving a changed threshold or effect list tells the table the new threshold.

| Effect | Kind | What it does |
|---|---|---|
| Darkness | state | 1 fewer crossing in the Eclipse (floor 1); a free-placement Eclipse is pulled back to 2 rooms |
| Shift | state | 1 fewer search token in every room (floor 1) |
| Panic | state | 1 fewer action each, on top of Wounded (floor 1) |
| Despair | state | No Hope is earned; spending what you hold still works |
| Silence | state | No Hope Calls, by anybody |
| Fog | state | No Free Move; crossings still cost actions |
| Rot | one-off | Every item with more than one point of durability left loses 1; nothing breaks |
| Earthquake | one-off | Every project loses 1 progress |

> [!TIP]
> Untick all eight and the counter climbs and never fires - a real setting, the counter as atmosphere.

**A trial verdict empties the overflow** on both outcomes; the season reset does too. Players see the pools' counts and the overflow's threshold, but a "?" in place of its count ("?/20") - when the hat fires stays Monokuma's to know.

---

## 8. Monokuma, Monocubs and the Mastermind

**Monokuma** (`scripts/monokuma.mjs`) is a `character` actor carrying a flag, set from Despair Flow or with **Mark as Monokuma** in the Actors list's right-click menu. What the flag changes:

- no action economy and no Hope;
- the action grid becomes the Despair Calls;
- movement is unrestricted (no room costs, no walls, no Eclipse limit, no seals);
- room visibility never hides them from themselves;
- their rolls are whispered to GMs only and feed no pool;
- they do not count as witnesses to an incident or a body.

The guide has the GMs walking the map as two distinguishable Monokumas; each is pointed at one GM's pool, and per-room voice follows that same mapping.

**Monocub** (`scripts/monocub.mjs`, `MONOCUB`). A dead student's player may join the GMs once their own Class Trial is over - the timing is yours, the module only insists they are dead. Invite them from **Students**. They keep the same sheet and get exactly two things: **Move**, and **Confusion** (**1 action + 1 Hope**), a flat 2d12 roll with no statistic that nudges a living student in the same room without saying who did it:

| Confusion | Grants | Inflicts |
|---|---|---|
| 12 | +1 on the target's next roll | -1 on the target's next roll |
| 16 | advantage | disadvantage |
| Critical | gives the target the action back | wastes the action |

A Monocub's Hope comes only from a GM converting Despair (Fuel a Monocub, or the Students window). The **Silenced** checkbox is the guide's rule for a Monocub who stumbled onto a crime scene: they may act but not talk about the crime until the chapter ends; the player is told when it is set and lifted. A Monocub's dice are shown to everyone in their room.

**The Mastermind** (`scripts/mastermind.mjs`). Chosen before the season with the player's consent, from **Between sessions > The Mastermind**. The identity never touches an actor or the world: it lives on GM browsers only and is synced GM to GM; the Mastermind's own player receives only a private "you are it" and the room of their lair.

> [!CAUTION]
> The window names the Mastermind, so do not share your screen while it is open.

Their **lair** is a room: <ins>while standing in it</ins> they see every token on the map, as you do; step out and it is gone. Locked doors, seals, other people's bedrooms and hidden stashes are open to them everywhere, and every room counts as already visited for their fog - they built the building. Despair converts to their Hope **1:1** from the same window, once a Mastermind has been picked and applied. The endgame runs on the ordinary trial:

| Piece | Where | Notes |
|---|---|---|
| One **Final Truth Remnant** per chapter | placed from the Investigation dashboard's **Final Truth Remnants** tab | reinforced by type, so nobody can remove it - the chapter-end screen reminds you if none was placed |
| The **Final Trial** flag | toggled from the trial console | announced to the table |
| A final verdict | given from the Mastermind window's **Final Trial verdict** | correct, the Mastermind is executed and the killing game ends; wrong, or the Mastermind already dead, nobody new dies and the table is shown the truth |

---

## 9. Rooms, regions, fog and discovery, movement, voice

### 9.1 Rooms and Room Setup

A room is a **named Scene Region**. Movement, Search, Listen, rests, voice and every incident are answered in terms of them. Neighbours are worked out from geometry (regions touching along an edge, within about a third of a grid square) unless you write an explicit list in the region's `drpgNeighbours` flag, comma-separated. Two regions with the same name are one room (a corridor drawn in two pieces).

**Room Setup** (Between sessions) is one table per kind of fact, and **Apply** saves every tab at once:

| Tab | Columns |
|---|---|
| Bedrooms | Whose bedroom each room is (one student, one bedroom). Owning a bedroom locks its door to everyone else and issues the owner a key |
| Stashes | Who has a stash in which room and whether it is hidden. Click a cell to cycle none / open / hidden. A bedroom gives its owner an open stash automatically; a stash in somebody else's room gives no key to it. A stash with something in it cannot be removed; removing an empty one makes everybody who had located it forget it |
| Doors | Which doors are locked now, and which start the season locked (the reset copies the second column over the first), and whether the region is Not a room (see below) |
| Searching | Which RollTable the room draws from (or the global pool), how many search tokens it has left, a "cannot be searched" seal, and which categories the room favours (advantage on a Search aimed at one) or hinders (disadvantage); never both |
| Rests | Whether a Short Rest and a Long Rest are allowed here |
| Description | What the room looks like, in your words; shown on the move card when somebody walks in and behind the clock |
| Fog | The discovery matrix - which rooms each character has already seen on this scene - with Discover all / Hide all, the percentage of the scene that belongs to no room, and the region check |

The **Doors** tab also carries a **Not a room** column: tick it for corridors, stairwells and anywhere nobody can talk privately, and the region stops counting towards the rooms-per-player advice and nothing else.

Search tokens: **3 per room per time of day** (`ROOMS.searchTokensPerRoom`, editable in settings), restocked on every time-of-day change, one spent per Search.

### 9.2 Fog and discovery

`scripts/fog.mjs`, the *Rooms decide what players can see* setting. One layer over the whole scene, three states: the room you stand in is clear; a room you have visited shows through a veil; everything else, including any patch of map outside every region, is full fog. During an Eclipse even the room you stand in is only veiled. Discovery is **per character**, written by the primary GM when a token crosses into a room for the first time (with a sound for the student who walked in), and survives sessions; the full record stays on the GM's browser, and each player's browser holds only its own characters' rows. A GM sees a lighter fog: every room the class has discovered is clear, and rooms nobody has found yet, with any space outside every room, sit under the veil. The Mastermind sees every room as visited.

For the fog to work a scene needs Foundry's own vision off:

| Setting | Must be |
|---|---|
| Token vision | disabled |
| Global light | on |
| Fog exploration | off |

**Pre-season checks** reports which scenes with rooms are ready; `game.drpg.prepareScenes()` prepares every scene with rooms at once and remembers what it changed, so `restoreSceneVisionMode` can give a scene back.

> [!WARNING]
> A scene with rooms and Foundry vision still on renders as a **black screen for players** on v14 and says nothing about why - the single most common "it is broken" report.

**Token visibility** (`scripts/visibility.mjs`, *Players only see who is in their room*) is enforced directly on tokens, so doorways, archways and wall-less maps do not leak. A revealed Remnant is visible only to the people who have found it themselves.

### 9.3 Movement and charging

`scripts/movement.mjs`. Moving inside a room is free. Crossing into a connected room spends the time of day's **Free Move**, then **1 action** per crossing (a banked Sprint is spent first). The crossing is vetoed before it is written, so a token that cannot pay snaps back with a red card. The move card names the room, the price, and the room's description if you wrote one; the crossing also fires the trap watcher.

Some refusals apply whatever the *Crossing rooms costs a Move* setting says:

- a character inside an incident cannot leave the room;
- nobody leaves the room during a Class Trial;
- a room sealed by Behind Closed Doors, a Chained player;
- a locked door (Room Setup > Doors);
- somebody else's bedroom without its key;
- the Eclipse's crossing cap and connected-rooms rule.

Monokumas walk through all of it. A dead character's token does not move: the body stays where it fell. Turning the setting off hands you the *economy* - Free Move and action - and, outside an Eclipse, the connected-rooms rule, to run by hand.

### 9.4 Voice

`scripts/voice.mjs`, the *Regional voice* setting plus LiveKit AVClient. Every mapped room becomes its own LiveKit breakout room; a player hears whoever is in the room with them, and their voice client follows their token. A Monokuma follows its own token, using the GM that its pool is mapped to. During an Eclipse everybody is in their own channel, and the GMs share one. The dead, unless they come back as a Monocub, go back to the main room. **There is no eavesdropping:** LiveKit shows every listener's tile to the room, so a GM who wants to hear a room walks their Monokuma into it. **Reset all voice rooms** (Between sessions) sends everybody back to the main room. `game.drpg.voicePlan()` prints where everybody *would* be sent, with no microphone and nobody else connected, so most of a voice test is one person's minute; `game.drpg.diagnoseVoice()` says which of the five links is the broken one; run it on the client that is complaining.

> [!WARNING]
> A proximity-voice module installed alongside can silence a table while every check reports success - the diagnosis names it.

---

## 10. Items

`config.mjs ITEM_*`, `scripts/inventory.mjs`, `tables.mjs`, `gm-items.mjs`, `handover.mjs`, `vault.mjs`, `use-items.mjs`.

**Categories and limits.**

| Category | Limit |
|---|---|
| Usables (Healing restores Health, Sanity Relief restores Sanity, the kind comes from the table it was drawn from) | up to **3** |
| Murder Weapons, Cleaning Tools and Tools | together the **gear** group: **2 slots**, and only **1** may be stowed - carrying two means one is in your hand |
| Truth Bullets | uncapped |
| Room Keys | uncapped |

A GM give ignores the carry limit and marks the excess.

**Tiers** 0 to 3, and their **durability** (`ITEM_DURABILITY`):

| Tier | Usables | Weapons and cleaning tools | Durability |
|---|---|---|---|
| 0 | "a random, seemingly useless item, open to creative use"; comes to you to rule on | useless | **1** point |
| 1 | restores 1 | meant for something else but usable | **1** point |
| 2 | restores 2 | partly intended for the job | **2** points |
| 3 | restores 2 Health or 2 Sanity, the player's choice, plus 2 Hope | made strictly for it | **3** points |

A Murder Weapon's tier is its damage in an incident; a Cleaning Tool's tier comes off the clean-up DC and off Move the body; a **Tool held ready** gives advantage on project work and sabotage and takes its tier off the threshold (`TOOL_IN_HAND`).

**Durability** (the last column above). A roll that lands with **Despair** - success or failure, never a critical - takes one point off the item in the character's hand <ins>when the roll used it</ins>: a Tool on project work or sabotage, a Cleaning Tool on a clean-up, a Murder Weapon on a swing. The point that empties it breaks it. A broken item stays in its slot, broken wherever it goes next; its holder gets rid of it by stashing it or throwing it away (a Shadow roll that always leaves a trace). The Rot darkening wears everything by one but never takes the last point.

**Item tables** (`scripts/tables.mjs`, Between sessions > Item tables). Search draws from RollTables: one **tier pool** per category and tier ("DRPG Murder Weapons - Tier 2", "DRPG Usables (Healing) - Tier 1", and so on), found by name, plus optional **room pools** a room can be pointed at from Room Setup. The editor has three tabs - Tier pools, Room pools and Create an item - and an **Install / reinstall** button: the one-time install of the module's own mundane, school-shaped lists, as 20 RollTables in a "Danganronpa RPG" folder; if they exist you choose between **Keep mine** and rebuilding. From Tier 2 up a pool entry may carry one second role ("also serves as"), so an axe is a tool and a mop is a weapon. Renamed labels keep old tables findable.

**Giving and taking** (`scripts/gm-items.mjs`): **Students > Items**, the button at the foot of the Students window. *Give* has two tabs - an existing entry from a table (category and tier follow the table) or a new item you type. *Take* removes anything the module tracks. The same window issues **Truth Bullets** (from a Remnant on the scene, or written new with the real type, what the player is told it is, the visibility that sets its Analyze DC, the player text and a GM-only note) and the **Autopsy Truth Bullet** to the students you tick (the living, by default).

**Handover** (`scripts/handover.mjs`): a Truth Bullet is *copied* (both end up holding one), an item is *moved*, a room key is copied. No action, same room only, refused during an Eclipse; the write goes through a GM client which re-checks the room.

**Bedrooms and keys.** A bedroom is shut to everyone but its owner; the owner never needs the key. Anybody else needs the Room Key item, which the owner can copy to somebody with **Give room key**. A key that changes hands any other way - Palmed off somebody, lifted from a stash, taken from a body - still opens its door.

> [!WARNING]
> Keys name their room in a flag, so renaming a region orphans them.

**Stash** (`scripts/vault.mjs`). Everything a character does not carry lives in a stash: the bedroom's by default, or any room where Room Setup gives them one. A stash holds **3** things (`VAULT_LIMIT`). Stowing and retrieving cost nothing but you have to be standing there; Truth Bullets cannot be stowed. An **open** stash is a drawer: anybody standing in the room can go through it for free and take one thing, and the owner is not told. A successful Search in a room where somebody else keeps a stocked stash takes from that stash instead of the room's table (open stashes first; a hidden one costs the searcher a disadvantage die), and only a Search that does it with Despair leaves the drawer disturbed enough for the owner to notice - never by whom. A **hidden** stash (the owner built a hiding place - a project, at your discretion; you make it hidden by cycling its cell in Room Setup) must first be found with Analyze > Locate a hidden stash (Head, **16**), which opens that one stash to that one person until you remove it. The Mastermind sees every stash. `game.drpg.inspectVaults()` shows you every stash's contents.

**Palm** (section 5) is theft from a person and planting on a person; both are resolved on a GM client against `ACTIONS.palm`, and a clumsy thief is heard by the victim.

**Taking from a body** (`scripts/handover.mjs`). A dead student's Truth Bullets are gone; everything else they carry stays on the sheet, and another student who opens it can press **Take** on an item. The item moves to the taker, who also gets a Neutral Truth Bullet naming what they took and off whom, and the body gets one Subtle Remnant, tied to the crime, whose note lists everything taken from it. Its trace card names the action "Taken from a body", and the token wears the Palm hand - to a GM always, to a player once their own copy is identified.

---

## 11. Projects and traps

`scripts/projects.mjs`, `projects-ui.mjs`, `traps.mjs`, `config.mjs PROJECT_SCALE`, `TRAP_TRIGGERS`, `TRAP_MODIFIERS`, `INDIRECT_MURDER`.

Projects are Daggerheart Countdowns that count *up*. Scales:

| Scale | Progress |
|---|---|
| Trivial | **3** |
| Standard | **4** |
| Complex | **6** |
| Desperate | **8** |

Each project has a name, a picture or a tray glyph, a scale, a room (or any room), an optional required statistic, a visibility (secret projects are seen by the proposer and the GMs; share them with accomplices), and the indirect-murder flag. **Projects** (the panel tile) is the manager: create, edit, share, add or remove progress, delete. A project with a room also stands on the map as a two-square token with a hammer and no name on it, which you can drag; a player sees it once they have stood in its room, or, for a secret project, once they are let in on it. Double-clicking it opens its card. Observe's *Look past the obvious* can uncover a secret project in the searcher's room (DC 18), which lets them in on it.

**Proposals.** From the sheet a player either works on a project available in their room or **proposes** one. A proposal reaches you as a card; you approve it (editing the scale, room or wording as you go), or refuse it. Nothing exists until you do. Progress rises only through *Work on a project*: 12 gives +1, 18 gives +2, a critical gives +2 and refunds the action; Contribution adds +1, Patronage +2, Game Integrity removes 2, an Earthquake removes 1. A finished project whispers its proposer and the GMs - never the table, because a project can be secret - and it is yours to say what it now does.

**Indirect murder** (`INDIRECT_MURDER`). A trap is built as projects: prepare the weapon (Standard to Complex, 4 to 6 progress; may need a specific room unless the tool was obtained) and set the trap (Trivial to Standard, 3 to 4; always a specific room). The card advises about 6 progress in total, four to six actions. While working on it with others present the killer rolls Shadow against **16** to conceal their intent:

| Concealing (Shadow, 16) | What happens |
|---|---|
| Success | nobody sees |
| Success with Despair | nobody sees and the project gains +1 |
| Failure | the others get a general description ("fiddling with test tubes") |

Working alone gives **+1 progress**. Hiding the traces of the work rolls Shadow:

| Hiding the traces (Shadow) | Trace left |
|---|---|
| Below 12 | Obvious |
| 12 | Evident |
| 18 | Subtle |
| Critical | Hidden |

**Traps: the module watches, the GM fires.** A project flagged as an indirect murder carries a trigger, chosen when it is created or edited:

- somebody is alone in the room;
- somebody enters;
- somebody searches it (a successful Search);
- somebody rests here;
- somebody uses the planted item;
- somebody works on a named project;
- somebody sabotages a named project;
- somebody hunts for a hidden stash here (hit or miss);
- or "my own condition, I will watch for it".

Two modifiers: **Only after dark** (Evening, Night, or any Eclipse) and **Not the one who built it** (on by default). The trap arms when its bar fills. When the condition matches, an alert goes to the GMs only - it names the trigger, the person, the room and the time of day, and carries the killer's typed condition - with **Fire** (opens the murder screen with the killer filled in and *indirect* ticked; you pick the victim) and **Not this one, keep watching**. Nothing reaches the killer's thread.

> [!IMPORTANT]
> A trap that has spoken disarms itself until you re-arm it, so a trap in the Main Hall does not fire twenty cards a session.

The planted-item trigger works through **Plant an item** on the finished project: which object is the trap and which room it waits in; it arrives as whatever the next successful Search there was looking for (one not diverted into somebody's stash), and the poisoned identity lives in your browser's ledger, never on the item.

---

## 12. The Eclipse

`scripts/eclipse.mjs`, `ECLIPSE_MOVES`, `ECLIPSE_FREE_PLACEMENT`. The Eclipse is the placement window between two times of day: the lights go out, nobody sees anyone, everybody moves their token to where the next time of day finds them. It is named after the time of day it *opens* - the Night Eclipse runs before Night.

**Starting it** (the HUD's right chevron, or **Do it** on the GM panel's Next line): the overflow is checked for the coming time of day; **actions, free Moves and Sprint/Burst grants are refilled here** - this is the one refill; seals, Chained and Silence end here too, because they last only until the end of the time of day; the card announces the number of crossings; each player is whispered their allowance and their room; and each client gets a notice summing up what that player did in the time of day just ended (a GM gets the whole table's; nothing happened, no notice). Ordinary Eclipses allow **2 crossings between connected rooms**; the **Night** Eclipse lets everybody pick any room on the map (a Darkness draw pulls that back to 2). During an Eclipse: movement is the only thing that works; a **Direct Murder** may be declared (it spends an action from the new budget and is parked); Calls, handovers, other actions, the murder tile and body discovery are all refused; music switches to the Eclipse playlist; every player is in their own voice channel.

**Ending it**: **Do it** on the panel's Next line shows the placement table (who moved how many times, where they stand) with **End and move the clock** (the normal path: advances the clock, no second refill) and **End without advancing**; the HUD's play button ends it and advances at once. Then the parked Direct Murders are judged against where everybody actually ended up: <ins>exactly one other character in the killer's room</ins> makes that person the victim, anything else fails and the killer is told why, and only the first valid declaration opens an incident.

> [!IMPORTANT]
> Nothing opens without you: each declaration posts an **Allow it** / **Refuse** card in the killer's thread as it is made, and one you have not ruled on is asked at the lights (closing that window refuses it); `game.drpg.ruleOnParkedMurder(killerId, true)` is the console shortcut if the card is lost.

---

## 13. The murder engine, end to end

`scripts/murder.mjs`, `cleanup.mjs`, `chapter.mjs`; `config.mjs MURDER_OPENING`, `INCIDENT`, `CRISIS_ACTIONS`, `CLEANUP`, `INDIRECT_MURDER`. The module owns the numbers - thresholds, the drain, turn order, damage, which Remnants each outcome leaves. It does not own the prose: every outcome's sentence is shown to you and the participants to finish at the table. Whether the killer is in the right room and whether a stage has gone on long enough are yours.

### 13.1 Opening

Two roads. A player declares a **Direct Murder** during an Eclipse (consent from the victim's player is a table agreement, not a checkbox); it is parked and judged at the lights. Or you open it yourself from **The case > Murder**: killer, victim, and the *indirect* checkbox, which ticks itself when that killer has a finished trap. One incident at a time. One name in both fields opens a death by their own hand: Stage 4 still rolls, Stage 5 cannot run, and the incident goes straight to Stage 6; the death is recorded when you close the incident.

**Stage 4, the opening roll.** A direct murder opens on the **killer's** roll: Body or Hand against **8**, with advantage at Night.

| Killer's roll | What happens | Key Remnants the case will hold |
|---|---|---|
| Hope | the incident begins | **5** |
| Despair | it begins; the victim loses all Sanity and Role reversal for this incident | **4** |
| Critical | it begins; the victim learns who is attacking them | **3** |
| Failure | no incident; the victim never learns anything was attempted; the action is spent | - |

The count is floored at **3** (`KEY_REMNANTS.minimum`). A trap opens on the **victim's** roll: Eye or Head against **20**, with disadvantage at Night.

| Victim's roll | What happens |
|---|---|
| Hope | something is wrong - they may spend their Free Move to get out, and if they do they live (the module grants no extra Move) |
| Despair | they work out what was set up and may tell the others; the project stays active |
| Critical | they spot the trap and whose hands built it |
| Failure | the trap closes |

Every success leaves an Evident Incident Remnant, and a noticed trap leaves the incident sitting at its opening until you close it from the tracker. A trap always leaves the case its full 5 Key Remnants. The victim is told the incident began only when it actually begins.

### 13.2 The incident (Stage 5)

Turn-based, the victim first; a round is the victim, then each killer in turn. Each time the turn comes back to the victim (their first turn is free) it costs them **1** Sanity (direct) or **2** (indirect, they are alone with a trap), then Health once Sanity is gone; a critical Self-defence stops the drain. A trap's victim has advantage on every crisis roll, and their Leave a clue and Secure a trace list Body instead of Shadow and leave Reinforced Remnants on Hope as well as on a critical (two of them on a critical). The participants roll in front of each other; nobody else sees. Crisis actions (`CRISIS_ACTIONS`), with the statistic and threshold (where several statistics are listed, here and in Stage 4, the first is the one rolled; a player who wants another arms *Resolve*):

| Side | Action | Roll | What it does |
|---|---|---|---|
| both | Use an item | Hand 15 | Get something out of a pocket. Works on a critical or a success with Hope; with Despair, a trace and nothing else; a failure with Despair costs 1 extra |
| victim | Leave a clue | Hand/Leg/Shadow 12 | A Remnant meant to help the others (Evident / Subtle / Obvious). A failure with Hope gives advantage next attempt |
| victim | Secure a trace | Hand/Leg/Shadow 15 | Take something off the killer and turn it into a trace tied to their identity (same visibilities) |
| victim | Self-defence | Hand/Leg/Body 18 | Fight. Hope opens Survive and Role reversal; Despair opens Role reversal only; critical stops the drain, opens both, and one may be taken this turn without rolling. A weapon gives advantage |
| victim | Survive | Leg 18 | Ends the incident and the drain. Despair adds a hint about who they were; critical adds immunity for this chapter and the next. Needs Self-defence first |
| victim | Role reversal | Hand/Leg/Body 15 | Become the killer. Hope also restores all Health and Sanity; critical kills the attacker outright. Needs Self-defence first |
| killer | Strike | Hand/Leg/Body 15 | 1 Health and 1 Sanity off the victim; critical: 2 of the killer's choice. A Despair failure still takes 1 Sanity and leaves an Evident trace |
| killer | Pin them down | Body 12 | Two turns of disadvantage on Leave a clue and Survive |
| killer | Keep your distance | Leg 12 | Two turns of disadvantage on Secure a trace and Role reversal |
| killer | Attack with a weapon | Body/Hand/Leg 15 | Damage 1 + half the weapon's tier rounded up (critical: 1 + tier). Unarmed rolls at disadvantage and a success improvises a weapon (Tier 2 on Hope or critical, 1 on Despair). A Tier 0 object's damage is yours to set, 0 to 2 |
| killer | Finishing blow | Body/Leg/Hand | Threshold is **5 times the victim's remaining Health** - free at 0. Ends the incident; Despair leaves an Incident Remnant; critical grants one free action in Stage 6 |
| third | Escape together | Leg 15 | Both get out; Hope or critical restores the victim; critical adds immunity for this chapter and the next; failure: only the third party leaves |
| third | Double role reversal | no roll | The victim and the third party become the killers; the original killer starts bleeding |
| third | Partners in crime | no roll | The third party joins the killer |
| third | Averted eyes | no roll | Walk away, no trace of you |

**Walking in on it.** In a direct murder, a character whose token crosses into the room gets one free choice among the third-party resolutions, automatically. **A fourth person cancels the incident** where it stands: nobody dies, no Blackened, what already happened stays happened, and the newcomer is told nothing. A victim who runs out of both Health and Sanity dies without a Finishing blow, and then nobody earns what a critical there grants. Resolution actions (Survive, Role reversal, Escape together, Finishing blow) cost **1 Sanity** rather than an action, or **1 Health** when there is no Sanity left; the third party's three no-roll choices are free. Nothing here kills by itself except the engine's own endings.

> [!IMPORTANT]
> Some outcomes on the table above are prose for you to deliver rather than effects the engine applies: restoring the victim after Escape together, immunity for this chapter and the next, Survive's hint, and the attacker's death on a critical Role reversal (the engine swaps the sides, restores the new killer and leaves the Evident Reinforced trace; the death is yours to record).

The **incident tracker** (the Murder tile while one runs) updates live and shows who is attacking whom (and any third party), the stage, the turn, whose side acts, what the victim has left and the Key Remnant count; in Stage 6 it adds a read-only list of the traces in the killer's room with each one's erase DC. Its buttons: **Ask for the opening roll again** (while the opening waits, at most once every 10 seconds), **Pass the turn**, and **Close the murder**. There is no manual "somebody walks in": a token crossing into the room is the only road. Stage 6 begins by itself - after a Finishing blow, a victim run out of Health and Sanity, a successful Survive or Escape together, or straight after a death by their own hand - or when you mark the victim dead with **A character dies** and accept the prompt that follows. A player's Reroll on a crisis action is judged against the record the tracker keeps.

### 13.3 Cleaning up (Stage 6) and Tamper

When the incident ends with a body, the killer can finally see the Remnants they left, on their sheet, and work on them. In their own Stage 6 it costs **no action and 1 Sanity each** (`RESOLUTION_STRESS_COST`), and every trace in the room they stand in is theirs to work on, found or not. Via the **Tamper** tile in ordinary play (`PRICE_CHAINS.tamper`) it costs an action, or 1 Sanity once the actions are gone - never both - and reaches only the traces listed under Tamper in section 5. Cleaning is a Shadow roll. A readied Cleaning Tool gives advantage and takes its tier off the DC.

| Trace visibility | DC to erase |
|---|---|
| Hidden | 9 |
| Subtle | 12 |
| Evident | 15 |
| Obvious | 18 |

**The scene is still warm:** **-3** on every DC until the body is found or the Investigation starts (`CLEANUP.freshScene`). Outcomes:

| Erasing | The trace |
|---|---|
| Critical | gone and 1 refunded (the Sanity or the action that paid), and the killer is offered to reshape the trace instead |
| Hope | gone |
| Despair | gone, but an Evident Faint Tamper Remnant is left |
| Failure with Hope | still there, plus a Subtle Faint Tamper Remnant |
| Failure with Despair | still there, plus an Evident one |

Reinforced traces never come off.

**Reshape a trace** is also an attempt of its own, 3 easier than erasing: the killer writes a new name (up to 60 characters) and description (up to 400), the trace always becomes a Tamper Remnant, and the rewrite reaches you as a card to approve or decline - nothing is written until you approve; a critical also makes it one band quieter and gives back what paid (the Sanity, or the action).

Two more Stage 6 actions: **Misleading trail** (**15**) plants a Prep Remnant pointing at another living student (Evident / Subtle / Obvious; a Hope failure leaves a Hidden Faint one, a Despair failure nothing); **Move the body** (Body, **16**, 1 lower per tier of a readied Cleaning Tool) carries it into a connected room the killer picks before the roll, never a bedroom; a success always leaves an Evident Tamper trace, a failure leaves the body where it was.

With anybody but a fellow killer in the room, erasing, reshaping and planting a trail first roll Shadow against **16** to cover what they are doing (moving the body does not):

| Covering (Shadow, 16) | Costs |
|---|---|
| Success | free |
| Success with Despair | 1 Sanity |
| Failure with Hope | 1 Sanity |
| Failure with Despair | 2 Sanity |

A failure lets the others see roughly what they are up to. The Murder Weapon that was swung is marked Broken when the incident closes, and the killers' readied Cleaning Tools when the body is found; both stay in the bag as evidence the killer has to throw away or stash.

**The betrayal window.** An accomplice - a third party who sided with the killer - may turn on them: the offer lasts until the end of that day, survives the incident closing, is single-use, and cannot be taken while another fight is running. It opens a second incident with the body still on the floor. The killer's post-incident screen carries the button too.

### 13.4 After the incident, and body discovery

Closing the murder records the **Blackened** (every killer of the chapter, including a betrayer), marks the swung weapon Broken, and opens the after-incident screen, "The incident is over - what now": **A body is discovered** (announce it), **Move to Investigation**, **Issue Autopsy Truth Bullet**, the betrayal if one is on offer. It also reminds you how many Key Remnants still need placing, and to issue the autopsy.

**Body discovery** happens by itself when two or more students stand in the room with this chapter's body, at least one of them <ins>unconnected to the killing</ins> - neither a recorded Blackened nor a killer of the running incident still cleaning up in Stage 6 (killers over their own victim are a frame-up, not a discovery; Monokumas and this chapter's dead are not witnesses, a Monocub is), never during an Eclipse - or from the **A body is discovered** button. It first asks you which Faint Prep traces belong to this murder (they become permanent evidence), marks the killers' cleaning tools Broken, gathers everyone to the room, announces the body to the table with its sound, pauses the music, and then **holds**.

> [!IMPORTANT]
> The phase stays Daily Life until you start the Investigation from the Next line or the after-incident screen. A time-of-day change ends only the silence.

---

## 14. Investigation

`scripts/remnants.mjs`, `investigation.mjs`, `truth-bullets.mjs`, `observe.mjs`, `analyze.mjs`; `config.mjs REMNANT_TYPES`, `KEY_REMNANTS`, `OBSERVE_DC`, `ANALYZE_DC`.

**Remnants** are hidden tokens on the map, dropped where a character stood when an action left one, carrying type, visibility (Obvious, Evident, Subtle, Hidden), who left it, the room, the chapter, day and time of day, whether it is reinforced (cannot be cleaned) and whether it is tied to the crime. Types:

| Type | What it is |
|---|---|
| **Key** | yours, unremovable, becomes a Truth Bullet unanalysed |
| **Neutral** | undetermined; Analyze turns it into a real category |
| **Faint** | doubtful; cleared at chapter end unless tied to the murder |
| **Prep** | - |
| **Incident** | - |
| **Tamper** | left by cleaning |
| **Autopsy** | handed out, never found by Observe |
| **Final Truth** | one per chapter, points at the Mastermind, reinforced |

Truth Bullet types mirror them. Every Remnant starts as a token with one neutral name and a "?" picture (after the first copy it carries the name you gave it); a GM sees the icon of the action that left it (Search, project, sabotage, dynamic action, clean-up, incident, thrown away, placed by the GM, taken from a body), a player only once their own copy is identified, and double-clicking a Remnant opens its trace card.

**The Investigation dashboard** (The case > Investigation) is the GM's case file, live:

| Tab | What it does |
|---|---|
| **Traces** | lists every Remnant with filters (by player, room and chapter), lets you edit its name, player text and analysis text, correct its type, and mark it Faint, tied to the crime or reinforced |
| **Key Remnants** | the planner |
| **Final Truth Remnants** | places Final Truth Remnants |
| **Who has what** | shows every student's Truth Bullets, how many are not analysed yet and what they really are |

The footer carries **New trace** (a trace of any kind, in any room), **Clear Faint Remnants**, **Sweep Truth Bullets**, the autopsy, the trial evidence log and the body.

**Key Remnants** (`KEY_REMNANTS`). You prepare **5** clues per chapter, scaled Trivial, Standard, Standard, Complex, Desperate; the opening roll decides how many the case keeps (5, 4 or 3; a trap keeps all 5), never below **3**. Together they should narrow the suspects to **2 to 4** people - the last step from the circle to a name belongs to the trial. Each planner row has a name and player text (what the finder receives), an analysis text (what Analyze reveals), your private note, a room and a visibility; **Create on the map** places it at a random spot inside the room as Reinforced and tied to the crime. A player's request card ("I look at the window") carries **Create a Key Remnant here**, which can fill one of the five slots.

> [!WARNING]
> At the start of the Class Trial the module charges for a failed investigation: every Key Remnant short of **4 found** is worth **3 Despair to each Monokuma's pool** (`unfoundBar`, `unfoundDespair`) - a completely failed investigation is **+12** to every pool. It is charged once per chapter, and only while the plan is still this chapter's.

**Observe.** The player declares how they are looking:

| Mode | What it looks for |
|---|---|
| **Sweep the room** | the easiest trace here |
| **Look past the obvious** | the hardest, and a secret project in the room at DC **18** |
| **Follow my traces** | their own first |
| **Focus your gaze** | they name what they want and a card asks you which trace the words point at |
| **Examine point of interest** | something that is not a trace, yours to rule on |

Both of the last two have rolled before you see them: refusing the Focus pick, an Examine point of interest, or an Observe in a room with no traces left becomes a ruling card on that roll with **Create a Key Remnant here**, **Reply**, and **Nothing was there**, which counts as the miss. The roll is scored on your client against the trace's real type and visibility; the player is told the outcome, never which DC applied. A hit copies the Remnant into their inventory as a Neutral Truth Bullet and leaves the original; a miss costs **1 Sanity**. One trace yields one copy per person. Traces tied to the murder are shown first. The first time anyone copies a trace, your browser asks you to describe it (name, player text, analysis text, prefilled); everyone who copies it later gets the same words, and a critical asks you again only for the bigger hint.

| Visibility | Daily Life | Key | Faint | Prep / Incident / Tamper |
|---|---|---|---|---|
| Obvious | 8 | 6 | 12 | 9 |
| Evident | 12 | 9 | 15 | 12 |
| Subtle | 18 | 12 | 18 | 15 |
| Hidden | 21 | 15 | 21 | 18 |

(Observe DCs, `OBSERVE_DC`. Neutral is priced as Prep; Final as Key.)

**Analyze.** Head against the bullet's real type and original visibility. Key and Final Truth Bullets show their kind the moment they are picked up, but their analysis text still waits for an Analyze on the easiest column (6 / 9 / 12 / 15); only an Autopsy Truth Bullet arrives fully read. A success reveals the true type (and whether it is tied to the crime); a failure locks that bullet for this player until the chapter ends - a copy handed to somebody else is a different item and carries no lock. The same tile always offers a hint request to you (**14** subtle, **18** direct, critical: one question of their choosing) and the hunt for a hidden stash (**16**); with no bullet left to analyse, only those two remain. Every use of Analyze needs a GM online and is refused, before anything is paid, without one.

| Visibility | Daily Life | Faint | Prep / Incident / Tamper |
|---|---|---|---|
| Obvious | 8 | 8 | 12 |
| Evident | 12 | 12 | 15 |
| Subtle | 18 | 15 | 18 |
| Hidden | 21 | 18 | 21 |

(Analyze DCs, `ANALYZE_DC`. Key and Final Truth Bullets, and an Autopsy handed out as Neutral, read on a Key column of 6 / 9 / 12 / 15. Inside a Class Trial an Analyze costs an action, or 1 Hope when none is left, or 1 Sanity when neither is.)

> [!IMPORTANT]
> A **critical** Observe or Analyze owes the player a substantial hint from you - the card says so in red.

The **autopsy** is issued from the dashboard or the after-incident screen to the students you tick: a name, what the player reads, your note. The answer key behind every bullet lives only on GM browsers and syncs GM to GM; `game.drpg.exportLedger()` and `importLedger()` back it up and restore it.

---

## 15. The Class Trial

`scripts/trial-floor.mjs`, `trial-floor-ui.mjs`, `trial.mjs`, `vote.mjs`; `config.mjs TRIAL`. One door: **The case > Class Trial**, a console that reads the trial top to bottom and never hides a section.

1. **Start the Class Trial.** Moves the phase, hands out the time of day's actions (keeping banked Sprint and Burst; a trial's later debates refill nothing), resets this chapter's trial record, charges the unfound Key Remnants, announces it. The trial opens in **discussion**: everybody talks, evidence goes on the table without taking the floor. While a trial sits, only the Analyze tile stays open (with Present, the Hope Calls and items), nobody crosses rooms, and Despair Calls and a Monocub's Confusion are locked; an Analyze or an Objection costs an action, then 1 Hope, then 1 Sanity.
2. **Open the debate** with a budget in seconds (default **180**, remembered per trial). Running over turns the debate's clock (on the trial's card in the Event panel) red and ends nothing; you decide when an argument is over. From now on presenting a Truth Bullet is an **OBJECTION**: the objector alone holds the floor for **60 seconds**, then the person it was aimed at answers in a **rebuttal** of **120 seconds** for the two of them, then the floor closes back to open discussion by itself - the debate's clock is not restarted; open another debate when the room needs one. Silence is social, not technical: the module does not mute anyone, it makes the state unmistakable on every screen and refuses the Objection button to anyone it is not for. Manual overrides: **+30 seconds** (counted from now if the clock has already run out), **End this mode now**, **Back to the debate**. **Close the debate** returns to discussion with the trial still running. `game.drpg.objectionLog()` lists everything presented this chapter.
3. **Vote.** Ballots go out to every living student's player (the dead do not cast ballots, `deadCastBallots: false`); the ballot lets them name themselves, Monokuma or the dead. The number of names demanded is the number of Blackened recorded this chapter. Ballots never touch world data: they travel to the GMs, are tallied in memory, and only the totals are published. The console shows who has not voted; **Send another ballot** re-sends a fresh ballot to them; **Start the vote over** throws the returned ballots away and warns you first. **Close and count** publishes the tally. A conviction needs **more than half of the ballots issued** (floor of half plus one); short of that, or with more names tied at the bar than there are Blackened, the result is a tie, and a tie counts as a wrong vote unless the table settles it.
4. **Verdict.** The window states who the register says the Blackened were, asks who is executed if the class was wrong, and whether they got it right. Correct: the Blackened are executed and every survivor gets a **Standard Level Up** (1 pick). Wrong: the accused is executed, every surviving Blackened stays anonymous and in play with a **Reinforced Level Up** (3 picks) and one **new rule** of their choice (you type it; it is announced without a name), and every Monokuma's pool is **filled to 12**. Both verdicts empty the overflow. The advancement dialogs open on your client, one per character: +1 max Health, +1 max Sanity, +1 to a statistic, +1 to an experience, or a new experience at +2. A Level Up can also be granted from a character sheet, where you decide what was earned (standard or reinforced) and whether you pick or the player does: their Level Up button lights gold, and the primary GM's client checks their choice against the offer before writing it.
5. **End of chapter** (section 16), and **End the trial**, which closes the floor and returns the campaign to Daily Life. The chapter-end screen can do the second for you.

During a **Final Trial** the same floor and vote run; only the verdict is the Mastermind's (section 8).

---

## 16. End of chapter and season reset

**End the chapter** (Between sessions, or the trial console once the verdict is applied) is one screen with checkboxes, each counted before it is offered:

- reveal what every Truth Bullet really is (bullets with no real type recorded are named as a loose end);
- sweep the students' Truth Bullets (Faint and Final stay);
- clear the Faint Remnants (reinforced traces and anything tied to the crime stay);
- clear this chapter's planted Key Remnants;
- end the Class Trial if it is still sitting;
- move to the next chapter, count the next session, and open the next chapter on the **following Morning, one day on, with actions and search tokens refilled**.

The Key Remnant plan is filed under its chapter before the clock moves, the Blackened register is cleared, and a stale body card cannot leak into the next chapter. If a second GM presses it after the first has moved the chapter on, they are told the chapter was already ended and nothing is done twice. A note reminds you whether a Final Truth Remnant was placed this chapter. **Chapter 6 is the last of a season:** there the "next chapter" box starts unticked and a warning says so; reset instead of moving to 7.

**Reset the season** (red tile) wipes the season and keeps the cast: it lists exactly what goes, with counts - projects, Remnants, Truth Bullets and the answer key, the Key Remnant plan, which rooms each character has discovered and which stashes they have found, deaths and Monocubs, every item carried or stowed, every advancement and what it bought, every card the module wrote and every messenger thread, notes, the pools to zero and Hope back to 2, doors back to how the season opened, the incident, the Mastermind, the trial, search tokens, Calls in force, the motive, the killing game rules, a called assembly, the overflow, the rest of the chat log, and the clock to Chapter 1, Day 1, Morning with everyone's actions refilled. Each of these is one of **29** tickable groups in five sections (the case, the cast, the board, the log, the world), all ticked by default; untick one and the reset leaves it alone, and the choice is remembered, unticked, for the next reset.

**What stays:** the cast with names, portraits and Ultimates, the maps, the rooms and who owns them, who watches whom, the Monokuma team, the campaign name.

> [!CAUTION]
> You type **RESET** to confirm; nothing can undo it.

---

## 17. Sound and SFX

`scripts/music.mjs`, `sfx.mjs`, `sound*.mjs`; `config.mjs SFX_CATEGORIES`, `SFX_EVENTS`, `SFX_SLIDERS`, `SITUATIONAL_PLAYLIST`.

> [!NOTE]
> **The module ships no audio.** The files are yours; an event with no file is silent by choice, not by fault.

The **Sound** window (Right now > Sound) has three tabs for a GM:

- **Play**: a cue from the playlist named **"Situational"** on repeat, holding whatever was playing, and a reset that gives it back. If the world has no playlist of exactly that name, a button creates it - the match is by name, and an almost-right name is a playlist the module ignores.
- **Music**: one playlist per state, in the order the states outrank each other: game paused, the Eclipse, trial Objection (rebuttal keeps the same music; a random track per takeover, and it starts at once), trial Debate, trial Discussion, body found (silence by default, the previous music paused), the Investigation, then each of the five times of day. Requires the *Music follows the game state* setting (off until you turn it on); the primary GM's playback is everyone's. The **murder** row stands outside that ladder: it plays one track off its playlist only in the browsers of the incident's participants and the GMs, whatever the setting says, and ducks the room's music there, so nobody else learns from the music that a murder is happening (a trap's builder, somewhere else, hears nothing). Left empty, an incident holds whatever was playing.
- **Effects**: one file per event (or several separated by `|`, drawn at random, never the same twice in a row) and a Test button.

Two **volume sliders**, per browser, in the Look dialog and in the Sound window for players: *Sound* for the effects, *Music* which is Foundry's own playlist volume rather than a second one. A GM also finds the table-wide **Vary the sounds you hear often** switch beside the sliders, in Settings and, under Monokuma Legacy, at the top of the Sound window (`SFX_VARIATION`: rate ±14%, floor 0.5, small gain changes).

The catalogue, by category:

| Category | Events |
|---|---|
| **Safety** | the safeword - full volume whatever the slider says |
| **Interface** | windows opening and closing, buttons, the chat opening |
| **Chat** | message sent, received, a player calling for a GM, a Hope Call, a Despair Call, a new rule, a motive, an assembly |
| **World** | room discovered, room entered, a crossing refused, an action spent, a project finished, a critical, a search finding nothing, Observe failing, a secret project noticed, sabotage failing or witnessed, a tool breaking, something stolen, the Eclipse beginning and ending, the overflow firing |
| **Incident** | a death, a body found, cleaning up failing, Breakdown, Wounded, a Monocub changing, Confusion, your turn in an incident, a Truth Bullet found, evidence identified, analysis failing, the debate opening, an Objection, the rebuttal, the vote opening, the verdict, a level up |

Each event's audience is fixed in the catalogue - a death is heard only by the GMs and the participants; a body found by everyone; the rebuttal by the whole table, once as it starts, whether the Objection's minute ran out or you opened it.

A browser plays nothing until it has been clicked; the module drops those sounds rather than queueing them. `game.drpg.diagnoseSfx()` counts what was dropped and lists what is mapped, muted or has already failed; `game.drpg.testSfx(key)` says why a sound did not play; `game.drpg.diagnoseMusic()` prints every state, whether it applies and what it is mapped to.

---

## 18. The Look dialog, themes and the Language setting

The gear in the bottom-right corner opens **Settings** (`scripts/look.mjs`): everything in it belongs to this browser alone, except the one switch a GM also gets there, the table-wide **Vary the sounds you hear often**. It holds the two volume sliders and **Messenger sounds**, and:

| Setting | Details |
|---|---|
| **Language** | English or Polski, per browser, English by default, separate from Foundry's core language on purpose (a change asks to reload; the glossary stays English) |
| **Theme** | *Stained Glass* (the current identity: black broken glass along the screen edges, colour in the seams) or *Monokuma Legacy* (the look before it, with the pixel font switch) |
| **Interface scale** | 80% to 140% on the module's own type and panels |
| The glass pulse, the state name behind the clock and **Glass blurs the map** | under Stained Glass |
| **Reduced motion** and **High contrast** | under both; each also switched on by the operating system's own preference |

The same switches are in Foundry's module settings.

> [!TIP]
> **Glass blurs the map** is the theme's most expensive effect: the first thing to turn off if the interface stutters, and `game.drpg.perf()` says what it costs on that machine.

The **book** beside it, the smallest of the three corner buttons (`scripts/handbooks.mjs`), opens the handbooks in the game, rendered from `docs/handbooks` in the module language: the Student Brochure and the Player Handbook for everybody, and this GM Handbook for GMs only.

Clicking any standing panel - the clock, the Despair rail, the status strip, the Projects tray - opens a window that explains what it is and where things stand, showing each user only what the panel already shows them.

**Notices** (`scripts/popup.mjs`) are the cards that surface results, refusals and announcements; a GM gets the ones addressed to the table or to them. A notice stays until its reader closes it - an ordinary one with a click anywhere on it, a sticky one from its X; only a "waiting for the GM" card closes itself once the answer arrives. The newest goes on top and pushes the older ones down. When there are more than the stack shows (**2** on the Stained Glass tile, **4** under Monokuma Legacy), the older ones wait underneath behind a "+N" badge and come back as cards are closed. The Class Trial's evidence stage in the middle of the map shows two and keeps arrival order, so an Objection reads after the presentation it answers.

---

## 19. The safeword

`scripts/safeword.mjs`. Every character sheet carries a **safeword button** bottom-left, captioned with the table's word (set in Season setup; blank means the default "Safe Word"). There is also a keybinding, unbound until the table picks one, and `game.drpg.safeword()`. **Anyone may press it** - player, GM, dead, Monocub, spectator - and it does three things in one press:

1. the game pauses (the primary GM's client does it, so a GM has to be connected);
2. everybody sees the same "THE SCENE IS STOPPED" card and hears the safeword sound at full volume;
3. every GM gets a sticky note saying who called it and, when it was pressed on a sheet, from which room.

Nobody else is told who. The Event panel keeps a "The scene is stopped" card up, with no name on it, for as long as the game stays paused.

> [!CAUTION]
> There is no reason field and no target: the scene is being stopped, not an accusation filed. Sort it out with the person, then resume from a point everyone agrees on.

The **pre-session note** in the messenger (seven questions a player answers before every session: whether they intend to kill, whether they are open to dying, consent to torture or romance, triggers, how they mean to play, the large project they aim at) is the other half of this; read them before deciding whether to approve a murder.

---

## 20. Troubleshooting

Everything is under `game.drpg` in the browser console; actor arguments accept a document, an id or a name.

**The regression suite.**

| Call | What it does |
|---|---|
| `game.drpg.runTests()` | runs the source regressions and the read-only invariants; safe during play - it checks at the end that nothing in the world moved, and says what did if something did (a player acting while it runs counts too) |
| `game.drpg.runTests({ tier: 2 })` | adds the scenarios, which write; asks first, in a window that names the world, with Cancel first and the default; only on a copy of a world |
| `game.drpg.runTests({ tier: 0 })` | reads the module's own source alone |

> [!CAUTION]
> **Tier 2 writes** - it opens incidents, kills people and resets seasons in fixtures it builds and removes - so never run tier 2 in a world somebody is playing in; scenarios that need more people or rooms than the world has are skipped and say what the world lacks, tier 2 is refused while an incident is open, and a second run on the same client is refused while one is in flight.

The result is a "passed, failed, skipped" count - with ", red until a later stage" after it when a test is marked to fail until a named stage ships - followed by `ok`, `FAIL`, `skip` and `red` lines; a skip is a test that said what the environment lacks, never a result that came out wrong.

**Fog and visibility.**

| Call | What it does |
|---|---|
| `diagnoseFog()` | on the *player's* client (a GM's fog is lighter and clears every room the class has found, so it cannot show a player's problem) says which of the look-alike causes it is: the setting off, no named regions, the layer not mounted, every room already discovered, the scene not prepared |
| `diagnoseScenes()` | lists the scenes with rooms and whether each is ready |
| `prepareScenes()` | fixes them all |
| `whyBlack()` | lists what the fog layer has on screen while the picture is wrong |
| `checkRegions()` | reports overlapping rooms, borders off their walls, openings too long to be doorways and corners off the grid |
| `doorwayReport()` | explains each stretch of the current room's border |
| `fogPeek()` | hides the fog for a few seconds |
| `fogAnimations(false)` | turns the reveal off mid-session |
| `seedDiscovery()` | records the room every character already stands in |
| `diagnoseVisibility()` | on the complaining client, explains why a token in another room is visible |

**Despair and dice.** `diagnoseDespair()` and `diagnoseDice()`; `diagnoseCharacters()` is the setup report. Despair not arriving usually means no primary GM connected, *Rolls grant Despair* off, or the roll was a reaction.

**Other tools.** `diagnoseVoice()`, `diagnoseSfx()`, `testSfx()`, `diagnoseMusic()`, and:

| Tool | For |
|---|---|
| `diagnoseTruthBullets()` | are the bullets and their answer key in step |
| `diagnosePatches()` | is every override still where it expects |
| `diagnoseWindows()` and `diagnoseStyles()` | a window cut off or a sheet that looks wrong |
| `traceClicks()` | a click that does nothing |
| `fileSizes()` | a hosted world that seems to serve the old files |
| `perf()` | a theme that stutters |
| `a11y()` | controls a screen reader cannot name |
| `relayGuard()` | whether the guard on Daggerheart's GM relay is standing (`state: "ok"`), and what it has refused this session |
| the panel's **Debug log** (Diagnostics) | its Copy button produces the paste a bug report needs |

Repairs: `resetAllActions()` for a botched advance, `ruleOnParkedMurder(killerId, true)`, `applyChapterEnd({...})`, `setMotive(null)`, `refreshMusic()`, `repaintFog()`, `resetAllVoice()`.

**Common pitfalls.**

| Symptom | Cause and fix |
|---|---|
| *Players see a black screen.* | The scene has rooms but Foundry vision is still on. Pre-season checks, or `prepareScenes()`. |
| *"Morning · ECLIPSE" and murders keep being refused.* | The clock was edited while an Eclipse ran. End the Eclipse from the HUD's play button. |
| *Nobody got their actions back.* | Actions come back when the Eclipse opens, not when the clock moves. Use the panel's **Next time of day** for a boundary without an Eclipse, or tick *Also refill* in Edit campaign. **Never both.** |
| *Search never produces what I put in the tables.* | The tables are found by name; keep the `DRPG <category> - Tier n` shape or install from the editor. Room pools must be pointed at from Room Setup. |
| *The Play button does nothing.* | There is no playlist named exactly "Situational". The button in the Play tab makes one. |
| *Silence for the first minutes of a session.* | The browser had not been clicked. Not a fault; `diagnoseSfx()` counts what was dropped. |
| *The panel says the debate is open, but the chapter is over.* | The trial outlived its chapter. End the Class Trial from the console (the chapter-end screen has a checkbox for this). |
| *A Despair Call or a ruling did nothing.* | Two GMs: the primary writes. Check which connected full Gamemaster is the primary (the lowest user id), and look at the Debug log. |
| *A player says the GM's client refused a Daggerheart change.* | Their Daggerheart feature asked for something this game keeps to the GM (an area on the map, a new countdown, another student's Health). The warning on your screen names what; do it by hand. |
| *A player's Daggerheart cost did not land while a GM was reloading.* | With two GMs, only the primary one makes Daggerheart's changes for players; one sent in the moments around its reload can be lost. Set it by hand. |
| *Chat says Daggerheart asked for a change for a sender Foundry did not name.* | Every such change is refused. If players' Hope, Stress or Fear stop moving when they roll, this is why: tell the module's author, with `game.drpg.relayGuard()`. |
| *A door stays locked after the season reset.* | The Doors tab's "starts locked" column is what the reset restores. |

---

## 21. Session checklist

**Before the session**
- Open **Set the season up**: every non-optional row ticked; run **Pre-season checks** (no black-screen scenes, no readable sheets).
- Room Setup: bedrooms owned, doors as intended, rest rooms flagged, tables and favours set, tokens restocked.
- Despair Flow: every student watched; pools named; overflow threshold and hat as you want them.
- Item tables installed; opening items in every bag.
- Sound: playlists mapped (and "Situational" exists), effect files assigned, volumes checked on your browser.
- Read the pre-session notes in the messenger. Confirm the safeword with the table.
- Key Remnant plan drafted if a murder is likely this session; Final Truth Remnant placed if the chapter needs one.
- Clock: right chapter, day, session, time of day, phase.

**Each time of day**
- Watch the **Next** line and the roster: who still has actions.
- Rule on cards in the messenger promptly (Experience, Ultimate, dynamic actions, proposals, Observe targets, reshaped traces, Direct Murder declarations, trap alerts).
- When everyone is done: start the Eclipse (refill), let them place, end it (advance). Judge parked murders at the lights.
- Spend Despair like a Monokuma: the table is always told.

**When a murder runs**
- Take the incident to the end before anything else. Finish the prose the cards hand you.
- Let the killer clean up while the scene is warm. Place the remaining Key Remnants (the after-incident screen counts them).
- Body found: pick which Faint traces belong, then start the Investigation when the room is ready. Issue the autopsy.

**Investigation**
- Dashboard open: Traces, Key Remnants found of planted, Who has what. Aim for the suspect circle of 2 to 4.
- Honour critical hints. Start the trial when the class is ready, knowing what the unfound charge will be.

**Trial**
- Start, discussion, open debates as needed, close them; vote, remind stragglers, count; verdict; level-ups; end of chapter.

**After**
- End of chapter: reveal, sweep, clear, next chapter, next session, next morning.
- Copy the Debug log if anything misbehaved. Note what the next chapter needs.
