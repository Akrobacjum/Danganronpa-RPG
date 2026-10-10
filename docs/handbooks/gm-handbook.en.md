# Danganronpa RPG - GM Handbook

*For the Foundry VTT v14 module "Danganronpa RPG", version 1.2.71, built on the Daggerheart system.*

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
| Dice So Nice! | required | Every roll in this game is thrown on the screens allowed to see it; this is how the duality dice are seen |
| Isometric Perspective | recommended | The academy maps are drawn isometrically; without it the scenes, tokens and Remnants land on a grid the art was never made for. Square maps still work |
| LiveKit AVClient | recommended | Per-room voice: regions become breakout rooms, and moving between rooms moves who can hear you. Without it the whole school talks on one channel |

The module does not use libWrapper. If Isometric Perspective ever asks for it, that module's own page says so.

The module was developed and played on The Forge and works the same on any Foundry v14 host.

**Starting a world.** Make a world on the Daggerheart system, enable the module and its dependencies, then open the GM panel (the **GM** button in the left column, under the clock) and run **Set the season up**. Everything after that is section 2.

**Updating from a build before 1.2.63.** 1.2.63 moves what only the GMs may know - the case, section 14 - into a store it keeps for each world in each GM's browser. It reads the store the earlier builds kept in the browser and never writes it, and nothing leaves the world's data before the new store has read it back. Before you install it, copy the world (Foundry's backup of the world in Setup, or a copy of the world's folder), as you would before any update that moves data. If you also want the browser's own copy, open the world in each GM's browser and paste this into the console (F12); it saves every `danganronpa-rpg.` key of that browser to one file and answers how many it saved. That file holds every answer key this browser keeps, of every world it has opened: keep it where no player can open it, as you keep a case backup.

```
(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("danganronpa-rpg.")) o[k] = localStorage.getItem(k); } foundry.utils.saveDataToFile(JSON.stringify(o), "application/json", `drpg-browser-${game.world.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`); return Object.keys(o).length; })()
```

A world copied before the update opens holding the same case as the original in a browser that played both: the old store in the browser did not say which world it was, so each copy takes the rows its own actors, scenes and items match. From the first load on, each world keeps its own. Whether Foundry's Duplicate World gives the copy a world id of its own, which that depends on, has not been checked at a table.

**Updating from a build before 1.2.64.** 1.2.64 takes more of what only the GMs may know out of the world's data and into the same store: who builds each trap, what sets it off and who sabotaged a project; the Direct Murders declared in the dark and the crossings of a running Eclipse; the Key Remnant plan; the players' pre-session notes; how a running incident happened; the overflow's count; what was taken off each body; and which trace each Truth Bullet came from. It drops a Reroll's bookmark and a Search card's facts from the world's data, puts the neutral name and picture back on traces' tokens that earlier builds had named, and moves the answer keys still left on old traces' tokens into the case. This runs once, on the primary GM's browser, a moment after the first load of 1.2.64. Nothing leaves the world's data before the store has read it back; a step that cannot finish leaves the world as it was, says so in a notice that stays on screen, and the next load of the world tries again. Copy the world before you install it, as for 1.2.63, and **Back up the case** (section 14) after that first load. Do not go back to 1.2.63 afterwards: it reads the world data 1.2.64 emptied, so traps lose their killer and their trigger, the notes, the Key Remnant plan and the overflow's count read empty, players stop seeing the traces they found, and what was taken off each body is forgotten.

**Module settings worth knowing.** Under Foundry's module settings you will find, among others: *Force private player rolls* (every roll is whispered: one an action throws to the GMs alone, its roller reading their own, and a statistic clicked on a sheet to the GMs and that character's player; with Dice So Nice 6.0 or later a roll's dice then fall only on the screens that may read it (and, in an incident's fight, on its participants'), whatever Dice So Nice's own *Hide 3D dice on secret rolls* says - an older Dice So Nice decides that by its own setting), *Keep character sheets anonymous* (another player's sheet opens redacted), *Search tokens per room*, *Lock the roll window for players*, *Players only see who is in their room*, *Rooms decide what players can see* (the room fog), *Players cannot edit Actions, Hope, Health, Sanity or statistics*, *Crossing rooms costs a Move*, *Rolls grant Despair*, *Replace the Daggerheart Fear tracker*, *Guard token editing from Isometric Perspective*, *Music follows the game state*, *Regional voice*, and the per-browser *Language* and *Theme*. The defaults are the way the game is meant to be played; the switches exist so a table can handle one piece by hand when it wants to.

> [!IMPORTANT]
> Two of these settings start off because each needs something from you first: *Music follows the game state* (playlists mapped in the Sound window) and *Regional voice* (LiveKit AVClient and a working server).


> [!NOTE]
> **What a player's console can and cannot do.** Players' browsers ask yours to make most changes in this game, and Daggerheart does the same for its own rules. Your browser checks each request: who really sent it, whether that player plays the character or may see the project, and whether the room, the stage and the turn allow it. A player's request to take something back is refused; the Reroll is made by your browser. A request that fails changes nothing. A refusal leaves a line with the player's name in the primary GM's Debug log, and tells the player, in their own language, what was not carried out and why; a few are only logged - among them a trap report, the Level Up catch-up and a Search's look for a planted item, which nobody waits on - and a Daggerheart request of a kind the module does not know at all is noted without a name. For a Daggerheart change you are also warned on screen, and a change Daggerheart does not make for a player puts a card in your chat - usually a sign somebody went around the game, sometimes a Daggerheart feature this module has not met yet, so ask before you conclude. Fear is not rationed: every step a player's Daggerheart asks for lands, one at a time, and if one player's client moves it more than four times in ten seconds you get a note on screen - compare it with the rolls in chat; slower steps are not compared with anything. Since 1.2.67 the dice of a player's action and of a statistic clicked on a sheet are thrown by the primary GM's browser, and what an action earns is read from that roll, not from what the player's browser reports; since 1.2.68 what that roll adds to its dice - the statistic, experiences, a bonus, advantage dice - is your browser's own reading of the character, the action and the Calls the GMs hold armed, and whatever the player's roll window put on beyond it is not counted: you are whispered, the player's own card says what was not counted, and `game.drpg.rollFlags()` lists it - since 1.2.69 a die the window shows at other faces, in another number or with a modifier of its own is named there too, and never thrown. Since 1.2.68 too a change a player's browser makes on their own student - Hope, Health, Sanity, actions, statistics, the module's items - is checked by the primary GM's browser against what the GMs hold, and put back or brought to you (section 6.3). Since 1.2.69 your browser also keeps a trace naming the player Foundry names as the sender: a Daggerheart request about a student it refused, a message a player's browser wrote with a flag only a GM's browser writes (no browser reads it as a drawn roll; it is never granted and never a Reroll's), and a roll's dice a player rewrote that it put back - `game.drpg.sheetWrites()` lists them beside the writes. What is not checked yet: the dice of a roll thrown with no GM connected (you grant what it moves, section 6) and of Daggerheart's own item and damage rolls; what the player's browser still reads for itself - which item a Search grants (its tier is checked), how a Shadow roll that hides what a student is doing from the room came out, and what Listen hears; the resources of any actor that is not a student, companions included; their own items' charges (not held to the item's maximum), and the quantities of those that are not the module's; countdown ticks, one step each, and any change to a countdown you gave them ownership of; save totals for their own tokens; their party's group roll and tag team entries; and the order of a scene's environments - none of them with a limit on how often. If a Daggerheart feature a player uses stops with that refusal (placing an area, starting a countdown, healing or harming another student with an ability), it asked for something this game keeps to the GM: do it for them. A player's transfer of an item to a party waits for you the same way, and you are told of it once a session. If Daggerheart is newer than the module knows, you are told once what it refuses.
>
> **What every browser holds anyway.** The module keeps its secrets out of the world's data. The rest of the world is Foundry's to send, and Foundry sends it to every browser, where a console reads it whatever the screen shows: where every token stands and when it moved, hidden tokens and the Eclipse included; every actor's data - a victim's Health at 0 before anybody has found the body, the new maxima of a Level Up (the class picks together, which hides the moment and not the amount: a Blackened who walked out of a wrong vote takes four picks where the others take one), action budgets, and Hope, a conversion's included (section 7); every item on every sheet, and each move of one from sheet to sheet; that a chat card exists, when, who posted it and to whom it is whispered - the words of the module's own private cards travel beside it, to their readers alone; Daggerheart's Countdowns, which are the projects - a secret project's name, its progress and who may see it (section 11; this version does not move them); every other module's world settings (section 9.4 has the one that matters); and other players' Truth Bullets - that they exist, their name, the words their holder has read, and the room and time they were found, but not their answer key and not which trace they came from.
>
> **What the chat still says** (since 1.2.65). A roll the module throws names nobody on its document - no speaker, no title, no actor - and is whispered to the GMs alone, its roller reading their own; what a private card says about itself travels with its words; and a card whose mere existence would tell something is veiled: addressed to the whole table and naming nobody. While an incident runs, every private card that would name a character or a player is veiled, whoever posts it and whoever it is about - a bystander's own included, so a veiled card says nothing of who is in the fight: it speaks as Monokuma, and a browser that was not sent its words when it was posted never shows it (measured on the test harness for an item used in a fight, a Call bought for a participant and a bystander's cards). What stays, on purpose, and how far each was measured:
> - **Who created a roll or a card, and when.** Foundry stamps both on the document with the user whose browser created it. Since 1.2.67 a player's roll - an action's, and a statistic clicked on a sheet - is thrown on the primary GM's browser, which writes its message, so its author is a GM and nothing on it names the roller (measured on the test harness, where a bystander's browser holds the killer's opening roll with the GM as its author). The roller still sees it as their own: their dice fall on their screen in their colours, or the dice sound plays without Dice So Nice, and they read the result; the GMs see the dice in the roller's colours, an incident's participants each incident roll, and nobody else anything - measured on the test harness's model of Dice So Nice, not at a table. A roll thrown while no GM is connected, or on a Daggerheart whose rolls the module does not draw (you are told once per version), is thrown in the player's browser and names that player as before - with no GM connected an action is refused before it is paid for, and any other roll is stamped and moves nothing until a GM grants it (section 6, the primary GM). A private card a player's browser would post while an incident runs is posted by the primary GM's browser at its asking, so its author is a GM as well (measured on the test harness, where the bystander's browser holds the fight's cards - an item used, a tool broken - and a player's message to the GM with a GM as their author); with no GM connected it is not posted, and the player is told that no GM is connected. Any other card a player's browser posts, veiled or not, carries its author the same way (Foundry's rule, not measured card by card).
> - **That a veiled card exists, and when; that a GM whispered the GMs, and when.** Measured for the trap's receipt: a bystander's browser holds it as a card that names no thread and no player, without its words.
> - **A roll's formula**, which carries the statistic's value: when you roll for one character, it can tell them from another (read in the code, not measured).
> - **Daggerheart's own reroll** is taken off a player's chat menu since 1.2.67, and dice a player's browser rewrites anyway - Daggerheart's own reroll on the card, a console - are put back by the primary GM's browser, and the GMs are told, once per message and player (read in the code), with a `rewrite` row in `game.drpg.sheetWrites()` naming who (measured on the test harness for a console's rewrite; the menu and the card's reroll not, as the harness does not run Daggerheart's chat log). A roll thrown before the primary GM's browser loaded cannot be put back, only told. The 3D dice of such a rewrite may still fall on every screen before it is put back (not measured). The module's Reroll shows its dice only to the roller, the GMs and, in an incident's fight, its participants.
> - **Foundry's user activity**: a player's targets and cursor are shown to everyone (Foundry's own, not measured here; the setup checklist can make the GMs' pointer private).
> - **A statistic clicked on a sheet** at your request keeps Daggerheart's card, written by the GM's browser and naming nobody, whispered to the GMs; the roller's browser alone is let read it beside them (measured on the test harness). Wherever it is read, its header shows the roller's character - portrait and name - or, on a browser that no longer knows whose roll it was (after a reload), nobody; never the GM (measured on the test harness's model of Daggerheart's header, not at a table). **A roll the module did not throw** - Daggerheart's own item rolls - keeps Daggerheart's card and its speaker, whispered to the GMs and that character's player (read in the code). **A Monocub's Meddle** is thrown by the GM's browser since 1.2.67, after it has checked the target; its card is the module's own, posted by the Monocub's player's browser under the Monocub's name, and the room sees it like every Monocub roll. A Meddle the GM's browser refuses throws nothing and posts no card - the Monocub's player is told it was refused (read in the code; the refusal measured on the test harness).
> - **The chat log written before 1.2.65, where its first load could not rewrite it.** That load rewrites the module's old rolls and private cards as they are written today: what is veiled now is veiled (the trap's receipts, a reshape card, Confusion's cards, a Loaded Die's notice, a worn or broken tool, a Hope Call's receipt, the time of day told during an incident), and a roll's list loses an incident's other players. It leaves a whisper that carries its words in its document (the module's from before it kept private words off the document, and every whisper that is not the module's), 1.2.64's public card for the end of a secret project's repair, an old card of a veiled kind known only by its words, when the primary GM's browser no longer holds them or holds them in another language, a Monocub's roll, and the other private cards posted while an incident ran - an item used in a fight, a Call armed on a participant - which are veiled today because an incident is running, and an old card does not record whether one was. A veiled thread card keeps its place in its thread only on the browsers connected at that load; elsewhere its words stay in the chat log. Measured on the test harness for a receipt, Confusion's card and a fight's roll, not on a real world's log. Clearing the chat log at a case's end takes all of it.

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
| Every student has a Monokuma watching | Every student feeds a Despair pool (one never assigned falls back to the first pool), or is set to "- nobody -" on purpose (an NPC-run character, a template), which counts as watched. Every player's browser can read who is set to "- nobody -", so assign the Mastermind like any other student | **Open** opens Despair Flow |
| The students are split evenly between the pools (optional) | The living cast per pool differs by at most one student | Advice only: **Open** opens Despair Flow, where **Split evenly** deals them out. A cast that will not divide is a decision, not a mistake |
| Sound files (optional) | At least one sound event has a file | **Open** opens the Sound window; the module ships no audio |
| Enough rooms for the cast (optional) | Shared rooms (bedrooms and regions ticked "Not a room" in Room Setup > Doors excluded) against about 1.5 per player (`ROOMS_PER_PLAYER`), rounded by `roomsWantedFor` | Advice only: below the ratio, two private conversations cannot happen at once |
| The map has rooms | The working scene has at least one Region | **Open** opens Room Setup. The row also carries the room-drawing guide and **Check the rooms on this scene** |
| The GM's pointer is private (recommended) | Foundry's cursor sharing is off for the two GM roles | **Do it** edits core's permission matrix; players keep theirs |
| The Mastermind (optional) | A Mastermind is set | **Open** opens the Mastermind window. A season without one is a legal season |
| The Mastermind feeds a Despair pool (shown only when it does not) | The Mastermind is set to "- nobody -" in Despair Flow, which every player's browser can read; the case health check (`game.drpg.gmStoreHealth()`, `game.drpg.diagnoseGmStores()`) lists it too | **Open** opens Despair Flow |
| The voice server's secret is not in the world (shown only when it is) | LiveKit AVClient is set to a self-hosted server with its API secret in a world setting, which reaches every browser | Nothing this module can move: a server that issues its own access tokens, such as the Tavern, keeps the secret off every browser. `game.drpg.diagnoseVoice()` says the same |

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
| Right now (always open) | **Students** (alive / dead / Monocub, Hope for Monocubs, and one **Items** button at the foot of the window), **Projects**, **Sound**, **Killing game rules**, **Public roll** (a formula and a flavour; the one roll everybody reads, since 1.2.69; a table check, LIVE-E33-04, not yet run) |
| The case (Daily Life, Investigation, Class Trial) | **Murder** (greyed out during an Eclipse), **Investigation** dashboard, **Class Trial** console |
| Between sessions (collapsed) | **Edit campaign**, **Despair Flow**, **Room Setup**, **Item tables**, **Reset all voice rooms**, **Set the season up**, **The Mastermind**, **End the chapter**, **Reset the season** (red) |
| Diagnostics (collapsed, dim) | **Debug log** - everything this browser has failed at since the page loaded, with Copy and Clear |

**Students** deserves a note: the dropdown only moves flags and is the repair tool for a misclick. The buttons on the right do the real thing - **A character dies**, below, and **Invite as a Monocub**, which turns a dead student into one. Monocub columns (Hope, Despair to Hope donation, Silenced) appear only once a Monocub exists. A death the GMs keep until the body is found (section 13.4) shows in the dropdown as **Dead, not found**; setting it to *dead* (or *Monocub*) makes it known to the table, the same publication a discovery makes, and setting it to *alive* takes the death back.

> [!CAUTION]
> **A character dies** destroys the character's Truth Bullets (unless you tick *Keep their Truth Bullets*, for a death outside the killing game) and leaves everything else on the body. Its second box, *Keep it the GMs' until the body is found*, is ticked for the running incident's victim: then nothing reaches the table yet - no flag, no marker, and the Truth Bullets are destroyed only when the death becomes known (section 13.4).

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
| Search | Eye | 1 + a room search token | Loot the room for something you name | 8: Tier 0 (Hidden trace), 12: Tier 1 (Subtle), 18: Tier 2 (Evident); critical: +1 tier and an Obvious trace. Taking a Murder Weapon or Cleaning Tool leaves a Faint Prep Remnant. Failure finds nothing |
| Observe | Eye | 1 | Copy a Remnant into your inventory as a Neutral Truth Bullet | DC from `OBSERVE_DC` (section 14); a failure costs 1 Sanity (`OBSERVE_FAIL_STRESS`) |
| Analyze | Head | 1 | Identify a Neutral Truth Bullet, or ask the GM for a hint | DC from `ANALYZE_DC`; a failure locks that bullet until the chapter ends. Hint mode: 14 a subtle hint, 18 a direct hint, critical: they may ask you one question. Locate a hidden stash: 16 |
| Projects | the project's | 1 | Push a project in this room, or propose a new one for you to approve | 12: +1 progress, 18: +2; critical: +2 and the action refunded |
| Dynamic | GM's choice | 1 | The player describes something the game has no name for; you set the band | see the bands below |
| Rest | none | 1 (Short) or 2 (Long) | Recover | see below |
| Listen | Shadow | 1 | Learn who is next door, no GM needed | The room is picked before the roll. 14: how many people are in it; 18: who they are, by name; critical: who is in every neighbouring room. The answer is a private card. A neighbour the listener has not discovered is named only "Unexplored room 1, 2...", in the picker and in the answer |
| Palm | Hand, then Shadow | 1 | Take something out of a pocket, or leave something in it | Take: 10 to succeed, 15 on Shadow to stay unseen. Plant: 8, unseen 13 |
| Tamper | Shadow | 1, or 1 Sanity when no action is left | Erase a trace, reshape it, or plant one pointing at somebody else | Uses the Stage 6 rules (section 13). Reaches only traces in your room that you have found (hold a Truth Bullet of), plus, while an incident is open, its Incident traces if you are its victim or one of its killers |
| Direct Murder | none | 1 | Open a direct murder, agreed with you beforehand | Declared in the Eclipse; section 13 |

**Move** is not a tile: dragging the token is the action, and the cost is applied when the token arrives in another room. **Sabotage** is the third branch of the Projects menu, and rolls the statistic of the project it breaks.

**Who picks the statistic.** A roll whose definition lists one statistic rolls it. One that lists several - the openings, the crisis actions, the clean-up - asks you: the player tells you in their messenger thread what their character does, and you pick one of the listed statistics on a card in that thread, or in a window on your own screen when you roll for a character yourself. **Refuse** means the action is not taken, and nothing is spent. The roll window opens on your pick, locked. The one exception is the Hope Call **Resolve**, after which the player picks in the roll window. A project's roll - Work on it, or a Sabotage of it - takes the statistic the project was given when it was made; a project stored without one asks you once, the same way, and keeps your pick.

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

Spent from the character sheet, whispered to the player. A Call that changes a roll - Support, Experience, Ultimate, Resolve, Loaded Die - is bought on the primary GM's browser, which takes the Hope and arms it; with no GM connected it cannot be bought, and nothing is paid (read in the code: the GM's browser refuses the request before its price; measured for a Search, not for a Call). A roll the primary GM's browser draws applies only the Calls the GMs hold armed; a roll thrown in the player's browser - with no GM connected, or on a Daggerheart whose rolls the module does not draw - spends there the Calls its window shows (read in the code). Locked during an Eclipse, under a *Silence* darkening, for a player hit by the *Silence* Despair Call, and for the dead; they stay open in an incident and in a Class Trial. Two of them need your ruling.

| Call | Cost | Effect | Needs the GM |
|---|---|---|---|
| Support | 1 | Give another player advantage on one roll; same room | no |
| Experience | 1 | Add an experience to a roll it genuinely applies to | yes |
| Ultimate | 1 | Advantage on a roll the Ultimate genuinely applies to | yes |
| Contribution | 2 | +1 progress to a project being worked on in your room | no |
| Sprint | 2 | One more room crossing this time of day, free | no |
| Reroll | 3 | Reroll the action; the previous outcome is reverted. A crisis action that killed somebody cannot be rerolled: the death stands. A trace you have written on, one somebody has already found (for a Reroll that would remove it) and one older than a Reroll can reach stay as they are; you are told which trace, to settle by hand. Your browser makes it - the Hope, the dice, the message, the undo and the replay; with no GM connected it is not made. It settles what a fresh roll of those dice would: Hope, Fear and the critical's second Hope only with Daggerheart's Hope and Fear automation on for players, and Despair only with "Rolls grant Despair" on. A reload of the browser making it, half way, is put right when the primary GM's world loads: before the new dice counted, the first roll and the Hope come back and the player and you are told; while the action was being made again, you get a card with the character, the action and both totals - check by hand what the action left (progress, items, traces, damage, a turn) and settle it; the Hope stays paid and that roll cannot be rerolled again; while its Hope was being paid or given back, the first roll stands and you are told to check that character's Hope by hand. A second Reroll of a character is refused while one is being made, on any GM's browser. A Reroll of a roll your browser drew throws it again as it was counted - the same dice and what your browser counted, never what the roll window claimed | no |
| Resolve | 3 | For one roll, choose the statistic yourself | no |
| Burst | 4 | The next action costs nothing, however much it would have cost | no |
| Relief | 4 | Take a Short Rest now: no action, no rest room, does not use up this time of day's | no |
| Loaded Die | 6 | On the next roll one die is set to 12 and the other is thrown; a critical only if that die is 12 too | no |

**Approving Experience and Ultimate.** The player must write what they mean to do with it - an empty box cancels, because the ruling is about the sentence, not the Call. The request lands as a card in the player's messenger thread, visible to the player and every GM, with **Applies** and **Not this time**. Any GM may answer. The yes is kept by the primary GM's browser, which arms the Call only with it; a card put up by a primary GM who has since left cannot take a yes - the player asks again (read in the code). Nothing is charged until a yes; a refusal or a silence costs the player nothing (the request times out after **five minutes**). If your browser reloads with the question open, the player's client asks again when you reconnect. Once answered, the card becomes a receipt in the thread.

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

Obstacle, Approval, Support and a Monocub's Confusion are all "armed" on the target's next roll through the same mechanism; the roll dialog applies it, and one armed after the target's window opened waits for their next roll (the window says so). On a roll your browser draws (since 1.2.68) your browser's list decides instead: a hindering Call - a disadvantage or a negative bonus - counts on it when the window names it, whatever its age, and when it was armed more than a minute before the roll, whether the window shows it or not; only one the window does not name and that was armed later waits for the next roll. Since 1.2.69 the bonus a Call arms (a Confusion's help) is written into the window's bonus field, read-only, and travels with the roll, and a Call taken back while the window is open leaves the field empty: the window never sends a number your browser does not hold (measured on the test harness's stand-in of the window; on Daggerheart's own window a table check, LIVE-E33-09, not yet run). Seals, Chained and Silence are cleared when the next Eclipse opens, or by the next time-of-day change when no Eclipse is used. A Public Announcement is deferred: the assembly runs on the next boundary, and a rewind cancels it. A **Motive** asks for the demand, a deadline of **1 to 10** times of day (default **3**, `MOTIVE`), and the consequence; it is announced to everyone, ticks down on every time-of-day change (an Eclipse does not count), is announced once more when it comes due, and stays on the board at zero until you withdraw it or the chapter turns. A **New Rule** goes into the killing game rules list, which is shown on every character sheet; edit the wording, withdraw or add rules from **Killing game rules** in the panel.

### 6.3 Rulings, cards and the messenger

Every action that needs a human - Analyze hints, dynamic actions, Direct Murder declarations, project proposals, reshaped traces, trap alerts, the Calls above - arrives as a **card in the messenger** (`scripts/gm-bridge.mjs`, `scripts/messenger.mjs`). The messenger is one shared thread per player: the player and every GM read and write into the same conversation. A GM opens threads from the launcher bottom-right (a roster with unread badges) or by right-clicking a player in Foundry's Players list. A card shows the roll, the player's own words, and a GM-only block with the thresholds; the buttons are GM-only and re-checked on arrival, so a forged click achieves nothing. Once a button is pressed the card is rewritten into a receipt in the thread, so nobody rules twice; you can still answer in words below it. A ruling with no player owner (a Monokuma actor, a trap alert) goes to the GM whisper log instead, with the same buttons.

Two GMs are normal. One of them is the **primary GM** (the connected full Gamemaster with the lowest user id; an Assistant GM only when no full Gamemaster is connected), and that client is the one that writes world state: Despair awards, search tokens, discovery, incident results. An assistant's Despair adjustments are routed to the primary. If something "does nothing", check that a primary GM is connected.

**Rolls made while no GM was connected.** With no GM connected a player's action is refused before it is paid for; any other roll (a statistic from the sheet - since 1.2.69 thrown as a reaction, so it moves nothing even when granted -, a reaction, Daggerheart's own item rolls) is thrown in the player's browser, marked on its card "thrown with no GM connected", and moves no Hope, Sanity or Despair. When a GM connects, the primary GM gets one card, **Rolls made while no GM was connected**: each such roll's character, its Hope and Despair dice as the player's browser threw them, and what it would have moved (a reaction moves nothing). **Grant all** gives each of them what it would have moved - Hope, Daggerheart's Fear, the Monokuma's Despair - once; **Grant none** gives nothing. Either way each roll is marked decided and becomes the GM's message, so it is not asked again. The dice on the card are the player's browser's word, which is why it asks. Beside each roll the card also says what it claimed - its modifier and its advantage dice - and what your browser's list would have given it; that is for your reading only, and a grant moves what the dice moved. A message a player's browser wrote with a GM's flags is not on the card and is never granted (since 1.2.69; it is a `forged` row in `game.drpg.sheetWrites()`).

**What a player writes on their own sheet** (since 1.2.68). Hope, Health, Sanity, actions and statistics move through play - a roll, a Rest, an item, a Call, a Level Up - and the primary GM's browser checks every change a player's browser makes on their own student, its module items and the effects on either, against what the GMs hold. A change something covers stands: a payment your browser saw given back, a Rest in a room that allows it, an item used and spent, a Call's price, a Search's find within the tier its roll earned. What nothing covers goes one of three ways. **Put back** at once - a Hope gain (by the amount nothing covers, so Hope forged and spent at once still costs real Hope), a statistic, an experience, a maximum (a class's hit points among them), Daggerheart's roll rules, bonuses and Level Up choices, the module's own records, a Call armed by hand, a hindering Call or one a GM armed taken off with no roll of the player's about that student after it was armed (a roll a player's console posts first counts as one; it is in the chat for you to read), a module item's tier, category, roles or kind of usable changed, its wear lowered, its breakage mended or its count raised, a move into or out of a stash the room does not allow, an effect that changes any of these or a resource, on the student or on one of its items (an item added carrying one is deleted): the player is told the GM's client put it back, and the GMs get one whisper naming who, which student, and each field before and after. **Flagged** - a gain in Health, Sanity or actions, in the Burst and Sprint grants or the free Move given back, a module item taken off or added to the sheet: it stands, and the GMs get one card with **Undo** and **Keep**, the player is told nothing. Any GM may click; the primary GM's browser decides once. Undo writes a field back only while it still holds what the change left - a field that moved since is not written over, and the card says so - makes a deleted item again, or deletes an added one. A card can be decided for a day. **Listed** - anything else, for you to read in `game.drpg.sheetWrites()`. Your own changes are never judged: they are what the GMs hold from then on, which is how you set by hand a move the module does not know. Since 1.2.69 `game.drpg.sheetWrites()` also keeps the three traces of section 1's note - `refused`, `forged` and `rewrite` rows, with a `what` column saying what was refused, forged or put back - and a `times` column: the same `refused` or `forged` trace from the same player again within half a minute counts on its row instead of adding one. A Hope gain Daggerheart's relay credits for a player's own roll your browser did not draw stands on a `covered` row naming that roll's message.

**Sheet changes made while no GM was watching.** A change made while no GM is connected is judged when the primary GM's world loads: what would have been put back is put back at once, and every other difference - a gain in Hope, Health, Sanity or actions, a Rest, an item taken off or added - goes on one card, **Sheet changes made while no GM was watching**, a row per student and field with its value before and after, **Undo** and **Keep** on each and **Undo all** and **Accept all** for the lot. A Rest or an item used while no GM was connected is on that card too.

**The setting** *Players cannot edit Actions, Hope, Health, Sanity or statistics* governs all of this for the fields it names. On (the default), as above, and the pips on the character sheet and the Party sheet and the token HUD's bars are display-only for players (a table check, LIVE-E29-02, not yet run). Off, a player's changes to those fields are listed, not put back or flagged. Items, effects and the module's records are judged either way.

---

## 7. Despair pools, assignments and overflow

`scripts/despair.mjs`, `scripts/assignments.mjs`, `scripts/overflow.mjs`, `config.mjs OVERFLOW`.

**Earning.** When a student's roll lands with the Despair die higher, **+1 Despair** goes to the pool of *that student's* Monokuma (`Rolls grant Despair` setting, written by the primary GM). Reaction rolls - a bare statistic click - pay nothing; a Monokuma actor's own rolls pay nothing. A student assigned to "- nobody -" feeds nobody (useful for a retired or NPC-run character, or a template). Not for the Mastermind: the division is a world setting every player's browser can read, and the one student left out would stand out.

**Pools.** Every full Gamemaster account holds a Despair pool, capped at **12** (`STARTING.despairMax`), and the Monokuma characters spend from them. The Despair widget at the top of the screen shows every pool under its name, a single one included (the name set in Despair Flow, otherwise the account name): everyone sees the counts, GMs also get the steppers. **Despair Flow** (Between sessions) is the one window for the team: which actors are Monokumas, which GM's pool each draws on, pool names, extra pool holders (an Assistant GM can be granted a pool), which Monokuma watches which student (with **Split evenly** and "- nobody -"), and the overflow's tuning. The guide's shape is at least two GMs dividing the students strictly between them, but the module works with one.

**Converting Despair into Hope** (1:1) is a GM ruling from the Students window or the Mastermind window, never a self-service button: it is how a Monocub is fuelled and how a Mastermind stays afloat. The Hope arrives at once; the donor pool's drop waits until the next time of day, when every pool may have moved for a dozen other reasons, and the card about it is private - so the table cannot pair the two (the recipient's Hope is actor data every browser holds, section 1). Until the time of day changes the pool shows more than it can spend: every Call, conversion and picker counts only what it can spend, and the pickers show what it owes ("Kuma (5, 2 owed)": 5 it can spend, 2 it owes). Despair that will not fit in a full pool pays what it owes before it spills into the overflow, and filling or emptying the pools clears what they owe. Each conversion is owed on its own, so two GMs converting from one pool at once both count, and a pool pays once - also when one GM's browser was away as it paid. A conversion made on another GM's screen in the very moment the time of day changes can go unpaid.

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

**A trial verdict empties the overflow** on both outcomes; the season reset does too. Players see the pools' counts and the overflow's threshold, but a "?" in place of its count ("?/20") - when the hat fires stays Monokuma's to know. Since 1.2.64 the count itself is kept by the GMs (section 14), so a console reads no more of it than the screen shows; Despair Flow shows it to you.

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

**Monocub** (`scripts/monocub.mjs`, `MONOCUB`). A dead student's player may join the GMs once their own Class Trial is over - the timing is yours, the module only insists they are dead. Invite them from **Students**. They keep the same sheet and get exactly two things: **Move**, and **Confusion** (**1 action + 1 Hope**), a flat 2d12 roll with no statistic that nudges a living student in the same room. Since 1.2.69 a Monocub's abilities are one table, `MONOCUB.abilities` in config.mjs, Confusion its one row (key `meddle`), with one executor (`game.drpg.performCubAbility`), one picker and one bridge action (`monocub.ability`): your browser throws the 2d12, checks the target once more and scores it, and a refusal is told to the Monocub and refunds nothing. A second ability is one row and one resolver (read in the code). The target's card never says who did it, but the room saw the Monocub roll, and the Confusion window tells the player so:

| Confusion | Grants | Inflicts |
|---|---|---|
| 12 | +1 on the target's next roll | -1 on the target's next roll |
| 16 | advantage | disadvantage |
| Critical | gives the target the action back | wastes the action |

A Monocub's Hope comes only from a GM converting Despair (Fuel a Monocub, or the Students window). The **Silenced** checkbox is the guide's rule for a Monocub who stumbled onto a crime scene: they may act but not talk about the crime until the chapter ends; the player is told when it is set and lifted. A Monocub's dice are shown to everyone in their room, Confusion's included. Whom a Confusion was aimed at is not: since 1.2.65 the Call it arms waits in the GMs' browsers and its target's player's alone, and only a critical, which moves the target's actions, shows in data every browser holds.

**The Mastermind** (`scripts/mastermind.mjs`). Chosen before the season with the player's consent, from **Between sessions > The Mastermind**. The identity never touches an actor or the world: it lives on GM browsers only and is synced GM to GM; the Mastermind's own player receives only a private "you are it" and the room of their lair.

> [!CAUTION]
> The window names the Mastermind, so do not share your screen while it is open.

Their **lair** is a room: <ins>while standing in it</ins> they see every token on the map, as you do; step out and it is gone. Locked doors, seals, other people's bedrooms and hidden stashes are open to them everywhere, and every room counts as already visited for their fog - they built the building. Despair converts to their Hope **1:1** from the same window, once a Mastermind has been picked and applied. The endgame runs on the ordinary trial:

| Piece | Where | Notes |
|---|---|---|
| One **Final Truth Remnant** per chapter | placed from the Investigation dashboard's **Final Truth Remnants** tab | reinforced by type, so nobody can remove it - the chapter-end screen reminds you if none was placed |
| The **Final Trial** flag | toggled from the trial console | announced to the table |
| A final verdict | given from the Mastermind window's or the trial console's **Final Trial verdict** | correct, the Mastermind is executed and the killing game ends; wrong, or the Mastermind already dead, nobody new dies and the table is shown the truth |

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

`scripts/fog.mjs`, `fog-geometry.mjs`, `fog-doorways.mjs`, `fog-reveal.mjs`, `fog-diagnostics.mjs`, the *Rooms decide what players can see* setting. One layer over the whole scene, three states: the room you stand in is clear; a room you have visited shows through a veil; everything else, including any patch of map outside every region, is full fog. During an Eclipse even the room you stand in is only veiled. Discovery is **per character**, written by the primary GM when a token crosses into a room for the first time (with a sound for the student who walked in), and survives sessions; the full record stays in the GMs' browsers (section 14), and each player's browser holds only its own characters' rows. A GM sees a lighter fog: every room the class has discovered is clear, and rooms nobody has found yet, with any space outside every room, sit under the veil. The Mastermind sees every room as visited.

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

`scripts/voice.mjs`, the *Regional voice* setting plus LiveKit AVClient. Every mapped room becomes its own LiveKit breakout room; a player hears whoever is in the room with them, and their voice client follows their token. A Monokuma follows its own token, using the GM that its pool is mapped to. During an Eclipse everybody is in their own channel, and the GMs share one. The dead, unless they come back as a Monocub, go back to the main room - a victim whose death the GMs keep (section 13.4) at the kill, not at the discovery, which has been read in the code and not yet heard at a table. **Nobody can listen in through this module:** it sends a voice client only to the room its token stands in, and LiveKit shows every listener's tile to the room, so a GM who wants to hear a room walks their Monokuma into it. **Reset all voice rooms** (Between sessions) sends everybody back to the main room. `game.drpg.voicePlan()` prints where everybody *would* be sent, with no microphone and nobody else connected, so most of a voice test is one person's minute; `game.drpg.diagnoseVoice()` says which of the five links is the broken one; run it on the client that is complaining.

> [!WARNING]
> A proximity-voice module installed alongside can silence a table while every check reports success - the diagnosis names it.

**The voice server's secret.** What this module cannot vouch for is LiveKit AVClient's own setting. Set to a self-hosted server, that module keeps the server's API key and secret in a world setting, which reaches every player's browser like any other (section 1), and anyone holding them can connect to any voice room. This module cannot move another module's setting; it tells you instead - a row of the season checklist (section 2), shown only when it is so, and a line of `game.drpg.diagnoseVoice()`. A server that issues its own access tokens, such as the Tavern, keeps the secret off every browser. What the warning reads - the server types avclient-livekit 0.6.8 offers, and a filled-in secret with any type but the Tavern - comes from that module's source, not from a table.

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

**Stash** (`scripts/vault.mjs`). Everything a character does not carry lives in a stash: the bedroom's by default, or any room where Room Setup gives them one. A stash holds **3** things (`VAULT_LIMIT`). Stowing and retrieving cost nothing but you have to be standing there; Truth Bullets cannot be stowed. An **open** stash is a drawer: anybody standing in the room can go through it for free and take one thing, and the owner is not told. A successful Search in a room where somebody else keeps a stocked stash takes from that stash instead of the room's table (open stashes first; a hidden one is a disadvantage die, as it was before 1.2.65, added once the dice have fallen - one of an advantage's dice set aside, or one more penalty die - and the searcher's card says what it did; the roll window does not show it, or opening a Search and closing it would say a hidden stash is there), and only a Search that does it with Despair leaves the drawer disturbed enough for the owner to notice - never by whom. A **hidden** stash (the owner built a hiding place - a project, at your discretion; you make it hidden by cycling its cell in Room Setup) must first be found with Analyze > Locate a hidden stash (Head, **16**), which opens that one stash to that one person until you remove it. The Mastermind sees every stash. `game.drpg.inspectVaults()` shows you every stash's contents.

**Palm** (section 5) is theft from a person and planting on a person; both are resolved on a GM client against `ACTIONS.palm`, and a clumsy thief is heard by the victim.

**Taking from a body** (`scripts/handover.mjs`). A dead student's Truth Bullets are gone; everything else they carry stays on the sheet, and another student who opens it can press **Take** on an item. The item moves to the taker, who also gets a Neutral Truth Bullet naming what they took and off whom, and the body gets one Subtle Remnant, tied to the crime, whose note lists everything taken from it. Its trace card names the action "Taken from a body", and the token wears the Palm hand - to a GM always, to a player once their own copy is identified and, for the trace of a body nobody has found, once that death is the table's (a copy found before says nothing of what left it until then). Which trace is the body's, and what has left it, is the GMs' record (section 14). A body nobody has found yet (section 13.4) may be searched only by those who know of the death - the GMs, the incident's players, the victim's own player and a student who found it alone; its Truth Bullets are still on it then, and cannot be taken. The item moving from one sheet to another is world data every browser holds, before the discovery as after. The taker's Truth Bullet names whose body it was, so off a body nobody has found it waits: your record of the death keeps it, and the death's publication (section 13.4) gives it, dated when and where the item was taken.

---

## 11. Projects and traps

`scripts/projects.mjs`, `projects-secrecy.mjs`, `projects-ui.mjs`, `projects-tray.mjs`, `traps.mjs`, `config.mjs PROJECT_SCALE`, `TRAP_TRIGGERS`, `TRAP_MODIFIERS`, `INDIRECT_MURDER`.

Projects are Daggerheart Countdowns that count *up*. Scales:

| Scale | Progress |
|---|---|
| Trivial | **3** |
| Standard | **4** |
| Complex | **6** |
| Desperate | **8** |

Each project has a name, a picture or a tray glyph, a scale, a room (or any room), a required statistic (every roll on it takes that one, a Sabotage's included; a project made before 1.2.66 without one asks you on its first roll and keeps your pick), a visibility (secret projects are seen by the proposer and the GMs; share them with accomplices - a builder cannot be taken off their own project), and the indirect-murder flag. **Projects** (the panel tile) is the manager: create, edit, share, add or remove progress, delete. A project with a room also stands on the map as a two-square token with a hammer and no name on it, which you can drag; a player sees it once they have stood in its room, or, for a secret project, once they are let in on it. Double-clicking it opens its card. Observe's *Look past the obvious* can uncover a secret project in the searcher's room (DC 18), which lets them in on it.

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

Two modifiers: **Only after dark** (Evening, Night, or any Eclipse) and **Not the one who built it** (on by default). The trap arms when its bar fills. When the condition matches, an alert goes to the GMs only - it names the trigger, the person, the room and the time of day, and carries the killer's typed condition - with **Fire** (opens the murder screen with the killer filled in and *indirect* ticked; you pick the victim) and **Not this one, keep watching**. Nothing reaches the killer's thread, and the one line of the alert every browser's copy of the card carries, its title, says only "A ruling to make".

> [!IMPORTANT]
> A trap that has spoken disarms itself until you re-arm it, so a trap in the Main Hall does not fire twenty cards a session.

The planted-item trigger works through **Plant an item** on the finished project: which object is the trap and which room it waits in; it arrives as whatever the next successful Search there was looking for (one not diverted into somebody's stash), and the poisoned identity lives in your browser's ledger, never on the item.

**What stays in Daggerheart's Countdowns.** A project is a Daggerheart Countdown, and the Countdowns are a world setting every browser holds: each project's name, its progress, and the ownership that says who may see it. A secret project is hidden from the screens of those not in on it, not from their consoles; this version does not move the Countdowns. The module's own record of each project, also world data, says its room, whether it is secret, whether it is an indirect murder, its statistic and glyph, its token on the map, and whether it is sabotaged and being repaired. Since 1.2.64 the rest is the GMs' (section 14): who builds a trap, the condition typed for it, its trigger and its modifiers, whether it is armed and when it last fired, and who sabotaged a project. A GM browser that does not hold a trap's row cannot arm or fire it, and the case health check says how many (section 14).

---

## 12. The Eclipse

`scripts/eclipse.mjs`, `ECLIPSE_MOVES`, `ECLIPSE_FREE_PLACEMENT`. The Eclipse is the placement window between two times of day: the lights go out, nobody sees anyone, everybody moves their token to where the next time of day finds them. It is named after the time of day it *opens* - the Night Eclipse runs before Night.

**Starting it** (the HUD's right chevron, or **Do it** on the GM panel's Next line): the overflow is checked for the coming time of day; **actions, free Moves and Sprint/Burst grants are refilled here** - this is the one refill; seals, Chained and Silence end here too, because they last only until the end of the time of day; the card announces the number of crossings; each player is whispered their allowance and their room; and each client gets a notice summing up what that player did in the time of day just ended (a GM gets the whole table's; nothing happened, no notice). Ordinary Eclipses allow **2 crossings between connected rooms**; the **Night** Eclipse lets everybody pick any room on the map (a Darkness draw pulls that back to 2). During an Eclipse: movement is the only thing that works; a **Direct Murder** may be declared (it spends an action from the new budget and is parked); Calls, handovers, other actions, the murder tile and body discovery are all refused; music switches to the Eclipse playlist; every player is in their own voice channel.

**Ending it**: **Do it** on the panel's Next line shows the placement table (who moved how many times, where they stand) with **End and move the clock** (the normal path: advances the clock, no second refill) and **End without advancing**; the HUD's play button ends it and advances at once. Then the parked Direct Murders are judged against where everybody actually ended up: <ins>exactly one other character in the killer's room</ins> makes that person the victim, anything else fails and the killer is told why, and only the first valid declaration opens an incident. A second killer whose declaration also held is told only your ordinary refusal ("The GM did not allow it. The action is spent."), and you are told who it was.

> [!IMPORTANT]
> Nothing opens without you: each declaration posts an **Allow it** / **Refuse** card in your chat log as it is made - whispered to the GMs, its title only "A ruling to make", since a card in the killer's thread would tell every browser who had declared something - and one you have not ruled on is asked at the lights (closing that window refuses it); a refusal reaches the killer privately at once, an allowance is not told, and the killer hears the answer when the lights come up. `game.drpg.ruleOnParkedMurder(killerId, true)` is the console shortcut if the card is lost.

**What the dark keeps** (since 1.2.64). The declarations are the GMs' (section 14), from the moment one is made to the lights: a declaration outside a running Eclipse is refused. What a console can still read is that the killer's action was spent, since an action budget is actor data (section 1). The crossings are counted by the GMs too: the primary GM's browser judges each against the allowance and posts its card, privately, to the mover alone - naming the room crossed into when that is a room of a scene the character has a token on, else the room the token stands in - and each player's browser holds only its own characters' count. Where every token ends up is still world data (section 1): the dark is the screens', not Foundry's.

---

## 13. The murder engine, end to end

`scripts/murder.mjs`, `incident-store.mjs`, `murder-rules.mjs`, `murder-ui.mjs`, `cleanup.mjs`, `chapter.mjs`; `config.mjs MURDER_OPENING`, `INCIDENT`, `CRISIS_ACTIONS`, `CLEANUP`, `INDIRECT_MURDER`. The module owns the numbers - thresholds, the drain, turn order, damage, which Remnants each outcome leaves. It does not own the prose: every outcome's sentence is shown to you and the participants to finish at the table. Whether the killer is in the right room and whether a stage has gone on long enough are yours.

### 13.1 Opening

Two roads. A player declares a **Direct Murder** during an Eclipse (consent from the victim's player is a table agreement, not a checkbox); it is parked and judged at the lights. Or you open it yourself from **The case > Murder**: killer, victim, and the *indirect* checkbox, which ticks itself when that killer has a finished trap; fired from a trap's card, the window opens on the student the trap read. It says so when the named killer is not among the living, and when a direct murder's two stand in different rooms (open it anyway if the story already has). One incident at a time. One name in both fields opens a death by their own hand: Stage 4 still rolls, Stage 5 cannot run, and the incident goes straight to Stage 6; the death is recorded when you close the incident.

**Stage 4, the opening roll.** A direct murder opens on the **killer's** roll: Body or Hand against **8**, with advantage at Night. Which of the two is yours to pick (section 5): in the murder window when you open it yourself (*Opening roll's statistic*), otherwise in a window on your screen as the roll goes out. While you pick, the killer alone is told privately that you are choosing, and to say in their thread how they go about it; the invitation then carries your pick, locked, and goes away when the opening resolves. What the roll came to - its total against the threshold and its band - is carded to you and to the roller's side (the killers; for a trap, its victim); the Key Remnants it leaves and the table's text are told to you alone. A failed opening is also said on screen, to the GM whose browser scored it.

| Killer's roll | What happens | Key Remnants the case will hold |
|---|---|---|
| Hope | the incident begins | **5** |
| Despair | it begins; the victim loses all Sanity and Role reversal for this incident | **4** |
| Critical | it begins, leaving the fewest Key Remnants | **3** |
| Failure | no incident; the victim never learns anything was attempted; the action is spent | - |

The count is floored at **3** (`KEY_REMNANTS.minimum`). A trap opens on the **victim's** roll: Eye or Head against **20**, with disadvantage at Night, and you pick between the two the same way; the victim is told only that a roll is being set up for them.

| Victim's roll | What happens |
|---|---|
| Hope | something is wrong - they may spend their Free Move, if they still have it, to get out, and if they do they live (the module grants no extra Move) |
| Despair | they work out what was set up and may tell the others; the project stays active |
| Critical | they spot the trap and whose hands built it |
| Failure | the trap closes |

Every success leaves an Evident Incident Remnant, and a noticed trap leaves the incident sitting at its opening until you close it from the tracker. A trap always leaves the case its full 5 Key Remnants. The victim is told the incident began only when it actually begins. In a direct murder their browser holds nothing of it while the killer rolls - no cast, no card, no murder music, nothing on the Event panel; a success gives them all of it at once, with a whisper naming the killer (it is fought face to face), and a failure leaves them nothing.

### 13.2 The incident (Stage 5)

Turn-based, the victim first; a round is the victim, then each killer in turn. A killer who is dead to you takes no turn; when none is left alive you are told, and offered the close. **In a trap only the victim acts**: the builder is elsewhere, so each of the victim's turns hands the turn back to them, and the round, the drain and the hindrances move on with it. Each time the turn comes back to the victim (their first turn is free) it costs them **1** Sanity (direct) or **2** (indirect, they are alone with a trap), then Health once Sanity is gone; a critical Self-defence stops the drain. A trap's victim has advantage on every crisis roll, and their Leave a clue and Secure a trace list Body instead of Shadow and leave Reinforced Remnants on Hope as well as on a critical (two of them on a critical). The participants roll in front of each other - the primary GM's browser shows each of them the others' dice, and the crisis card says what each roll came to and which action it was, with or without Dice So Nice. Nobody else sees: a trap's builder sees none of its dice and none of its cards, the card of the action that ends it included. Crisis actions (`CRISIS_ACTIONS`), with the statistic and threshold (where a row lists several statistics, you pick one from what the player says their character does, as in section 5 - unless they armed *Resolve*, which lets them pick):

| Side | Action | Roll | What it does |
|---|---|---|---|
| victim, killer | Use an item | Hand 15 | Get something out of a pocket. Works on a critical or a success with Hope; with Despair, a trace and nothing else; a failure with Despair costs 1 extra. Not a third party's |
| victim | Leave a clue | Hand/Leg/Shadow 12 | A Remnant meant to help the others (Evident / Subtle / Obvious). A failure with Hope gives advantage on the next attempt at this action |
| victim | Secure a trace | Hand/Leg/Shadow 15 | Take something off the killer and turn it into a trace tied to their identity (same visibilities) |
| victim | Self-defence | Hand/Leg/Body 18 | Fight. Hope opens Survive and Role reversal; Despair opens Role reversal only; critical stops the drain, opens both, and one may be taken this turn without rolling. A weapon gives advantage. Role reversal opens only where it is available; a Self-defence that would open nothing else (Despair, with Role reversal not available) is not spent and may be tried again |
| victim | Survive | Leg 18 | Ends the incident and the drain. Despair adds a hint about who they were; critical adds immunity for this chapter and the next. Needs Self-defence first |
| victim | Role reversal | Hand/Leg/Body 15 | Become the killer. Hope or a critical also restores all Health and Sanity; critical kills the attacker outright. Needs Self-defence first. Not available against a trap, or once somebody has joined the killer (Partners in crime, Double role reversal) |
| killer | Strike | Hand/Leg/Body 15 | 1 Health and 1 Sanity off the victim; critical: 2 of the killer's choice. A Despair failure still takes 1 Sanity and leaves an Evident trace |
| killer | Pin them down | Body 12 | Disadvantage on Leave a clue and Survive for the victim's next two turns |
| killer | Keep your distance | Leg 12 | Disadvantage on Secure a trace and Role reversal for the victim's next two turns |
| killer | Attack with a weapon | Body/Hand/Leg 15 | Damage 1 + half the weapon's tier rounded up (critical: 1 + tier). Unarmed rolls at disadvantage and a success improvises a weapon (Tier 2 on Hope or critical, 1 on Despair). A Tier 0 object's damage is yours to set, 0 to 2 |
| killer | Finishing blow | Body/Leg/Hand | Threshold is **5 times the victim's remaining Health** - free at 0. Ends the incident; Despair leaves an Incident Remnant; critical: the striker's first clean-up attempt in Stage 6 costs no Sanity, hit or miss |
| third | Escape together | Leg 15 | Both get out; Hope or critical restores the victim; critical adds immunity for this chapter and the next; failure: only the third party leaves, and does not walk back in |
| third | Double role reversal | no roll | The victim and the third party become the killers; the original killer starts bleeding. Heals nobody |
| third | Partners in crime | no roll | The third party joins the killer |
| third | Averted eyes | no roll | Walk away, no trace of you, and do not walk back in |

**Walking in on it.** In a direct murder, a character whose token crosses into the room gets one free choice among the third-party resolutions, automatically. **A fourth person cancels the incident** where it stands: nobody dies, no Blackened, what already happened stays happened, and the newcomer is told nothing. A third who walked away - Averted eyes, or a failed Escape together - stays out: their token crossing in again takes no seat. A victim who runs out of both Health and Sanity dies without a Finishing blow, and then nobody earns what a critical there grants. Resolution actions (Survive, Role reversal, Escape together, Finishing blow) cost **1 Sanity** rather than an action, or **1 Health** when there is no Sanity left; the third party's three no-roll choices are free. Nothing here kills by itself except the engine's own endings.

> [!IMPORTANT]
> Some outcomes on the table above are prose for you to deliver rather than effects the engine applies: restoring the victim after Escape together, immunity for this chapter and the next, Survive's hint, and the attacker's death on a critical Role reversal (the engine swaps the sides, restores the new killer and leaves the Evident Reinforced trace; the death is yours to record). The swap restores the new killer only on Hope or a critical; nobody else's Health or Sanity comes back with it.

The **incident tracker** (the Murder tile while one runs) updates live and shows who is attacking whom (and any third party), the stage, the turn, whose side acts, what the victim has left and the Key Remnant count; while the opening waits, whose roll it waits for and to whom the invitation went; during the fight, the last three turns - who, which action, how it came out; in Stage 6 it adds a read-only list of the traces in the killer's room with each one's erase DC. Its buttons: **Ask for the opening roll again** (while the opening waits, at most once every 10 seconds), **Pass the turn**, and **Close the murder**. There is no manual "somebody walks in": a token crossing into the room is the only road. Stage 6 begins by itself - after a Finishing blow, a victim run out of Health and Sanity, a successful Survive or Escape together, or straight after a death by their own hand - or when you mark the victim dead with **A character dies** and accept the prompt that follows. A player's Reroll on a crisis action is judged against the record the tracker keeps; one of an action that killed somebody is refused, and the death stands.

On the sheet the fight is one tile: **Fight back** on the victim's side, **Crisis actions** on the others, marked free and with no GM chip; off-turn it is dimmed and says whose turn it is. Its menu lists the side's actions; picking one unfolds what it costs, which statistics it rolls and who picks, and what a miss does, and **Roll it** goes on to your pick of the statistic, where it lists several, and the roll window; a take that needs no roll says **Do it** instead.

### 13.3 Cleaning up (Stage 6) and Tamper

When the incident ends with a body, the killer can finally see the Remnants they left, on their sheet, and work on them. In their own Stage 6 it costs **no action and 1 Sanity each** (`RESOLUTION_STRESS_COST`) - the first attempt after their critical Finishing blow costs nothing, hit or miss - and every trace in the room they stand in is theirs to work on, found or not. Via the **Tamper** tile in ordinary play (`PRICE_CHAINS.tamper`) it costs an action, or 1 Sanity once the actions are gone - never both - and reaches only the traces listed under Tamper in section 5. In Stage 6, erasing, reshaping and planting a trail list Shadow, Hand and Head, and you pick one from what the killer says they do (section 5; with *Resolve* armed, they pick); through Tamper in ordinary play the same work rolls Shadow, and nobody is asked. A readied Cleaning Tool gives advantage and takes its tier off the DC.

| Trace visibility | DC to erase |
|---|---|
| Hidden | 9 |
| Subtle | 12 |
| Evident | 15 |
| Obvious | 18 |

**The scene is still warm:** **-3** on every DC until the body is found or the Investigation starts (`CLEANUP.freshScene`). Outcomes:

| Erasing | The trace |
|---|---|
| Critical | gone and 1 refunded (the Sanity or the action that paid), and the roller is offered to reshape the trace instead, choosing how loud it reads; a reshape you decline leaves it gone |
| Hope | gone |
| Despair | gone, but an Evident Faint Tamper Remnant is left |
| Failure with Hope | still there, plus a Subtle Faint Tamper Remnant |
| Failure with Despair | still there, plus an Evident one |

Reinforced traces never come off.

**Reshape a trace** is also an attempt of its own, 3 easier than erasing: the roller writes a new name (up to 60 characters) and description (up to 400), the trace always becomes a Tamper Remnant, and the rewrite reaches you as a card to approve or decline - nothing is written until you approve; a critical also makes it one band quieter and gives back what paid (the Sanity, or the action). The card says how many copies of the trace are already held: those keep the words they were found with, and whoever finds the trace afterwards reads the reshape. One ruling per reshape - a second GM's, or a second click of yours, is refused and told who ruled, and an assistant GM's ruling is made on the primary GM's browser and recorded as theirs - and a reshape that carries only one of its two fields is refused. An attempt the GMs' browser refuses - a reinforced trace, one the player has not found, or a Stage 6 already over - gives back what it cost and tells the player why.

Two more Stage 6 actions: **Misleading trail** (**15**) plants a Prep Remnant pointing at another living student (Evident / Subtle / Obvious; a Hope failure leaves a Hidden Faint one, a Despair failure nothing); **Move the body** (Body, **16**, 1 lower per tier of a readied Cleaning Tool) carries it into a connected room the killer picks before the roll, never a bedroom; a success always leaves an Evident Tamper trace, a failure leaves the body where it was.

With anybody but a fellow killer in the room, erasing, reshaping and planting a trail first roll Shadow against **16** to cover what they are doing (moving the body does not):

| Covering (Shadow, 16) | Costs |
|---|---|
| Success | free |
| Success with Despair | 1 Sanity |
| Failure with Hope | 1 Sanity |
| Failure with Despair | 2 Sanity |

A failure lets the others see roughly what they are up to.

**What breaks.** Only an incident that reached Stage 6 breaks anything. When it closes, every Murder Weapon a killer swung in the fight is marked Broken - each killer's, an accomplice's too; a Finishing blow swings nothing, so a weapon only held while it landed stays whole, and a failed opening, a trap or an early close breaks none. When the body is found, every Cleaning Tool a killer wore for a clean-up attempt is marked Broken, readied or put away since, as long as it is still carried and not stashed (the module keeps a ledger of them on the GMs' browsers until then); a killer who never cleaned up loses the Cleaning Tool in their hand at that moment instead. Only the killers of the bodies found: a betrayer's Cleaning Tool stays whole while nobody has found their victim. Both stay in the bag as evidence the killer has to throw away or stash. The owner is told only of an item that actually broke.

**The betrayal window.** Once the incident has left a body, its third party may turn on the killer: an accomplice - a third who sided with the killer - or, in a direct murder, a third who walked in and stayed without choosing anything. Never a third who left (Averted eyes) or tried Escape together, and never, in a trap, a third on the victim's side. The offer lasts until the end of that day, the Investigation included, survives the incident closing, is single-use, and cannot be taken while another fight is running or during a Class Trial. Taken in an Eclipse, it is declared like any action there: it costs an action and opens when the Eclipse ends - after the Night's Eclipse, on the next morning - and a second declaration in the same Eclipse is refused. A betrayal that cannot open when its time comes is refused with the reason, and the offer goes back while its day holds. It opens a second incident with the body still on the floor. Your own after-incident screen (13.4) carries the button too, except during a Class Trial. Of the players, only the one it is offered to holds the offer in their browser.

### 13.4 After the incident, and body discovery

Closing the murder tells each of its players that it is over, in a card that names nobody - a living victim, that they can act again; a direct murder's victim during the opening roll, and a trap's builder before Stage 6, are told nothing. Only an incident that left a body records the **Blackened** (every killer of the chapter, including a betrayer); one that reached Stage 6 breaks the weapons swung (13.3). With a body it opens the after-incident screen, "The incident is over - what now": **A body is discovered** (announce it), **Move to Investigation**, **Issue Autopsy Truth Bullet**, the betrayal if one is on offer. It also reminds you how many Key Remnants still need placing, and to issue the autopsy. Without a body nobody is Blackened: after Escape together you get the escape's own screen, after another survival a short one saying so with a button to the Remnants, and an incident closed before Stage 6 says it was interrupted and nobody died.

**Body discovery** happens by itself when two or more students stand in the room with this chapter's body, at least one of them <ins>unconnected to the killing</ins> - neither a recorded Blackened nor a killer of the running incident still cleaning up in Stage 6 (killers over their own victim are a frame-up, not a discovery; Monokumas and this chapter's dead are not witnesses, a Monocub is), never during an Eclipse - or from the **A body is discovered** button. It first asks you which Faint Prep traces belong to this murder (they become permanent evidence), marks the Cleaning Tools the killers' clean-up attempts wore Broken (13.3), gathers everyone to the room, announces the body to the table with its sound, pauses the music, and then **holds**.

> [!IMPORTANT]
> The phase stays Daily Life until you start the Investigation from the Next line or the after-incident screen. A time-of-day change ends only the silence.

**A death kept until the body is found** (since 1.2.64). When the running incident's victim dies - a Finishing blow, a victim run out of Health and Sanity, a death by their own hand at the close, or **A character dies** with *Keep it the GMs' until the body is found* ticked, as it is for that victim - the death is recorded in the GMs' store and nothing reaches the table: no deceased flag, no dead marker, and the Truth Bullets stay on the sheet. The death card goes, privately, to the GMs and the incident's players, and its sound to them alone. Who knows of it: the GMs, the incident's players (a trap's killer included), the victim's own player, and later a lone finder; each of their browsers holds the deaths it may know of, and no other. Any other death - an execution, a ruling, the dialog with the box unticked - is the table's at once, as before.

Two things make it known, and only two: the body's discovery, whose first step publishes every kept death of a body in that room - on the scene where the students walked in on the body, whichever scene you are looking at, or, when you announce it from the form, on the scene you are looking at - and your hand - the student set to *dead* in the Students window, where they show as **Dead, not found** (section 3). Then the Truth Bullets go (unless kept), the flag is written with the kill's chapter, day and time of day rather than the discovery's, the marker appears, and whoever took something off the body meanwhile is given its Truth Bullet (section 10). Nothing else publishes it: the Class Trial's start only tells you, in a notice that stays on screen, how many deaths nobody has found; the chapter's end says nothing of them. Until you publish one, the table and the trial treat that student as living: their player is sent a ballot, their name stands on it with no dead mark, and a correct verdict's Level Up is theirs too. Closing the murder still records the killer in the Blackened register, but the trial counts a killer only for a death the table knows: the ballot asks for no name for a death nobody has found, and a verdict neither executes nor rewards its killer for it (measured by the suite's tier 2 in the headless harness, not yet tried at a table). The same holds for a death you take back: a victim you revive leaves their killer uncounted. Publish it before you open the vote if the trial is to ask for its killer. A kept death from an earlier chapter is never found by itself, since discovery looks only for this chapter's bodies: publish it by hand. A *dead* status you toggle on a token by hand is neither: the module reads its own record and never the token's status icon, so to the module that student is still alive - a trap they set still watches, and they count among the living everywhere. Record a death from the Students window (section 3).

Before the discovery, the victim's own sheet shows the dead panel with "Nobody has found your body yet."; what their player tries is refused as it is for the dead. A refusal that only an undiscovered body explains - handing an item to them, arming a Call on them - is told to whoever asked as "That cannot be done now", and the reason goes to your Debug log. A Call is refused so only after every check a Call on a living student faces, the buyer's Hope among them. An assembly leaves the body where it lies. What the table can still read is actor data (section 1): the victim's Health at 0.

**The lone finder.** One student unconnected to that killing - a killer of the chapter's other incident included - who stands alone in a room with a body nobody has found is told privately, with no chat card: "In {room} you find the body of {name}. Nobody else has seen it yet, and nothing is announced." From then on they know of that death: their screen alone draws the body's dead marker, and they may take from the body (section 10). What Tamper allows anybody, it allows them; moving the body stays the killer's. Nobody else is told, and one witness is not a discovery: the rule of two stays. The finder's marker is drawn by the module on that one screen; the headless harness has no canvas, so it has not been seen at a table yet.

---

## 14. Investigation

`scripts/remnants.mjs`, `investigation.mjs`, `truth-bullets.mjs`, `observe.mjs`, `analyze.mjs`; `config.mjs REMNANT_TYPES`, `KEY_REMNANTS`, `OBSERVE_DC`, `ANALYZE_DC`.

**Remnants** are hidden tokens on the map - all but a running incident's own, which are made un-hidden so that its players' screens can draw them for them alone (hiding one by hand while the incident runs takes it off their screens too; when the incident closes, the module hides those nobody has copied) - dropped where a character stood when an action left one, carrying type, visibility (Obvious, Evident, Subtle, Hidden), who left it, the room, the chapter, day and time of day, whether it is reinforced (cannot be cleaned) and whether it is tied to the crime. Types:

| Type | What it is |
|---|---|
| **Key** | yours, unremovable, becomes a Truth Bullet unanalysed |
| **Neutral** | undetermined; Analyze turns it into a real category |
| **Faint** | doubtful; also a mark a Prep trace can carry (a Search's tool, a Sabotage, a misleading trail); cleared at chapter end unless tied to the murder, while a Truth Bullet with it survives the sweep |
| **Prep** | - |
| **Incident** | - |
| **Tamper** | left by cleaning |
| **Autopsy** | handed out, never found by Observe |
| **Final Truth** | one per chapter, points at the Mastermind, reinforced |

Truth Bullet types mirror them. Every Remnant is a token with one neutral name and a "?" picture, found or not: since 1.2.64 the name and picture you give it are never written on the token, which every browser holds. The screens that may know more draw it on their own copy of the map - yours from the case, a finder's from their own Truth Bullet, its name and picture (drawn by the module on each screen; the headless harness has no canvas, so not yet seen at a table). A GM sees the icon of the action that left it (Search, project, sabotage, dynamic action, clean-up, incident, thrown away, placed by the GM, taken from a body), a player only once their own copy is identified - and the icon of a trace left by taking from a body nobody has found only once that death is known to the table - and double-clicking a Remnant opens its trace card. An incident's traces are shown to its players as they are made; when the incident closes, those nobody has copied are hidden again, so the players of a later incident are not shown an old crime scene. A world updated to 1.2.64 does the same once, at its first load, for the incidents closed before it; an incident still running then keeps its own.

**Tied to the crime** has three states, as the Traces tab shows them: undecided (-), Tied and Not tied. When the chapter's victim dies - by another's hand or their own - every undecided trace of the chapter is tied, and one you marked Not tied stays so; a weapon swung in the fight ties the traces that handed it over. The players' identified copies learn a tie when the death is made known (the discovery, the Students window, a public kill), or at the fight's close for a fight that left no death. A Sabotage of an indirect murder leaves a tied trace when the trap's killer or proposer made it and an untied one when a bystander did; a misleading trail an innocent plants is not tied. Until 1.2.71 Not tied and undecided were one value, so a world updated to it reads each old Not tied once as undecided - a pre-1.2.63 token's too, and one a Reroll of an older clean-up gives back: mark your red herrings again.

**The Investigation dashboard** (The case > Investigation) is the GM's case file, live:

| Tab | What it does |
|---|---|
| **Traces** | lists every Remnant with filters (by player, room and chapter), lets you edit its name, player text and analysis text, correct its type (to a kind Observe can find, or keep its own), and mark it Faint, tied to the crime or reinforced |
| **Key Remnants** | the planner |
| **Final Truth Remnants** | places Final Truth Remnants |
| **Who has what** | shows every student's Truth Bullets, how many are not analysed yet and what they really are |

The footer carries **New trace** (a trace of any kind, in any room), **Clear Faint Remnants**, **Sweep Truth Bullets**, the autopsy, the trial evidence log and the body.

**Save** writes only the fields you changed. A field that changed elsewhere while your window was open - another GM's Save, a reshape ruled meanwhile - is marked, is not saved and is named to you; the window shows what it holds now, and the rest of what you changed is saved. A kind changed here pulls what depends on it: a trace made a Faint Remnant is Faint on its players' copies too, a planned Key Remnant given another kind is said to be no longer a Key Remnant, and a trace nobody has copied that is retyped to or from Incident is drawn for the incident's players as if it had been placed so.

**Key Remnants** (`KEY_REMNANTS`). You prepare **5** clues per chapter, scaled Trivial, Standard, Standard, Complex, Desperate; the opening roll decides how many the case keeps (5, 4 or 3; a trap keeps all 5), never below **3**. Together they should narrow the suspects to **2 to 4** people - the last step from the circle to a name belongs to the trial. Each planner row has a name and player text (what the finder receives), an analysis text (what Analyze reveals), your private note and a Status - where it stands on the map, or not placed yet; **Place** asks for a room and a visibility and puts it at a random spot inside that room as Reinforced and tied to the crime, with the words typed on the row. A placed row shows its trace's words, and an edit typed over a rename made meanwhile is refused and told. A row past the case's Key Remnant count is placed only with **Create more than the opening roll allows** ticked, and the case's count outlives the incident's close. The plan is the GMs' (section 14) and kept a chapter at a time: each chapter has its own five rows, and a new chapter opens on an empty plan. A player's request card ("I look at the window") carries **Create a Key Remnant here**, which can fill one of the five slots.

> [!WARNING]
> At the start of the Class Trial the module charges for a failed investigation: every Key Remnant short of **4 found** - or of the case's own count, where its opening gave it fewer - is worth **3 Despair to each Monokuma's pool** (`unfoundBar`, `unfoundDespair`, `keyFeeOf`) - a completely failed investigation is **+12** to every pool. Found means a copy a living student holds, as the GMs hold it; a copy whose trace is gone counts in the chapter it was found in. It is charged once per chapter, on the primary GM whichever GM opens the trial, the same whether or not the planner was saved, and not at all once the chapter has moved past the case.

**Observe.** The player declares how they are looking:

| Mode | What it looks for |
|---|---|
| **Sweep the room** | the easiest trace here |
| **Look past the obvious** | the hardest, and a secret project in the room at DC **18** |
| **Follow my traces** | their own first |
| **Focus your gaze** | they name what they want and a card every GM sees asks which trace the words point at; any GM picks, and the primary GM checks the pick against the room |
| **Examine point of interest** | something that is not a trace, yours to rule on |

Both of the last two have rolled before you see them: refusing the Focus pick, an Examine point of interest, or an Observe in a room with no traces left becomes a ruling card on that roll with **Create a Key Remnant here**, **Reply**, and **Nothing was there**, which counts as the miss. The roll is scored on your client against the trace's real type and visibility; the player is told the outcome, never which DC applied. A hit copies the Remnant into their inventory as a Neutral Truth Bullet and leaves the original; a miss costs **1 Sanity**. One trace yields one copy per person. Traces tied to the murder are shown first. The first time anyone copies a trace, your browser asks you to describe it (name, player text, analysis text, prefilled); everyone who copies it later gets the same words, and a critical asks you again only for the bigger hint. A Focus pick made after the player stopped waiting, after another GM's pick or after a refusal is refused and told to the GM who made it.

| Visibility | Daily Life | Key | Faint | Prep / Incident / Tamper |
|---|---|---|---|---|
| Obvious | 8 | 6 | 12 | 9 |
| Evident | 12 | 9 | 15 | 12 |
| Subtle | 18 | 12 | 18 | 15 |
| Hidden | 21 | 15 | 21 | 18 |

(Observe DCs, `OBSERVE_DC`. Neutral is priced as Prep; Final as Key. No roll is scored on the Daily Life column: no trace is of that kind. It is the ladder Observe's briefing shows the player for something with no trace behind it - the scale to hold an **Examine point of interest** to.)

**Analyze.** Head against the bullet's real type and original visibility. Key and Final Truth Bullets show their kind the moment they are picked up, but their analysis text still waits for an Analyze on the easiest column (6 / 9 / 12 / 15); only an Autopsy Truth Bullet arrives fully read. A success reveals the true type (and whether it is tied to the crime); a failure locks that bullet for this player until the chapter ends - a copy handed to somebody else is a different item and carries no lock. The same tile always offers a hint request to you (**14** subtle, **18** direct, critical: one question of their choosing) and the hunt for a hidden stash (**16**); with no bullet left to analyse, only those two remain. Every use of Analyze needs a GM online and is refused, before anything is paid, without one.

| Visibility | Daily Life | Faint | Prep / Incident / Tamper |
|---|---|---|---|
| Obvious | - | 8 | 12 |
| Evident | - | 12 | 15 |
| Subtle | - | 15 | 18 |
| Hidden | - | 18 | 21 |

(Analyze DCs, `ANALYZE_DC`. No Daily Life column: a bullet is read on the column of what it really is. Key and Final Truth Bullets, and an Autopsy handed out as Neutral, read on a Key column of 6 / 9 / 12 / 15. Inside a Class Trial an Analyze costs an action, or 1 Hope when none is left, or 1 Sanity when neither is.)

> [!IMPORTANT]
> A **critical** Observe or Analyze owes the player a substantial hint from you - the card says so in red.

The **autopsy** is issued from the dashboard or the after-incident screen to the students you tick: a name, what the player reads, your note. The answer key behind every bullet lives only in GM browsers, with the rest of the case.

**What lives only in GM browsers** (since 1.2.63): every Truth Bullet's answer key; every trace's real type and reading; who the Mastermind is and where the lair is; the running incident's cast, and the Blackened of each chapter; which planted object is which trap's, and what waits in which room; the Level Ups on offer; which rooms each character has found. Since 1.2.64 also: who builds each trap, its condition and its trigger, and who sabotaged a project (section 11); the Direct Murders declared in the dark, and who has crossed how often in the Eclipse (section 12); the Key Remnant plan, chapter by chapter; the players' pre-session notes (section 19); how an incident happened - a trap, a death by the victim's own hand, how it ended; the deaths nobody has found yet (section 13.4); the Reinforced Level Ups waiting for the class (section 15); the overflow's count, and the Despair each pool owes for its conversions to Hope (section 7); what has been taken off each body, and its trace (section 10); and which trace each Truth Bullet came from. Since 1.2.65 also: a Confusion armed on a character and not rolled yet (section 8). Since 1.2.66 also: how a running incident's fight stands - the round, whose side acts, what is hindered, blocked or spent (section 13.2); the world holds only that an incident runs, and at which stage; the statistic you picked for its opening, the free clean-up attempt a critical Finishing blow earned (its killers' browsers hold it too, so the striker's is quoted free), the last three turns the tracker lists, and who walked into the fight and out of it; a betrayal declared in an Eclipse; and which Cleaning Tools the killers' clean-up attempts wore, until the body is found (section 13.3). None of it is world data, so no player's console reads it. Each GM's browser keeps a copy for each world, and the GMs' browsers exchange their copies when one of them joins, field by field: the newer decision wins, a deletion included, so a GM who joins with an empty browser loses nothing and takes nothing away. A player's browser holds what is theirs to know: whether they are the Mastermind, and where the lair is when they are; in an incident they are part of, its cast - every name in it but a trap's builder on the victim's side; the betrayal offer only on the browser of the third it is offered to, who keeps it, and nothing of a later incident that is not theirs, for the rest of the day; never the record a Reroll of a crisis action takes it back from, which only a GM reads; the Level Ups offered to their own characters; and the rooms their own characters have found. Since 1.2.64 also how often their own characters have crossed in a running Eclipse, their own pre-session note, the deaths they know of, and which trace each of their own Truth Bullets came from; an incident's cast includes how it happened. Since 1.2.65 also a Confusion armed on their own character. Since 1.2.66 an incident's cast includes its fight - the round, whose side acts, what is hindered, blocked or spent - for those who fought it: never the Key Remnant count, the opening's statistic, the free clean-up attempt (but for its killers), the last turns or who walked into the fight and out of it, which stay the GMs', and not for a trap's builder, who is let back in at Stage 6 without it. The Observe declarations waiting for their roll stay on the primary GM's browser alone, and a Reroll's bookmark - the last roll and what it did - on the browser that rolled it, with nobody else's copy and no backup.

**Back up the case** (GM panel, Between sessions) saves all of it to one file; keep the file where no player can open it. **Restore the case** merges a file back: it takes only what is newer - a newer removal too, and its window counts what it would remove - so any GM may run it and running it twice is running it once. It never takes the file's season reset: rows from before a reset are left out unless you tick the box that takes them. A file of another world is taken only when you tick it, and then brings no removal, and its Mastermind and incident cast only when you tick those as well. After a restore every connected player is sent their part again. When the primary GM's browser opens a world holding less than the world says it should - a new browser, cleared site data - a health check names what is missing and offers **Restore from a file**, **Enter the cast by hand** for an incident in progress, or **Move them into the ledger** for traces from before the ledger whose answer key is still on the token. It also counts, since 1.2.64, an indirect murder whose killer, condition and trigger this browser does not hold (its trap cannot arm or fire), a pre-session note marked written that this browser does not hold, and a Mastermind set to "- nobody -" in Despair Flow (section 2) - and a trace whose token still keeps flags of its answer key: the update to 1.2.64 leaves a Faint Prep promotion a later correction stood against, and flags with no ledger row to carry them into, on the token for you to decide, and says so on screen when it does. From the console, `game.drpg.gmStoreStatus()` and `gmStoreHealth()` report on it; `exportLedger()` and `importLedger()` are Back up and Restore.

---

## 15. The Class Trial

`scripts/trial-floor.mjs`, `trial-floor-ui.mjs`, `trial.mjs`, `vote.mjs`, `level-up.mjs`; `config.mjs TRIAL`. One door: **The case > Class Trial**, a console that reads the trial top to bottom and never hides a section. Its first line names the next step - start the trial, open the debate, send the ballots, deliver the verdict, finish it, end the chapter - and it counts the Blackened on this chapter's register, warning you when the register is empty and a student died this chapter (a killer goes on the register when their incident is closed).

1. **Start the Class Trial.** Moves the phase, hands out the time of day's actions (keeping banked Sprint and Burst; a trial's later debates refill nothing), resets this chapter's trial record, charges the unfound Key Remnants, announces it, and tells you how many deaths nobody has found, publishing none (section 13.4). During an Eclipse it opens nothing and says so, and no other door opens a trial in the dark: Edit campaign keeps the phase, applies the rest of its window and says so, and `game.drpg.setPhase` and `game.drpg.setClock` refuse the whole move. With a murder incident still open it asks first: close it now (**Close the murder**; its Blackened go on the register, which the vote and the verdict read), **Go on with it open**, or Cancel. In a chapter whose verdict is already in it asks again (**Open a new trial**) before opening a second trial, Cancel first and the default, since a second verdict means another execution and another round of Level Ups; `game.drpg.setClock` moving the phase asks nothing. Edit campaign asks the same question when it moves the phase to Class Trial, about the chapter the window moves to, so moving back into a chapter whose verdict is in asks first. The trial opens in **discussion**: everybody talks, evidence goes on the table without taking the floor. While a trial sits, only the Analyze tile stays open (with Present, the Hope Calls and items), nobody crosses rooms, and Despair Calls and a Monocub's Confusion are locked; an Analyze or an Objection costs an action, then 1 Hope, then 1 Sanity.
2. **Open Debate** with a budget in seconds (default **180**, remembered per trial). Running over turns the debate's clock (on the trial's card in the Event panel) red and ends nothing; you decide when an argument is over. From now on presenting a Truth Bullet is an **OBJECTION**: the objector alone holds the floor for **60 seconds**, then the person it was aimed at answers in a **rebuttal** of **120 seconds** for the two of them, then the floor closes back to open discussion by itself - the debate's clock is not restarted; open another debate when the room needs one. Silence is social, not technical: the module does not mute anyone, it makes the state unmistakable on every screen and refuses the Objection button to anyone it is not for. Manual overrides: **+30 seconds** (counted from now if the clock has already run out), **End this mode now**, **Back to the debate**. **End this mode now** runs on the primary GM's browser whichever GM presses it, so a press while the clock is moving the floor on does not move it a second time, and a press that reaches it after the floor has moved on moves nothing and tells you so. **Close Debate** returns to discussion with the trial still running. The debate's clock counts the server's time, so a player whose computer clock is off reads the seconds you read. Opening the debate turns the Present button on every open sheet into Objection, and closing it turns it back; a dead student has neither, and an Objection posted in a dead student's name is refused on the primary GM's browser and its player told. An Objection's card stays above every window until it is clicked. `game.drpg.objectionLog()` lists everything presented this chapter.
3. **Vote.** **The vote** in the console opens one window - pressed again, it is raised rather than drawn twice - which names whom a ballot goes to before you press **Send the ballots** (with a murder incident still open, Send asks first, as Start does). A ballot goes to each connected player of a living student, one per person: a player with two students gets one ballot, and a student only a GM plays gets none (the dead do not cast ballots, `deadCastBallots: false`). The ballot lets them name themselves, Monokuma or the dead. The number of names demanded is the number of Blackened recorded this chapter for a death the table knows (section 13.4). The vote's state - open or closed, its round, who was handed a ballot, the count - is in the world, so a GM's reload keeps it and every GM's console reads the same vote. The ballots themselves go to the primary GM, who checks each one (one per person, of the open round, no name twice and no more names than asked) before recording it, and they are kept by the GMs' browsers alone (section 14) until the next vote is opened: no player's browser is sent another's ballot, and the table sees only the totals. A player who connects while the vote is open is handed a ballot as their browser loads, and it counts among the ballots issued, so it raises the bar: the window and the console say how many ballots are back, of how many, and how many votes a conviction needs. The console shows who has not voted; **Send another ballot** re-sends a fresh ballot to them; **Start the vote over** throws the returned ballots away and warns you first. **Close and count** - any GM may press it; it runs on the primary GM's browser - publishes the count in one sentence. A conviction needs **more than half of the ballots issued** (floor of half plus one) for every name it accuses; short of that the count says there is no majority, and that, or more names tied at the bar than there are Blackened, counts as a wrong vote unless the table settles it.
4. **Verdict.** The window states who the register says the Blackened were (leaving out a killer whose victims nobody has found yet, section 13.4), names whom the count accused and on how many ballots, and asks who is executed if the class was wrong, and whether they got it right. The executed list opens on the student the count accused, and on its first option, **Nobody is executed**, after a tie, with no majority, with nobody accused, or when the accused is already dead, which the window says; the dead stay listed, marked, but only a living student can be picked. A student whose body nobody has found is not marked dead here - for the table they are alive - and the window tells you alone whose death it is: executing them makes that death the execution, and the table learns it with the verdict. Its buttons are Cancel, **They got it right** and **They got it wrong**, in that order whatever the count said: Cancel is the default, so Enter closes the window and executes nobody. Correct: the Blackened are executed and every survivor gets a **Standard Level Up** (1 pick). Wrong: the accused is executed, every surviving Blackened stays anonymous and in play with a **Reinforced Level Up** (3 picks) and one **new rule** of their choice (you type it; it is announced without a name), and every Monokuma's pool is **filled to 12**. Since 1.2.64 that Reinforced Level Up waits for the class, in the GMs' store: its owner is told privately, and it is picked with the class's own Level Ups at the next verdict that names the Blackened correctly - one window with 1 + 3 picks, written in one go - or, alone, at the Final Trial's verdict, so no browser sees the Blackened's maxima move on the day of the wrong vote. It lapses if they die first, and a season reset that clears advancement drops it. Both verdicts empty the overflow. The verdict is written into the world's trial record before anything else, then done step by step; every player then sees one card, **THE VERDICT** - who was executed, or that nobody was, and whether the class got it right, never naming a Blackened the class missed - and the Event panel says the same; the executed student's player is also told privately. If a step fails, or the GM giving the verdict leaves, the console says where the verdict stopped, and **Finish the verdict** does the rest without repeating what was done. It runs on the browser of the GM who gave the verdict while they are connected, otherwise on the primary GM's - on another GM's the console names whom to ask, and Enter presses nothing there - and it gives no survivor a second Level Up and posts no second card. One gap is left open: a GM who leaves between a row's Level Up and the write that records it leaves that one row to be given again (read in the code, not measured). So is a second, also read in the code and not measured: in the moment the verdict's GM disconnects, the GM who becomes its runner can press Finish the verdict before the first one's last write has landed. One verdict per trial. The survivors' Level Ups come in one window on your client, **The class's Level Ups**: a row per student with its picks, each **The player picks** or **I pick** (the player's choice is preselected when their player is connected). **Hand them out** - the first button and the default, so Enter does it - follows the rows, **All: the players pick** hands every Level Up to its player; closing the window does the same, except that a student nobody plays is then given nothing (see below). A player is told and picks on their own sheet, where the Level Up button lights gold; yours open here one after another, each saying whom it is for: +1 max Health, +1 max Sanity, +1 to a statistic, +1 to an experience, or a new experience at +2. A student nobody plays is yours to pick; one you leave is not given, you are told so, and you give it from the Level Up button on their sheet. A Level Up can also be granted from a character sheet, where you decide what was earned (standard or reinforced) and whether you pick or the player does. Offers stand side by side, so a character can hold more than one; on the sheet your Level Up button shows how many stand, and its menu takes one back (**Take back the offer**), which puts the player's button out. A take-back is refused, and you are told, while that character's Level Up is being written. A player's Level Up picked while a take-back of that offer is being written is refused as busy, and a second take-back of the same character in that time is refused in its own words on the primary GM's browser and on the browser of the GM who asked for the first (that one read in the code), and as busy on any other GM's. The primary GM's browser checks a player's pick against the offer and against the sheet as the GMs hold it - a statistic or an experience the character does not have is refused, the player is told, and the offer stands - and writes it once. Every GM's browser holds the offers, so they survive a change of primary GM; a season reset that clears advancement withdraws them.
5. **End of chapter** (section 16), and **End the trial**, which closes the floor and returns the campaign to Daily Life. The chapter-end screen can do the second for you.

During a **Final Trial** the same floor and vote run; only the verdict is the Mastermind's (section 8): the console's verdict button opens **Final Trial verdict**, and that verdict closes the trial's record and takes the Final Trial flag down; `game.drpg.verdictDialog()` and `game.drpg.applyVerdict()` open that window too, so no road gives a Final Trial the ordinary verdict.

---

## 16. End of chapter and season reset

**End the chapter** (Between sessions, or the trial console once the verdict is applied) is one screen with checkboxes, each counted before it is offered:

- reveal what every Truth Bullet really is, with its reading, as an Analyze would (bullets with no real type recorded are named as a loose end); a Faint stays unread, except that every Final, Faint or not, shows its kind without its reading; both still to be analysed in the next chapter;
- sweep the students' Truth Bullets (Faint and Final stay);
- clear the Faint Remnants (reinforced traces and anything tied to the crime stay);
- clear this chapter's planted Key Remnants;
- end the Class Trial if it is still sitting;
- move to the next chapter, count the next session, and open the next chapter on the **following Morning, one day on, with actions and search tokens refilled**.

The Key Remnant plan keeps each chapter's rows under that chapter, so the next chapter opens on an empty plan; the Blackened register starts the next chapter empty (it counts by chapter), and a stale body card cannot leak into the next chapter. A death nobody has found is not mentioned and not published: make it known by hand first if the table should have it (section 13.4). If a second GM presses it after the first has moved the chapter on, they are told the chapter was already ended and nothing is done twice. A note reminds you whether a Final Truth Remnant was placed this chapter. **Chapter 6 is the last of a season:** there the "next chapter" box starts unticked and a warning says so; reset instead of moving to 7.

**Reset the season** (red tile) wipes the season and keeps the cast: it lists exactly what goes, with counts - projects, Remnants, Truth Bullets and the answer key, the Key Remnant plan, which rooms each character has discovered and which stashes they have found, deaths and Monocubs, every item carried or stowed, every advancement and what it bought, every card the module wrote and every messenger thread, notes, the pools to zero and Hope back to 2, doors back to how the season opened, the incident, the Mastermind, the trial, search tokens, Calls in force, the motive, the killing game rules, a called assembly, the overflow, the rest of the chat log, and the clock to Chapter 1, Day 1, Morning with everyone's actions refilled, the season counted one on and the Final Trial flag down. Each of these is one of **29** tickable groups in five sections (the case, the cast, the board, the log, the world), all ticked by default; untick one and the reset leaves it alone, and the choice is remembered, unticked, for the next reset. The groups cut what the GMs keep (section 14) with the rest: *Projects* takes who builds each trap and what sets it off, *The incident* the declarations made in the dark, *Eclipse placements* the crossings, *Deaths and Monocubs* the deaths nobody has found, *Advancement* the Level Ups waiting for the class, *pre-session notes* the notes, *The Despair overflow* its count, *Despair pools* what the pools owe, *Remnants on the maps* what was taken off each body. *The Key Remnant plan*, left unticked, keeps only the rows of the chapter the season was in.

**What stays:** the cast with names, portraits and Ultimates, the maps, the rooms and who owns them, who watches whom, the Monokuma team, the campaign name.

**The reset is the primary GM's** - the connected full Gamemaster with the lowest user id (an Assistant GM only when no full Gamemaster is connected); another GM is told who that is and nothing happens. The window names every GM who is not connected. A GM's browser keeps its copy of the case (section 14) until it next opens the world: the reset writes on the clock when it happened, for each group it cleared, and a browser that was away drops what those groups held the first time it loads, whether or not anybody else is connected. Back up the case first if you might want any of it back.

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

Nobody else is told who: a player's press asks the primary GM's browser to post the card, so no player's name is on it. With no GM connected the caller's own browser posts it - its header shows no name, but the card's record names the caller as its author, as every card a player's browser posts does (section 1). The same goes for a press no GM's browser answers within three seconds (`TIMING.safewordAnswerMs`) - a GM connected but reloading, whose module is not listening yet: the caller's browser posts the card then, and the caller's own card says so, a GM whose browser was not listening is not told who called it, and the game pauses only if the primary GM's browser sees the card arrive - if yours was still loading, pause it by hand. The Event panel keeps a "The scene is stopped" card up, with no name on it, for as long as the game stays paused.

> [!CAUTION]
> There is no reason field and no target: the scene is being stopped, not an accusation filed. Sort it out with the person, then resume from a point everyone agrees on.

The **pre-session note** in the messenger (seven questions a player answers before every session: whether they intend to kill, whether they are open to dying, consent to torture or romance, triggers, how they mean to play, the large project they aim at) is the other half of this; read them before deciding whether to approve a murder. Since 1.2.64 a note's words are the GMs' and its writer's alone: no other player's browser holds them, and a note saved while no GM is online waits on its writer's browser until one connects.

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

**Despair and dice.** `diagnoseDespair()` and `diagnoseDice()`; `diagnoseCharacters()` is the setup report. Despair not arriving usually means no primary GM connected, *Rolls grant Despair* off, or the roll was a reaction. Since 1.2.65 a roll the module throws names nobody on its document (section 1), and the primary GM's browser learns whose it was from the roller's browser; when that word is lost to a reload, the roll counts for the roller's one living character, and without one it awards no Despair.

**Other tools.** `diagnoseVoice()`, `diagnoseSfx()`, `testSfx()`, `diagnoseMusic()`, and:

| Tool | For |
|---|---|
| `diagnoseTruthBullets()` | are the bullets and their answer key in step |
| `diagnosePatches()` | is every override still where it expects |
| `diagnoseWindows()` and `diagnoseStyles()` | a window cut off or a sheet that looks wrong |
| `traceClicks()` | a click that does nothing |
| `fileSizes()` | a hosted world that seems to serve the old files |
| `perf()` | a theme that stutters; since 1.2.69 also what a roll your browser drew cost on its way - the last fifty draws this browser took part in, packet in to answer out here, asked to dice shown on a player's |
| `a11y()` | controls a screen reader cannot name |
| `relayGuard()` | whether the guard on Daggerheart's GM relay is standing (`state: "ok"`), and what it has refused this session |
| `rollFlags()` | the players' rolls drawn in the last half hour (as long as a Reroll can reach) whose roll window claimed a statistic, an experience, a bonus or dice the list of the GM's browser that drew them did not give, or left out a bonus, an advantage die or a hidden stash's die the list gave, or that waited for a statistic no GM picked; each was whispered to the GMs as it was drawn and counted as the list gives, and a line may end with what the GM counted |
| `sheetWrites()` | the changes players' browsers made on their students in the last day that the primary GM's browser put back, flagged or listed, or let stand on what covered them: who, which student, the reason the change named, each field before and after, what a refund took back of what was paid before, and how and by whom a flagged one was decided; since 1.2.69 also the three traces (`refused`, `forged`, `rewrite`: what, and how many times) and a relay gain covered by the player's own roll |
| `publicRoll(formula, { flavor })` | the one roll everybody reads while rolls are forced private - a vote's tie, Monokuma's lottery; GM only, the same road as the panel's **Public roll** tile (read in the code; since 1.2.69) |
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
| *A player is told a Daggerheart change was not carried out, because this game leaves it to the GM.* | Their Daggerheart feature asked for something this game keeps to the GM (an area on the map, a new countdown, another student's Health). The warning on your screen names what; do it by hand. |
| *A player's Daggerheart cost did not land while a GM was reloading.* | With two GMs, only the primary one makes Daggerheart's changes for players; one sent in the moments around its reload can be lost. Set it by hand. |
| *Chat says Daggerheart asked for a change for a sender Foundry did not name.* | Every such change is refused. If players' Hope, Stress or Fear stop moving when they roll, this is why: tell the module's author, with `game.drpg.relayGuard()`. |
| *A player's change to their sheet snapped back, or a card asks you about it.* | Nothing the module knows of covered it (section 6.3); `game.drpg.sheetWrites()` shows what and why. If it was a ruling of yours, set the value yourself: a GM's change is never judged. |
| *A door stays locked after the season reset.* | The Doors tab's "starts locked" column is what the reset restores. |
| *"The data migration stopped short" stays on screen after an update.* | A step that moves world data into the GMs' store could not read it back and left the world as it was (section 1). The console has the details; the next load of the world tries again, on the primary GM's browser. |
| *The table sees nothing of a death.* | The running incident's victim is kept by the GMs until the body is found (section 13.4). Set them to *dead* in the Students window to make it known. |

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
- **Back up the case** (GM panel) and keep the file where no player can open it: the answer keys, the traces and the Mastermind live only in GM browsers, and so, since 1.2.64, do the traps' builders and triggers, the Key Remnant plan, the notes and the deaths nobody has found.
- Copy the Debug log if anything misbehaved. Note what the next chapter needs.
