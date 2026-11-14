# Danganronpa RPG - GM Handbook

*For the Foundry VTT v14 module "Danganronpa RPG", version 1.2.112, built on the Daggerheart system.*

This is the handbook for the people running the killing game. It follows the order a season is built and played: install, set up, run a day, run a murder, run an investigation, run a trial, end the chapter, start again. Where a decision is the GM's to make rather than the module's, the text says so.

> [!NOTE]
> Every number in this handbook is quoted from the module's code, most of them from its rules file. If a rule ever seems to disagree with what you see at the table, the code is the authority and this handbook is the commentary. File names, console calls, test ids and version history are in the technical notes, section 22.

The glossary stays in English in every language the module speaks: Hope, Despair, Sanity, Health, Truth Bullet, Remnant, Key Remnant, Blackened, Class Trial, Daily Life, Eclipse, Mastermind, Monokuma, Monocub, Ultimate, the names of the Calls and the names of the actions. They are the game's proper names. A stash and a vault are ordinary words, so Polish says skrytka and sejf. Where this handbook says "the guide", it means the game's own rulebook, the *Danganronpa RPG System - Full Guide*, whose rules the module plays.

---

## 1. Installation and dependencies

Install from Foundry's **Add-on Modules** tab with **Install Module** and this manifest URL:

```
https://github.com/Akrobacjum/Danganronpa-RPG/releases/latest/download/module.json
```

Then install the system and the modules below from their own package pages. The module never installs anything by itself. Required means installed and switched on; nothing checks that a LiveKit server answers.

| Needs | Version |
|---|---|
| Foundry VTT | 14.364 or newer (verified on 14.365) |
| Daggerheart (Foundryborne) | 2.6.5 or newer (verified on 2.12.8; a newer version loads, and each GM is warned at every load until they tick that this version should not be mentioned again on that computer) |

| Module | Status | Why |
|---|---|---|
| Dice So Nice! | required | Every roll is thrown as 3D dice, seen only by the people allowed to see that roll, in the one dice style the GM sets for the table |
| Isometric Perspective | required | Maps drawn for isometric play will look wrong on a flat grid |
| LiveKit AVClient | required | Voice follows the rooms: you hear the people in the room your character is in, and moving to another room changes who hears you |

**When a required module is missing**, the module does not start. A GM gets the window **Danganronpa RPG is not running**, which names each missing module as "not installed" or "installed, but switched off", with its reason, in that browser's language; a player gets a notice that stays on screen. Install or switch on what it lists, then reload the world.

Nothing of a module that did not start runs: none of its looks, settings or holds take effect, and the hotbar, the scene navigation and the players list stay where Foundry draws them. What it changed in Foundry while it ran before stays as it left it until it runs again and you press **Give back Foundry's settings** (section 1.2).

The module does not use libWrapper; if Isometric Perspective ever asks for it, that module's own page says so. The module was developed and played on The Forge and works the same on any Foundry v14 host.

**Other tokens look dimmed on a player's screen.** Two settings outside the module do this, and the module changes neither: Isometric Perspective's *Enable Occlusion: Dynamic Tile*, which draws a copy of the player's own token over the map, so that token alone stays bright, and the scene's darkness while its global light is not bright.

### 1.1 Starting a world

Make a world on the Daggerheart system, enable the module and its dependencies, and load the world as a GM. While the world has no campaign name and no students, a GM's first load opens **Where to start**, once on each GM's browser: *Start here: GM panel > Season setup.*, with a **Season setup** button that opens it. The GM panel is the red button with the eye in the bottom-right corner, above the gear. From there to the first Eclipse, all in the module's windows:

1. **Season setup** (section 2) opens at its top, on Edit campaign's fields, with the campaign name in focus. Name the campaign and press **Save**, create the students and a character for each Monokuma, and mark it as Monokuma (section 8).
2. Open the **Season checklist** (the last tile at Season setup's foot) and work down its rows in order. Each row says what it checked, and beside each row it can help with stands a button that names its work (**Give the starting resources**, **Hide the GMs' cursor**, **Convert to passages**, **Hide**) or **Open**.
3. Draw the rooms and mark them (section 9.1), then press **Check the rooms on this scene** in the checklist's rooms row until it finds no problem (section 2 lists what it finds). The rooms row is drawn again as soon as the check ends.
4. Read the **further checks** at the foot of the Season checklist and fix what they name (section 2).
5. Read what the module changes in Foundry (section 1.2).

**The Next line.** Until every required row holds, the GM panel's **Next** line reads *To set up:* and names the first row still to do, and **Season checklist** beside it opens the checklist; it never offers the Eclipse before. It judges the rooms on the school, whichever scene you are looking at, and it does not wait on a row the module cannot finish for you (the voice server's secret, section 2: that row stays crossed in the checklist). Once the required rows hold, or once the season has started even with a row not done, the line follows the day (section 3, the Next line, items 10 and 11).

### 1.2 What the module changes in Foundry, and giving it back

While it runs, the module holds these settings of Foundry, Daggerheart and the modules it needs. A held setting does not show in Configure Settings, and a change made to it anyway is put back. The module keeps the value each setting had before it first changed it.

| What the module holds | Its switch in the game's settings |
|---|---|
| Daggerheart's Vulnerable and Defeated automations are off: Breakdown and Wounded take their place. The first time it switches them off, the GMs get a whisper saying so. | none |
| Players and Trusted Players cannot browse or upload files. | *Keep players out of the file browser* (section Foundry and the system; section 1.3) |
| Isometric Perspective's welcome window stays closed for everyone. | *Keep Isometric Perspective's welcome window closed for everyone* (section Foundry and the system) |
| Daggerheart's welcome journal opens for nobody. | *Keep Daggerheart's welcome window closed for everyone* (section Foundry and the system) |
| LiveKit's voice stays inside the Foundry window for everyone. | *Voice inside the Foundry window for everyone* (section Foundry and the system) |
| Foundry's camera dock is folded while the voice tile is on, and no camera pops out. | *Voice tile instead of the camera dock* (section Voice) |
| On scenes with rooms, the rooms take over Foundry's own vision, fog and global light. | *Rooms decide what players can see*: turning it off gives the scenes their vision, fog and light back |

**The dice look.** *Dice look for the table* has three choices, and if you are unsure, keep the default. With *Each player's own* the module writes nothing: everyone throws the dice they set. With *Everyone: Dice So Nice*, the default, every player and Assistant GM throws Dice So Nice dice in the look of one full Gamemaster, fixed the first time the game runs with it on, that Gamemaster's looks in Dice So Nice's Dice Roles included. A look of their own for a role, on themselves or on their character, goes back to it. On Daggerheart 2.9 and older every Hope and Despair die on every screen also takes the look that Gamemaster set in Daggerheart's own Dice So Nice settings, whoever throws it. *Everyone: Daggerheart* does the same, and on Daggerheart 2.10 and later every Hope, Despair, advantage and disadvantage die on every screen takes Daggerheart's own colors (yellow Hope, blue Despair, green advantage, red disadvantage), whoever throws it, a GM too. A player whose browser draws no Dice So Nice dice sees no 3D dice in any choice: Daggerheart draws none of its own.

With one look for the table, the shared look has no special effects but those a Gamemaster marks as global, and a full Gamemaster's later changes of that look reach everyone. A look a player or an Assistant GM picks in Dice So Nice - for themselves, on their character or, for an Assistant GM, on that Gamemaster - goes back to the shared look; one picked for themselves or on their character has them read *Your dice look is set by the GM.* once a session, and an Assistant GM's look on that Gamemaster tells nobody. Full Gamemasters keep their own look, and everyone keeps their own display and performance settings. Only a full Gamemaster may switch the dice look or choose whose look it is: an Assistant GM's change of either is put back, and the primary GM (the connected full Gamemaster with the lowest user id, section 6.3) is told. Give back does not change the dice look, and neither it nor turning the shared look off gives anybody their own earlier look back: the module never kept it.

**Give back Foundry's settings** is a button in the game's settings (the GM panel's **Settings** tile), section Foundry and the system, for users who may change the world's settings. It lists the same changes. **Give them back** writes the kept values back, each browser its own, and the module leaves those settings alone from then on; **Hold them again** lets it hold them again. Only a full Gamemaster can press **Give them back**, and an Assistant GM reads why. A part Foundry refuses to write stays kept, and the window offers **Give them back** again for it. The button does not touch the scenes' vision, fog and light: turning *Rooms decide what players can see* off gives those back.

Two old values may be missing. Where the file permissions were taken away by a version of the module that kept no old value, there is nothing to give back: the window says so, and you grant them again in Foundry's permissions. Where an earlier version switched Daggerheart's automations off, the values from before the module are not known either: the window says so plainly, and **Give them back** sets Daggerheart's defaults (both on).

> [!IMPORTANT]
> **Before you switch the module off**, press **Give them back** in Give back Foundry's settings, and turn *Rooms decide what players can see* off. A module switched off writes nothing, so what it held stays as it was until you do. **When you switch it on again**, it still holds nothing: a GM is asked at each start, the Season checklist shows the row *The module holds Foundry's settings* and Pre-season checks say so, until you press **Hold them again**.

### 1.3 Module settings worth knowing

The module's settings are in two places. The game's settings, everything that changes the table for everybody, open from the GM panel's **Settings** tile, under Between sessions; only a GM who may change the world's settings can open them. Pick a section on the left, change what you want, then press **Save changes**; a line under each setting says what it changes, and its tooltip says the rest. This browser's own settings (language, theme, look, effects, volumes, the messenger's sounds and the voice) are the gear's window, the same for a GM and a player, and also Configure Settings, DRPG Settings (section 18).

Among the game's settings:

- *Force private player rolls*: every roll is whispered. A roll an action throws goes to the GMs alone, its roller reading their own, and a statistic clicked on a sheet goes to the GMs and that character's player. With Dice So Nice 6.0 or later the dice then fall only on the screens that may read the roll (and, in an incident's fight, on its participants'), whatever Dice So Nice's own *Hide 3D dice on secret rolls* says; an older Dice So Nice decides that by its own setting.
- *Keep players out of the file browser*: Players and Trusted Players neither browse nor upload files, and a portrait click opens nothing for them. At its first start the GMs get a card naming what it took away. Turning it off does not give that back; **Give back Foundry's settings** does (section 1.2). While it is on, a change to those two permissions in Foundry's own window is put back and the GMs are told. An account you give the file browser by name keeps it.
- *Keep character sheets anonymous*: another player's sheet opens redacted.
- *Players' statistics without approval*: off by default (section 5).
- *Frisk: forcing after a refusal*: on by default; off, an open Frisk only asks, and a refusal or no answer ends it (section 10.5).
- *Dice look for the table* (section 1.2), *Search Tokens per room*, *Lock the roll window for players*, *Players only see who is in their room*, *Rooms decide what players can see* (the room fog), *Lock players' resources on the sheet*, *Crossing rooms costs a Move*, *Rolls grant Despair*, *Replace the Daggerheart Fear tracker*, *Guard token editing from Isometric Perspective*, *Keep Daggerheart's welcome window closed for everyone* and *Separate voice in each room*.

*Music follows the game state* and *Vary the sounds you hear often* are switches in the Sound window (section 17). The defaults are the way the game is meant to be played; the switches exist so a table can handle one piece by hand when it wants to.

> [!IMPORTANT]
> Besides *Players' statistics without approval*, two of these settings start off, because each needs something from you first: *Music follows the game state* (playlists mapped in the Sound window) and *Separate voice in each room* (LiveKit AVClient and a working server).

### 1.4 The players' accounts

Name each player's account exactly as their student, and the student is theirs at their first start: their character, and Owner of the sheet when no other player owns it. Case, Polish letters, extra spaces and spaces at either end do not matter, but a missing space does; a part of the name is not enough. A character you assign or clear by hand stays as you set it, also when the player starts again; in a new season an account with no character is matched again. Nothing is assigned when no student, or more than one, is named like an account, when two accounts are named alike, when the student already belongs to another player, or when the account already owns another student; the GMs then get a card naming the accounts.

**A student two players own.** Give a second player Owner of a student's sheet, and the private cards to that student - a Listen's answer, a find, a ruling's line, a secret passage's card - reach both players and the GMs. So do the student's rolls when rolls are forced private, what is heard in the student's room, the clean-up's word to witnesses, an incident's cards and the victim's own words when it closes. A player with Observer or Limited on the sheet reads none of them.

The messenger's thread is one account's. A question one owner asks and waits on (a Call, a Dynamic Action, the statistic a roll lists several of, an Observe aimed at a point of interest) lands in that owner's thread. The other ruling cards about the student (a Search for something specific, an Analyze hint, a Tier 0 item, a project), and the notes a ruling posts after them, land in one owner's thread: the first owner connected, else the first.

### 1.5 Updating the module

Copy the world before you install an update that moves data, with Foundry's backup of the world in Setup or a copy of the world's folder. If you update from a build older than 1.2.64, copy the world first, and after the first load press **Back up** in **The case** (GM panel, Diagnostics; section 14.8). Nothing leaves the world's data before the new store has read it back; a step that cannot finish leaves the world as it was, says so in a notice that stays on screen, and the next load of the world tries again.

> [!WARNING]
> Do not go back to 1.2.63 after 1.2.64. 1.2.63 reads the world data 1.2.64 emptied, so traps lose their killer and their trigger, the notes, the Key Remnant plan and the overflow's count read empty, players stop seeing the Remnants they found, and what was taken off each body is forgotten.

What 1.2.63 and 1.2.64 moved out of the world's data, how to save the old browser store to a file, and what a world copied before the update holds are in section 22.

### 1.6 What players' browsers can see and do

Players' browsers ask a GM's browser to make most changes in this game, and Daggerheart does the same for its own rules. Each request is checked: who really sent it, whether that player plays the character or may see the project, and whether the room, the stage and the turn allow it. A request that fails changes nothing, and the player is told, in their own language, what was not carried out and why; a few that nobody waits on are only logged. A player's request to take something back is refused, and the Reroll is made on the GM's side.

What reaches you:

- A refusal leaves a line with the player's name in the primary GM's **Debug log**.
- For a Daggerheart change you are also warned on screen, and a change Daggerheart does not make for a player puts a card in your chat. It is usually a sign somebody went around the game, sometimes a Daggerheart feature this module has not met yet, so ask before you conclude.
- Daggerheart's Fear, the system's single shared GM resource, whose bar the module hides and replaces with the Despair pools (*Replace the Daggerheart Fear tracker*, on by default), is not rationed: every step a player's Daggerheart asks for lands, one at a time. If one player's client moves Fear more than 4 times in 10 seconds, you get a note on screen; compare it with the rolls in chat. Slower steps are not compared with anything.
- The dice of a player's action and of a statistic clicked on a sheet are thrown by the primary GM's browser. What the roll earns is read from that roll, and what it adds to its dice (the statistic, experiences, a bonus, advantage dice) is the GM's side's own reading of the character, the action and the Calls the GMs hold armed. Whatever the player's roll window put on beyond that is not counted: you are whispered, and the player's own card says what was not counted.
- A change a player's browser makes on their own student - Hope, Health, Sanity, actions, statistics, the module's items - is checked against what the GMs hold, and put back or brought to you (section 6.3).
- A Daggerheart request about a student that was refused, a message a player's browser wrote as only a GM's browser may, and a roll's dice a player rewrote are each put back or refused, and kept as a Remnant naming the player Foundry names as the sender (section 6.3).
- If Daggerheart is newer than the module knows, you are told once what it refuses.

If a Daggerheart feature a player uses stops with that refusal (placing an area, starting a countdown, healing or harming another student with an ability), it asked for something this game keeps to the GM: do it for them. A player's transfer of an item to a party waits for you the same way, and you are told of it once a session.

These are not checked yet, and none of them has a limit on how often:

- the dice of a roll thrown with no GM connected (you grant what it moves, section 6.3) and of Daggerheart's own item and damage rolls;
- what the player's browser still reads for itself: which item a Search grants (its tier is checked), how a Shadow roll that hides what a student is doing from the room came out, and what Listen hears;
- the resources of any actor that is not a student, companions included;
- the players' own items' charges (not held to the item's maximum), and the quantities of those that are not the module's;
- countdown ticks, one step each, and any change to a countdown you gave them ownership of;
- save totals for their own tokens;
- their party's group roll and tag team entries;
- the order of a scene's environments.

**What every browser holds anyway.** The module keeps its secrets out of the world's data. The rest of the world is Foundry's to send, and Foundry sends it to every browser, where a console reads it whatever the screen shows:

- where every token stands and when it moved, hidden tokens and the Eclipse included;
- the description and the picture of every room, which travel like a scene's background. Room setup's Description tab says so: "Every browser holds the descriptions and pictures of all rooms, so keep a room's secrets in its stashes and traces.";
- every actor's data: a victim's Health at 0 before anybody has found the body, the new maxima of a Level Up (the class picks together, which hides the moment and not the amount: a Blackened (a chapter's killer, section 13) who walked out of a wrong vote takes 4 picks where the others take 1), action budgets, and Hope, a conversion's included (section 7);
- every item on every sheet, and each move of one from sheet to sheet;
- that a chat card exists, when, who posted it and to whom it is whispered; the words of the module's own private cards travel beside it, to their readers alone;
- Daggerheart's Countdowns, which are the projects: a secret project's name, its progress and who may see it (section 11; this version does not move them);
- the picture on each project's token, which is the project's tray icon, a secret project's too, so a console reads what kind of project stands in a room, even one its player may not see;
- every other module's world settings (section 9.5 has the one that matters);
- other players' Truth Bullets: that they exist, their name, the words their holder has read, and the room and time they were found, but not their answer key and not which Remnant they came from.

**What the chat still says.** A roll the module throws names nobody on its document (no speaker, no title, no actor) and is whispered to the GMs alone, its roller reading their own. What a private card says about itself travels with its words, and a card whose mere existence would tell something is veiled: addressed to the whole table, naming nobody and speaking as Monokuma. While an incident runs, every private card that would name a character or a player is veiled, whoever posts it and whoever it is about, a bystander's own included, so a veiled card says nothing of who is in the fight; a browser that was not sent its words when it was posted never shows it.

What stays on purpose:

- who created a roll or a card, and when: Foundry stamps it on the document. A player's roll is written by the primary GM's browser, so its author is a GM, and nothing on it names the roller;
- that a veiled card exists, and when, and that a GM whispered the GMs, and when;
- a roll's formula, which carries the statistic's value: when you roll for one character, it can tell them from another;
- Foundry's user activity: a player's targets and cursor are shown to everyone (the Season checklist can make the GMs' pointer private).

Who sees which dice, what happens to a roll with no GM connected, Daggerheart's own reroll, the cards of a statistic clicked on a sheet and of a Monocub's Meddle, and the chat log from before 1.2.65 are in section 22. Clearing the chat log at a case's end takes all of it.

---

## 2. The season setup checklist

**Season setup** (GM panel > Between sessions) is the one place a season is set up. From the top it holds **Edit campaign** (the campaign's name, the chapter, the phase (Daily Life, Investigation or Class Trial), the day, the session, the time of day, **Next morning's line** and the **Safeword**, with *Also refill actions and Search Tokens* and **End the chapter** apart at its foot; section 4), the **Scenes** part that links the school and the trial hall (section 15.1), and **Reset the season** in its warning frame (section 16). **Save** writes Edit campaign's fields exactly as Edit campaign's **Apply** does, and asks the same questions.

A row of tiles stands at the window's foot above **Save**, always in view: **Despair Flow**, **The Mastermind**, **Killing game rules** and **Season checklist**. When the window is short, the part above the row scrolls. Each tile's window opens in front, and Season setup waits behind it as you left it, with what you typed kept.

Season setup opens at its top, on the campaign name, which is shown at the top of everyone's screen. A blank **Safeword** means the default, "Safe Word" (section 19).

The **Season checklist** is a window of its own: its rows first, then the *First session* rows, then the further checks the rows do not cover. Every row stays on screen with its state showing, so a step you skipped is a step you can still see. A tick means done; a cross, the one red mark, means the season needs it (a screen reader says *Required, not done yet*); a dash means optional; a **!** means something is off and the decision is yours (*Check this*). A row ticks only once it has checked something, and a row that waits on something else has no mark and no button: with no students yet, the rows about students read *Waiting for the cast: create the students first.*

A row the module can finish carries a button that names the work (**Give the starting resources**, **Hide the GMs' cursor**, **Convert to passages**, **Hide**); a row that needs you carries **Open**, which takes you to the right window. Every row's button closes and reopens the checklist so the marks are current, and the window an **Open** brought up stands in front of it.

| Step | What it checks | How to fix it |
|---|---|---|
| Name the campaign | A campaign name exists | Type it in Season setup's Edit campaign and press **Save** |
| The cast exists | At least one student character (Monokumas do not count) | Create the characters in Foundry's Actors list |
| Characters no player plays are marked (optional) | Every character no player owns is a Monokuma, a Spectator (section 8) or marked *Not in the class*; the row names the others | Advice only: such a character is probably an NPC. Mark it *Not in the class* on its sheet, or leave it as it is |
| At least one Monokuma | A Despair pool (section 7) exists (every full Gamemaster account holds one) and a character is marked as Monokuma (section 8); the row names whichever of the two is missing | **Open** opens the Students window, whose **Role** column makes a Monokuma (section 3); **Mark as Monokuma** on a character's sheet header works too |
| Starting Health, Sanity and Hope | Every student has at least max Health 4 and max Sanity 6; a sheet whose maxima are still 0 reads as Wounded and in Breakdown at once (section 5) | **Give the starting resources** sets up every student below them; on one sheet, the wand beside the name does the same |
| Everybody has an Ultimate | Every student has an Ultimate written on the sheet | **Open** opens the first sheet that lacks one |
| Everybody has their Experiences | Every student has at least 2 Experiences, each worth +2; the row names each student short of them, with the count | **Open** opens the first sheet short of them |
| Everybody carries something | Every student holds an opening item (a Usable, Murder Weapon, Cleaning Tool or Tool; keys and Truth Bullets do not count). The guide gives everyone one Tier 2 item tied to their Ultimate; what it is, you agree with each player | **Open** opens **Give / take items** |
| Every student has a Monokuma watching | Every student is assigned to a Despair pool by a GM in Despair Flow (section 7), or set to "- nobody -" on purpose (an NPC-run character, a template), which counts as watched. A student nobody assigned feeds the first pool and is named here as *Name (falls back to Pool)* until assigned. Every player can read who is set to "- nobody -", so assign the Mastermind like any other student | **Open** opens Despair Flow |
| The Mastermind feeds a Despair pool (shown only when it does not) | The Mastermind is set to "- nobody -" in Despair Flow, which every player can read; the case health check lists it too | **Open** opens Despair Flow: give the Mastermind a Monokuma like any other student |
| The students are split evenly between the pools (optional) | The living cast per pool differs by at most one student | Advice only: **Open** opens Despair Flow, where **Split evenly** deals them out. A cast that will not divide evenly is your decision; an uneven split shows a **!** and each pool's count (*Uneven: ...*) |
| The overflow threshold suits the cast (optional) | The overflow threshold (section 7) is the module's suggestion for this season, 12 plus half the living students; the row reads *Suggested for n students and p pools: x.* and the threshold now | Advice only: the threshold is yours, and the default 20 stays until you change it. **Open** opens Despair Flow, whose **Overflow** tab sets it |
| Enough rooms for the cast (optional) | Shared rooms on the scene judged against about 1.5 per living student, rounded up. Bedrooms and rooms ticked **No privacy** in Room setup's **Rooms** tab are left out, and locked rooms count. The row is never ticked with no room, and the Rooms tab prints the same count | Advice only: below the ratio, two private conversations cannot happen at once |
| The map has rooms | A scene holds rooms, and the scene judged (the one on screen when it is a map with rooms, otherwise the school) has at most 10% of its own area in no room (the padding around the map does not count) and no error left from its last **Check the rooms on this scene**. Every scene with rooms also has Foundry's token vision and fog off and its global light on, or the players may see black (section 9.2 has the three switches). The line under the row names the scene judged and how many scenes hold rooms | **Open** opens Room setup. The row also carries the room-drawing guide and **Check the rooms on this scene** |
| Every named region is decided: a room or not | No named region without behaviors, on any scene, is still waiting for a GM's **This is a room**; the row names the regions waiting. With no named region anywhere the row is not ticked and says to draw the rooms first | **Open** opens Room setup on its **Rooms** tab |
| The GM's pointer is private (recommended) | Foundry's cursor sharing is off for the two GM roles | **Hide the GMs' cursor** takes it from the two GM roles in Foundry's permissions; players keep theirs |
| No Foundry secret doors (recommended) | No scene of the world has a Foundry secret door, which any player can open; the row names each scene that has one, with how many | **Convert to passages** makes each one an ordinary wall, shut, and where it stood between two rooms also a secret passage nobody knows yet (section 9.6) |
| The players' movement ruler is hidden (optional) | The Player and Trusted Player roles do not show Foundry's movement ruler, which the whole table sees while a token is dragged, a route through a secret passage too | **Hide** takes the movement ruler from the Player and Trusted Player roles, and **Show** gives it back; the GM roles keep theirs |
| The voice server's secret is not in the world (shown only when it is) | LiveKit AVClient is set to a self-hosted server with its API secret in a world setting, which reaches every player | Nothing this module can move, so the row has no button and the Next line does not wait on it. A server that issues its own access tokens, such as the Tavern, keeps the secret off every browser |
| The Mastermind (optional) | A Mastermind is set | **Open** opens **The Mastermind**. A season without one is a legal season |

**First session.** Three rows stand apart, under *First session* after the list, each set once before the first session, with its state and its button as any row's. All three are optional, so the GM panel's Next line waits on none of them.

| Step | What it checks | How to fix it |
|---|---|---|
| The school and the trial hall are linked (optional) | Season setup links the scene the season is played on and the scene the Class Trial is held in, and the row also checks the hall's tokens: the hall needs a token of yours only for Monokuma, since the module makes the students' | **Open** opens Season setup (section 15.1). With none linked the trial is held wherever the table is |
| The module holds Foundry's settings (optional) | Shown only while Foundry's settings are given back: the module holds none of them | **Open** opens **Give back Foundry's settings**, where **Hold them again** takes them back (section 1.2) |
| Dice So Nice (optional) | Dice So Nice is on. It is a required module (section 1), so while this module runs the row is always ticked | **Open** opens Foundry's module list, where it is switched on |

> [!IMPORTANT]
> **How rooms must be drawn** (the guide printed in the row): draw the walls, then a region for each room, and tick “This is a room” in Room setup.
> The rest of it: draw each region to the walls with snapping on; a room may be several regions of one name. A region nobody ticked, a passage (a region that teleports a token or changes its level) and a region a player drew are no rooms and never count as neighbors. Neighbors touch along a shared edge and never overlap. A doorway is a gap in the walls, of any width. Two zones means two rooms. The check in the row reports errors, overlaps, borders drawn off their walls, a room with no way out and no neighbor, a room whose pieces disagree, and corners off the grid; it never edits your map.

The report of **Check the rooms on this scene** says once, above the list, what each kind of finding means, then gives each room a short fact (how many squares of its border have no wall, how many squares of floor two rooms share) and **Show on map**, which takes the map to the spot and marks it. With no scene on the canvas it says *No scene on the canvas*, and on a scene with no rooms *No rooms on this scene*; it says the map is clean only when it has checked rooms.

The **further checks**, under the Season checklist's rows, are reports in the table's language. Each part shows only when it has something to say, except the dice look and the anonymity audit:

- **Room pictures**: pictures that do not load, a cross (pick the file again in Room setup); and, each a **!**, pictures over 4096 px on a side or over 8 MB, which every player waits for, pictures whose file size the server did not give, and pictures that did not finish loading in time, whose size was not checked (run the checks again on a faster connection).
- **Voice**, each a **!**: A/V is off in this world, so the voice tile does not work; the world is set to video only, so nobody sends sound; the world sends video nobody watches.
- **Dice look**: what this browser reads of every user's dice look, a **!** for each thing that can make the dice look different and a tick when there is none. **Open the dice look** opens the whole window (section 20). Another person's browser is read only on that browser; the Debug log's **Foundry and modules** says how (section 3).
- **The anonymity audit**: sheets owned by every player, which every player reads whole, under *fix these*, with **Set them to Observer** (every player can then open them, their secrets hidden). Sheets at Observer are fine and not listed. Sheets closed to the other players are listed for your information, since nobody can loot such a character's body. It also lists sheets an Assistant GM owns, sheets owned by more than one player, sheets with no player owner, and Observer sheets every player reads whole while *Keep character sheets anonymous* is off.

**Character creation numbers**:

| Starting | Value |
|---|---|
| Statistics | Eye, Head, Body, Leg, Hand and Shadow, with the spread **+2, +1, +1, 0, 0, -1** |
| Health | **4** |
| Sanity | **6** |
| Hope | **2** of a maximum 6 |
| Experiences | 2, at **+2** |

---

## 3. The GM panel

`scripts/gm-panel.mjs` draws the GM panel, which opens from the red button with the eye in the bottom-right corner, above the gear (**Open the GM panel**). Its top is the standing: the campaign name, the clock line ("Chapter 2 · Day 3 · Session 3 · Afternoon", with "· ECLIPSE" appended while one runs) and the phase (Daily Life, Investigation or Class Trial, section 4), **Skip the Eclipse** on a row of its own, the **Next** line, and how many students still have actions this time of day (*n students still have actions*). That count takes in a Monocub (a dead student who plays on, section 8), who spends a real budget, and leaves out the Monokumas and the dead; each student's actions and Free Move are in **Students**. While a check has found the case incomplete on this browser, a warning box (*The case is incomplete on this browser:* and what is missing) stands above it all (section 14).

**The Next line** is one instruction, the most urgent first, and the button beside it runs the step and names it:

1. An incident is running: take it to the end (**Open the incident** opens the incident tracker).
2. The players were asked before the clock moves and the question still stands: open it again (**Move the clock on**, or **Start the Eclipse** or **End the Eclipse** for an Eclipse's question).
3. The Eclipse is open: close it once everyone has placed (**End the Eclipse**).
4. A chapter's end stopped before every step was done: finish it (**End the chapter**).
5. In a Class Trial: the trial has outlived its chapter, so end it (**Open the trial console**); otherwise the console's next step, in the words the console's first line and the vote window's first line use, from *No Class Trial is running. Start the Class Trial.* through *The ballots are out. When they are back, Close and count in The vote.* to *The verdict is in. End the chapter.* The line names the step only, without the mode on the floor or who holds it, and its button opens the console, or **End the chapter** at that step.
6. A body has been announced and this case's Key Remnants are not all on the map: place them from the Investigation window's Key Remnants tab (**Open the Investigation**).
7. A body has been found and the Investigation has not started: start it (**Start the Investigation**).
8. In an Investigation: once this chapter's body was announced, the autopsy Truth Bullet if it was not issued this chapter, to everyone alive (**Issue the autopsy**); then, once every planned Key Remnant is found, start the Class Trial (**Open the trial console**); otherwise check the Investigation window (**Open the Investigation**).
9. Daily Life, a body: one two witnesses found waits for your word; one nobody has found yet waits in its room for two witnesses and then your word; one whose token is hidden or in no room waits for you to announce it. The button, **Announce the body**, opens the window in 13.4.
10. Daily Life, while a required row of the Season checklist is not done and the season has not started: *To set up:* and that row (**Season checklist**). The season has started once the clock has left Chapter 1, Day 1, Session 1, Morning in Daily Life, or an Eclipse has refilled the cast. From then on that row shows under the line below as a second, quieter line instead (*The Season checklist still waits on:* and the row, with **Open**).
11. Otherwise *n students still have actions to spend*, or, once everyone has spent them, start the Eclipse: opening it refills everyone, and closing it moves the clock (**Start the Eclipse**).

So the line may point at things that are not tiles: the Eclipse, moving the clock on, the chapter's end, starting the Investigation, the trial console, the body's announcement and the Season checklist.

**Skip the Eclipse** moves the clock on without an Eclipse and *does* refill actions, Free Moves and Search Tokens; at Night it also starts the next day and session. It stays on its row in every phase, disabled during an Eclipse (its end moves the clock on) and during a Class Trial (the chapter's end does), its tooltip saying which. It asks the players first (section 12, *The players first*).

Like an Eclipse's start, **Skip the Eclipse** opens on every screen the summary of the time of day it ends (section 12, *Starting it*), and so does any other move of the clock forward while no Eclipse runs, Edit campaign's included. Each screen sums up a time of day once. The end of an Eclipse, a rewind and a new season or chapter open no summary, and **Skip the Eclipse** after an Eclipse ended without advancing sums up only what was played since that end. While an incident runs, a player outside it is shown no summary when the clock moves.

The tiles, by section:

| Section | Tiles |
|---|---|
| Right now (always open) | **Students**, **Projects**, **Sound** |
| The case (Daily Life, Investigation, Class Trial) | **Murder** (grayed out during an Eclipse, unless an incident runs: then it opens the incident tracker), **Investigation**, **Class Trial** console |
| Between sessions (collapsed) | **Room setup**, **Item tables**, **Season setup** (section 2), **Settings** (the game's settings; disabled, with the reason, for a GM whom Foundry does not let change settings) |
| Diagnostics (collapsed, dim) | **Debug log**, **Fix voice**, **The case** (backup and restore, with the last copy's age; section 14) |

**Debug log** lists everything this browser has failed at since the page loaded, a repeat as one row with a count; a reload empties it. While it holds anything it offers **Copy to clipboard** and **Clear the log**, and it always offers **Foundry and modules**. That window has two parts. *Foundry, Daggerheart and the modules* gives one line when every place the module relies on in them is as this version expects, and a **!** for each place that is not, with what the table gets instead (the list is in section 20, "The contract with Foundry, Daggerheart and the modules"); places that could not be checked on this screen are one counted line with the list folded under it, and are not known to work: unchecked is never a pass. *Dice look* says how another browser's dice look is read, with **Open the dice look**.

**Fix voice** sends everybody their voice room again (section 9.5). Only the primary GM can press it, and only with LiveKit AVClient active.

**Students** has a row for every character, in groups when there is more than one: the students, then the Monokumas, the Spectators and the characters not in the class. Every row has the name, a button for the sheet and **Items** beside it (not on a Monokuma's row: its sheet has no Inventory tab), its **Role**, and a **Level Up** where the sheet offers one. **Role** (Student, Monokuma, Spectator or Not in the class) changes at once, as the sheet header's controls do, and marking a player's character as Monokuma asks first; a dead student's Spectator reads *Dead student's Spectator* there. **Level Up** opens the sheet's own Level Up menu and says how many offers stand (*n Level Ups on offer*); **Items** opens **Give / take items** on that character; the table comes back after either.

A student's row also has **State**, **Actions** (left / maximum this time of day), **Free Move** (the footprint solid while it is there, outline once spent; a dead student's two cells read -) and the three Monocub columns, **Hope**, **Despair → Hope** and **Crime witness**, which are always there; a student who is not a Monocub reads a dimmed "-" in them. The **State** dropdown changes only the recorded state, on **Apply**: it is for correcting a misclick.

The **Do** column does the real thing: **A character dies** on a living student (below), and **Invite as a Monocub** on a dead one, which sends an invitation: the student becomes a Monocub when their player accepts the Monocub Rule (so does *Monocub* in the **State** list). An open invitation reads *Invitation sent*, and **Withdraw** takes it back. On a death the GMs keep, **Silence now** moves that player's voice to the Spectators before the body is found. **Refund last crossing** stands on the row of a character whose last crossing the GMs can still give back, its tooltip naming the two rooms.

A death the GMs keep until the body is found (section 13.4) shows in the dropdown as **Dead, body not found**; setting it to *Dead* (or *Monocub*) makes it known to the table, the same publication a discovery makes, and setting it to *Alive* takes the death back.

> [!CAUTION]
> **A character dies** destroys the character's Truth Bullets (unless you tick *Keep their Truth Bullets, for a death outside the killing game*) and leaves everything else on the body. Its second box, *Keep it the GMs' until the body is found*, is ticked for the running incident's victim: then nothing reaches the table yet (no flag, no marker), and the Truth Bullets are destroyed only when the death becomes known (section 13.4).

---

## 4. The clock

The clock runs Season > Chapter > Session > Time of day. One session is one in-fiction day of five times of day: **Morning, Noon, Afternoon, Evening, Night**. Advancing past Night rolls the day and the session over together. Chapters never advance on their own: the rules guide the module is built on (the *Danganronpa RPG System - Full Guide*) allows stretching a chapter when no murder has happened yet, so the chapter is yours to move (**End the chapter**, section 16, or Edit campaign).

Three **phases**, each set by hand. A canonical chapter is 5 sessions, as below:

| Phase | What it means | Sessions in a canonical chapter |
|---|---|---|
| Daily Life | 2 actions per time of day | 3 (the third carrying the murder) |
| Investigation | a body was found; Observe and Analyze build Truth Bullets | 1 |
| Class Trial | objections, testimony and the vote (section 15) | 1 |

**What a time-of-day change does**, in order:

1. checks the Despair overflow (section 7), before the restock, because a darkening (an Overflow state that covers a time of day, section 7) can shrink the token count;
2. restocks every room's Search Tokens;
3. clears every Despair Call in force for one time of day (Behind Closed Doors seals, Chained, Silence), and lapses every Bribe still unanswered and every Bounty nobody claimed (section 6);
4. ticks Monokuma's motive deadline down by one (section 6.2);
5. announces the new time of day to the table (privately to the incident's participants and the GMs while an incident runs) and redraws everyone's HUD.

While an incident runs, a motive that comes due is whispered, veiled, to the incident's participants and the GMs, once however often the time of day moves inside it, and its card for the whole table is posted when the incident closes. Until then everybody outside the incident keeps seeing the motive's countdown in the Event panel as it stood when the time of day first moved inside it, as their clock stays where it was.

> [!IMPORTANT]
> A time-of-day change does **not** refill actions by itself. The budget comes back <ins>when the Eclipse opens</ins> (section 12); **Skip the Eclipse** on the GM panel refills for tables that skip the Eclipse, and Edit campaign has a box for it. Never refill one boundary twice: the module refills each boundary once, and Edit campaign's box refills every time it is ticked.

When **Skip the Eclipse** refills, the GMs also get a note naming each Wounded student who is down to one action this time of day (section 5).

**Rewinding** (the left chevron on the HUD) steps the clock back one time of day, as a correction for a misclick; from Morning it steps back to the previous day's Night, the day and the session with it. It is refused while an Eclipse runs (*An Eclipse is running. End it first.*): end the Eclipse without advancing from the panel instead.

A rewind refills nothing. Within **5 minutes** of the boundary it steps back over, it also takes back what that boundary gave: the actions, Free Moves, Search Tokens and seals are as they were before it (*Taken back: ...*), and the boundary refills next time exactly as it would have before it was crossed. After several boundaries in a row (up to 4), as many rewinds take back each one, each within 5 minutes of its own; later nothing is put back. A rewind calls off an assembly (the gathering a Public Announcement calls, section 6.2) that has not gathered yet first, clears the Despair Calls in force (or, when it takes the boundary back, puts back the seals of the time of day it returns to), and gives the motive its time of day back.

**Edit campaign** stands at the top of Season setup (section 2) and corrects the clock. It edits the name, chapter, phase, day, session and time of day, and **Next morning's line** (below). *Also refill actions and Search Tokens* is off by default; ticked, it refills the actions and the Search Tokens and nothing else of a boundary: the motive, the seals and the overflow are left alone, and no time-of-day card is posted. **Chapter**, **Day** and **Session** are numbers with - and + beside them; the chapter runs from 1 to the season's 6 chapters, or to the clock's chapter when it is already past them.

Edit campaign does not do what ending a chapter or opening a trial does. Moving the chapter asks first (*Correct the chapter number*): it corrects the number only, with no reveal, no sweep and no Blackened (the chapter's killer), and **Cancel** keeps the chapter and applies the rest. **End the chapter** stands apart at the bottom, in a warning frame: it reveals, sweeps and names the Blackened, and it asks first. Its button closes Edit campaign without applying what was typed, asks once more (**Cancel** the default), and only then opens the chapter's end (section 16).

Moving the phase to Class Trial asks too (*Open the Class Trial*), because that opens the trial's budget and charges for unfound Key Remnants (section 15); during an Eclipse the phase is kept, you are told, and the rest of the window is applied. Changing the time of day or the session calls off an assembly that has not gathered yet, in a card the table sees and with nothing refunded. The assembly is kept when the time of day moves on (later the same day, or another time of day on a later day) and the session does not go back.

> [!WARNING]
> Two cautions:
>
> - changing the phase ends the "body found and waiting" record;
> - moving the clock does not end an Eclipse: when the time of day, the day or the chapter moved while one was running, you are warned after Apply, and the clock line keeps saying ECLIPSE until you end it from the HUD.

**The HUD** shows all of this to everyone. GMs also get the chevrons: the left one rewinds, and the right one starts the Eclipse for the next time of day (its tooltip names it, and at Night says it ends the session as well). The right chevron asks first, **Start it** or **Cancel** (the default), and then turns into a play button that ends the Eclipse. It does exactly what **Start the Eclipse** and **End the Eclipse** on the GM panel's Next line do, the players asked first (section 12).

The HUD also shows how long the current time of day has run, amber at **15 minutes** and red at **30**: the minutes the table has played, frozen while the game is paused. A reload or the time between two sessions adds nothing, to within a minute. A GM who opens the next session on another computer, or after clearing the browser's data, counts from the clock's last change instead (a pause, its end, a new time of day), so the minutes played after that change are lost from the line, never the days between sessions. During an Eclipse the line is not shown.

During a Class Trial the time row names the trial's mode instead, the chevrons and the elapsed line step aside, and the debate's countdown sits on the trial's card in the Event panel. During an Eclipse the phase line names it in place of the phase (*Night Eclipse*, for instance). While the game is paused, every clock says so: **On hold** stands in place of the campaign's name until the game runs again, and Foundry's own caption in the middle of the screen and the dimming stay as they are. Under the clock's lines a band names the track that browser plays.

The GM's status strip counts who is *Still to act*, or *Still placing* during an Eclipse (in a placement that allows any room: those who have not moved yet), over the students the panel's Next line counts: the living and the Monocubs. While an incident runs nobody spends the day's actions, so *Still to act* is not shown; in a Class Trial it stays.

The **Event panel** under the Despair rail carries the standing events as cards: the safeword's stop, the trial and its vote, the opening roll and the incident (to its participants and the GMs only), a body found (naming its room), the overflow's darkening, an assembly called and the motive. It keeps one size whatever it holds, and a card longer than it scrolls inside it.

**The clock's turns and the day's boards.** Each change of the time of day turns the curtain: an hour forward from the top, a new day or a rewind from the bottom, the Eclipse from the center. The Investigation opens with pane flashes, and a body's announcement makes the curtain flicker.

When Night begins (at the end of the Night Eclipse, or at **Skip the Eclipse** from Evening when you hold no Night Eclipse), everyone sees an **end-of-day board**: what they did that day (you see the whole table), what the school saw, and **the school's mood**: Calm, Uneasy or Close to spilling. The mood weighs the students' Hope against the Monocubs' Hope, Monokuma's Despair and the Overflow; players see only the word.

When the next day begins (at the start of the Morning Eclipse, or at **Skip the Eclipse** from Night when you hold no Morning Eclipse), everyone sees the **start-of-day board**: the new day, the cast, and your morning line from Edit campaign's **Next morning's line** (empty shows nothing; with two GMs, the line of the GM who moves the clock). The Morning Eclipse's end plays no board, and the day's number and the session still move there. **End without advancing** on a Morning Eclipse gives your line back to the field. At the End of chapter screen's next morning both boards play, after the trial's exit. Edit campaign plays neither. Esc skips a board; the **Full-screen sequences** switch turns all of this off (section 15.3).

---

## 5. Actions and budgets

Every student gets **2 actions** per time of day and **1 Free Move**. **Wounded** (no Health left) costs 1 action per time of day in Daily Life and in the Investigation; in the Class Trial it costs none, though the state and its badge stay, and a Monocub never loses an action to it. A *Panic* darkening (section 7) costs 1 more action, and the two stack, but Panic never takes the budget below **1**. A character who heals mid-day gets the action back at the next refill. A banked Burst (a Hope Call, section 6.1) pays the whole price of the next action, a Long Rest's 2 included, before any action is spent; a crossing takes the Free Move first, then a banked free crossing, then a Burst, then an action (section 9.3). **Breakdown** (no Sanity left) gives disadvantage on every roll, and a roll's card calls the extra die Disadvantage, never Breakdown (*Who reads what*, below).

The ten tiles on the sheet, in the order they are drawn:

| Action | Statistic | Cost | What it does | Numbers |
|---|---|---|---|---|
| Search | Eye, or another you approve | 1 + one of the room's Search Tokens | Loot the room for something you name | 8: a Tier 0 item (section 10.1), and the Search leaves a Hidden Remnant (the evidence an action leaves on the map, section 14.1); 12: Tier 1, a Subtle Remnant; 18: Tier 2, an Evident one; a critical adds 1 tier and leaves an Obvious Remnant, so a critical that misses every threshold still finds a Tier 1 item. Taking a Murder Weapon or a Cleaning Tool leaves a Faint Prep Remnant. A Search never reaches into a stash. A failure finds nothing |
| Observe | Eye | 1 | Copy a Remnant into your inventory as a Neutral Truth Bullet (an unidentified one, section 14.1) | The DC by the Remnant's visibility (section 14); a failure costs 1 Sanity |
| Analyze | Head | 1 | Identify a Neutral Truth Bullet, or ask the GM for a hint | The DC by visibility (section 14); a failure locks that bullet until the chapter ends. Hint: 14 a subtle hint, 18 a direct hint, a critical lets them ask you one question. Find Stash: 16. Find Passage: 16 (section 9.6). In a Class Trial only the identification is offered, and a hint, a stash or a passage asked anyway is refused before anything is paid; there, with no action left, it costs 1 Hope, or 1 Sanity once Hope is gone |
| Infiltrate | Shadow | 1 | Listen: learn who is next door, with no ruling from you; or one of the tile's seven other actions (below the table) | The room is picked before the roll. 14: how many people are in it; 18: who they are, by name; critical: who is in every neighboring room. The answer is a private card. A neighbor the listener has not discovered is named only "Unexplored room 1, 2...", in the picker and in the answer |
| Palm | Shadow, then Hand (Frisk openly: no roll, or Body after a refusal or no answer) | 1 | Take something out of a pocket, leave something in it, or see what they carry | Take: 12 to succeed, 15 on Shadow to stay unseen. Plant: 8, unseen 13; into full pockets the item stays with the planter, the action stays spent, and the target is told nothing. Frisk openly: no roll, and the target's player answers within 60 s (you answer for a character without a player); the searcher may force it with Body 12 after a refusal or no answer, deciding within 30 s, unless *Frisk: forcing after a refusal* is off (section 10.5). Frisk in secret: unseen Shadow 15 then Hand 10 |
| Projects | the project's | 1 | Push a project in this room, or propose a new one for you to approve | 12: +1 progress, 18: +2; critical: +2 and the action back |
| Facilities | none | 1 (Short Rest) or 2 (Long Rest); a room action its own price (sections 9.1 and 11) | Rest, or use one of the actions of the room you stand in | *Rest*, below |
| Dynamic | GM's choice (the player proposes) | 1 | The player describes something the game has no name for; you set the band | *Dynamic Actions*, below |
| Tamper | Shadow | 1; a killer cleaning up on the night of their own murder pays 1 Sanity instead; with no action left there is no Tamper | Erase a Remnant, reshape it, or plant one pointing at somebody else | The rules of Stage 6, the clean-up after a murder (section 13.3). Reaches only Remnants in your room that you have found (hold a Truth Bullet of), and, while an incident is open, its Incident Remnants (those the murder itself left, section 14.1) if you are its victim or one of its killers |
| Direct Murder | none | 1 | Open a Direct Murder, agreed with you beforehand | Declared in the Eclipse (section 13) |

**Move** is not a tile: dragging the token is the action, and its price is paid when the token arrives in another room. **Sabotage** is the third branch of the Projects menu and rolls the statistic of the project it breaks.

**Infiltrate** lists its rows in this order, each for 1 action; the player handbook's section 4 has each in full:

| Row | Roll | What it does |
|---|---|---|
| Listen | Shadow | the tile's row above |
| Echoes | no roll | names the nearest room where a living student of another player stands, never who |
| Tail Someone | Shadow 15 to go unnoticed, then Leg or Shadow, which a GM picks on a card | follows another student |
| Dash | Leg | 12 gives 2 free crossings, 18 gives 3, a critical 4 |
| Shut the Door | Body | a barricade from inside a room with at most two doors |
| Force the Door | Body | a barricade gives to a roll above its own, a lock or a seal to 18 |
| Pick the Lock | Shadow 16 so the room beyond does not see who, then Hand 15 | opens a lock or a seal for the picker alone, until they leave the room beyond; the picker's own room always sees who it is; a bedroom's owner is warned of a lock picked below 18 (a critical warns nobody) and of a miss with Despair |
| Keep Watch | Body 12, before an Eclipse but not in the Evening (no watch before the Night Eclipse) | a roll below 12 keeps no watch; a watch of 18 or a critical puts one hindrance die (one die of disadvantage, which the killer's window names without its cause) on the opening roll of whoever opens a murder on the watcher (section 13.1) |

**Who picks the statistic.** A roll whose definition lists one statistic rolls it and asks nobody. When an action lists several, the player proposes one in the action's window, under the choices (*Which statistic do you propose?* and *How do you do it? (optional)*), and may say how; you rule on one card in their thread: **Approve** it, **Change to** another on the roll's list (the card offers no other), or **Refuse**. When you roll for a character yourself, a window on your own screen offers **Approve**, a **Change to** for each other listed statistic and **Cancel**, which rolls nothing; it has no **Refuse**. Nothing is spent before you answer, and a refusal costs nothing, with one exception: a killer's Direct Murder spends its action when it is declared, so **Refuse** on its card does not give that action back.

After a **Change to**, the player's window says what you changed it to and offers **Roll** with that statistic or *I'll pass (nothing spent)*; a pass leaves one line in their thread, and in a fight the crisis menu opens again. The roll window then opens on your answer, locked: *Approved by the GM.*, *Changed by the GM.* or, when the player proposed nothing, *Chosen by the GM.* Who picks, roll by roll:

| Roll | Statistics it lists | Who picks |
|---|---|---|
| Search | all six, Eye first | Eye: nobody is asked. Another: the player proposes it on a card to you |
| Work on a project, Sabotage | the project's one statistic | nobody is asked; a project stored without one gets the player's proposal once, and your answer stays its statistic |
| Dynamic Action | any | you set the band and the statistic; the card names the one the player proposed |
| Crisis actions (13.2) | one to three, as that table says | the player proposes, you rule on a card |
| Opening rolls (13.1) | killer: Body, Hand; a trap's victim: Eye, Head | a trap victim's: you pick; a killer's: the killer proposes, you rule (13.1) |
| Clean-up in Stage 6 (13.3) | Shadow; Move the Body: Body | nobody is asked |
| Taking from a body (section 10) | Hand, with Shadow 16 as the cover | nobody is asked |
| Observe, Analyze, Listen, Tamper, Palm | one each; Palm's is Hand, with Shadow as its cover | nobody is asked |
| Any roll that lists several, with Resolve armed | any | the player, in the roll window; nobody is asked |

**Approving on its own.** With the world setting **Players' statistics without approval** on (it is off by default), a player's proposal for a Search on a statistic other than Eye, or for a project stored without a statistic, is approved without your press while the clock is in Daily Life, no Eclipse is running and no incident is open: the card in their thread says *Approved automatically.* and the roll goes on as after your press, and when you roll for a character yourself no window opens. It never reaches a crisis action, a clean-up, an opening or a Dynamic Action, and Resolve asks nobody to begin with. Off, every proposal waits for you.

**Dynamic Actions.** The player's description reaches you as a card in their messenger thread with **Set the difficulty** and **Refuse**. You pick the band and the statistic (the card names the one the player proposed, if they did); a refusal costs the player nothing. A roll passes a band when it reaches the band's number (13 passes "beat 13"): both windows say "beat N", and the roll's card says "needed N". A success leaves a Faint Prep Remnant of the band's visibility and hands you a card with a button that opens the item tables at the band's tier, with the room and the player's words filled in; nothing is given until you give it. A Reroll that turns a miss into a success brings the same card.

| Band | Beat | Tier | Remnant |
|---|---|---|---|
| Trivial. Anyone could do it | 8 | 0 | Obvious |
| Takes practice | 13 | 1 | Evident |
| Foreign to most people | 16 | 2 | Subtle |
| Demands very niche expertise | 19 | 3 | Hidden |

An easy feat leaves a plain Remnant and a hard one a faint Remnant. A Search runs the other way: its better find leaves the plainer Remnant.

**A Dynamic Action never stands in for looting.** A player who wants to find or take something in a room is sent to Search, which spends one of the room's Search Tokens and draws from its tables: refuse the card and say so.

**Rest.** A **Long Rest** costs **2 actions**, picks 2 of the three options and can be taken **once per session**; a **Short Rest** costs **1 action**, picks 1, **once per time of day**. Each works only in a room flagged for it (**Room setup** > **Facilities**); the rules put the Long Rest in the bedrooms, so flag those. Both are counted within the chapter: a new chapter starts them afresh, even on the same day, time of day and session.

| Option | Long Rest | Short Rest |
|---|---|---|
| Sleep | restores all Health | restores half |
| Meal | restores all Sanity | restores half |
| Breath | grants 2 Hope | grants 1 |

**Sabotage** breaks a project by its result:

| Result | Breaks the project so it needs | Remnant |
|---|---|---|
| 12 | a simple repair, 2 progress | Subtle |
| 18 | a complex repair, 6 progress | Evident |
| Critical | a hidden-difficulty repair, 8 progress | Obvious |
| Failure | - | still leaves a Hidden Remnant |

With somebody else in the room the saboteur also rolls Shadow against **16** to cover what they are doing. On Despair they fumble and the sabotage is 1 harder, and a Despair result with witnesses is told to the players of the students in the room and to the GMs. A sabotaged project is frozen until its repair project is finished.

> [!NOTE]
> A GM's browser applies the damage. If no GM confirms in time, the roll has succeeded but the project may not be broken, and the player is told to tell you.

**Critical rolls** grant **2 Hope**. A roll with Despair that used the item in the character's hand takes one point of its durability, and a Tier 0 item is spent by any roll that used it, a critical included (section 10).

**The character sheet's reserve.** Daggerheart stores Health and Sanity as what has gone; the module shows them everywhere as what is **left**. The sheet's two bars are full for an untouched student and shorten as they are hurt, each with a row under its title (**3 / 4**: what is left, then the most there can be), and the pips are the module's own, drawn the same whether Daggerheart's pips are on or off. The Event panel, the tracker, the token bars and the Party sheet show the same. You type the reserve in a field on the sheet, and the module writes what has gone. A player who owns the student has the field only while **Lock players' resources on the sheet** is off (section 6.3). A student's two token bars are the reserve too and cannot be edited there: the token HUD's two inputs are disabled for everybody, a GM included, so type it on the sheet. A Monokuma's and an NPC's token reads as a student's (*Who reads what*, below); any actor that is not a character keeps Foundry's bars. The Party sheet's rows are the reserve, with the toggles off for players.

**Who reads what.** Sanity is private: on the sheet, the token bars, the Party sheet, the Event panel and the tracker, a player who does not own the student, an Observer included, reads their Health and no Sanity (a **?** in the sheet's row); the owner and the GMs read both. A Monokuma's and an NPC's (Not in the class) token reads the same way: its bars show what is left, its Sanity bar only to its owner and the GMs, and its HUD bar inputs are off, so edit it on the sheet; their rows on the Party sheet read the same.

**Breakdown and Wounded are public on the sheet.** Whoever opens a character's sheet (the owner, a GM, another player, an Observer) reads a badge for each state the character is in under the reserves, with its name and a tooltip saying what it does, the way they read the name and Health, for a student, a Monokuma and an NPC alike. Only the state is public: another player still reads a **?** for Sanity, but a Breakdown badge tells them that Sanity is gone. Neither state's icon is drawn on any token, for anybody; the dead overlay still is, and the token HUD's status palette still lists both statuses. A roll's card never names Breakdown: a roll made in Breakdown shows its extra die as Disadvantage to every reader, and only the roller's own roll window, the crisis briefing, the price preview and the GMs' audit say Breakdown. All of this is what the screens draw: every browser still receives the student's data, the Breakdown status and a roll's data, and a console reads them (section 1.6, "What every browser holds anyway").

**The state icons.** Breakdown, Wounded and the dead overlay are the module's own pixel art, 16x16 like its item icons: the dead overlay on a token, Breakdown and Wounded on the sheet's state badges only. A GM who chose their own dead icon in Daggerheart's Automation setting keeps it (technical notes: section 22.5).

**The sheet's other parts.** The biography is a field labeled **Background**, saved when focus leaves it, on a tab change and when the sheet closes; it is read-only for a viewer who may not edit the sheet, and a redraw while somebody types keeps their text and place. When somebody else writes it while you type, your next save writes nothing and says so once (*Someone else changed this Background meanwhile...*): your text stays in the field, and leaving the field again writes it over theirs. A Monokuma's sheet has no Inventory tab (nor Biography, Equipped or Experience): what the character held stays in its data, nothing is deleted or moved, and unmarking brings the tab and the items back. If a part of the sheet fails to draw, the rest still draws and the primary GM gets one notice naming it (*Parts of the character sheet failed to draw: ...*).

**One gate, five sheets.** What a sheet shows depends on whose it is and who is looking. A **student**'s sheet shows its owner and the GMs the action grid and, on the items, Use, Discard, Give or Share, Stash, Present and Analyze. A **dead** student's shows a **Dead** stamp, a line on what the dead still do, the dead's panel and a header that still shows Hope, Actions and Move but marks no Hope change, and none of those item buttons. A **Monocub**'s shows its own panel, with Confusion among its tiles and none of those item buttons, and it plays on. A character **Not in the class** has no action panel, Level Up or Calls for its owner, and the GMs read a line saying why in the panel's place. **Monokuma**'s sheet is the Despair Calls, with none of a student's parts: no Equipped or Experience heading, no Background, and an inventory group only for what Monokuma holds. Anybody else (another player, an Observer) gets none of the controls on any of the five, and with **Keep character sheets anonymous** on reads a redacted sheet: Health stays, while Sanity, Hope, the statistics and the actions read **?**.

**A sheet that does not blink.** A hit, a heal or a Hope spent or given updates every open copy of the sheet in place, so a field someone is typing in keeps its place (technical notes: section 22.5).

---

## 6. Hope Calls and Despair Calls

### 6.1 Hope Calls

A player spends Hope Calls from the character sheet, and each is whispered to them. They are locked during an Eclipse, under a *Silence* darkening, for a player hit by the *Silence* Despair Call, and for the dead; they stay open in an incident and in a Class Trial. A Call that changes a roll (Support, Talent's Experience or Ultimate, Resolve, Loaded Die) is bought through the primary GM, who takes the Hope and arms it: with no GM connected it cannot be bought, and nothing is paid. Talent's two Calls need your ruling.

| Call | Cost | Effect | Needs your ruling |
|---|---|---|---|
| Support | 1 | Give another student in the same room advantage on their next roll; the card names who spent it. A student who already holds an unused Support cannot get another, and the spender keeps their Hope | no |
| Talent | 1 | One tile, two Calls: the player picks Experience (add an experience to a roll it genuinely applies to) or Ultimate (advantage on a roll the Ultimate genuinely applies to); each keeps its own rules | yes |
| Contribution | 2 | +1 progress to a project being worked on in the student's room; on a murder plan it also rolls to Hide the Traces, like working on it | no |
| Sprint | 2 | One more room crossing this time of day, free | no |
| Reroll | 3 | Reroll the action; the previous outcome is reverted (*Reroll*, below) | no |
| Resolve | 2 | For one roll, the player chooses any statistic in the roll window, wherever the action lists several; nobody is asked, and it is spent on the roll it is armed for | no |
| Burst | 4 | The next action costs nothing, however much it would have cost | no |
| Relief | 4 | Take a Short Rest now: no action, no rest room, and it does not use up this time of day's; Breath is grayed in it and refused, as it would give back less Hope than Relief costs | no |
| Loaded Die | 6 | On the next roll one of the two dice, at random, is set to 12 and the other is thrown; a critical only if that die is 12 too, and a roll whose Despair die was set comes out with Despair. If the die does not work (some dice settings ignore it), the player gets the Call back for the next roll | no |
| Bribe | 1 | Offer a Monocub 1 Hope for a favor, paid only if its player accepts; nobody else knows (section 8) | no |

**Reroll.** A Reroll settles what a fresh roll of those dice would: Hope, Fear (Daggerheart's own GM resource; *Replace the Daggerheart Fear tracker*, section 1.3, hides its bar) and a critical's second Hope only with Daggerheart's Hope and Fear automation on for players, and Despair only with **Rolls grant Despair** on. A crisis action that killed somebody cannot be rerolled: the death stands. Close the breach, Repair an item and a Secret Passage are kept for the Reroll of the roll that finished them. A Remnant you have written on, one somebody has already found (for a Reroll that would remove it) and one older than a Reroll can reach stay as they are, and you are told which, to settle by hand. A Reroll of a roll a GM's browser drew throws it again as it was counted, with the same dice. With no GM connected no Reroll is made, and a second Reroll of a character is refused while one is being made.

After a reload the Reroll window still names the roll it takes back: on your screen the roll the GMs' row holds for that character, with its action and its dice; on a player's, their last roll in the chat, with a line saying that the GMs' row decides which roll a Reroll takes back. A Reroll that turns a Dynamic success into a miss grays that success's card for the GMs, with the line *A Reroll turned this roll into a miss*, beside the miss's card. When a GM had already answered the success's card, the card is left as it was and the GMs are told, with the player's words: what was given on it stands until you take it back.

**A Reroll cut short by a reload** of the browser making it is put right when the primary GM's world loads. Cut before the new dice counted, the first roll and the Hope come back, and the player and you are told. Cut while the action was being made again, you get a card with the character, the action and both totals: check by hand what the action left (progress, items, Remnants, damage, a turn) and settle it; the Hope stays paid, and that roll cannot be rerolled again. Cut while its Hope was being paid or given back, the first roll stands, and you are told to check that character's Hope by hand.

**Approving Experience and Ultimate.** The player must write what they mean to do with the Call; an empty box cancels, because the ruling is about that sentence. The request lands as a card in the player's messenger thread, seen by the player and every GM, with **It applies** and **Not this time**, and any GM may answer. Only a yes arms the Call, and nothing is charged until then: a refusal or a silence costs the player nothing, and the card says until when it is open (**five minutes**). If your browser reloads with the question open, the player's browser asks again when you reconnect and the question keeps its card; a card whose primary GM has left takes a yes again once the player's browser has asked the new primary (section 6.3). Once answered, the card becomes a receipt in the thread.

> [!TIP]
> The question to ask: does the experience or the talent *genuinely* apply here?

### 6.2 Despair Calls

A GM spends Despair Calls from a Monokuma's sheet, out of the pool that Monokuma draws on, and each but the Bounty (the table's last row) is announced to the whole table. The card names no secret project and no Chained student's room: Game Integrity or Patronage on a secret project tells the table only that a project's progress changes, while you and those in on the project get its name and progress on a card of your own, and the Chained student's own notice names the room. Despair Calls are locked during an Eclipse and during a Class Trial. A Call that would change nothing is refused before it is paid, and if the effect fails the Despair is refunded.

| Call | Cost | Effect |
|---|---|---|
| Obstacle | 1 | Disadvantage on a player's roll |
| Approval | 1 | Advantage on a player's roll |
| Fuel a Monocub | 1 | 1 Despair becomes 1 Hope for a Monocub, so they can use Confusion |
| Feed the Overflow | 1 | Pour 1 Despair into the Overflow |
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
| Bounty | 1 | Chosen in the Fuel a Monocub tile, which asks Fuel or Bounty; it has no tile of its own. The one Call that is not public: the Monocubs and the GMs are told, nobody else. One Hope goes into the purse of the first Monocub whose Confusion hinders the named student and lands. The Despair is owed from now and taken at the next time of day; the GMs' card says so, and a GM's Despair bar draws it as owed. An unclaimed Bounty lapses then and its Despair goes back to the pool: the debt is dropped, or paid back if the pool had paid it, and the GMs' card says which; the Monocubs are told it lapsed |

Obstacle, Approval, Support and a Monocub's Confusion are all armed on the target's next roll; the roll window applies them, and one armed after the target's window opened waits for their next roll (the window says so). A hindering Call (a disadvantage or a negative bonus) counts on the roll if the roll window names it or it was armed more than a minute before the roll; otherwise it waits for the next roll. The bonus a Call arms (a Confusion's help) is written into the window's bonus field, read-only, and travels with the roll; a Call taken back while the window is open leaves the field empty.

Seals, Chained and Silence are cleared when the next Eclipse opens, or by the next time-of-day change when no Eclipse is used. A Public Announcement is deferred: the assembly runs on the next boundary, and a rewind cancels it.

A **Motive** asks for the demand, a deadline of **1 to 10** times of day (default **3**) and the consequence. It is announced to everyone, ticks down on every time-of-day change (an Eclipse does not count), is announced once more when it comes due, and stays on the board at zero until you withdraw it or the chapter turns. **Killing game rules**, a tile of **Season setup**, shows the motive in force, its time left and its price, with **Withdraw**, which takes it down and tells everyone.

A **New Rule** goes into the killing game rules list, which every character sheet shows; edit the wording, withdraw or add rules in **Killing game rules**. Its **Announce changes** box is ticked by default: a save posts one card to everyone, *The killing game's rules have changed*, listing the rules introduced and those revoked (a rule revoked and introduced again in one save is listed once, as introduced; a rewording alone posts nothing). A rule is revoked by its box: a rule you empty keeps its wording, and you are told which. A save that could not be written says so and announces nothing.

### 6.3 Rulings, cards and the messenger

Every action that needs a human (Analyze hints, Dynamic Actions, Direct Murder declarations, project proposals, reshaped Remnants, trap alerts, the Calls above) arrives as a **card in the messenger**. The messenger is one shared thread per player: the player and every GM read and write into the same conversation. Open a thread from the launcher at the bottom right (a roster with unread badges) or by right-clicking a player in Foundry's Players list; the roster closes on a click outside it or on a row, and pressing the launcher again opens no second one.

Each GM keeps their own read marks. A thread counts as read only while its window is in front, on its Chat tab, with the page visible: a message that arrives while the window is behind another, on the Note tab or in a hidden tab raises its card and stays unread until you look. A card the module posts in a player's thread from your own session counts as unread for you too, until you read it or rule on it. A message deleted from the chat log leaves every open thread window.

A card shows the roll, the player's own words, and a GM-only block with the thresholds. Only a GM can press its buttons. Once a button is pressed the card is rewritten into a receipt in the thread, so nobody rules twice; you can still answer in words below it. A ruling with no player owner (a Monokuma actor, a trap alert) goes to the GM whisper log instead, with the same buttons. With no GM connected a player's question is not posted at all: the player reads *No GM is connected.* and gets back what it cost.

**One ruling per card.** A press by a GM who is not the primary goes to the primary GM, who takes the card once: a second GM pressing the same card is told *{gm} already ruled on this card.*, or that the other GM is ruling on it right now, and a card its author reopened is not ruled again.

**A question the player waits on** (an Experience or Ultimate Call, a Dynamic Action, the statistic of a roll that lists several, an Observe aimed at a point of interest) says on its card until when it is open (*Open until 21:40.*): five minutes for a Call, three for the others. Each reader sees that time, and the line the card ends with, in their own time zone and language. Your yes or your difficulty goes through the primary GM, and the card reads it as given only once the player's browser says it has it. If the player stopped waiting, no word came back within eight seconds of the ruling, or the card's time passed, the card ends *Nobody answered in time. You can ask again.* for everyone and *The player was no longer waiting.* for the GMs, and a Call's yes is taken back: nothing is charged.

A ruling the player has used is not taken back: a yes their Call was armed on, or a difficulty a Dynamic roll was thrown on, ends the card as ruled (*Approved by ...*), whatever the player's browser says after. A difficulty with no word back and no roll ends *Answered by ... - not confirmed as received.*: it stands as your record, so the player is not told to ask again; so does a ruling a reloaded primary GM finds only on the card. A primary GM whose world loads ends the open cards past their time. If the primary GM reloads, or another GM becomes primary, while a question is open, the player's browser asks again, three times at most, and the question keeps its one card.

**A private card a player missed.** A private card's words go only to the browsers connected when it is sent. A reader who was away, or opens the game in a new browser, asks the connected GMs for them when the world loads or a GM comes back; each GM answers from what their own browser holds, to that card's readers alone and without the GMs' block, and a line written for that player alone (*You lose 1 Health.*) comes back as it was written for them. A card whose words no GM holds reads *A private card. Its words did not reach this browser.* instead of a bare dash.

**The primary GM.** Two GMs are normal. One of them is the **primary GM**: the connected full Gamemaster with the lowest user id, or an Assistant GM only when no full Gamemaster is connected. The primary GM writes world state: Despair awards, Search Tokens, discovery, incident results, and every change of the Despair pools and the Overflow, which another GM's controls ask the primary to make. Only the primary sweeps away the pools of deleted accounts. If something "does nothing", check that a primary GM is connected.

**Rolls made while no GM was connected.** With no GM connected a player's action is refused before it is paid for. Any other roll (a statistic from the sheet, a reaction, Daggerheart's own item rolls) is thrown in the player's browser, marked on its card *Thrown with no GM connected - the GM will see it.*, and moves no Hope, Sanity or Despair. When a GM connects, the primary GM gets one card, **Rolls made while no GM was connected**: each such roll's character, its Hope and Despair dice as the player's browser threw them, and what it would have moved; a reaction moves nothing, and a statistic from the sheet is thrown as a reaction, so it moves nothing even when granted. **Grant all** gives each roll what it would have moved (Hope, Daggerheart's Fear, the Monokuma's Despair) once; **Grant none** gives nothing. Either way each roll is marked decided and becomes the GM's message, so it is not asked again. The card asks because its dice are the player's browser's word. Beside each roll it also says what the roll claimed (its modifier and its advantage dice) and what your browser's list would have given it, for your reading only; a grant moves what the dice moved.

**What a player writes on their own sheet.** Hope, Health, Sanity, actions and statistics move through play (a roll, a Rest, an item, a Call, a Level Up), and the primary GM's browser checks every change a player's browser makes on their own student, its module items and the effects on either, against what the GMs hold. A change something covers stands: a payment your browser saw given back, a Rest in a room that allows it, an item used and spent, a Call's price, a Search's find within the tier its roll earned. What nothing covers goes one of three ways:

- **Put back** at once. The player is told the GM's client put it back, and the GMs get one whisper naming who, which student, and each field before and after. This covers:
  - a Hope gain, by the amount nothing covers, so Hope forged and spent at once still costs real Hope;
  - a statistic, an experience or a maximum (a class's hit points among them);
  - Daggerheart's roll rules, bonuses and Level Up choices;
  - the module's own records, a Call armed by hand, and a hindering Call or one a GM armed taken off with no roll of the player's about that student after it was armed;
  - a module item's tier, category, roles or kind of usable changed, its wear lowered, its breakage mended or its count raised;
  - a move into or out of a stash the room does not allow;
  - an effect that changes any of these or a resource, on the student or on one of its items (an item added carrying one is deleted).
- **Flagged**: a gain in Health, Sanity or actions, in the Burst and Sprint grants or the free Move given back, or a module item taken off or added to the sheet. It stands, the player is told nothing, and the GMs get one card with **Undo** and **Keep**. Any GM may click; the primary GM's browser decides once. Undo writes a field back only while it still holds what the change left (a field that moved since is not written over, and the card says so), makes a deleted item again, or deletes an added one. A card can be decided for a day.
- **Listed**: anything else, on a list you read from the console (section 20.3). The list also holds what section 1.6 names, a refused request, a forged message and a change put back, each with what it was; the same refused or forged one from the same player again within half a minute counts on its row instead of adding one. A Hope gain Daggerheart's relay credits for a player's own roll your browser did not draw stands on its own row, naming that roll's message.

When a card asks you about a player's sheet change, **Undo** it unless you allowed it. Your own changes are never judged: they are what the GMs hold from then on, which is how you set by hand a move the module does not know.

**Changes made while no GM was online.** A change made while no GM is connected is judged when the primary GM's world loads: what would have been put back is put back at once, and every other difference (a gain in Hope, Health, Sanity or actions, a Rest, an item taken off or added) goes on one card, **Changes made while no GM was online**, a row per student and field with its value before and after, **Undo** and **Keep** on each and **Undo all** and **Keep all** for the lot. A Rest or an item used while no GM was connected is on that card too.

The setting **Lock players' resources on the sheet** governs all of this for the fields it names. On (the default), it works as above, the reserve's field on the character sheet is not drawn for players, and on a character's token a token HUD bar input that is not a student's Health or Sanity (Hope, say) is disabled for players. Whatever the setting, the Party sheet's pips are display-only for players, and a student's Health and Sanity inputs in the token HUD stay disabled for everybody (section 5, *The character sheet's reserve*). Off, the reserve's field is drawn for a player who owns the student, the token HUD's other bar inputs are theirs to type, and a player's change to those fields is not put back or flagged: a statistic, a maximum the setting names, or a gain in Hope, Health, Sanity or actions (a heal typed in the reserve among them) is listed and stands, and a fall in Hope, Health, Sanity or actions stands with no row. Items, effects and the module's records are judged either way.

---

## 7. Despair pools, assignments and overflow

**Earning.** When a student's roll lands with the Despair die higher, **+1 Despair** goes to the pool of the Monokuma assigned to *that student*, while the setting **Rolls grant Despair** is on. Reaction rolls (a bare statistic click) and a Monokuma's own rolls pay nothing. A student set to **- nobody -** feeds no pool: use it for a retired or NPC-run character, or for a template. Do not set the Mastermind to **- nobody -**: every player's browser can read the division, and the one student left out would stand out. The Season checklist warns you when the Mastermind feeds no pool (section 2).

**Pools.** Every full Gamemaster account holds a Despair pool of at most **12**, and the Monokuma characters spend from them. The Despair bar at the top of the screen shows every pool, a single one too, under its name: the name set in Despair Flow, otherwise the account name. Everyone sees the counts, and GMs also get the steppers.

**Despair Flow** (GM panel > Between sessions > Season setup) is the one window for the GM team. Its four tabs:

- **Pools**: the pools' names, and extra pools: **Add pool** grants one to an Assistant GM, **Remove pool** takes it back.
- **Monokumas**: which GM's pool each Monokuma draws on. Who is a Monokuma is set in the Students window's **Role** column (the column: section 3; marking a Monokuma: section 8).
- **Students**: which Monokuma watches which student, with **Split evenly** and **- nobody -**. A student never assigned feeds the first pool, and its select says *(fallback)*. **Save** writes only the rows you changed or set before, so a fallback stays one.
- **Overflow**: the Overflow's threshold and effects (below).

The guide (the game's own rulebook, which the module follows) is shaped for at least two GMs who divide the students strictly between them, but the module works with one. With one GM and no Assistant GM to grant a pool to there is nothing to choose, so the window opens on **Overflow** and folds the other three tabs behind **Show pools, Monokumas and students**.

**Converting Despair into Hope** (1:1) is a GM ruling, never a self-service button. It is how a Monocub is fueled and how a Mastermind stays afloat. There are two roads, and both credit the Hope the same way, with a private card to the receiver that names the paying pool:

- **The quiet road**: the Students window or the Mastermind window, also in a Class Trial. A request above what the pool can spend, or above the room left under the receiver's Hope maximum, gives what fits. Only a pool with nothing to spend, or a receiver whose Hope is full, refuses.
- **Fuel a Monocub** (section 6): the public road, a Despair Call paid at once with its own card. It is not available in a Class Trial.

**What a pool owes.** The receiver's Hope arrives at once, but the donor pool pays only at the next time of day, when the other pools may have moved too, and with a private card, so the table cannot pair the Hope with the drop. Until the time of day changes the pool shows more than it can spend: every Call, conversion and picker counts only what it can spend, and the pickers show what it owes ("Kuma (5, 2 owed)": 5 it can spend, 2 it owes).

Only a GM's screen shows the debt on the pool too. The owed skulls on the Despair bar are drawn dimmer, the count's tooltip says *2 owed, paid at the next time of day*, the **Despair** window adds *(2 owed)*, and the GM who gives (from the Students window, the Mastermind window or a Monocub's Ask for Hope) is told *2 Despair owed from Kuma. The pool pays at the next time of day; only GMs see it owed.* A player's screen shows the pool unchanged until it pays.

Despair that will not fit in a full pool pays what the pool owes before it spills into the Overflow, and filling or emptying the pools clears what they owe. Each conversion is owed on its own, so two GMs converting from one pool at once both count. A pool pays once, also when one GM's browser was away as it paid. A conversion made on another GM's screen in the very moment the time of day changes can go unpaid.

**The Overflow.** Despair earned past a full pool collects in one counter shared by every Monokuma, and **Feed the Overflow** (section 6) pours Despair in on purpose. At the **threshold** the counter pays the threshold, keeps the rest, and draws **one** effect at random from those you have ticked. It fires the moment the counter reaches the threshold, and the card comes at once: a state (a darkening) covers the coming time of day, and a one-off happens at once. If a darkening is already running, the counter waits for the next boundary. The counter is checked again when an Eclipse opens and at every change of the time of day, and one boundary pays only once.

**The threshold** is 20 by default, and you can set it from 6 to 60. The Season checklist's overflow row (section 2) and the Overflow tab suggest one for your season, 12 plus half the living students; the threshold stays yours. Saving a changed threshold or effect list tells the table the new threshold. A field you empty changes nothing, and an effect's size is held to 0-5.

On Despair Flow's **Overflow** tab the threshold stands above two tables of the effects, the states and then the one-offs, in the order of the table below, a row each: **On** (the tick), **Effect**, **How much** (the size, where an effect has one) and **What it does**. The numbers below are the default sizes.

| Effect | Kind | What it does |
|---|---|---|
| Darkness | state | 1 fewer crossing in the Eclipse (floor 1); a free-placement Eclipse is pulled back to 2 rooms |
| Shift | state | 1 fewer Search Token in every room (floor 1, never more than the rooms are set to: a world set to 0 stays at 0) |
| Panic | state | 1 fewer action each, on top of what Wounded takes (floor 1) |
| Despair | state | No Hope is earned; spending what you hold still works |
| Silence | state | No Hope Calls, by anybody |
| Fog | state | No Free Move; crossings still cost actions |
| Lockdown | state | No room actions in the Facilities tile; the rests still work |
| Insomnia | state | No Short Rest; the Long Rest still works |
| Toll | state | Every room action costs 1 more action (the size), also a project's that costs none |
| Jitters | state | The rolls of the room's own actions, the ones you set in Room setup, are at disadvantage |
| Power cut | state | No actions from completed projects; the room's own actions still work |
| Rot | one-off | Every item with more than one point of durability left loses 1, never its last point; nothing breaks |
| Earthquake | one-off | Every project not yet finished and not frozen loses 1 progress |

> [!TIP]
> Untick all thirteen and the counter climbs and never fires: a real setting, the counter as atmosphere. The five room-action states (Lockdown to Power cut) start ticked, in the draw like the rest. The draw is even: with all thirteen ticked, each effect comes up 1 time in 13. Untick the five room-action states to keep the draw to the other eight.

**A trial verdict empties the Overflow**, whatever the verdict, and so does the season reset. A darkening announced during the Class Trial still comes: its card says from the next time of day, the verdict keeps it waiting, and the next time of day, or the Eclipse that opens it, brings it with nothing paid again and no second card. The season reset clears that darkening as well.

Players see the pools' counts and the Overflow's threshold, but a "?" in place of its count ("?/20"): when the Overflow fires stays Monokuma's to know. Only the GMs hold the count, and Despair Flow shows it to you (technical notes: section 22).

**Clearing it yourself.** **Clear the overflow**, under the count on the Overflow tab, asks first (**Cancel** is the default), then sets the spilled Despair back to 0, whichever GM presses it. A darkening already drawn stays until its time of day ends.

---

## 8. Monokuma, Monocubs and the Mastermind

**Monokuma** is a character you make for it and mark as one in the Students window's **Role** column, or with **Mark as Monokuma** on the character's sheet header: a GM's control beside **Not in the class**, which shows the state it changes (**Unmark as Monokuma** on a Monokuma). Marking a player's character asks first, with **Cancel** the default: their Hope and actions go to 0, and unmarking does not give them back. Unmarking does not ask. A Monokuma:

- has no action economy and no Hope;
- has the Despair Calls in place of the action grid;
- moves without limits: no room costs, no walls, no Eclipse limit, no seals;
- is never hidden from themselves by room visibility;
- has their rolls whispered to the GMs only, and those rolls feed no pool;
- does not count as a witness to an incident or a body.

The guide has the GMs walking the map as two Monokumas the table can tell apart. Point each at one GM's pool (Despair Flow's **Monokumas** tab, section 7); per-room voice follows the same mapping.

**Not in the class** is a GM's control on a character's sheet header, for an NPC. With it set the character leaves the ballots, Level Ups, the murder's cast, the GM panel, the census and the Calls: no Support, Obstacle or Approval offers them as a target, and a Support aimed at them from a player's console is refused. Their sheet shows no action panel, Level Up or Calls and says why (*Not in the class: no actions, ballots, or Level Ups.*). Press it again to make them a student. A player's own write of this mark is put back, as a Monokuma's is. The Season checklist names each character no player owns, in the row *Characters no player plays are marked* (*A character no player owns is probably an NPC: mark it Not in the class on its sheet, or leave it as it is.*).

**Spectator** is a player who watches and does not play: set it in **Students**, Role **Spectator**. A Spectator takes no actions and counts in no vote, trial, incident or room. Other players do not see its token; you see it faint. It moves by dragging its token, at no cost. Its microphone is off: **Talk with the Spectators** on its voice tile puts it in the Spectators' own voice channel, and **Go back to your room** brings it back. With **Voice tile instead of the camera dock** off, there is no such button. It has no chat, though a player with the browser console can still read the public messages.

A Spectator sees every room the class has found, every token, and every project's name, progress and description in every room, secret ones too, but nothing else secret: never your half of a secret project. At the day's end it sees only the end of the day and the school's mood. Made a student again, it keeps the rooms it found itself and loses the secret projects it was shown before it watched.

**The dead as Spectators.** When a student dies and is no Monocub, the module gives their player a Spectator of their own: a new character with the student's name, portrait and token picture, owned by that player alone, with a token where the body lies. The body's token stays the corpse. The player drags the Spectator anywhere, free; other players do not see it, and you see it faint. The dead still see only what a dead student sees: walking the Spectator into a room shows them nothing there. How the dead talk: section 9.5.

A student whose player is offline at the death is still that player's and gets a Spectator. A student no player owns at the moment of death is an NPC and gets none (an NPC's Spectator from an older world: section 22).

The Spectator is made at the death, a death you keep secret too. The new character and its token are world data, so a player with the browser console can learn of a secret death from them before the body is found.

On a death in play (a murder, or the row's **A character dies**) the dead student's screen fades and the **Death fade** sound plays for them alone (Sound, Incident; with no file it plays the death's sound). The death's own sound, which the GMs and the incident's other players hear, leaves them out, so they hear one sound. An execution does not fade: everybody hears the execution's sound, then the trial's end. A change in the Students window's dropdown, Edit campaign or the season reset makes or takes the Spectator with no fade.

A revive takes the Spectator away. If two GMs make the same student's Spectator at once, the primary GM keeps one and removes the other. When the student becomes a Monocub, the Spectator's token stays where it stands and becomes the Monocub's own token, the Spectator character goes, and the body's token stays. A Monocub no more, still dead, gets a Spectator back on that token.

**The body on the map.** When a student dies and the death is the table's (at once, or when a death the GMs kept is found or made known by your hand), the module leaves their body where their token lies at that moment, as a tile. So a death shows two things on the map: the student's own token, the body, with the dead marker and "{name}'s body" over it, and their Spectator. The tile is fully transparent, and it is where the module reads the body. It is hidden if the token is, and on the Tiles layer you can still select it and delete it. A death you keep leaves no tile until it is made known, so no screen learns of it early.

While the student lies dead the tile goes where their token goes: your drag, or the killer's Move the Body. Once they become a Monocub the token walks away and the tile stays. The body is searched from the tile's room; delete the tile and it is searched from the token's room again, and nothing lays the tile again. Every body tile goes when a Class Trial ends, the executed's too (laid by the sentence and taken away in the same click), and a student's tile goes when they are revived or the season is reset. A student whose token cannot be read on a scene with rooms leaves no tile, and you are told, except for a death in the Class Trial. A body whose token you take to another scene leaves its tile where it lay.

**Monocub.** A dead student's player may join the GMs once their death is known to the table: the timing is yours, and the module only insists the death is public. **Invite as a Monocub** in **Students** sends an invitation. The player's window shows the Monocub Rule (*You never tell the living what only the dead know: who killed you, how, or what you see from now on.*) and its three steps if it is broken (a talk, the role taken away, out of the game). **I accept the Rule** makes them a Monocub, **Not now** closes it and you are told, and you can **Withdraw** an open invitation. Nothing else makes a Monocub.

A Monocub starts clean: 0 Hope, all their Health and Sanity left, no Wounded or Breakdown, whatever the body carried. Wounded never costs a Monocub an action. They keep the same sheet. Their token moves free: it crosses to a connected room for no action and no Free Move, in an Eclipse too, with no Move tile, and the two feet in the sheet's header and on their status strip stay solid. The room of a running murder is refused to them with the Seal's words.

Their panel offers these tiles and nothing else. A tile that cannot be used says why, and none but Ghost Bet works in an Eclipse or a Class Trial.

- **Confusion** (**1 action + 1 Hope**): a flat 2d12 roll with no statistic, **Help** or **Hinder**, that nudges a living student in the same room (the table below).
- **Tinker** (**1 action + 1 Hope**): Confusion aimed at a public, unfinished project in the Monocub's room that a living student worked on this time of day. 12 or more moves it one step forward or back, never to finished, and a critical gives the Hope back. No secret project is ever listed or reached.
- **Redeem** (free): +1 Hope, once a game day, not at full Hope or while the darkening blocks Hope.
- **Ask for Hope** (free, not at full Hope): a card in their thread, **Give 1 Hope**, **Give 2 Hope** or **Not now**, ruled once by whichever GM clicks and paid from that GM's Despair (section 7). One is open at a time; one left unanswered stops holding up the next when its time of day ends.
- **Ghost Bet** (free; below).

A Monocub sees every room the class has found, without who found it, and not the Mastermind's. A student can be the target of one Confusion per time of day and two per game day, counted over every Monocub, a failed one too. What a Monocub carried is its body's: the sheet offers no Use, no Discard and no open stash, and the body is searched like any other.

A move is checked before it is paid: a refused move is told to the Monocub and costs nothing (technical notes: section 22). The target's card never says who did it, but the room saw the Monocub roll, and the Confusion window tells the player so. The window lists the totals, and the result card says what was needed:

| Confusion | Grants (Help) | Inflicts (Hinder) |
|---|---|---|
| 11 or more | +1 on the target's next roll | -1 on the target's next roll |
| 16 or more | advantage | disadvantage |
| Critical (a double) | gives the target the action back | wastes the action |

A critical with nothing to move (a target with every action left, or none left to lose) says so on both cards.

**Hope and the purse.** A Monocub's Hope comes from a GM converting Despair (Fuel a Monocub, or the Students window), from Redeem and from Ask for Hope. A Bribe, a Bounty and a Ghost Bet pay into its **purse** instead: kept by the GMs beside the sheet, counted with it toward the Hope limit, spent first, and shown in the Students window's Hope column.

A **Bribe** is a living student's Hope Call: 1 Hope offered to a Monocub, paid into its purse only on its player's yes, lapsing at the next time of day, its cards to the two players alone. You are whispered a warning when one comes from this chapter's Blackened, and at a pair's third Bribe this chapter. An accepted Bribe makes the Monocub's next Confusion or Tinker this time of day a move to order, which costs only its action.

A **Ghost Bet** names the student the verdict will sentence, one bet at a time, for 4, 3, 2 or 1 Hope by when it is placed: before the body is announced, after it, in the trial before the vote, or while the vote is open. The verdict's step *Ghost Bets* pays a right verdict on that student into the purse and clears every bet. It is not for a Monocub whose own case is open, or for a crime witness.

After a wrong verdict, a Monocub of the case's death and each crime witness of the chapter get a veiled card that names nobody: until the next trial, no moves for or against the one who did it, their projects, Bribes or Ghost Bets. Your summary lists who was told.

The **Crime witness** box, on a Monocub's row of the Students window (the column's tooltip says the rule), is the guide's rule for a Monocub who saw the crime: they may act but not talk about the crime until the chapter ends. The player is told when it is set and when it is lifted. The module ticks it itself for a Monocub standing in the murder's room when the incident opens, or walking in while it runs, a trap's included; tick it by hand for a Monocub who saw the crime some other way. The GMs keep it, and only the Monocub's player is sent it.

A Monocub's dice, Confusion's included, are shown to everyone in their room; whom a Confusion was aimed at is not. Only a critical, which moves the target's actions, shows in data every browser holds.

**The Mastermind** is chosen before the season with the player's consent, from **Season setup > The Mastermind** (Between sessions). Only the GMs know who it is: the identity never touches an actor or the world, and the Mastermind's own player receives only a private "you are it" and the room of their lair.

> [!CAUTION]
> The window names the Mastermind, so do not share your screen while it is open.

Their **lair** is a room. While they stand in it they see every token on the map, as you do; when they step out it is gone. Locked doors, seals, other people's bedrooms and hidden stashes are open to them everywhere, every room counts as already visited for their fog and for the public projects in it (they built the building), and they know every secret passage (section 9.6). On their own sheet they can lock or open the lair and seal a secret passage that leads into it. The lock is the one in **Room setup**, so to everyone else it is any locked door, and you can open either again.

Despair converts to their Hope **1:1** from the Mastermind window, once a Mastermind has been picked and applied (section 7). The endgame runs on the ordinary trial:

| Piece | Where | Notes |
|---|---|---|
| One **Final Truth Remnant** per chapter | placed from the **Investigation** window's **Final Truth Remnants** tab | reinforced by type, so nobody can remove it; the chapter-end screen reminds you if none was placed |
| The **Final Trial** flag | toggled from the trial console | announced to the table |
| A final verdict | given from the trial console's verdict button, which opens **Final Trial verdict** in a Final Trial | correct, the Mastermind is executed when the trial ends and the killing game ends; wrong, or the Mastermind already dead, nobody new dies and the table is shown the truth |

---

## 9. Rooms, regions, fog and discovery, movement, voice

### 9.1 Rooms and Room setup

A room is a **named Scene Region a GM has marked as one**: tick **This is a room** in Room setup's **Rooms** tab. Movement, Search, Listen, rests, voice and every incident are answered in terms of rooms. A region carrying a Teleport or level-change behavior, or one a player created, is never a room. You draw the walls and the regions with Foundry's scene controls, which stand in the module's **Map tools** window (section 18). A region you draw is yours to mark, and the Season checklist names the ones waiting.

A player's change to the mark is put back to what a GM last left, and the GMs are told; when the GM's browser has no record of the mark from before the change, nothing is put back and the GMs are told to check the region in Room setup. A change made while no GM is connected is judged by nobody.

Two regions with the same name are one room (a corridor drawn in two pieces): a lock, a seal or a Neighbours list on any piece holds for the whole room, and Room setup writes to every piece and shows the room as one row. On a scene of several floors a room is read on the token's own floor (section 9.4).

**Room setup** opens from the GM panel's **Between sessions** section (the red GM button, section 3). It works on the scene that was on screen when you opened it: the window's title names it, and Apply writes there even if you have moved to another map since, then says how many rooms it changed on it. It has one tab per kind of fact, in this order, and **Apply** saves every tab at once; the buttons of the Passages tab, the Search Token buttons and **Save room actions** act at once, without Apply.

| Tab | Columns |
|---|---|
| Rooms | Whether the region is a room at all (**This is a room**, a switch, grayed out for a region that cannot be one), whose bedroom each room is (one student, one bedroom; owning a bedroom locks its door to everyone else and gives the owner a key and an open stash), and **No privacy** (below) |
| Doors | Which doors are **Locked** now and which are **Locked at start** (the season reset copies the second column over the first), **Broken**, and the room's **Neighbours** (both below) |
| Passages | The secret passages on this scene (section 9.6), in the columns Rooms, Kind, Shape, Origin, Who knows, At season start and State, with **+ New passage**, **+ Tunnel or stairs**, and on each row **Show**, **Pick again**, **Close** or **Open**, **Make public** or **Make secret** and **Delete**, always in those places: Pick again is grayed until the passage's wall moves, and Close is grayed while it has (a breach's row has Show and **Close the breach**, section 11) |
| Searching | Which RollTable the room draws from (or the global pool), how many Search Tokens it has left (the - and + beside the count and the refill button beside them save each click at once, as one change), a "cannot be searched" seal, and one switch per category, clicked to cycle neither / good place (advantage on a Search aimed at that category) / bad place (disadvantage), so a category is never both |
| Facilities | Whether a Short Rest and a Long Rest are allowed here, and the room's own actions: the count and **Edit actions**, which opens the room's list of at most 8. Each action has a name, a statistic, a difficulty and up to 4 effects, each on the user, everyone present or the others present: Health, Sanity, Hope, a Free Move, a Search Token for the room, the Overflow down, your words, or one that lasts or waits (a statistic raised for a while, an Experience for a while, advantage on the next roll, protection from Despair on a roll, crossings in the next Eclipse, durability back on the most worn thing, the end of Wounded or of Breakdown, progress to the room's oldest project, or a stronger next Ultimate). **Save room actions** writes the list. A player sees a room's actions only while standing in it; each is rolled and costs 1 action, and once anyone has used it, a failed roll too, nobody can until the next time of day. Its use leaves a Faint Subtle Remnant (section 14.1) |
| Stashes | Who has a stash in which room and whether it is hidden. Click a cell to cycle none / open / hidden; the legend over the table shows the three, and a shaded cell is the owner's own bedroom. The students head the columns, each name on up to two lines and whole in its tooltip when cut, as on the Fog tab. A bedroom gives its owner an open stash whichever way you set it up: the room marked and given to a student in either order, in one Apply or in two, and Apply pressed on this tab without touching a cell (a cell you did not change is left as it was). When a bedroom is given to someone else, the old owner keeps their stash and what is in it, and the new owner gets their own open stash in the room. A stash in somebody else's room gives no key to it. A stash with something in it cannot be removed; removing an empty one makes everybody who had located it forget it |
| Description | **What it looks like**: the room in your words, plain text shown as typed, an empty line starting a new paragraph. **Picture**: one picture from this server's files or, on The Forge, from your Assets Library (not from S3) - jpg, png, webp or avif - chosen with the picker or removed; any other path is not saved, and you are told so. A picture over 4096 px on a side or 8 MB is flagged in its cell (*This picture is large and slow to load for every player: ...*), as is one that does not load (*This picture does not load - pick the file again.*); neither stops Apply. Both show on the room tile (below) |
| Fog | The discovery matrix (which rooms each character has already seen on this scene) with **Discover all** and **Hide all** over it, which tick or clear every box (nothing changes until Apply), the percentage of the scene that belongs to no room, and the region check |
| Scenes | Not a tab of Room setup: **Season setup** holds this part, under **Scenes**, the same on every scene. It links the season's two scenes once: the **School** and the **Trial hall** (a scene of its own; the two must differ, and Season setup's **Save** waits until they do). It also holds the hall's cast (a table with a switch per character under **Takes part**, and **Token in the hall** where a token of yours stands there), the hall's **Name**, **Picture** and **Description** for the room tile in a trial, and **Prepare the hall on Save** (section 15.1) |

**The room tile.** Every player's screen has a room tile under the clock. It shows the room their own character stands in: its name, its Search Tokens left, **You can work a project here** when it holds a project they can work on, your **Picture** across the tile behind the name, and your words behind **Read more**; on a narrow screen a small picture and a **Description** window. Your own screen has it too, for the room your Monokuma stands in. During a Class Trial it shows the trial hall (section 15.1). Clicking the clock prints the room's words too. The Player Handbook's section 3 shows the tile as a player sees it.

**No privacy** (the Rooms tab): tick it for corridors, stairwells and anywhere nobody can talk privately. The region then stops counting in the room count (the Rooms tab's ratio line and the Season checklist's room rows and further checks) and in nothing else. A locked room still counts.

**Broken** (the Doors tab) is ticked for a room whose lock was forced open, by Force the Door or by a breach (section 11.3). While it is ticked the room's lock and its bedroom key stop nobody. Untick it and Apply to repair the lock by hand; the Locked column is left as it was. Repair the Lock is not yet built as a project preset.

**A barricade.** A player's Shut the Door barricades a room from inside. The GMs see who put it up and how strong it is; every player sees only that the room is barricaded. It comes down when its author leaves, at the next time of day, at an Eclipse's start and at the season reset.

The **Neighbours** column is where a door overrules the map. Left blank, a room's neighbors are the rooms without a list whose walls share an edge with its own (within about a third of a grid square of each other and side by side for at least half a square, so a corner is not enough), and every room that lists it; the grayed names in the empty cell are the rooms the rules connect it to now. Type room names separated by commas, and the room is connected to exactly those, both ways: two rooms are connected when either lists the other, and a room beside one with a list cannot walk into it unless one of the two lists the other. Apply writes the list to every piece of the room, and tells you of a name no room on the scene carries, which connects nothing.

A room the lists and the walls leave with no neighbour has no door out. A room that has no list, is in no list and touches no other room, not even at a corner, is not checked: a crossing from it may go to any room.

**Renaming a room.** When a GM renames a room's region, the module carries what pointed at the old name over to the new one once the room's last piece of the old name on that scene has the new one - until then a room of the old name still stands and keeps it all. It carries the keys to the room, the items stashed in it, the notes of a stash found there, who had discovered it, the room of a project, of a planted item and of a called assembly that stood there, the Mastermind's room once no scene has a room of the old name, the other rooms' Neighbours lists naming it, a Despair Call's seal on it and the room of the bodies found there, and whispers the GMs what it carried. The wording of a key's description is not carried. A player's rename carries nothing, and a room drawn again under a new name is a new room.

**What a rename carries on a world of several scenes.** Keys and stashed items name no scene, so they go only where they cannot mean a room of the same name on another scene: the keys when the room is a bedroom and no other scene has a bedroom of the old name, a character's stashed items when no other scene has a stash of theirs in a room of the old name. A seal names no scene either and shuts every room of its name: the new name is sealed, and the old one stays sealed while another scene still has a room of the old name. A found body's record names its scene and goes when that is this one; a record with none - the body the GMs have still to answer is one - goes when no scene before this one, the school first, has a room of the old name.

**A rename onto a room's name.** A rename onto the name of a room already on the scene is no rename but a piece joining that room: nothing is carried, the seal and the bodies found neither, the piece's own Room Setup values (the owner, the stashes, the locks, the seal, the Neighbours and the rest) come off it, and the GMs are told. Renaming one piece of a room of several takes the room's values off that piece the same way; the other pieces keep them.

**One name on several scenes.** A room is a name on a scene, and two scenes may each have a Kitchen. Every rule reads a room on its own scene:

- a project is listed, worked and sabotaged in its room on the scene of its map token (else the first scene with a room of that name, the school's first), a secret one is a non-obvious Observe's find only there, and a trap built as a project springs only there;
- Listen, the rooms a Rest lists, the audience of a Monocub's roll and a trap waiting for somebody alone read the scene the character stands on;
- Move the Body needs the body in the killer's room on the same scene and floor, and is refused before it is paid for otherwise.

**Search Tokens.** Each room has 3 per time of day (the setting **Search Tokens per room**, 0 to 10), restocked at every change of the time of day; each Search spends one. A room whose count was saved above a lowered maximum reads the maximum. When the answer to a player's Search does not come in time (section 22), the player reads *The search was not counted.* and keeps the action, and the token comes back to the room by itself, once. A Search you refuse because the room is sealed tells the player the room cannot be searched, and the action comes back.

### 9.2 Fog and discovery

While **Rooms decide what players can see** is on, one layer of fog lies over the whole scene, in three states: the room you stand in is clear; a room you have visited shows through a veil; everything else, including any patch of map outside every region, is full fog. During an Eclipse even the room you stand in is only veiled. Discovery is **per character**: a room is discovered when the character's token first crosses into it (with a sound for the student who walked in), and it survives sessions. A GM sees a lighter fog: every room the class has discovered is clear, and rooms nobody has found yet, with any space outside every room, sit under the veil. The Mastermind sees every room as visited, and the rooms the Mastermind walks into do not count for your fog, nor do those they found before they were chosen. On a scene of several floors the fog draws the floor on screen by this same rule (section 9.4).

For the fog to work a scene needs Foundry's own vision off:

| Setting | Must be |
|---|---|
| Token vision | disabled |
| Global light | on |
| Fog exploration | off |

The Season checklist's rooms row names a scene with rooms that is not ready. Set the three in the scene's own settings, or run the console call of section 20.3 that prepares every such scene at once (giving one back: section 22).

> [!WARNING]
> A scene with rooms and Foundry vision still on renders as a **black screen for players** on v14 and gives no reason. It is the most common "it is broken" report.

**Token visibility** (**Players only see who is in their room**) works on the tokens themselves, so doorways, archways and wall-less maps do not leak. A revealed Remnant is visible only to the people who have found it themselves.

**Door controls.** With token vision off, Foundry would show a player the control of every door on the map. The module shows a player only the doors of rooms the fog leaves clear or veiled for them on the floor on screen, the door out of the room they stand in included, and never a secret door there. Who may open a door is still Foundry's.

**Rooms drawn during play.** When a scene gains its first room during play, because a GM draws or marks one, the module prepares the scene for the fog, and every screen looking at a scene repaints its fog when one of its regions is drawn, changed or deleted. Adding or removing a region's behavior counts as such a change: a Teleport taken off a marked region makes it a room, and prepares its scene when it is the scene's first, and one put back repaints the fog at once. Switching a Teleport off in place is not a change the module reads: a region carrying a Teleport is a passage whether it is switched on or off.

**A region's caption.** Daggerheart's captions off a token, such as *Hope +1* or a wound, never show: the module holds them off (section 22). A region you give Foundry's **Display Scrolling Text** behavior shows its own text, and only over a token the screen shows: a token the room fog hides from a player (it stands in a room that player's character is not in), or from every player in an Eclipse, gets no caption on that player's screen, whatever the behavior's visibility says, unless a token that screen does show covers the same point.

### 9.3 Movement and charging

Moving inside a room is free. Crossing into a connected room spends, in this order, the time of day's **Free Move**, a banked free crossing (a Sprint's, a Dash's or a Facilities room action's), a banked Burst, then **1 action** per crossing. A token that cannot pay snaps back before the move is written, with a red card. The move card says only which room the character entered and what the crossing cost; the room's words and picture are on the room tile. A crossing can also spring a trap (section 11).

Some refusals apply whatever the **Crossing rooms costs a Move** setting says:

- a character inside an incident cannot leave the room;
- nobody leaves the room during a Class Trial;
- a room sealed by Behind Closed Doors, a Chained player;
- a locked door (Room setup > Doors);
- somebody else's bedroom without its key;
- the Eclipse's crossing cap and connected-rooms rule, the stairs included (section 9.4).

Monokumas walk through all of it. A dead character's token does not move: the body stays where it fell. Turning the setting off hands you the price of a crossing, the Free Move and the action, and, outside an Eclipse, the connected-rooms rule with the stairs, to run by hand. A change of floor is a move like a step across the map: refused, charged and sent back the same way (section 9.4).

**An arrival the rules refuse.** Every player's arrival is judged again by the same rules, without the price. A player's move into a room one of the refusals above shuts (an incident's room left before a crisis action lets them go, a locked door, a seal, Chained, somebody else's bedroom, the courtroom, an Eclipse crossing past the allowance) is put back to where the token last stood lawfully, its floor and elevation included, however the move was written, and the player is told the rule; the GMs are whispered once for a burst of them. A send-back a player asks for into a bedroom shut to them is refused. An arrival that breaks only the connected-rooms rule or crosses a wall is only noted in the Debug log while **A player's token moved through a wall** (section 9.6) is on its default. Nothing you do yourself is put back: if you move or place the token, the spot it stands on is lawful.

**Where a student counts.** A student who stands in a room those rules refuse is no witness to a body and no third party to a murder until they stand somewhere they could have walked to from the last room they reached lawfully, and the GMs are whispered when it happens. Such a student also keeps no trap waiting for somebody alone from springing, and is not counted in the killer's room when the parked Direct Murders are judged at the end of an Eclipse the primary GM ends. One student is one witness, however many of their tokens stand in the room. A token a player drops onto the map is judged from where that student last stood on the scene; a student who had stood nowhere there yet counts where the token landed, and the GMs are whispered so. A dropped token the rules refuse is deleted, and the GMs are told.

**Refund last crossing.** Each row of the Students window has a **Refund last crossing** button, its tooltip naming the two rooms. It stands the token back where it stood before that character's newest crossing and gives back exactly what the crossing cost: the Free Move, a Sprint, a Burst, an action, an Eclipse crossing (only in the Eclipse it was made in), or a tunnel's price, with the token back at its entry. It works after the time of day has moved on too, though an action comes back only up to the budget's maximum and the Free Move only in the time of day it was taken. It works once per crossing, and the player is told. The price is what the move spent as it crossed (section 22); another spend that lands first (a Search's action, say), or one later, is not given back, and the player is told nothing came back but the token.

**A sheet from its row.** Each row of the Students window, a student's, a Monokuma's or an NPC's, has a sheet button beside the name (*Open name's sheet*). It opens that character's sheet, or brings it forward when it is open already, and the Students window stays open beside it.

### 9.4 Floors (Foundry's Levels)

Foundry v14 can put several floors - Levels - on one scene: a token stands on one floor, a region is on the floors it names, and a region that names none is on every floor. The module reads a room on the token's own floor, so a token on the ground floor under the attic stands in the ground-floor room, never in the attic. Floors are ordered by their elevation, lowest first.

- **Stairs** are a region carrying Foundry's Change Level behavior, and such a region is never a room. Draw it inside the rooms it joins: it links the rooms under its center on each of its floors. Going up or down the stairs from one room into another costs one crossing, exactly like a door. A room drawn on two floors, a stairwell, is one room, and changing floor inside it is free.
- **No stairs, no climb.** On a scene with stairs, a change of floor between two rooms they do not link is refused, and the refusal names only the room you stand in. A scene with floors and no stairs region is judged by the rooms' footprints. The stairs are part of the connected-rooms rule: turning *Crossing rooms costs a Move* off hands them to you with it, and an Eclipse applies them wherever it applies that rule - in every Eclipse but one that lets everybody pick any room (section 12). Stairs a player drew link nothing.
- **The fog draws one floor**, the one on screen, by the rule of section 9.2, and the door controls follow it. The region check checks each floor apart (section 20).
- **Who sees which floor.** A player sees the rooms their character has discovered on every floor exactly as on their own: under the veil, with nobody else's token in them. A room they have never been in stays under full fog on every floor. A row of buttons beside the HUD, **Floors**, offers a player the floors their own tokens stand on and every floor holding a room they have found, lowest first, and a GM or the Mastermind every floor; it appears only on a scene of two floors or more. A floor put on screen any other way, Foundry's own level control included, is drawn by the same rule.

### 9.5 Voice

With **Separate voice in each room** on and LiveKit AVClient connected, every mapped room is its own voice channel: a player hears whoever is in the room with them, and their voice follows their token. A Monokuma's voice follows its own token, on the GM its pool is mapped to. A Monocub talks as a Monocub.

**During an Eclipse** no player is in voice at all until the lights come back, and the GMs share one channel. When the Eclipse ends, by the clock or a rewind, everybody is sent the room they belong in again, and an account with no character (a Spectator, a GM without a Monokuma) the main room.

**During a Class Trial** everybody is in the main room (the living, the dead, the Monocubs and the GMs) wherever their token stands and whether or not a trial hall is linked (section 15.1); an Eclipse opened inside a trial still takes every player out of voice. The dead listen but do not speak in the trial: for the trial the module blocks the microphone of every dead student's player - a death nobody has found too, never a Monocub's or a GM's - with Foundry's own block, and gives back exactly the blocks it made (section 15, step 1). A Monocub's tile says when it may speak (*Discussion: you may speak.*) and when it listens (*Mode: name. You listen.*, *The vote: you listen.*, *You listen: this trial is about your death.*). This is information only: the module blocks no Monocub.

**The dead channel.** A victim of an incident keeps the room they died in while that incident runs. Once it closes, once the body is found, once a living student from outside the incident walks into the room, or once you press **Silence now** (the student's row in the Students window, or the incident tracker for its victim), the dead student's player talks with the Spectators in the Spectators' voice channel, for a death the table has not been told of (section 13.4) and for one it has: the living do not hear them, and they hear the Spectators and the other dead. So another dead player or a Spectator may learn of a death nobody has found. Their microphone stays theirs to mute and unmute, with the reason under it, and the module writes no block on their account outside the trial. A death outside an incident is placed so at once.

**Nobody can listen in unseen through this module.** A player's voice goes only to the room their token stands in or, while their token stands outside every room (a doorway square, an undrawn corridor, below), to the room that token came from. Everybody in a room can see how many others are in it, silent ones included: the number on the speaker of the voice tile, or one camera tile each in Foundry's dock while the voice tile is off. A GM who wants to hear a room walks their Monokuma into it.

**Listening at a door** is the one exception the rules make, and it is still counted. After a Listen of 14 or more, with **Separate voice in each room** on, the listener's voice moves into the channel of the room they listened at, and their microphone is blocked with the same Foundry block the trial uses; a block you made yourself is left alone, and only what the module wrote is given back. They hear that room; nobody there hears them, nobody there is told, and the number on the speaker of that room's voice tiles counts them. Your list **Who you hear** shows at its top one line per listener (*name listens at room, from room*) whatever channel you are in, and offers no block of a listener's microphone. Listening ends when the listener presses **Stop listening at** *room* on their voice tile, when they walk out of the room they listen from (a step inside it or into a doorway does not end it), and at the end of the time of day, an Eclipse, an incident, a Class Trial or their death; the voice goes back first and the block is lifted about 4 seconds later. Listening at the same room again in the same time of day costs the player no action and no roll. With separate voice off, Listen is its card alone, and you are told once.

**Echoes**, the Infiltrate tile's row beside Listen, names the nearest room, by doors, stairs and the tunnels the player knows, that holds a living student of another player: no body (a death you keep secret included), no Monokuma, Monocub, Spectator, hidden token or GM's character, and never in an Eclipse.

**A doorway or a corridor.** A player's token that stands outside every room (a doorway square, a corridor not drawn as a room) keeps the voice room it came from while that room stands on its scene and floor, so a walk from one room through a gap into the next changes the voice room once, and a step into the doorway and back changes nothing. It goes to the main room once it stands on another scene or floor or its room is deleted, and the Eclipse, the trial and a death keep their own rules. A player's token you drag into a corridor keeps its last room too; drag it into a room to move its voice. A Monokuma's token outside every room goes to the main room: walking your Monokuma out of a room into a corridor takes your voice out of that room. A room a player's token was refused (a locked door, a crossing it could not pay) is never the one it keeps. When the primary GM reloads, or another GM becomes the primary, a token outside every room starts again from the main room. None of this has yet been heard at a table (LIVE-E88-03).

**When voice goes wrong.** **Fix voice** (the GM panel's **Diagnostics**) sends every connected player the room they belong in now, as if nobody had been sent anything yet: the cure for a player who is in the wrong room or hears nobody. Only the primary GM can send it, and it says how many people it reached. A player whose voice connection drops gets a **Voice disconnected** card (kept in their notice history) and joins again by themselves; when the card says to reload, only F5 brings them back. The voice diagnosis (section 20.3) says which of the five links is the broken one: run it on the client that is complaining.

**The voice tile.** With LiveKit AVClient connected, every screen shows a voice tile in place of Foundry's camera dock: the portrait and the name of whoever that screen hears in its own voice channel, a microphone button and a speaker button (the Player Handbook's section 3). On The Forge a portrait, a player's avatar or their student's picture, may be any picture on The Forge's asset host. The dock stays in the page out of sight, because LiveKit plays everybody's sound through it; you lose its local camera preview with it, and any buttons another module puts in it, proximity-voice-chat's among them. While nobody speaks, a blocked player's tile says **Blocked**, and a player not yet in voice reads **Connecting** or **Disconnected** there. The world setting **Voice tile instead of the camera dock**, on by default, is the way back: off brings Foundry's camera dock back for everyone.

**Blocking a microphone.** In your list **Who you hear** each player's row has **Block *name*'s microphone for everyone**: Foundry's own block, the dock's, and it holds as far as Foundry's block does. It is drawn disabled, with the reason, while the module itself holds that microphone: a death you keep secret, where a block would tell the table, and during a Class Trial a student on the trial's list of the dead, whose block is the trial's.

**Settings the module holds for every browser.** Two choices are made for the whole table and shown to nobody as theirs to change. Voice always runs inside the Foundry window: LiveKit AVClient's choice of a separate window or tab is held off for everyone, the GMs included, and taken out of its settings (the world setting **Voice inside the Foundry window for everyone**, on by default; a change takes effect after a reload). And while the voice tile is on, Foundry's camera dock is kept folded and no camera opens in a window of its own: those two fields are grayed out in Foundry's A/V settings, and a change made anyway is put back. Each player's devices, volumes, mutes, blocks and push-to-talk key stay their own. With the voice tile off, the module holds nothing of the dock: each screen gets its dock and camera windows back once, folded or open as they were before the tile hid them, so switch the voice tile off before you disable the module. The corner's buttons, the notice tile and the narrow screen's stack stand above the dock while it is shown. Set the world's A/V mode to audio only: the tile shows no video, and the Season checklist says so when the world sends video nobody watches.

> [!WARNING]
> A proximity-voice module installed alongside can silence a table while every check reports success. The voice diagnosis names it (section 20.3).

**The voice server's secret.** LiveKit AVClient's own setting is one this module cannot vouch for. Set to a self-hosted server, that module keeps the server's API key and secret in a world setting, which reaches every player's browser like any other (section 1.6), and anyone holding them can connect to any voice room. This module cannot move another module's setting, so it tells you instead: a row of the Season checklist (section 2), shown only when it is so, and a line of the voice diagnosis (section 20.3). A server that issues its own access tokens, such as the Tavern, keeps the secret off every browser.

### 9.6 Secret passages

A secret passage is a stretch of a plain wall between two rooms of one floor, or a tunnel or stairs between two rooms on one floor or two. The students who know it go through it at a door's price (a crossing, charged and refused by the rules of section 9.3); to everybody else it is a wall. You make and manage them in Room setup's **Passages** tab. A passage in a wall opens a gap in the room's outline on a knower's own screen alone; a tunnel's end in their room is marked there "Secret passage to" the room it leads to, named once they have found that room. It is not what the region check calls a passage (section 9.1): a region with a Teleport or Change Level behavior, which is never a room.

- **A new passage.** In the Passages tab, **+ New passage**, then two clicks on a wall between two rooms of the floor on screen: where it begins and where it ends (Esc cancels). Give it to a student with **+** and their name. Each button in the tab acts at once; Apply and Cancel do not change it.
- **A tunnel or stairs.** **+ Tunnel or stairs**, then a click in each of two rooms: where it begins and where it comes out, each end on the middle of its square. For stairs, switch to the other floor before the second click (Esc cancels). An end in no room, both ends in one room, or an end on a square where another tunnel already ends is refused. Its row's Shape says Tunnel or stairs; Closed takes the marks off the knowers' screens with the way.
- **On a GM's board.** Every GM's screen, an Assistant GM's too, draws the passages of the floor on screen over the map, and no player's screen does: a stretch in a wall dashed in the passage color, a tunnel's ends as rings joined by a dashed line, a closed one dashed gray, a broken one in red dots. Under each ring of a secret tunnel or stairs it says, dimmed, "Secret passage to" the room that end leads to, by the room's name; at a one-way tunnel's way out "Secret passage from" the room it comes from, and an arrowhead on the dashed line points to the way out. Stairs have no line between their ends on one floor: their words say which way. The outline your screen draws for the room a Monokuma's token stands in is cut where a secret passage runs in its wall, where a knower's outline is cut, and the cut is drawn again, dimmed, in the outline's color.
- **Go through.** A student who knows a tunnel goes through it when their token is dragged onto one of its ends - by their player, onto the mark, or by a GM, onto the end's square (the ring on a GM's board, above; **Show** on the passage's row shows where it is) - or when they stand on the mark, or a square next to it, and press **Go through** beside it under **Known passages** on their sheet. A drag that ends beside the end goes nowhere, and so does a token the module places there itself: the gathering of everyone at a body, the cast placed at a new season or after a trial, a body moved by a clean-up, a put-back and the landing. Your own teleport in Foundry goes nowhere only where Foundry marks the move as a teleport. It needs a GM connected.
- **What a tunnel costs and where it lands.** A tunnel is judged as a door is: one crossing at a door's price, or one Eclipse crossing during an Eclipse; somebody else's bedroom is passed, while a locked door, a sealed room, Chained, a running incident, a Class Trial, a price they cannot pay and a spent Eclipse turn the student back in a door's words, and nothing is paid. The token then lands on the far end's square, or the nearest free square of that end's room, on that end's floor; if the token cannot be moved there, the price is given back. The Mastermind passes a locked door and a sealed room this way too. A player's own move of the token to a tunnel's far end, across a wall or onto a floor no stairs lead to, is a move through a wall (the last point of this section).
- **One way only.** A tunnel or stairs goes both ways until you pick "Only from" one room "to" the other under its Shape in the Passages tab: from its other end **Go through** is refused ("This passage cannot be taken from this side."), and the students who know it see that end marked "Secret passage from" the room it comes from. A passage in a wall always goes both ways.
- **Who knows it.** Each row names the students who know it and how they learned it: from a GM (GM), from the season's start (start) or from another student (shown). A student who found it with Find Passage is listed as found. **At season start** is a second list: who knows it when the next season begins. The season reset gives that list back and takes the rest (section 16).
- **A project's passage.** A Secret Passage a player built is listed with Origin Project, and its builder and those it was shared with as built and shared; a breach as Kind Breach (section 11). Each button acts on it as on a passage of yours. A project's passages, and who knows them, go with the season's reset; yours stay.
- **Revoke.** A student who is not in the passage's rooms forgets it at once. For one who stands in them you choose: **Revoke now** makes it a wall to them from that moment, **Revoke when they leave the room** keeps it open to them until they walk out.
- **Close, Open and Delete.** Closed keeps who knows it, and the passage is a wall to all of them until you open it again. **Delete** forgets the passage and who knew it, after a yes. When the wall under a passage is moved or deleted, its row says so: pick it again. The Mastermind can also close a passage that leads into their lair, with **Seal** on their own sheet (section 8); only a GM opens it again.
- **Make public and Make secret.** **Make public**, beside Close, gives the passage to every student at once, and nobody is told: no card, no sound. It lifts no lock, and the season's reset keeps it public. **Make secret** gives it back to the students listed in its row alone; a show made while it was public is not kept. The row's Kind says Public or Secret, and its Origin says GM, or Secret door for one Convert to passages made.
- **Find Passage.** Analyze's fourth choice, offered in every room and refused in a Class Trial before anything is paid: Head against 16, 1 action. 16 or a critical finds the oldest open secret passage of the student's room on their floor that they do not know - a stretch of its wall or a tunnel's end - and they know it from then on; below 16, or with none to find, it finds nothing. The Mastermind finds none: they know them all. Whatever comes of it, the student and the GMs get one card of the same shape, the passage found or "You find no hidden passage here.", with the sound of a secret passage opening or of a search finding nothing. A Reroll that beats 16 finds once, in the room its roll was thrown in, and only while the student still stands there - else the Reroll is given back whole; one that falls below takes back only what its own roll found. The season's reset takes what was found and keeps the tunnels.
- **Showing.** A student who knows a passage can show it to another student standing in the same room (**Show the passage**), without asking you and for no action (the Player Handbook's section 3). You are told on a card. A show to a student who already knows the passage writes nothing and tells nobody but the player who showed it.
- **The Mastermind knows every secret passage**, and is not listed. That is the one player who plays the Mastermind - the first connected player among the owners of the Mastermind's student; another player who also owns that student knows only the passages the student was given or shown, and is held to them as any student is. A Monokuma's token passes every open secret passage when a GM moves it; whether Foundry 14 stops a GM's drag at a wall at all is not measured yet (LIVE-E79-08).
- **Every room needs an ordinary entrance.** Every player's browser holds the rooms and the tokens, so a room no door reaches gives its passage away: a token standing in it came through one. Every player also sees a token cross the wall where a passage runs, and a token that goes through a tunnel leave one end and stand by the other.
- **Foundry's secret doors.** Any player can open a Foundry secret door, and their character walks through it. **Check the rooms on this scene** names each one, and the Season checklist's row No Foundry secret doors has **Convert to passages**: every secret door of the world's scenes becomes an ordinary wall, shut, and where it stood between two rooms also a secret passage nobody knows yet - give it to a student here. Until then, a secret door a player changes is put back as a GM last left it, also when it was changed while no GM was connected, and a step through it is judged as a step through a wall (the last point of this section).
- **The players' rulers.** While a player drags a token, the whole table sees its route, through a secret passage too. The Season checklist's row The players' movement ruler is hidden offers **Hide** and, once hidden, **Show**.
- **A player's token moved through a wall** (module settings): what happens when a player's token is moved through a wall its character could not pass, a passage it does not know included. **Note it in the Debug log** (the default) writes a line there; **Send the token back** returns the token where it stood, tells its player and warns the GMs, once in half a minute for the same token and player.

---

## 10. Items

### 10.1 Categories, tiers and durability

| Category | Limit |
|---|---|
| Usables (Healing restores Health, Sanity Relief restores Sanity, the kind comes from the table the item was drawn from) | up to **3** |
| Murder Weapons, Cleaning Tools and Tools | together the **gear** group: **2 slots**, with at most **1** held ready and at most **1** put away, so a student carrying two holds one of them ready |
| Truth Bullets | no limit |
| Room Keys | no limit |

A GM give ignores the carry limit and marks the excess.

Items have **tiers** 0 to 3, and each tier its **durability**. A usable of Tier 1 to 3 restores its tier in what its kind restores (Health or Sanity), with no choice and no Hope:

| Tier | Usables | Murder Weapons and Cleaning Tools | Durability |
|---|---|---|---|
| 0 | "a random, seemingly useless item, open to creative use"; its use comes to you to rule on | useless | **single use** |
| 1 | restores 1 | meant for something else but usable | **1** point |
| 2 | restores 2 | partly intended for the job | **2** points |
| 3 | restores 3 | made strictly for it | **3** points |

A Murder Weapon's tier is its damage in an incident, and a Cleaning Tool's tier comes off the clean-up DC and off Move the Body. A **Tool held ready** gives advantage on project work and sabotage and takes its tier off the threshold.

A creative use of a Tier 0 usable is not a roll: it reaches you as a card with **Works - apply an effect**, **Works, no effect - use it up** and **It does not work**, and whether the item is used up is your ruling. You rule on one thing at a time: Works on a second card for the same thing waits while your window for the first is open, and a card for a thing used up or no longer carried closes with nothing given.

**Durability.** A roll that lands with Despair, a success or a failure, takes one point off the item in the student's hand when the roll used it: a Tool on project work or sabotage, a Cleaning Tool on a clean-up, a Murder Weapon on a swing. A critical never takes a point. The point that empties the item breaks it. A Tier 0 item is single use instead: any roll that used it breaks it, with Hope or Despair, a critical, a success or a failure, and the sheet shows it as **Single use** instead of a durability track. A Reroll of an incident action gives the Tier 0 item back with the action, and the replay spends it again. An item with no tier recorded counts as Tier 0. The Rot darkening wears everything by one but never takes the last point.

A broken item stays in its slot and stays broken wherever it goes next. Its holder gets rid of it by stashing it or by throwing it away, a Shadow roll that always leaves a Remnant: a Tamper Remnant in an Investigation or a Class Trial, or when a side of the running incident throws it, and a Prep Remnant otherwise. A player's own sheet cannot mend it; **Repair an item**, a project (section 11.2), makes a broken or worn usable or gear item whole.

### 10.2 Item tables

**Item tables** (Between sessions) holds what a Search can turn up. A Search draws from RollTables: one tier table per category and tier ("DRPG Murder Weapons - Tier 2", "DRPG Usables (Healing) - Tier 1", and so on), and the optional room tables a room is pointed at in Room setup. A Search in a room asks, in this order:

- the room's own tables: `<room> - Tier N`, then `<room> - <category>`, then the room's own table, and when none of those answers, every table of the room in a fair random order;
- the tier tables;
- the module's built-in lists.

It hands over what it drew with that entry's category and tier, never above the tier the roll earned. A tier table is found by the category and tier written on it, which the installer and the **Tier pools** tab write; a table without them is found by a name of that shape.

The editor has three tabs, **Tier pools**, **Room pools** and **New item**, and an **Install / reinstall** button: the one-time install of the module's own mundane, school-shaped lists, as 20 RollTables in a "Danganronpa RPG" folder. If they exist already, you choose between **Keep mine** and rebuilding. The tables are listed under **Table** with their **Items** count, and a table's entries by **Name** with **Description**, **Also serves as** where the table has second roles, and **Actions**. A room table's entries are grouped by kind: **Show** above them picks one group or **Everything**, each with its count, and a kind the room holds none of is listed with 0 and cannot be picked. **Rename table** and **Delete table** stand together beside the table's name.

From Tier 2 up an entry may carry one second role (**Also serves as**), so an axe is a tool and a mop is a weapon. Renamed labels keep old tables findable. The module's own lists are in English whatever the language; to play in another language, edit the installed tables or build your own. A usable's kind is the tables' wherever they know its name: a name the Sanity Relief tables hold restores Sanity however the item was found or given, and Give says so under the category when your pick is the other kind.

### 10.3 Giving, handovers and keys

**Giving and taking.** **Items**, the button beside each character's name in the Students window, opens **Give / take items**. On its **Give** tab you choose what to give (**Item**, **Truth Bullet** or **Room key**) and, for an item, **From the tables** (an existing entry) or **Create new** (one you type). An existing entry's category and tier follow the item: a tier table's own, or, for a room table, what the tier tables say of its name. Where nothing says, both read **- choose -** and Give waits until you choose them. The entry's second role goes with it only from Tier 2 up. **Take away** removes anything the module tracks. The same window issues Truth Bullets, from a Remnant on the scene or written new (the real type, what the player is told it is, the visibility that sets its Analyze DC, the player text and a GM-only note), and the Autopsy Truth Bullet to the students you tick, the living by default.

**Handover.** A student gives another student in the same room a Truth Bullet, an item or a room key, for no action. A Truth Bullet and a room key are copied, so both hold one; an item is moved. A handover is refused during an Eclipse and follows the same limits as a steal or a Plant: no Monocubs, no Monokuma, no hidden tokens, not in the Class Trial, and not by someone caught up in the running incident. A GM's browser checks the room again before it writes the handover.

**Bedrooms and keys.** A bedroom is shut to everyone but its owner, who never needs the key. Anybody else needs the Room Key item in hand: a key put away in a stash opens nothing. Whoever holds a key copies it to somebody in their room with **Share a copy** on the key's row, and you can give one on the **Give** tab (What: **Room key**). A key that changes hands any other way (Palmed off somebody, lifted from a stash, taken from a body) still opens its door. When you give a bedroom to somebody else in Room setup, the old owner's keys to it are taken, and so are the copies they gave others: you are told who lost one, and so is each of them. In an Investigation the bedroom of a student whose death the table knows stands open to everybody; one whose death only you know stays shut.

> [!WARNING]
> Keys name their room in a flag: a GM's rename of the room carries them (section 9.1 says when); a player's rename, or a room drawn again under another name, leaves them on the old name.
> A key check repairs an owner's own key to their bedroom where it can, and keeps one key where an owner holds several; when it cannot, a new key is made and the old one stays for you to delete. Copies that other students hold are never touched (technical notes: section 22).

### 10.4 Stashes

Everything a student does not carry lives in a stash: the bedroom's by default, or one in any room where Room setup gives them one. A stash holds **3** things. Stowing and retrieving cost nothing, but the student has to stand there; Truth Bullets cannot be stowed. A Search never reaches into a stash: it draws from the room alone, whoever keeps a stash there.

An **open** stash is a drawer: anybody standing in the room can go through it for free and take one thing, once each time of day for each stash (a second reach is refused), and the owner is not told at that moment. A **hidden** stash is one whose owner built a hiding place, a project at your discretion; you make it hidden by cycling its cell in Room setup. It is found only with Analyze > Find Stash (Head, **16**), which opens that one stash to that one person until you remove it; from then on they go through it as through an open one. The Mastermind sees every stash.

**The owner finds out on return.** When a reach took something while its owner stood elsewhere, the owner is whispered *Something has been moved in your stash, and something is missing from it.* the next time they stand in that room, however they come there: a crossing paid, free or in an Eclipse, or your own move of their token. They are told once however many reaches there were, never who or when, and never for a reach made while they stood in the room or for their own. A card to the GMs alone tells you as it happens whether the owner saw the reach or is still to be told, and when they are told, whose reaches it covers. The mark is dropped unsaid when the stash is gone or its owner is dead by the time they come back.

### 10.5 Palm and Frisk

**Palm** (section 5) is theft from a person and planting on a person, both resolved on a GM client. A clumsy thief is caught by the victim and seen by the other students in the room, who read whose hand it was, and the item only with Despair on the Shadow roll, as at a body. A Plant into full pockets does not go in: the item stays with the planter, who is told the victim felt nothing, the victim is told nothing, and the action stays spent. **Frisk**, Palm's third direction, moves nothing. Openly it asks the target's player (you answer for a character without a player), who has 60 s to answer; a refusal or no answer lets the searcher force it with Body 12 in front of the room, deciding within 30 s, unless you switch off *Frisk: forcing after a refusal* in the module settings. Unseen it is a Palm's two rolls, and an unseen Frisk the target notices is seen by the room the same way, with no item. The list goes to the searcher and to you, and on an open Frisk whose pockets are turned out, shown or forced, to the students in the room as well; Truth Bullets and stashes never appear in it. A Frisk on a body you still keep, or on somebody in the incident, asks nobody and plays as a student who does not answer; you get a notice and may open the discovery by hand.

If the searcher's browser does not confirm a refusal or a silence in time, the ask ends as their **Leave it** would, and you are told (technical notes: section 22).

### 10.6 Taking from a body

A dead student's Truth Bullets are gone; everything else they carried stays on their sheet. Another student opens the sheet, presses **Take from the Body**, ticks what they want in that window and presses **Take**. A Take costs no action and rolls **Hand** once for everything in it, every time: a second Take rolls again. The taker gets the items and a Neutral Truth Bullet naming what they took and off whom. With full hands and no stash an item stays on the body and the taker is told.

The taker must be alive and standing in the body's room, outside a Class Trial and an Eclipse, and the body (its tile, or its token when it has none) must not be hidden. The window grays a Take that would be refused, with its reason, and a thing the taker's full hands with no stash could not hold. A Monocub's body is searched like any other. A body nobody has found yet (section 13.4) may be searched only by those who know of the death: the GMs, the incident's players, the victim's own player and a student who found it alone. Its Truth Bullets are still on it then and cannot be taken, and the taker's Truth Bullet, which names whose body it was, waits in your record of the death until the death's publication (section 13.4) gives it, dated when and where the item was taken. The item moving from one sheet to another is world data every browser holds, before the discovery as after.

The body keeps **one** Remnant, tied to the crime, whose note lists everything taken from it. The Hand roll sets how plain it reads, and its visibility only rises, so a later Take can make it plainer, never fainter:

| Hand roll of the Take | The body's Remnant |
|---|---|
| under **12** | Evident |
| **12** to **17** | Subtle |
| **18** or more, or a critical | Hidden |

The Remnant stays where it was laid, at the body's tile (at its token while the body has none). Its card names the action "Taken from a body", and the token wears the Palm hand: to a GM always, to a player once their own copy is identified and, for the Remnant of a body nobody has found, once that death is the table's (a copy found before says nothing of what left it until then). Which Remnant is the body's, and what has left it, is the GMs' record (section 14).

With another student in the room the taker also rolls **Shadow** against **16** to go unnoticed (a critical holds); with nobody else there nothing is asked. Whether a Shadow is needed is read from who is in the room on your screen, not the taker's: a player's Take you see watched comes with its Shadow or moves nothing, and their window then asks for the Shadow even when their screen shows nobody; closed, nothing is taken. A miss sends one card to the students counted in the room and to you: with Hope it says the taker went through the body's pockets, with Despair it says what they took. A miss costs no Sanity. For a body the table does not yet know is dead, the card goes to you alone.

Only the first roll thrown for a Take counts: a roll thrown again before that Take is sent counts for nothing, and a Take you refuse (the taker walked out of the room) keeps its roll for the next try, whose new dice count for nothing. A Reroll of a Take rewrites the dice and nothing else: what was taken stays, and the body looks as it did.

The dead move nothing themselves: a dead student's sheet offers no Use, Ready, Discard, Put away or Take out.

---

## 11. Projects and traps

### 11.1 Projects

Projects are Daggerheart Countdowns that count *up*. Scales:

| Scale | Progress |
|---|---|
| Trivial | **3** |
| Standard | **4** |
| Complex | **6** |
| Desperate | **8** |

Each project has a name, a picture or a tray glyph, a scale, a room (or any room), a required statistic, a visibility, the **Indirect murder** box and a description of at most 1000 characters. Every roll on a project takes its statistic, a Sabotage's included. A project stored with no statistic gets the player's proposal before its first roll; you approve, change or refuse it on one card, and the statistic you settle on stays the project's (section 5). A secret project is seen by its proposer and the GMs; share it with accomplices. A builder cannot be taken off their own project.

The description is required in the player's proposal and in your create and edit windows. The proposal's text opens your approval window, where you may change it, and a project of a set kind comes with the kind's name, which names no room. After that only the GMs change it, in the project's edit window (the pen on its row in the manager). Everyone who knows the project reads it on its token's card, which follows an edit while it is open. An older project with no description gets one when you open its edit window, which asks for it; the manager's Save does not.

**Projects** (the panel tile) is the manager: a table of the projects grouped by room, with a column per player under **Who knows about it**. There you create, edit, share, add or remove progress, and delete; the bin on a project's row asks first, then removes the project for good. **Wide project windows**, a setting of each browser (on by default), opens Create a project, Edit project and Propose a project wider on that screen. In Daggerheart's own Countdowns tray, - and + on a project's row add or take one progress and the row's menu deletes the project, as the manager does; the tray offers no Reveal or Hide on a project's row, since who sees a project is set in the manager.

A project with a room stands on the map as a two-square token at full opacity with no name on it, wearing the project's tray icon (a hammer when it has none). You can drag it, and double-clicking it opens its card. A player sees it once they have stood in its room, or, for a secret project, once they are let in on it. The Mastermind's player knows a public project in any room of a scene their character stands on, on their own map and tray; its card on your screen lists them only for the rooms the record has them in, so that a screen you share does not name them.

The tokens follow their projects after every change: a new project in a room gets its token, a project moved to another room takes its token to that room's middle (a token you put in a doorway or a corridor stays where you put it), a finished project's token changes color and changes back if the bar is taken back, a project left with no room loses its token, and a share or a revoke shows or hides it for that player at once. A missing token is put back, and a token whose project no longer exists is removed. A token you delete by hand stays deleted until **Show on the map** in the manager puts it back. A second token of the same project is only warned about, with the project and its scenes named. Deleting a project, or a season reset with *Projects* ticked, removes its tokens from every scene. Observe's **Look past the obvious** can uncover a secret project in the searcher's room (DC 18), which lets them in on it.

**Proposals.** From the sheet a player either works on a project available in their room or proposes one. A proposal reaches you as a card; you approve it, editing the scale, room or wording as you go, or refuse it, and nothing exists until you approve. A roll on **Work on a project** gives +1 at 12, +2 at 18 and +2 on a critical, which also refunds the action. Besides the rolls, Contribution adds +1, Patronage +2, Game Integrity removes 2 and an Earthquake removes 1, and a room action's *Progress to the room's oldest project* effect (section 9.1) adds its amount to the oldest unfinished project in that room the user can see, never an indirect murder. A finished project whispers its proposer and the GMs, never the table, since a project can be secret, and it is yours to say what it now does.

A finished project can also give its room an action. The **Room action** button beside the pen in the project manager sets its name, its effects (as a room's own, section 9.1), whether it costs an action (**Costs an action**, on unless you turn it off) and its lifetime: for good, or a number of times of day or days from the time of day it was finished in, never past the chapter's end. It needs no roll, leaves a Faint Subtle Remnant like a room's own action, each character may use it once each time of day, and the Projects window says it is in Facilities and how long it lasts.

**Who sees a public project.** A public project with a room shows on a player's tray and map once one of their characters has stood in its room, or stands in it now, and to its proposer from the moment you approve it, wherever you put it; their player gets a private card saying so. Who proposed it stays yours, in no data the players' browsers hold. The rest of the table sees it only when their own character gets there: a project nobody has walked in on stays off their tray. Its card's **Knows it is there** lists who sees it.

### 11.2 Projects that change a wall, an item or a lock

The player's **Propose a project** window offers six kinds under **Kind** besides a project of their own, each with its statistic and size. What each does when its bar fills happens by itself, with nothing for you to rule:

| Kind | Statistic, size | Offered when | When it is finished | A Reroll of the roll that finished it |
|---|---|---|---|---|
| Secret Passage | Hand, Complex (6), always secret | the builder's room shares a wall with another room on that floor | a secret passage through that wall: the builder knows it, and so does each student of every player the project was shared with before it was finished | the passage and who knew it go |
| Breach the Wall | Body, Complex (6), public or secret | the same | a hole in the wall that stops nothing, for everyone; the room beyond forced (section 11.3) | the wall is given back |
| Seal the passage | Hand, Complex (6) | the builder knows a passage with a side in the room they stand in | the passage closed, as the Passages tab's Close: who knows it is kept, and you can open it again | the passage opens again |
| Close the breach | Body, Complex (6) | a breach stands in a wall of that room | the wall whole again, as the tab's **Close the breach** | the breach is cut again as it stood; if the wall changed meanwhile, nothing is cut and the GMs are told |
| Repair an item | Hand; Trivial (3) for an item of Tier 0 or 1, Complex (6) for Tier 2 or 3 | a usable or a gear item of the builder's own sheet, carried or stashed, is broken or worn | that item whole again: not broken, no wear. If the item's tier went up before the repair finished, nothing is mended and you are told why, unless you picked the size yourself when approving it | the item is broken and worn again as it was, unless it broke or wore again since |
| Repair the Lock | Hand, Trivial (3) | the lock of the builder's room, or of a room next to it, was forced open by Force the Door or a breach; the approval refuses a lock a project repairs already | the lock holds again, for everyone; a bedroom's owner is told when they next walk in | the lock is broken again |

After such a Reroll the project is kept until that student's next roll replaces the one the Reroll could take, then removed as finished. A lock you mend by hand in Room setup's **Broken** column removes every project repairing it, and the GMs are told.

Your approval window checks the target again against where the GMs see the builder, and shows what it found. For a Secret Passage or a breach it names the builder's room and the room beyond and has **Pick the stretch on the wall**: two clicks on the wall between those two rooms, on the builder's floor, as for a new passage (section 9.6). **Create project** is refused until a stretch is picked, a click on another wall is refused in the pick's window, and a breach's stretch may lie over a passage, never on a wall a breach was already cut from. Secret is ticked and held for a Secret Passage. For the other kinds the window names the target and says why it may not be done, and **Create project** is refused while it may not. Seal the passage and Close the breach are approved only for a passage or a breach with a side in the room where the GMs see the builder standing, and the completion asks that again. The size of a Repair an item is read from the item's tier as the GMs hold it, whatever the card says, and you may still change it. You may change the statistic, the scale and the wording as for any proposal. Where the project goes (the stretch, the room beyond, the passage, breach, item or lock) is kept with the GMs' secrets (section 14), never in the world's data.

When the bar fills, the target is judged again before anything is done: the wall still standing between the two rooms on no other passage's stretch, the passage still known to the builder, the breach still standing, the item still on the builder's own sheet and broken or worn, the lock still broken. A Daggerheart party actor's item, or another character's, is never repaired. What fails is not done, the GMs are told why on a card ("... is finished, but ..."), and the bar stays full.

When a Secret Passage's or a breach's completion is refused because the passage cannot be opened, or the wall breached, where it was aimed, the project stays with its bar full, and you get a card with the reason and a **Choose the target again** button. It opens the same pick as the approval, on the scene and floor of the refused stretch, with the room it was to lead to chosen first. The pick is judged as at the start, and the completion is made at once, as at any completion (the builder's and the finders' cards, the project kept for a Reroll of the roll that finished it). A pick refused again posts a new card; a project taken back, removed or finished meanwhile can no longer be aimed again, and the card then says who chose the target.

A student who found a secret project with Observe is told only that it is finished, and learns no passage from it. The card comes when one of that player's characters is next in the project's room, or at once if one stands there; until then it waits with the GMs (**Back up** keeps it).

### 11.3 A breach

The wall keeps its place, cut short where the hole begins; the hole is a wall of its own that stops no move, no sight, no light and no sound, and the rest of the wall is a copy beyond it. Everyone sees the hole. A passage on that wall stays on the piece that holds it, and the one the hole touches is made public: secret again if a Reroll takes the breach back or the season is reset, public still after a Close the breach (the hole was seen). One breach to a wall: a second on it waits until the first is closed.

The room beyond is forced on every piece of it: its lock and its bedroom door stop nobody, with a key or without, until the wall is repaired, and its seal is lifted until the end of the time of day, with no Despair given back. A Chained student stays chained, and the courtroom is never opened.

The students in the two rooms are told a wall gave way, named after the builder only when the builder stands in one of them, and the students in the rooms beside hear a crash and the room it came from; these cards carry the sound "A wall is breached" (section 17's World sounds). The GMs are told the room is forced, with the seal's lift if there was one. The bedroom's owner is told their door stops nobody when they next walk into the bedroom, or at once if they are in it, and not again if they stood in either room; a forced door, a careless pick and a repaired lock reach the owner the same way, one card for all that happened while they were away. The builder is told by the project's own card.

The Passages tab lists a breach as Kind Breach, Origin Project, with **Close the breach**: the wall given back exactly as the cut found it, the hole and the copy deleted, the passages it moved moved back, the room no longer forced (unless another breach forces it), and its seal put back if it was lifted in this same time of day. If a GM deleted the wall meanwhile, Close the breach rebuilds nothing and says so: the room beyond is given back and the breach leaves the list, and the hole and the pieces are left for you to delete by hand. The season's reset closes every breach first (section 16).

### 11.4 Indirect murder and traps

A trap is built as projects: Prepare the Weapon (Standard to Complex, 4 to 6 progress; it may need a specific room unless the tool was obtained) and Set the Trap (Trivial to Standard, 3 to 4; always a specific room). The card advises about 7-10 progress in total, the two parts' sums at their smallest and largest scales, roughly 4 to 5 actions at 2 progress a Work (a 12 and the +1 for working alone). While working on it with others present the killer rolls Shadow against **16** to conceal their intent:

| Concealing (Shadow, 16) | What happens |
|---|---|
| Success | nobody sees |
| Success with Despair | nobody sees and the project gains +1 |
| Failure | the others get a general description ("fiddling with test tubes"): the room is told by itself, the worker and the room named, the project not; add the detail if you wish |

A Work on it with nobody else in the room gives **+1 progress** on top of what the roll earns, a miss included. Each Work also rolls **Hide the Traces** (Shadow):

| Hide the Traces (Shadow) | Remnant left |
|---|---|
| Below 12 | Obvious |
| 12 to 17 | Evident |
| 18 or more | Subtle |
| Critical | Hidden |

**Traps: the module watches, the GM fires.** A project marked as an indirect murder carries a trigger, chosen when it is created or edited:

- somebody is alone in the room;
- somebody enters;
- somebody searches it (a successful Search: one that draws from the room, or asks you for something specific and finds it on the dice);
- somebody rests here;
- somebody uses the planted item;
- somebody works on a named project;
- somebody sabotages a named project;
- somebody hunts for a hidden stash here (hit or miss);
- somebody hunts for a secret passage here (hit or miss);
- or "My own condition; I watch for it" (nothing watches it: the card comes when the project is finished).

Two modifiers narrow it: **Only after dark** (Evening, Night, or any Eclipse) and **Not the one who built it** (on by default). The trap arms when its bar fills. If the bar is taken back under its target (a Reroll, your -; an Earthquake takes nothing from a finished project), it disarms; filled again, it arms again unless it has already fired, and that one only you re-arm. When the condition matches, an alert goes to the GMs only: it names the trigger, the person, the room and the scene it is on (for a trap on an object, the room and the scene its holder stands in) and the time of day, and carries the killer's typed condition. **Spring the trap** opens the murder screen with the killer filled in and *indirect* ticked, for you to pick the victim; **Rearm the trap** re-arms it. Nothing reaches the killer's thread, and the card's title says only "A ruling to make".

> [!IMPORTANT]
> A trap that has fired disarms itself until you re-arm it.

The planted-item trigger works through **Plant the item** on the finished project: you choose which object is the trap and which room it waits in. It arrives as whatever the next successful Search there was looking for, and which item is poisoned is kept with you, never on the item.

**What a console can read.** A project's name, its progress and who may see it are world data every browser holds, so a secret project is hidden from the screens of those not in on it, not from their consoles. Who builds a trap, the condition typed for it, its trigger and its modifiers, whether it is armed and when it last fired, and who sabotaged a project are the GMs' (section 14). A GM browser that is missing a trap's record cannot arm or fire that trap; the case health check counts such traps (section 14.8).

---

## 12. The Eclipse

The Eclipse is the placement window between two times of day: the lights go out, nobody sees anyone, and everybody moves their token to where the next time of day finds them. It is named after the time of day it *opens*: the Night Eclipse runs before Night.

### 12.1 Starting it

Press the HUD's right chevron, or **Start the Eclipse** on the GM panel's Next line; both ask first, with **Start it** and **Cancel** (the default). The Eclipse does not start:

- during a Class Trial (the HUD shows no chevron there): end the trial first;
- while a found body waits for its Investigation (13.4): the HUD's chevron is dimmed with the reason on it, and starting it tells you *A body has been found - start the Investigation first.*;
- while an incident is at its opening or its fight (Stages 4 and 5): the chevron is dimmed the same way, and starting it tells you *An incident is running - close it first.* From Stage 6 on the Eclipse starts, and a betrayal can be declared in it (section 13.3).

As it starts:

- the Overflow is checked for the coming time of day;
- **actions and Free Moves are refilled, and any unspent Sprint or Burst expires**: this is the one refill;
- seals, Chained and Silence, which last until the time of day ends, barricades, a room action's effects that last until the time of day ends (at the Night Eclipse, also those that last until the day ends) and a Pick the Lock way in nobody has walked through yet all end, so none of them lasts into the dark or is still on a sheet when a murder declared in it is judged; a time of day changed with no Eclipse ends them as it changes;
- a Keep Watch declared before it takes its post in the room the watcher stands in, and the watcher stays at that post (section 5);
- the card announces the number of crossings, and each player is whispered their allowance and their room;
- each player gets a notice summing up what they did in the time of day that ended (a GM gets the whole table's; when nothing happened, no notice), the same notice **Skip the Eclipse** opens when a time of day ends without an Eclipse.

An Eclipse opened again for the same boundary, after an End without advancing more than five minutes on, refills nothing a second time, and the question says so; the Sprint and Burst grants bought since still end as it opens, and so they do at **Skip the Eclipse** over such a boundary.

### 12.2 In the dark

Ordinary Eclipses allow **2 crossings between connected rooms**, plus any a room action gave the student; the **Night** Eclipse lets everybody pick any room on the map. A Darkness draw (section 7) pulls the Night Eclipse back to 2, and an ordinary one to 1. Each crossing is judged against the allowance, and its card goes privately to the mover alone, naming the room crossed into when that is a room of a scene the student has a token on, else the room the token stands in. A crossing past the allowance is put back to where the token stood; with no GM connected to answer, a crossing is refused and the token goes back; a route refused part-way goes back to the end of the last crossing it was allowed.

Movement is the only thing that works. A **Direct Murder** may be declared (it spends an action from the new budget and is parked); Calls, handovers, other actions, the murder tile and body discovery are all refused. Music switches to the Eclipse playlist. No player is in voice until it ends, the dead included, and the GMs share one channel.

> [!IMPORTANT]
> Nothing opens without you: each declaration posts a card in your chat log as it is made, whispered to the GMs with the title "A ruling to make". The killer proposes the statistic of their opening roll, and the card offers an **Allow:** button naming the proposed statistic, a **Change to:** button for the other one, and **Refuse** (with no proposal, an **Allow:** button for each). One you have not ruled on is asked at the lights, and closing that window refuses it. A refusal reaches the killer privately at once; an allowance is not told, and the killer hears the answer when the lights come up. If the card is lost, section 20.3 has the console call that rules on it.

### 12.3 Ending it

Press the HUD's play button, or **End the Eclipse** on the panel's Next line; they do the same. When every student who places has crossed at least once, in the Night Eclipse too, it ends at once and moves the clock. A student who stays where they stand crosses nothing: their player says **Done** in the round of section 12.4, or you decide in the placement table. Otherwise the placement table opens (who moved how many times, where they stand; those who have not crossed are grayed) with:

- **End and move the clock**: the normal path, which advances the clock with no second refill;
- **End without advancing**: within five minutes of the Eclipse's start this also takes back what its opening refilled (the actions, Free Moves, Search Tokens, Sprint and Burst grants and seals as they were, and the room actions' effects and the unused Pick the Lock ways in that its start ended; a barricade is not put back) and says *Taken back: the actions, the Free Moves, the Search Tokens, and the seals are as they were before this time of day began.*, so the next Eclipse refills once again; later, it keeps them. A Morning Eclipse ended this way also takes back the next day it opened on the boards: your morning line goes back to your draft;
- **Cancel**, which closes the table and leaves the Eclipse running.

Then the parked Direct Murders are judged against where everybody ended up: **exactly one other character in the killer's room** makes that person the victim, anything else fails and the killer is told why, and only the first valid declaration opens an incident. A second killer whose declaration also held is told only your ordinary refusal ("The GM did not allow it. The action is spent."), and you are told who it was. A Keep Watch's watcher gets a summary of how many entered and left their post, and the watch is over.

### 12.4 The players first

Before the clock moves on your press (the chevron, **Start the Eclipse** after the question, **End the Eclipse**, or **Skip the Eclipse**), every player who owns a student of the cast (the living and the Monocubs) gets a window naming what you want to do, with **Done** and **One moment** (the default; after it the window comes back with **Done** alone). Your window lists each of them as *Done*, *One moment*, *No answer yet* or *Not connected - counts as Done*, and goes on by itself once every connected player has said Done (at an end, also only once every student has crossed or their player has said Done). Its own buttons (**Start it**; **End and move the clock** or **End without advancing**; **Move the clock**) go on past the others after a confirmation, **Go on** or **Cancel** (the default, back to the window); at an end with a student nobody has placed for, the placement table asks instead. The window's own **Cancel** ends the round and closes the players' windows, and each player is told you are waiting a little longer. A player's answer moves nothing itself: your window moves the clock, by its button or by itself at the last Done.

There is no round while an incident runs before Stage 6, in a Class Trial, or with no player of the cast connected. Edit campaign, the rewind and the console ask nobody, and a clock they move ends an open round. Only the primary GM runs a round: another GM's press asks the primary, a second press joins the round already open, and with two GMs on one round the clock moves once. An incident or a Class Trial that begins while a round is open changes nothing in it; when your window goes on, the players' windows close as at any other round, the clock does not move, and you alone are told so in one line. A round whose GM is no longer connected is ended by the next press of another GM, who is told so in one line. While a round is open, the panel's **Next** line says so, and its button (**Move the clock on**, or **Start the Eclipse** or **End the Eclipse**) opens its window again.

### 12.5 What the dark keeps

The declarations and the crossings are the GMs' (section 14) from the moment one is made to the lights, and a declaration outside a running Eclipse is refused. A console can still read that the killer's action was spent, since an action budget is actor data, and where every token ends up is world data (section 1.6).

---

## 13. The murder engine, end to end

The module owns the numbers: thresholds, the drain, turn order, damage, and which Remnants each outcome leaves. The prose is yours: every outcome's sentence is shown to you and the participants to finish at the table, and you decide whether the killer is in the right room and whether a stage has gone on long enough. The stages keep the game guide's numbers: a murder runs through Stage 4 (the opening), Stage 5 (the incident) and Stage 6 (cleaning up), and the Investigation that follows the body's discovery is Stage 7. Technical notes: section 22.

### 13.1 Opening

A murder opens by one of two roads. A player declares a **Direct Murder** during an Eclipse; it is parked and judged at the lights, and the victim's player's consent is a table agreement with no checkbox for it. Or you open it yourself from **The case** > **Murder**: killer, victim, and *A trap (the victim alone, losing double)*, which ticks itself when that killer has a finished trap; fired from a trap's card, the window opens on the student the trap read. The window warns you when the named killer is not among the living, and when a direct murder's two stand in different rooms (open it anyway if the story has already brought them together). One incident runs at a time. One name in both fields opens a death by their own hand: Stage 4 still rolls, Stage 5 cannot run, the incident goes straight to Stage 6, and the death is recorded when you close the incident.

**Stage 4, the opening roll.** A direct murder opens on the **killer's** roll: Body or Hand against **8**, with advantage at Night. Which of the two is yours to pick (section 5): in the murder window when you open it yourself (*Opening roll's statistic*), otherwise in a window on your screen as the roll goes out. While you pick, the killer alone is told privately that you are choosing and asked to say in their thread how they go about it; the invitation then carries your pick, locked, and goes away when the opening resolves. A victim keeping a running watch of 18 or more, or a critical one (Keep Watch, section 5), puts one hindrance die on the killer's opening roll; the killer's roll window names it *a hindrance die*, never why, and it cannot be turned off.

What the roll came to, its total against the threshold and its band, goes on a card to you and to the roller's side (the killers; for a trap, its victim); the Key Remnants it leaves and the table's text are told to you alone. A failed opening is also said on screen to the GM who scored it. A roller who closes the roll window is offered it again, 3 times in all; after that you are told they did not throw it, and **Ask for the opening roll again** on the tracker asks once more.

**The killer proposes.** A Direct Murder declared in an Eclipse carries the killer's proposal: under their sentence of how, their declaration window asks *Which statistic do you propose?*, Body or Hand, Body to start. The card that asks you to allow it says *Proposed: Hand* and offers **Allow: Hand** on the proposal, **Change to: Body** on the other and **Refuse**, each button with the killer's value; a card with no proposal offers **Allow:** on each of the two. The question at the lights, when you did not answer during the Eclipse, offers the same buttons, with Cancel the default. The opening then rolls on the statistic you allowed, with no second window. The killer hears nothing of your answer before the lights, so there is no *I'll pass* here.

A betrayal asks no leave: its confirmation asks the same proposal (and *How do you do it?* outside an Eclipse), your opening window offers **Approve: Body** (or Hand) first, and the killer is told you are ruling on the statistic they proposed. A trap victim's opening stays your pick with no proposal, as does a murder you open yourself from the case, and **Ask for the opening roll again** asks with no proposal.

| Killer's roll | What happens | Key Remnants the case will hold |
|---|---|---|
| Hope | the incident begins | **5** |
| Despair | it begins; the victim's Sanity drops to 0 at once, and Role Reversal is closed to them for this incident | **4** |
| Critical | it begins, leaving the fewest Key Remnants | **3** |
| Failure | no incident; the victim never learns anything was attempted; the action is spent | - |

**The killer behind a "?".** A direct murder's opening that succeeds with Hope, or is a critical, hides the killer. Their tokens on every scene become a "?" with Foundry's mystery man, with no ring, name or bars, and their look comes back exactly when the mask ends. Nobody but the killers is told who it is: the victim's Event card and turn row name nobody, the victim's first whisper says *someone*, and a sheet of the killer that another player has open closes. The killer is moved to a silent voice room of their own, where they hear nothing of the room and nobody hears them, and their microphone is blocked; a block you set yourself stays, and the module lifts only its own. You and the Spectators see the name over the "?". The killer is asked *Stay hidden?* and keeps **Reveal yourself** on the voice tile; the mask ends at the reveal or at the next time of day, not with the incident. A player who reads the browser's console, not the interface, can still tell who is behind the "?".

**A trap opens on the victim's roll**: Eye or Head against **20**, the same by night as by day, and you pick between the two the same way. The victim is told only that a roll is being set up for them. The Key Remnant count is never below **3**, and a trap always leaves the case its full 5.

| Victim's roll | What happens |
|---|---|
| Hope | something is wrong - they may spend their Free Move, if they still have it, to get out, and if they do they live (the module grants no extra Move) |
| Despair | they work out what was set up and may tell the others; the project stays active |
| Critical | they spot the trap and whose hands built it |
| Failure | the trap closes |

Every success leaves an Evident Incident Remnant, and a noticed trap leaves the incident sitting at its opening until you close it from the tracker. The victim is told the incident began only when it actually begins. In a direct murder their screen shows nothing of it while the killer rolls - no cast, no card, no murder music, nothing on the Event panel; a success gives them all of it at once, with a whisper naming the killer (it is fought face to face), and a failure leaves them nothing.

### 13.2 The incident (Stage 5)

**Turns and the drain.** The incident is turn-based, the victim first; a round is the victim, then each killer in turn. A killer who is dead to you takes no turn; when none is left alive you are told and offered the close. Each time the turn comes back to the victim (their first turn is free) it costs them **1** Sanity in a direct murder or **2** in a trap, where they are alone with it; once Sanity is gone it costs Health. A critical Self-Defense stops the drain.

**In a trap only the victim acts**: the builder is elsewhere, so each of the victim's turns hands the turn back to them, and the round, the drain and the hindrances move on with it. A trap's victim has advantage on every crisis roll, and their Leave a Clue and Secure a Trace list Body first, instead of Shadow (Body / Hand / Leg), and leave Reinforced Remnants on Hope as well as on a critical (two of them on a critical). The Remnant types, Incident among them, and what Reinforced means are in section 14.1.

**Defense.** An action aimed at the other side is +1 harder when the defender's statistic is +1 or better: the victim's Body against Strike, Attack with a Weapon and Pin Them Down, the victim's Leg against Keep Your Distance, the killer's Body against Self-Defense and Role Reversal, and the killer's Leg against Survive and Escape Together. It counts on the tile, in the roll window and in your judgment alike, and never on the opening rolls or the Finishing Blow.

**Who sees the dice.** The participants roll in front of each other: each sees the others' dice, and the crisis card says what each roll came to and which action it was, with or without Dice So Nice. Nobody else sees them: a trap's builder sees none of its dice and none of its cards, the card of the action that ends it included.

The crisis actions, with the statistic and threshold. Where a row lists several statistics, the player proposes one and you rule on it as in section 5, unless they armed *Resolve*, which lets them pick:

| Side | Action | Roll | What it does |
|---|---|---|---|
| victim, killer | Use an Item | Hand 15 | Get something out of a pocket. Every hit leaves a Remnant (Evident on Hope, Subtle on Despair, Obvious and Reinforced on a critical). Works on a critical or a success with Hope; with Despair, the Remnant and nothing else. A critical keeps the turn. A failure with Despair costs 1 extra. A Tier 0 item waits for your ruling, as outside an incident, and is not used up until you rule. Not a third party's |
| victim | Leave a Clue | Hand/Leg/Shadow 12 | A Remnant tied to the crime, left at the scene to help the others (Evident / Subtle / Obvious; Reinforced on a critical). A critical keeps the turn. A failure with Hope gives advantage on the next attempt at this action |
| victim | Secure a Trace | Hand/Leg/Shadow 15 | A Remnant tied to the crime, left at the scene and Reinforced on every hit (Evident / Subtle / Obvious). A critical keeps the turn. A failure with Hope gives advantage on the next attempt at this action |
| victim | Self-Defense | Hand/Leg/Body 18 | Fight. Hope opens Survive and Role Reversal; Despair opens Role Reversal only; critical stops the drain, opens both, and one may be taken this turn without rolling. A weapon gives advantage. Role Reversal opens only where it is available; a Self-Defense that would open nothing else (Despair, with Role Reversal not available) is not spent and may be tried again. A failure with Despair costs 1 extra |
| victim | Survive | Leg 18 | Ends the incident and the drain. Despair adds a hint about who they were; critical adds immunity for this chapter and the next. Needs Self-Defense first. A failure costs 1 extra |
| victim | Role Reversal | Hand/Leg/Body 15 | Become the killer. Hope or a critical also restores all Health and Sanity; critical kills the original killer outright. Needs Self-Defense first. Not available against a trap, or once somebody has joined the killer (Partners in Crime, Double Role Reversal). A readied weapon gives advantage. A failure with Despair costs 1 extra |
| killer | Strike | Hand/Leg/Body 15 | 1 Health and 1 Sanity off the victim, leaving a Hidden Remnant on Hope and a Subtle one on Despair; critical: 2 of the killer's choice, and no Remnant. A Despair failure still takes 1 Sanity and leaves an Evident Remnant |
| killer | Pin Them Down | Body 12 | Disadvantage on Leave a Clue and Survive for the victim's next two turns; a critical blocks both for those turns. With Despair a hit leaves a Subtle Remnant and a miss an Evident one |
| killer | Keep Your Distance | Leg 12 | Disadvantage on Secure a Trace and Role Reversal for the victim's next two turns; a critical blocks both for those turns. With Despair a hit leaves a Subtle Remnant and a miss an Evident one |
| killer | Attack with a Weapon | Body/Hand/Leg 15 | Damage 1 + half the weapon's tier rounded up (critical: 1 + tier). Unarmed rolls at disadvantage and a success improvises a weapon (Tier 2 on Hope or critical, 1 on Despair). A Tier 0 object's damage is yours to set, 0 to 2 |
| killer | Finishing Blow | Body/Leg/Hand | Threshold is **5 times the victim's remaining Health** - free at 0. Ends the incident; Despair leaves an Incident Remnant; critical: the striker's first clean-up attempt in Stage 6 costs no Sanity, hit or miss |
| third | Escape Together | Leg 15 | Both get out; Hope or critical restores the victim; critical adds immunity for this chapter and the next; failure: only the third party leaves, and does not walk back in |
| third | Double Role Reversal | no roll | The victim and the third party become the killers; the original killer starts bleeding. Heals nobody. Leaves an Evident Remnant |
| third | Partners in Crime | no roll | The third party joins the killer. Leaves a Subtle Remnant |
| third | Averted Eyes | no roll | Walk away, no Remnant of you, and do not walk back in |

A cost of "1 extra" is 1 more Health or Sanity on top of the drain. Resolution actions (Survive, Role Reversal, Escape Together, Finishing Blow) cost **1 Sanity** rather than an action, or **1 Health** when there is no Sanity left; the third party's three no-roll choices are free.

**Walking in on it.** In a direct murder, a character whose token crosses into the room gets one free choice among the third-party resolutions, automatically; a token crossing in is the only road, and there is no manual "somebody walks in". **A fourth person cancels the incident** where it stands: nobody dies, nobody is Blackened, what already happened stands, and the newcomer is told nothing. A third who walked away - Averted Eyes, or a failed Escape Together - stays out: their token crossing in again takes no seat. A victim who runs out of both Health and Sanity dies without a Finishing Blow, and then nobody earns what a critical there grants. Nothing here kills by itself except the engine's own endings.

> [!IMPORTANT]
> Some outcomes on the table above are prose for you to deliver rather than effects the engine applies: restoring the victim after Escape Together, immunity for this chapter and the next, Survive's hint, and the original killer's death on a critical Role Reversal (the engine swaps the sides, restores the new killer and leaves the Evident Reinforced Remnant; the death is yours to record). The swap restores the new killer only on Hope or a critical; nobody else's Health or Sanity comes back with it.

The **incident tracker** (the Murder tile while one runs) updates live and keeps one width from the opening to Stage 6. It opens on the turn bar - the stage, the turn and whose side acts, in that side's colors; in Stage 6, that the turns are over - and then three facts: **Who** (who is moving on whom, and any third party), **Left** (what the victim has left of Health and Sanity, as their sheet says it) and **Case** (the Key Remnant count). While the opening waits it shows whose roll it waits for and to whom the invitation went; during the fight, the last three turns - who, which action, how it came out; in Stage 6, a read-only list of the Remnants in the killer's room with each one's erase DC, or one line when the room holds none. Its buttons are **Ask for the opening roll again** (while the opening waits, at most once every 10 seconds), **Pass the turn** and **End the murder**. Opened with no murder running, it says *No murder is running.* and offers **Open a murder...**, which opens the Murder window; once an incident opens, that window becomes the tracker.

Stage 6 begins by itself after a Finishing Blow, a victim run out of Health and Sanity, a successful Survive or Escape Together, or straight after a death by their own hand. It also begins when you mark the victim dead with **A character dies** and accept the prompt that follows. A player's Reroll on a crisis action is judged against the record the tracker keeps; a Reroll of an action that killed somebody is refused, and the death stands.

On the sheet the fight is one tile: **Fight back** on the victim's side, **Crisis actions** on the others, marked free and with no GM chip; off-turn it is dimmed and says whose turn it is. Its menu lists the side's actions. Picking one unfolds what it costs, which statistics it rolls and what a miss does, with a field under it, where it lists several, to propose one and say how. **Roll** carries the proposal to the GM's card (a GM rolling for a character answers in their own window) and then goes on to the roll window; a take that needs no roll says **Do it** instead.

### 13.3 Cleaning up (Stage 6) and Tamper

When the incident ends with a body, the killer can finally see the Remnants they left, on their sheet, and work on them. In their own Stage 6 each attempt costs **no action and 1 Sanity**, and the first attempt after their critical Finishing Blow costs nothing, hit or miss; every Remnant in the room they stand in is theirs to work on, found or not. Through the **Tamper** tile in ordinary play an attempt costs an action and no Sanity, with no action left there is no Tamper, and it reaches only the Remnants listed under Tamper in section 5. There is no cap on attempts in a time of day: each costs its price, and nothing else limits it. In Stage 6, erasing, reshaping and planting a trail roll Shadow and Move the Body rolls Body, with nobody asked, as through Tamper in ordinary play (with *Resolve* armed, the killer picks in the roll window). A readied Cleaning Tool gives advantage and takes its tier off the DC.

| Remnant visibility | DC to erase |
|---|---|
| Hidden | 9 |
| Subtle | 12 |
| Evident | 15 |
| Obvious | 18 |

**The scene is still warm:** **-3** on every DC while an incident runs or a body of this chapter that the roller knows of lies unfound, until the body is found or the Investigation starts. With no incident and no unfound body - an ordinary day - there is no discount. After every relief (the tool, the warm scene, a reshape's 3) a clean-up DC is never below **8**, on the card and where the GM scores it. Outcomes of **Erase a Trace**:

| Erasing | The Remnant |
|---|---|
| Critical | gone and 1 refunded (the Sanity or the action that paid), and the roller is offered to reshape the Remnant instead, choosing how loud it reads; a reshape you decline leaves it gone |
| Hope | gone |
| Despair | gone, but an Evident Faint Tamper Remnant is left |
| Failure with Hope | still there, plus a Subtle Faint Tamper Remnant |
| Failure with Despair | still there, plus an Evident one |

Reinforced Remnants never come off.

**Reshape a Trace** is also an attempt of its own, 3 easier than erasing. The roller writes a new name (up to 60 characters) and description (up to 400), the Remnant always becomes a Tamper Remnant, and the rewrite reaches you as a card to approve or decline: nothing is written until you approve. A critical also makes it one band quieter and gives back what paid (the Sanity, or the action). The card says how many copies of the Remnant are already held: those keep the words they were found with, and whoever finds it afterwards reads the reshape. There is one ruling per reshape: a second GM's ruling, or a second click of yours, is refused and told who ruled. A reshape that carries only one of its two fields is refused. An attempt the module refuses - a Reinforced Remnant, one the player has not found, or a Stage 6 already over - gives back what it cost and tells the player why.

**Misleading Trail** (**15**) plants a Prep Remnant pointing at another living student (Evident / Subtle / Obvious); a Hope failure leaves a Hidden Faint one, a Despair failure nothing. **Move the Body** (Body, **16**, 1 lower per tier of a readied Cleaning Tool) carries the body into a connected room the killer picks before the roll, never a bedroom and never through one. A room two away is listed under its own heading and only a critical reaches it: any other hit leaves the body in the room between. A success always leaves an Evident Tamper Remnant; a failure leaves the body where it was. A critical on either gives back what paid (the Sanity, or the action).

A success of either - the trail planted, the body moved - gives the killer the Truth Bullet of the Remnant it left at once, as a find (*You know this Remnant: it is on your sheet.*). No failure does, nor an erase or a reshape. A Reroll of that roll takes the Truth Bullet back (*The new dice take back the Truth Bullet of the Remnant you left.*), and the Remnant stays where it is.

With anybody but a fellow killer in the room, erasing, reshaping and planting a trail first roll Shadow against **16** to cover what they are doing; moving the body does not:

| Covering (Shadow, 16) | Costs |
|---|---|
| Success | free; a critical gives 1 Sanity back |
| Success with Despair | 1 Sanity |
| Failure with Hope | 1 Sanity |
| Failure with Despair | 2 Sanity |

A failure lets the others see roughly what they are up to.

**What breaks.** Only an incident that reached Stage 6 breaks anything. When it closes, every Murder Weapon a killer swung in the fight is marked Broken - each killer's, an accomplice's too. A Finishing Blow swings nothing, so a weapon only held while it landed stays whole, and a failed opening, a trap or an early close breaks none. When the body is found, every Cleaning Tool a killer wore for a clean-up attempt is marked Broken, readied or put away since, as long as it is still carried and not stashed; a killer who never cleaned up loses the Cleaning Tool in their hand at that moment instead. Only the killers of the bodies found lose one: a betrayer's Cleaning Tool stays whole while nobody has found their victim. Both stay in the bag as evidence the killer has to throw away or stash. The owner is told only of an item that actually broke.

**The betrayal window.** Once the incident has left a body, its third party may turn on the killer: an accomplice - a third who sided with the killer - or, in a direct murder, a third who walked in and stayed without choosing anything. Never a third who left (Averted Eyes) or tried Escape Together, and never, in a trap, a third on the victim's side. The offer lasts until the end of that day, the Investigation included, survives the incident closing and is single-use; it cannot be taken while another fight is running or during a Class Trial. Of the players, only the one it is offered to sees it. Taken in an Eclipse, it is declared like any action there: it costs an action and opens when the Eclipse ends - after the Night's Eclipse, on the next morning - and a second declaration in the same Eclipse is refused. A betrayal that cannot open when its time comes is refused with the reason, and the offer goes back while its day holds. It opens a second incident with the body still on the floor. Your after-incident screen (13.4) carries the button too, except during a Class Trial.

### 13.4 After the incident, and body discovery

Closing the murder tells each of its players that it is over, in a card that names nobody, and a living victim that they can act again; a direct murder's victim during the opening roll, and a trap's builder before Stage 6, are told nothing. Only an incident that left a body records the **Blackened**, the killers the chapter's Class Trial is to find (every killer of the chapter, including a betrayer), and one that reached Stage 6 breaks the weapons swung (13.3). With a body, closing opens the after-incident screen, *The incident is over - what now*: **Body found** (announce it), **Move to Investigation**, **Issue Autopsy Truth Bullet**, and the betrayal if one is on offer; it also reminds you how many Key Remnants still need placing, and to issue the autopsy. Without a body nobody is Blackened: after Escape Together you get the escape's own screen, after another survival a short one saying so with a button to the Remnants, and an incident closed before Stage 6 says it was interrupted and nobody died.

**Body discovery** is asked of you when two or more students stand in the room where this chapter's body lies (its body tile, or its token while it has none), at least one of them <ins>unconnected to the killing</ins>: neither a recorded Blackened nor a killer of the running incident still cleaning up in Stage 6. Killers over their own victim are a frame-up, not a discovery, and Monokumas and the dead, Monocubs among them, are not witnesses. It is never asked during an Eclipse. You can also start it with the **Body found** button.

**The module asks before it announces.** When the witnesses reach the count, the discovery waits, and the primary GM is asked in a window, *Students found a body*: **Announce** runs the discovery, **Not yet** keeps it waiting and is the default, so Enter announces nothing. Only a full Gamemaster answers it: while only an Assistant GM is connected, the discovery waits for a full Gamemaster. A waiting discovery survives a reload and is asked again when the primary GM reloads, or when a GM leaves and another becomes the primary; until then the **Body found** window names it (*Waiting for your word*) and opens on its room and body, one press from announcing. Meanwhile every witness is told privately that they found the body, as a lone finder is (below), in a sentence that says they are not alone.

The discovery then runs in this order: it publishes every kept death of a body in that room, marks Broken the Cleaning Tools the killers' clean-up attempts wore (13.3), gathers everyone to the room (each player's screen moves to their own token), announces the body to the table with its sound, pauses the music and **holds**. Only then does it ask you which of this chapter's Faint Prep Remnants belong to this murder; those become permanent evidence. A body found this chapter is announced once: a verdict, the end of a trial or a walk past it later does not announce it again, and its body card stays up through the Investigation. Only the primary GM can announce a discovery: on another GM's screen **Body found** announces nothing and says whom to ask. In that window a body already announced this chapter is marked so, and announcing it by name again is refused; leave the body unnamed to announce another one in that room. A death that cannot be made known is not named: the discovery leaves that student out, and the GMs are told to make the death known by hand. An execution - a verdict's or the Final Trial's - is never a body to find.

> [!IMPORTANT]
> The phase stays Daily Life until you start the Investigation from the Next line or the after-incident screen. The hold stops nobody: the students' actions stay open, and only the Eclipse waits for the Investigation (section 12). The silence and the pulsing body card last only the time of day, day and chapter the body was found in; the hold itself lasts until the phase moves, the chapter ends or a reset takes it (*The body waiting to be answered*). A body announced once the Investigation has started holds nothing: the Eclipse is not refused over it.

**A death kept until the body is found.** When the running incident's victim dies - a Finishing Blow, a victim run out of Health and Sanity, a death by their own hand at the close, or **A character dies** with *Keep it the GMs' until the body is found* ticked, as it is for that victim - the module keeps the death for the GMs and nothing reaches the table: the student is not marked dead, no dead marker appears, and the Truth Bullets stay on the sheet. The death card goes privately to the GMs and the incident's players, and its sound to them alone. Only these know of the death: the GMs, the incident's players (a trap's killer included), the victim's own player, and later a lone finder. Any other death - an execution, a ruling, the dialog with the box unticked - is the table's at once.

Two things make a kept death known, and only two. The first is the body's discovery, whose first step publishes every kept death of a body in that room, on the scene where the students walked in on the body whichever scene you are looking at, or, when you announce it from the form, on the scene you are looking at. The second is your hand: the student set to *dead* in the Students window, where they show as **Dead, body not found** (section 3). Then the Truth Bullets go (unless kept), the death is dated with the kill's chapter, day and time of day rather than the discovery's, the marker appears, and whoever took something off the body meanwhile is given its Truth Bullet (section 10). Nothing else publishes it: the Class Trial's start only tells you, in a notice that stays on screen, how many deaths nobody has found, and the chapter's end says nothing of them.

Until you publish a kept death, the table and the trial treat that student as living: their player is sent a ballot, their name stands on it with no dead mark, and a correct verdict's Level Up is theirs too. Closing the murder still records the killer in the Blackened register, but the trial counts a killer only for a death the table knows: the ballot asks for no name for a death nobody has found, and a verdict neither executes nor rewards its killer for it. The same holds for a death you take back: a victim you revive leaves their killer uncounted. Publish the death before you open the vote if the trial is to ask for its killer. A kept death from an earlier chapter is never found by itself, since discovery looks only for this chapter's bodies: publish it by hand. Published in a later chapter than the killing, it reaches no trial: a trial counts the Blackened of its own chapter only, so it neither asks for that death's killer nor executes them.

A *dead* status you toggle on a token by hand is neither of the two: the module reads its own record and never the token's status icon, so to the module that student is still alive: a trap they set still watches, and they count among the living everywhere. Record a death from the Students window (section 3).

Before the discovery, the victim's own sheet shows the dead panel with *Nobody has found your body yet.*, and what their player tries is refused as it is for the dead. A refusal that only an undiscovered body explains - handing an item to them, arming a Call on them - is told to whoever asked as *You cannot do that right now.*, and the reason goes to your **Debug log**. A Call is refused so only after every check a Call on a living student faces, the buyer's Hope among them. An assembly leaves the body where it lies. What the table can still read is actor data (section 1.6): the victim's Health at 0.

**The discovery sound for the one who walks in.** Whenever a student's character walks into a room where a body lies - any death, known to the table or kept, announced or not, alone or not - their player hears the discovery sound, and nobody else does. It plays once per body for each character, remembered over a reload; a student revived and killed again is a new body. A step inside the room the character already stands in is no entry. It does not play during an Eclipse, for the dead or a Monocub walking, for that body's own killers or the third of its incident (they were there), or while none of the character's players is connected (they hear it at their next walk in). The announcement's own sound to the whole table is unchanged, and the students it gathers are not played the walk-in sound again.

**The lone finder.** One student unconnected to that killing - a killer of the chapter's other incident included - who stands alone in a room with a body nobody has found is told privately, with no chat card: *In {room} you find the body of {name}. Nobody else has seen it yet, and nothing is announced.* From then on they know of that death: their screen alone draws the body's dead marker, and they may take from the body (section 10). What Tamper allows anybody, it allows them; moving the body stays the killer's. Nobody else is told, and one witness is not a discovery: the rule of two stays. At the count of two every witness who does not know yet is told the same way, in a sentence that says they are not alone and that nothing is announced until you say so.

---

## 14. Investigation

### 14.1 Remnants

**Remnants** are hidden tokens dropped on the map where a character stood when an action left one. Each carries its type, its visibility (Obvious, Evident, Subtle or Hidden), who left it, the room, the chapter, the day and time of day, whether it is reinforced (a reinforced Remnant cannot be cleaned) and whether it is tied to the crime. Truth Bullet types mirror the Remnant types:

| Type | What it is |
|---|---|
| **Key** | yours; unremovable; becomes a Truth Bullet unanalyzed |
| **Neutral** | undetermined; Analyze turns it into a real category |
| **Faint** | doubtful, a kind of its own with its own Observe column. Faint is also a mark: a Prep Remnant left by a Search's tool, a Sabotage or a Misleading Trail carries it, and you can mark any Remnant Faint on the Remnants tab; a marked Remnant keeps its own kind and is found and analyzed at that kind's DC. When you tick it in **End the chapter** (section 16), the chapter's end clears every Faint Remnant that is neither tied to the murder nor reinforced, and a Truth Bullet with the mark survives the chapter's sweep |
| **Prep** | left while somebody was gathering tools or preparing something |
| **Incident** | left during the murder itself |
| **Tamper** | left by cleaning. A Broken item thrown away leaves one too: during the Investigation, while an incident runs when the thrower is on one of its sides, and from the moment the chapter's body is found until its trial ends. At any other time a thrown-away Broken item leaves a Prep Remnant |
| **Autopsy** | handed out, never found by Observe |
| **Final Truth** | one per chapter, points at the Mastermind, reinforced |

A running incident's own Remnants are shown to the incident's players as they are made. Hiding one by hand while the incident runs takes it off their screens too. When the incident closes, the Remnants nobody has copied are hidden again, so the players of a later incident are not shown an old crime scene.

Every Remnant token shows one neutral name and a "?" picture, found or not; the name and picture you give it are never written on the token. Your screen draws the Remnant from the case, and a finder's screen draws it from their own Truth Bullet, with its name and picture. A GM sees the icon of the action that left it (Search, project, Sabotage, Dynamic Action, clean-up, incident, thrown away, placed by the GM, taken from a body). A player sees it only once their own copy is identified, and the icon of a Remnant left by taking from a body nobody has found only once that death is known to the table. Double-clicking a Remnant opens its card, where a GM also sets its visibility, as on the Remnants tab.

**Tied to the crime** has three states: undecided, **Tied** and **Not tied** (the Remnants tab's **Tied to crime** column shows them as ?, Yes and No). When the chapter's victim dies, by another's hand or their own, every undecided Remnant of the chapter is tied, and one you marked Not tied stays so. A weapon swung in the fight ties the Remnants that handed it over. The players' identified copies learn a tie when the death is made known (the discovery, the Students window or a public kill), or at the fight's close for a fight that left no death. A Sabotage of an indirect murder leaves a tied Remnant when the trap's killer or proposer made it and an untied one when a bystander did. A Misleading Trail an innocent plants is not tied.

### 14.2 The Investigation window

**Investigation** (**The case** > **Investigation** on the GM panel) is your case file, live. It opens on the Map (section 14.3); its Table has four tabs:

| Tab | What it does |
|---|---|
| **Remnants** | lists every Remnant, with filters by player, room and chapter. You edit its name, player text and analysis text, correct its type (to a kind Observe can find, or keep its own), and mark it Faint, tied to the crime or reinforced. Its **Visibility** column sets how hard a Remnant is to spot (Obvious, Evident, Subtle or Hidden), and so the Observe roll a finder needs, found or not: copies already made keep their visibility, and the next finder's copy is made at the new one. A Reroll of the action or the clean-up that left the Remnant keeps a visibility you set. **Delete** on a row asks first, naming the Remnant, then takes its token off the map and its row out of the case together; a reinforced one is refused, as the message says |
| **Key Remnants** | the planner (section 14.4) |
| **Final Truth Remnants** | places Final Truth Remnants: **Save** places one on the scene you are looking at, somewhere inside the room you pick, and none with no room picked; with none placed this chapter, the tab says so |
| **Who has what** | one row per student: how many Truth Bullets, Keys and not analyzed yet, then each Truth Bullet by name with what it really is, and their other items by name |

The footer carries **New Remnant** (a Remnant of any kind, in any room), **Issue Autopsy Truth Bullet**, **Body found** and **Realization preview**. The two clean-ups are in **End the chapter** (section 16), and the evidence log is in the trial console (section 15).

**Save** writes only the fields you changed and closes the window. Closing it any other way (its X, Escape or **Close**), or with one of the footer's other buttons, writes your changes too, and those buttons bring the window back with what they did. A Final Truth Remnant with its room picked is placed only once you say **Place it**. A field that changed elsewhere while your window was open, such as by another GM's Save or a reshape ruled meanwhile, is marked and not saved, and a notice names it with the value you typed and stays up until you dismiss it; the rest of what you changed is saved.

A kind changed here pulls what depends on it. A Remnant made Faint is Faint on its players' copies too. A planned Key Remnant given another kind is said to be no longer a Key Remnant. A Remnant nobody has copied that is retyped to or from Incident is drawn for the incident's players as if it had been placed so.

> [!NOTE]
> Every Remnant remembers who left it, and only GMs see it (**Left by (GMs only)**). An author you set works as a player's own: **Follow My Traces**, the incident's tie and the killer's clean-up read it, so naming the killer hands the killer that Remnant to clean.

### 14.3 The Map

Investigation opens on the **Map**: evidence on the left, what follows from it in the middle and the solution on the right, with the Remnants not tied to the murder below a gap in the evidence column. The **Table** is one switch away; the switch is yours alone, and each GM's choice is kept on their own account.

Every node shows all it holds, its whole name and its description, and grows to fit; the Map makes room for it. Click a node (or press Enter on it) to open its fields in its place, at its width; a Remnant or a Key Remnant slot shows the Table's own fields. They save when you close the node, pick another, switch to the Table or close the window, and **Close** saves them too, so no Save is needed. **Close**, Escape or a click on empty space closes the node, and its **Move up** and **Move down** order its column by hand.

The row over the Map adds a deduction (**Add deduction**), a counter (**Add counter**) or the solution (**Add solution**). **Add a plan** adds a **Planned Remnant**, a **Planned Final Truth** or a **Planned Truth Bullet** (section 14.5), and the picker beside it sets a column's order: by hand, by kind, by room, by state or with fewer crossings. You set what each node rests on in its own fields.

A node whose trial mode is Straw Poll, Scrum Debate or Logic Dive plans that game in its fields too: the question and two answers (and a Scrum Debate's thesis), or a saved Logic Dive set. Its start button in the trial console opens the **Hall zones** window filled in (section 15.2), and you still press **Start**.

To move around the Map, drag with the middle mouse button anywhere on it, over a node too, or drag empty space with the left button (on a touchpad with no middle button). The wheel zooms where the pointer is, and **+**, **-** and **Fit to view** (or the keys +, - and 0) zoom from the middle.

A deduction's "x/y" counts how many of its inputs living students other than the culprit hold. It is reachable past half (both of two, three of four), and a Truth Bullet only the culprit holds does not count.

The line over the Map names the chapter, its counts and its problems. Open it for **Check consistency**, which lists what does not hold together (a deduction resting on nothing, a solution nothing reaches, a reference to something gone, a mode the trial lacks) and blocks nothing; for who has what, by name; and for the Final Truth form.

### 14.4 Key Remnants

You prepare **5** Key Remnants per chapter, scaled Trivial, Standard, Standard, Complex and Desperate. The scale is the planner's **Difficulty** column, a guide for how hard each one should be to find; it sets no DC, which comes from the visibility you give the Key Remnant when you place it (section 14.6). The opening roll decides how many the case keeps (5, 4 or 3; a trap keeps all 5), never fewer than **3**. Together they should narrow the suspects to **2 to 4** people; the last step from the circle to a name belongs to the trial.

Each row of the planner has a name and player text (what the finder receives), an analysis text (what Analyze reveals), your private note and a **Status**: where it stands on the map, or not placed yet. **Place** asks for a room and a visibility and puts the Key Remnant at a random spot inside that room, Reinforced and tied to the crime, with the words typed on the row. A placed row shows its Remnant's words, and an edit typed over a rename made meanwhile is refused and told. A row past the case's Key Remnant count is placed only with **Create more than the opening roll allows** ticked, and the case's count outlives the incident's close.

The plan is the GMs' (section 14.8) and is kept a chapter at a time: each chapter has its own five rows, and a new chapter opens on an empty plan. A player's request card ("I look at the window") carries **Create a Key Remnant here**, which can fill one of the five slots.

> [!WARNING]
> At the start of the Class Trial the module charges the Key Remnant fee for a failed investigation: every Key Remnant short of **4 found**, or of the case's own count where its opening gave it fewer, is worth **3 Despair to each Monokuma's pool** (`unfoundBar`, `unfoundDespair`, `keyFeeOf`), so a completely failed investigation is **+12** to every pool. Found means a copy a living student holds, as the GMs hold it; a copy whose Remnant is gone counts in the chapter it was found in. It is charged once per chapter, on the primary GM whichever GM opens the trial, the same whether or not the planner was saved, and not at all once the chapter has moved past the case.

### 14.5 Realization and planned evidence

**Realization preview** changes nothing: it lists each Key Remnant slot not yet on the map, and you pick a room for each one to place. A slot's planned room (the room picker beside its **Place**, on the Map and in the Table) is the first choice there and in **Place**; a planned room the scene no longer has is said in one line, and you pick another. A slot also plans its visibility, who left it and its picture: **Place** starts on that visibility, and the realization places the slot with all of them. A slot with no room is named under the Map's consistency check.

**Run realization** places the slots as the planner's **Place** does and marks each in your case. **Undo realization**, in the same window once a run has placed something, asks first, removes only what nobody has found and Monokuma has not revealed, and frees its slot. When a body is found, the primary GM is asked once a chapter whether to open the preview, if the chapter has a case planned and its realization has not run; nothing is placed by itself.

A **Planned Remnant** is placed from its own node on the Map: open it and press **Place on the map**, which opens **New Remnant** filled in from the plan. Its fields are New Remnant's, in the same order: room, type, who left it, visibility, the tie, reinforced, name, words, analysis, your note and its picture. It is an Incident Remnant unless you pick Prep, Neutral, Faint or Tamper, and the visibility and the type set how hard it is to find. One with no room is named under the Map's consistency check, and its New Remnant asks for the room.

A **Planned Final Truth** plans the Final Truth Remnant the same way, with the Final Truth form's fields (room, visibility, who left it, name, words, analysis and your note) and its picture. Its **Place on the map** places it with all of them, and asks for the room when none is planned.

A **Planned Truth Bullet** plans a Truth Bullet you give by hand: the fields of the **Write a new one** tab of **Give a Truth Bullet** (name, real type, how it shows, visibility, Faint, tied, the words, the analysis and your note), its picture, who gets it and whether they are told. Its **Give a Truth Bullet** opens that window filled in, and once the Truth Bullet is given, its node reads Given. Who gets it can be **Everyone**, in the plan and in Give a Truth Bullet: every living student gets a copy of their own (the dead, Monocubs and Spectators do not), each told or not as you set. The plan reads Given only when every copy went out; otherwise the window names who got none, and you can give it again. On the Map, a Truth Bullet everyone holds is still one input. One with no name or no recipient is named under the Map's consistency check.

The Truth Bullet carries the planned picture. Every plan's empty picture field shows the module's Truth Bullet drawing, and a Truth Bullet given with no picture planned carries it, as does a Planned Remnant, a Planned Final Truth or a Key Remnant slot placed with no picture.

**Planned Autopsies.** The evidence column always has at least one Autopsy Truth Bullet node: write its name, its words for the players and your note in its fields. The first one's fields also hold how many the chapter plans; the preset is one for each body (the bodies found and the murder's victim, and one while the chapter has none), and you can pick more or fewer. Each planned Autopsy with a name or words written goes to every living student by itself, with no click, when its body is found: the first at the first body, the second at the second, unless you pick another in its **Sent at**.

The **autopsy** can still be issued by hand, as often as you like, with **Issue Autopsy Truth Bullet** from the GM panel, this window's footer or the after-incident screen, to the students you tick: a name, what the player reads and your note. The window fills in the next planned Autopsy and marks it sent.

### 14.6 Observe

The player declares how they are looking:

| Mode | What it looks for |
|---|---|
| **Sweep the room** | the easiest Remnant here |
| **Look past the obvious** | the hardest, and a secret project in the room at DC **18** |
| **Follow My Traces** | their own first |
| **Focus your gaze** | they name what they want, and a card every GM sees asks which Remnant the words point at; any GM picks, and the primary GM checks the pick against the room |
| **Examine point of interest** | something that is not a Remnant, yours to rule on |

**Focus your gaze** and **Examine point of interest** have rolled before you see them. Refusing the Focus pick, an Examine point of interest, or an Observe in a room with no Remnants left becomes a ruling card on that roll with **Create a Key Remnant here**, **Reply** and **Nothing was there**, which counts as the miss. A Focus pick made after the player stopped waiting, after another GM's pick or after a refusal is refused, and the GM who made it is told.

The roll is scored against the Remnant's real type and visibility (the table below), and the player is told the outcome, never which DC applied. A hit copies the Remnant into their inventory as a Neutral Truth Bullet and leaves the original; a miss costs **1 Sanity**. One Remnant yields one copy per person, and Remnants tied to the murder are shown first. The first time anyone copies a Remnant, you are asked to describe it (name, player text and analysis text, prefilled); everyone who copies it later gets the same words, and a critical asks you again only for the bigger hint.

| Visibility | Daily Life | Key | Faint | Prep / Incident / Tamper |
|---|---|---|---|---|
| Obvious | 8 | 6 | 12 | 9 |
| Evident | 12 | 9 | 15 | 12 |
| Subtle | 18 | 12 | 18 | 15 |
| Hidden | 21 | 15 | 21 | 18 |

These are the Observe DCs. Neutral is priced as Prep, and Final Truth as Key. No roll is scored on the Daily Life column: no trace is of that kind. It is the ladder Observe's briefing shows the player for something with no Remnant behind it, and the scale to hold an **Examine point of interest** to.

### 14.7 Analyze

Analyze rolls Head against the Truth Bullet's real type and original visibility. Key and Final Truth Bullets show their kind the moment they are picked up, but their analysis text still waits for an Analyze on the easiest column (6 / 9 / 12 / 15); only an Autopsy Truth Bullet arrives fully read. A success reveals the true type and whether the bullet is tied to the crime. A failure locks that bullet for this player until the chapter ends; a copy handed to somebody else is a different item and carries no lock.

Outside a Class Trial the same tile also offers a hint request to you (**14** a subtle hint, **18** a direct one, a critical: one question of their choosing), Find Stash (**16**) and Find Passage (**16**, section 9.6); with no bullet left to analyze, only those three remain. In a Class Trial it offers only the bullets. Every use of Analyze needs a GM online, and without one it is refused before anything is paid.

| Visibility | Daily Life | Faint | Prep / Incident / Tamper |
|---|---|---|---|
| Obvious | - | 8 | 12 |
| Evident | - | 12 | 15 |
| Subtle | - | 15 | 18 |
| Hidden | - | 18 | 21 |

These are the Analyze DCs. Analyze has no Daily Life column: a bullet is read on the column of what it really is. Key and Final Truth Bullets, and an Autopsy handed out as Neutral, read on a Key column of 6 / 9 / 12 / 15. Analyze costs 1 action; inside a Class Trial, with no action left it costs 1 Hope, and with neither, 1 Sanity.

> [!IMPORTANT]
> A **critical** Observe or Analyze owes the player a substantial hint from you, and the card says so in red. On a critical Observe the describe window has a box of its own for it, **Hint for this finder alone**: what you write there goes on that student's Truth Bullet only, under the Remnant's description, and never into the description that later finders copy.

### 14.8 Where the case is kept

The case lives only in the GMs' browsers, never in the world, so no player's console can read it. It holds every Truth Bullet's answer key and every Remnant's real type and reading, who the Mastermind is and where the lair is, each incident's cast and how it happened, the Blackened of each chapter, the traps' secrets, the Key Remnant plan, the deaths nobody has found yet, and the rest listed in section 22. Each GM's browser keeps a copy for each world, and the GMs' browsers bring each other up to date when one of them joins, so a GM who joins with an empty browser loses nothing and takes nothing away (section 22.14). A player's browser holds only what is theirs to know (section 22).

A player in on a secret project holds its name, and Daggerheart's own countdown list shows a secret project as "???". Rename one in the project manager, never in Daggerheart's countdown window, which would put the name back where every browser reads it.

**The case** (GM panel, Diagnostics) opens one window with the last backup's age and two buttons. **Back up** saves all of the case to one file; keep the file where no player can open it. **Restore from a file** merges a file back after its window shows what it would change in each store, and counts what it would remove. It takes only what is newer, a newer removal too, so any GM may run it, and running it twice is running it once. It never takes the file's season reset: rows from before a reset are left out unless you tick the box that takes them. A file of another world is taken only when you tick it, and then brings no removal, and its Mastermind and incident cast only when you tick those as well. After a restore, every connected player is sent their part again.

When the primary GM opens a world on a browser that holds less of the case than the world says it should (a new browser, cleared site data), a health check names what is missing. It offers **Restore from a file**, **Enter the cast by hand** for an incident in progress, or **Move them into the ledger** for older Remnants whose answer key is still on the token: the ledger is the case as the GMs' browsers keep it, and the button takes each such key off its token into the case. It also counts an indirect murder whose killer, condition and trigger this browser does not hold (its trap cannot arm or fire), a pre-session note marked written that this browser does not hold, a Mastermind set to "- nobody -" in Despair Flow (section 2), and a Remnant whose token still holds its answer key.

---

## 15. The Class Trial

The Class Trial runs from one console in one window: **The case > Class Trial**. Its first line names the next step - start the trial, open the debate, send the ballots, deliver the verdict, finish it, end the chapter - and counts the Blackened on this chapter's register, with a warning when the register is empty and a student died this chapter (a killer goes on the register when their incident is closed). Its read-out carries **Trial evidence log**, the same log the Investigation's footer opens: who presented what and who objected to whom. Technical notes: section 22.

While a trial runs the console also reads *Trial time: used of budget min (estimate)*: the minutes since the trial opened, against 270 minutes for sixteen players, in proportion to the players who took part when it opened. Like every time in this section, it is an estimate for planning and blocks nothing. When the trial runs long, what to cut is yours, but never cut Monokuma's Reveal, the Closing Argument or the vote.

**The console's footer** keeps every button in its place while the trial moves on: the console is redrawn in place. The next step - the one the first line names - stands on the right, and Enter presses it. On the left stand **Close** and what cannot be undone - **End the trial**, **End the chapter** and **Start the Final Trial** - and Enter never presses one of those. While an Objection or its rebuttal holds the floor, the next step keeps its place and Enter presses nothing. **Start the Final Trial** is grayed while no Mastermind is set, and says why on hover: *No Mastermind set. Pick one from the GM panel first.* The Mastermind is picked in **Season setup > The Mastermind** (section 8).

**The footer follows the trial.** **The verdict** appears once the vote is counted, and **End the chapter** once the verdict and the case summary are done; each is then the console's next step. **Start the Final Trial** is not offered while an ordinary Class Trial runs. A chapter that ends without a verdict ends from the part at the bottom of **Edit campaign**.

**The console's layout.** The console opens wide and as tall as the screen, so nothing in it needs scrolling (section 22.15). With no Class Trial running, its lines - the next step, the register - stand at the top, the case schema fills the rest of the window, read-only (nothing is ticked there), and the footer's **Close**, **Start the Final Trial** and **Start the Class Trial** stay under it. While a trial runs:

- **At the top, the status**: the first line, the trial's time, the table's scene and the register, then the mode picker - one button for each mode (**Nonstop Debate**, **Testimony**, **Panic Round**, **Closing Argument**, **Straw Poll**, **Logic Dive**, **Scrum Debate**), each grayed while another mode holds the floor, with the reason on hover.
- **On the left, the read-out**: the mode on the floor, **Trial evidence log** and **Findings**, then *Missing Key Remnants* and the vote. It scrolls on its own when it is longer than the window.
- **On the right, the case schema**, as tall as the window allows.
- **At the bottom, pinned**: the GM's bar (**Skip**, **-30 s**, **+30 s**, **Overrule**, **End this mode**, **Back to the debate**, **Re-point**), and the footer under it.

On a narrow screen the two columns stack and the console scrolls.

The trial runs in five steps, each in turn the console's next step:

1. **Start the Class Trial.** Moves the phase, hands out the time of day's actions (keeping banked Sprint and Burst; a trial's later debates refill nothing), resets this chapter's trial record, charges the Key Remnant fee (section 14.4), announces it, and tells you how many deaths nobody has found, publishing none (section 13.4). Beside its button it states the table's rule: **the dead listen but do not speak in the trial**, and the module keeps it: as the trial opens, it lists every dead student - a death nobody has found too, never a Monocub - and turns each one's player's microphone off for the trial with Foundry's own block, the one in the voice tile's list (section 9.5). *Opening the trial*, below, has the rest.
2. **Open the debate**, as often as the trial needs: a timed debate in which a player can interrupt with **OBJECTION!** (*The debate and the Objection*, below).
3. **Vote.** **The vote** in the console sends the ballots and counts them (*The vote*, below).
4. **Verdict.** **The verdict** records whether the class got it right, whom it sentences and who levels up (*The verdict* and *The Level Ups*, below).
5. **End of chapter** (section 16), and **End the trial**, which carries out a waiting sentence (step 4), closes the floor and returns the campaign to Daily Life. The chapter-end screen can do the second for you (*Ending the trial*, below).

#### Opening the trial

With a trial hall linked (section 15.1), Start the Class Trial's window names the hall and lists who takes part, a tick per character as on the Scenes tab, and opening the trial takes every browser there; with none linked it says the table stays where it is.

A player who also plays a living student keeps their microphone. A GM's account is never blocked, and a player you had blocked yourself stays as you left them. The list is public on purpose: a microphone gone silent tells the table that student is dead, a body nobody has found included, and nobody on the list holds a ballot. A student who dies during the trial joins the list, one who becomes a Monocub leaves it, and every road out of the trial gives back the blocks the trial made and no other. A Monocub speaks only while no mode runs, and listens in every mode, from the vote's opening on and through a trial about their own death; the convicted speak until the trial ends. In the trial the dead sit in the trial's voice room with everyone; outside it they talk with the Spectators, and the living do not hear them (section 9.5).

During an Eclipse Start the Class Trial opens nothing and says so, and no other door opens a trial in the dark: Edit campaign keeps the phase, applies the rest of its window and says so, and `game.drpg.setPhase` and `game.drpg.setClock` refuse the whole move. With an incident still open it asks first: close it now (**End the murder**; its Blackened go on the register, which the vote and the verdict read), **Go on with it open**, or Cancel. In a chapter whose verdict is already in it asks again (**Open a new trial**) before opening a second trial, Cancel first and the default, since a second verdict means another execution and another round of Level Ups. Edit campaign asks the same question when it moves the phase to Class Trial, about the chapter the window moves to, so moving back into a chapter whose verdict is in asks first. It also says what entering the trial does - the trial's budget opened and the Key Remnant fee charged - and Cancel there keeps the phase and applies the rest.

The trial opens in **discussion**: everybody talks, and evidence goes on the table without taking the floor. While a trial sits, only the Analyze tile stays open (with Present, the Hope Calls and items), nobody crosses rooms, and Despair Calls and a Monocub's Confusion are locked. An Analyze or an Objection costs an action, then 1 Hope, then 1 Sanity.

#### The debate and the Objection

**Open the debate** takes a budget in seconds (default **180**, at least **30**: a shorter one runs as 30; the budget is remembered for the trial) and an optional *Debate question*, which the trial's card in the Event panel, the console and the debate's Objection and Present cards show. The question holds up to 200 characters. Running over turns the debate's clock (on the trial's card in the Event panel) red and ends nothing; you decide when an argument is over.

From now on a player can interrupt with **OBJECTION!** on their voice tile (*OBJECTION! on the voice tile*, below). It is aimed at whoever the primary GM's voice room hears speaking now - about a second of speech counts - or, when nobody is, at the last player who spoke in this trial. It is never aimed at a GM, a Monocub, a student whose death has been announced (one whose death you keep secret is, for the table, alive and may be objected to), the objector or another student of the objector's player; with nobody to aim at it is refused and costs nothing. When the primary GM has no voice room, the press asks the player to name the target, with nothing paid until the name comes, and the name is held to the same rules.

Its price is paid at the press, and the player then has **30 seconds** to choose the Truth Bullet; until then the card says the Objection is pending and the console counts the seconds. With no bullet in time the Objection is withdrawn, its card says so, the price is not given back and the floor goes back to the debate with the time the debate had left. **Re-point** in the console aims a running Objection at another living student. An Objection's card stays above every window until it is clicked.

Once the bullet is on the card the objector alone holds the floor for **60 seconds**, then the person it was aimed at answers in a **rebuttal** of **120 seconds** for the two of them, then the floor closes back to open discussion by itself, and the console's next step is **Open the debate again**: the same question and budget, no window (`game.drpg.reopenDebate()`); after your own **Close Debate** the next step is a new **Open the debate**. **Close Debate** returns to discussion with the trial still running.

Who speaks in a mode is the table's to keep: the module silences only the dead (step 1), makes the state unmistakable on every screen and refuses the Objection button to anyone it is not for. A dead student can neither present nor raise an Objection.

#### The GM's bar

While a Class Trial runs, the console carries one row of buttons in the same order in every mode, so none moves when the floor does: **Skip**, **-30 s**, **+30 s**, **Overrule**, **End this mode**, **Back to the debate** and **Re-point**. A button that would change nothing now is grayed and says why, on hover and when pressed; outside a Class Trial every one refuses. Any GM may press them.

**Skip** ends the running turn - an Objection's minute goes on to its rebuttal, a rebuttal closes the floor - and a debate has no turn to skip. **-30 s** takes half a minute off the running clock: under 30 seconds left in an Objection or a rebuttal it is Skip, and a debate goes down to zero at most and is not closed. **+30 s** gives half a minute, counted from now when the clock has already run out, and may take a mode past its usual length. **End this mode** closes a debate as **Close Debate** does, and ends an Objection or a rebuttal as a rebuttal's own end does. **Back to the debate** gives the debate the time it had left when the Objection cut in, not its whole budget.

A press that reaches the floor after it has moved on moves nothing and tells you so. Each step is public: a skipped turn and an ended mode each post a card that says so, and a change of time shows *GM: +30 s* on the trial's card in the Event panel for ten seconds.

**Overrule** takes back the newest Objection of this trial and no other. During its exchange - its seconds to pick a bullet, its minute or its rebuttal - the floor goes back to whom or what it interrupted, with the time it had then; an Objection cut into a rebuttal takes two presses, one for each. After its exchange nothing on the floor moves: the Objection is marked, and the console offers **Open the debate again** with the time the debate had left. The price is never given back. The card is stamped **Overruled by the GM** and OBJECTION! closes on every screen. An older Objection, one withdrawn or refused, and one of a trial that is over are refused, and say why.

**Full control, fairly.** The bar puts the whole floor in your hands, and the table trusts you to use it the same way for everyone. Say aloud what you press and why. Keep the form, not the content: a turn ends because its time is up or the table is in trouble, never because of what is being argued. **Overrule** an Objection pressed by mistake or one that has nothing to do with what the speaker said, never a weak argument. Its price stays paid. No rule of the module protects a speaker but you, so **End this mode** is for a technical problem or a clock run over, never to stop someone before they finish.

#### The vote

**The vote** in the console opens one window - pressed again, it is raised rather than drawn twice - which names whom a ballot goes to before you press **Send the ballots** (with an incident still open, Send asks first, as Start does). Its first line is the trial's next step, in the same words as the console's first line and the GM panel's **Next** line, and the window stays open while the vote opens or closes under it, its footer redrawn in place.

A ballot goes to each connected player of a living student, one per person: a player with two students gets one ballot, and a student only a GM plays gets none (the dead do not cast ballots, `deadCastBallots: false`), and neither does a Monocub or a student on the trial's list of the dead (step 1), a death nobody has found among them. The ballot lets them name themselves, Monokuma or the dead. The number of names demanded is the number of Blackened recorded this chapter for a death the table knows (section 13.4).

The vote's state - open or closed, its round, who was handed a ballot, the count - is in the world, so a GM's reload keeps it and every GM's console reads the same vote. Each ballot is checked before it is recorded - one per person, of the open round, no name twice and no more names than asked - and the table sees only the totals: no player is sent another's ballot. A player who connects while the vote is open is handed a ballot as their browser loads, and it counts among the ballots issued, so it raises the bar: the window and the console say how many ballots are back, of how many, and how many votes a conviction needs.

The console shows who has not voted; **Send another ballot** re-sends a fresh ballot to them, and **Start the vote over** throws the returned ballots away and warns you first. **Close and count** publishes the count in one sentence, and any GM may press it. It stands on the left of the footer, with what cannot be undone, and is never the default: while a vote runs, Enter presses Cancel. A conviction needs **more than half of the ballots issued** (floor of half plus one) for every name it accuses; short of that the count says there is no majority, and that, or more names tied at the bar than there are Blackened, counts as a wrong vote unless the table settles it. The module settles nothing for you: **Start the vote over** runs a new round, and the verdict window offers both verdicts whatever the count said (*The verdict*, below).

#### The verdict

The window states who the register says the Blackened were (leaving out a killer whose victims nobody has found yet, section 13.4), names whom the count accused and on how many ballots, and asks who is executed if the class was wrong, and whether they got it right. The executed list names every student, the Blackened the register names among them. It opens on the student the count accused, and on its first option, **Nobody is executed**, after a tie, with no majority, with nobody accused, when the accused is already dead, which the window says, or when the accused is one of those Blackened; the dead stay listed, marked, but only a living student can be picked. A student whose body nobody has found is not marked dead here - for the table they are alive - and the window tells you alone whose death it is: executing them makes that death the execution, and the table learns it when the trial ends.

Its buttons are Cancel, **They got it right** and **They got it wrong**, in that order whatever the count said: Cancel is the default, so Enter closes the window and executes nobody.

| Verdict | Who is sentenced | What follows |
|---|---|---|
| **They got it right** | the Blackened | every survivor gets a **Standard Level Up** (1 pick) |
| **They got it wrong** | the accused | every surviving Blackened stays anonymous and in play with a **Reinforced Level Up** (3 picks) and one **new rule** of their choice (you type it; it is announced without a name), and every Monokuma's pool is **filled to 12** |

Both verdicts empty the Overflow. The Blackened's Reinforced Level Up waits for the class: its owner is told privately, and it is picked with the class's own Level Ups at the next verdict that names the Blackened correctly - one window with 1 + 3 picks, written in one go - or, alone, at the Final Trial's verdict, so nobody sees the Blackened's maxima move on the day of the wrong vote. It lapses if they die first, and a season reset that clears advancement drops it.

The verdict is recorded first, and every player then sees one card, **THE VERDICT** - who is sentenced, or that nobody is, and whether the class got it right, never naming a Blackened the class missed - and the Event panel says the same. One verdict per trial.

The verdict kills nobody and ends nothing: its card says *Execution when the trial ends: names.*, the trial goes on, and the sentence is carried out once, when the trial ends by any road - End the trial, the chapter's end, the phase select or a console call that moves the phase - before the table is taken back from the hall: each sentenced student still alive dies then, in the trial's own chapter, recorded as an execution, every player sees **THE EXECUTION**, and the executed student's player is also told privately. A verdict given after End the trial is carried out at once (*The sentence is carried out now: names.*). End the trial's question names whom it will execute, a season reset drops a sentence still waiting, and a sentence that cannot be carried out is named to you, to mark that death by hand in the Students window.

If a step fails, or the GM giving the verdict leaves, the console says where the verdict stopped, and **Finish the verdict** does the rest without repeating what was done. It runs on the browser of the GM who gave the verdict while they are connected, otherwise on the primary GM's - on another GM's the console names whom to ask, and Enter presses nothing there - and it gives no survivor a second Level Up and posts no second card.

#### The Level Ups

The survivors' Level Ups come in one window on your client, **The class's Level Ups**: a row per student with its picks, each **The player picks** or **I pick** (the player's choice is preselected when their player is connected). **Hand them out** - the first button and the default, so Enter does it - follows the rows, and **All: the players pick** hands every Level Up to its player; closing the window does the same, except that a student nobody plays is then given nothing (see below).

A player is told and picks on their own sheet, where the Level Up button lights gold; yours open here one after another, each saying whom it is for. A Level Up offers three options: +1 to a statistic, +1 to an experience, or a new experience at +2. A point in **Head** also raises the Sanity maximum by 1, a point in **Body** or **Leg** the Health maximum by 1, in the same write. A student nobody plays is yours to pick; one you leave is not given, you are told so, and you give it from the Level Up button on their sheet.

A Level Up can also be granted from a character sheet, where you decide what was earned (standard or reinforced) and whether you pick or the player does. Offers stand side by side, so a character can hold more than one; on the sheet your Level Up button shows how many stand, and its menu takes one back (**Take back the offer**), which puts the player's button out. A take-back is refused, and you are told, while that character's Level Up is being written. A pick of a statistic or an experience the character does not have is refused, the player is told, and the offer stands. The offers survive a change of primary GM, and a season reset that clears advancement withdraws them.

**Level Ups taken under the older rule.** A world with such Level Ups is offered a one-time correction when the primary GM loads it: a window lists what to correct, and you tick each change to make (section 22.15).

#### Ending the trial

With a trial hall linked, End the trial asks for a room - one list of every room of every scene with rooms, the school's first - and its only other button is Cancel, so the trial does not end without one. The table goes to that room's scene, the tokens the module made in the hall are deleted and yours hidden, and the living students who took part go to random points inside the room, as the discovery of a body gathers everyone; a Monocub goes with them, the dead and Monokuma stay. Only the cast is moved, carried or named: a student you left unticked (section 15.1) stays where they stand, and nothing below names them.

A living student whose token stands on another scene with rooms comes too: the module copies that token into the room and deletes the old one (section 22.15); for a student with tokens on two such scenes it is the one the module reads as where they stand, and you are told the other stays. A living student who cannot be moved - standing only on a scene with no rooms, a player's student standing only in the hall, or one whose token could not be copied or deleted - stays where they stood, and you are told who.

You are also told of every living student left with a token in the room and another on a scene that is not the hall, and of a student whose old token could not be deleted and whose copy could not be taken back either: they stand twice, so delete the one you do not want. A return cut short between the copy and the deletion is named to the GMs at the next GM's load (section 22.15). Every other road out of the trial moves nobody.

#### The trial's modes

Besides the debate, three of the mode picker's buttons open modes on the debate's floor, each while a Class Trial runs and no Objection or round holds the floor: **Testimony**, **Panic Round** and **Closing Argument**; the other three are the zone modes of section 15.2. These three run on the debate's floor, under the same bar and with the same clock on every screen. Each mode says who may speak, present and object; the table holds the zone modes of section 15.2 too:

| Mode | Who speaks | How long | Present | OBJECTION! |
|---|---|---|---|---|
| Open discussion (no mode) | everyone | - | everyone | nobody: there is no floor to take |
| Nonstop Debate | everyone | your budget | everyone | anyone, at whoever is speaking |
| Objection, then rebuttal | the objector; then the two of them | 60 s, then 120 s | everyone | not in the Objection's minute; in a rebuttal, at one of the two |
| Testimony | one participant at a time, in order | 60 s a turn offered, 30 to 120 s | the speaker | at the speaker |
| Panic Round | one participant at a time, in order | 15 s a turn (10 s offered from 12 participants on), 10 to 15 s | the speaker | nobody |
| Closing Argument | the speaker you confirm, pick or let continue | 300 s | the speaker | at the speaker, by anyone else |
| Straw Poll | everyone | 45 s | everyone | nobody |
| Logic Dive | everyone | 60 s a question | everyone | nobody |
| Scrum Debate | the camps' speakers, in turn | 45 s, 120 s, then turns of 20 to 40 s | the speaker | nobody |

**Testimony and Panic Round** are rounds. Their window offers the seconds a turn from the table above (Testimony's 60 s at every size of table, typed again at each start), draws the order at random (**Draw a new order** and **Move up** change it before **Start**, never after) and shows the whole round's length as you type. The order is frozen at the start from the trial's participants, so a dead student and a death nobody has found get no turn.

The speaker is shown *Your turn (n s)* with **Done** and **Pass** and hears the *your turn* sound alone; every screen names who speaks and the Event panel who is next. A pass is told (*name passes.*), a speaker whose player is not connected passes at once, and the round ends with *The Testimony is over.* (or the Panic Round). A round goes on while your tab is in the background. In Testimony an Objection is aimed at the speaker alone and runs the debate's exchange (60 + 120 s, cut-ins allowed); after it the round goes on at the next speaker - the interrupted speaker's rest is not given back - and **Overrule** in that exchange gives the speaker back the rest of their turn. A Panic Round has no Objection, and its bar's -/+ are 5 s. **Skip** moves to the next speaker, **End this mode** (*End the round*) ends the round, and **Back to the debate** is refused in a round; +30 s may take a turn past the longest, which holds only at the start.

**The Closing Argument** comes once a trial; a second trial of the chapter and a Final Trial have their own, and afterwards its button is grayed, *This trial has already had its Closing Argument.* For **30 seconds** every participant is asked whether they will sum up the case (**I'll sum up** or **Someone else**); the players see only how many volunteered, you see the names. When the 30 s run out, or you press Skip, one volunteer is drawn: *Drawn: name. Volunteers: names.*, with **Confirm the speaker** and **Pick someone else** (the volunteers first, then everyone else taking part, a student who already spoke marked *Already spoke in the Closing Argument*). The players read *The GM is confirming the speaker.*, and the card says only who gives it, never that you changed the draw. With nobody volunteering: *Nobody volunteered. The GM picks a speaker or goes to the vote.*

The speaker has **300 seconds**. Anyone else taking part may object at them at any second - nobody protects the speaker but you - and the Objection runs the debate's exchange while the speaker's clock stands. Then you decide, *Who continues the Closing Argument?*: the speaker, with the seconds they had at the Objection, or one who objected in that exchange, with a new 300 s (*name continues the Closing Argument (time).*). Whoever continues may be objected at again.

A drawn or picked speaker's **Pass** in their first 30 seconds hands the choice back to you; later, Pass, **Done** and the time running out end the Closing (*The Closing Argument is over.*, and the vote is the next step). **Skip** hands the choice back to you; **End this mode** ends it, in an exchange with no decision; opening the vote ends it too. **Resume the Closing Argument** gives the last speaker the rest of their time; **Overrule** in its exchange gives the speaker the time they had at the Objection. Nobody is paid Hope for the last word.

**Present, mode by mode.** Present is free in every mode; who may press it is the table's column above, and while somebody else holds the floor of a mode with a speaker the row's button is grayed, *Only name can present right now.* Its window offers **Show it with my Analyze result** when there is one; without it, the card and every copy show the bullet as never analyzed - no reading, no type it turned out to be. Each participant but the presenter then gets a copy on their sheet as it was shown, for nothing and once per Truth Bullet (*who presented name. A copy, as it was shown, is now on your sheet.*). With no GM connected Present is refused. The Objection's choice of a Truth Bullet offers the same with-or-without, and makes no copies. Inside a Class Trial a Truth Bullet's row has no Share; it is back once the trial is over.

**OBJECTION! on the voice tile.** The button is on each player's voice tile, beside the microphone; outside a Class Trial it is grayed, *You can raise an Objection only in a Class Trial.*, and the HUD's trial row carries it only where no voice tile is drawn (no LiveKit, or the voice tile switched off). The tile's plate says *has the floor* beside the student who holds it.

**Monokuma's Reveal.** The console's *Missing Key Remnants* lists this chapter's Key Remnants that no living student holds - a planned slot whose Remnant nobody found, one you wrote and never placed (or whose Remnant was erased), and one placed off the plan - under *Left to reveal: n*: the Key Remnants the trial's opening charged the Key Remnant fee for, less those revealed (a count fixed when the fee was charged). **Reveal** asks first: what the players will read (a slot with no Remnant asks you to write it), and past the count *No Despair was charged for this Key Remnant. Reveal it anyway?*; Cancel is the default, so Enter reveals nothing.

A Reveal hands everyone taking part (no Monocub, nobody dead) a copy as a find would - typed Key, with the players' text, not analyzed: Analyze in the trial reads it at its usual cost. It shows them its Remnant, tells each *Monokuma reveals a Key Remnant you never found.* with its sound, and costs nothing. Once per Key Remnant.

During a **Final Trial** the same floor and vote run; only the verdict is the Mastermind's (section 8): the console's verdict button opens **Final Trial verdict**, and that verdict closes the trial's record and takes the Final Trial flag down. No road gives a Final Trial the ordinary verdict. Its list names every student, the Blackened too, after **Nobody named**, and opens on the student the count accused, dead or alive; any of them can be picked, and the dead are marked. Like the ordinary verdict it is given once a trial: a second one is refused, and so is one asked while the first is still being given. Its execution posts the same **THE EXECUTION** card, naming the executed student. If one of its steps fails - its card, the flag, the execution, the Level Ups that waited, the Mastermind's pick - or its GM leaves, the console says where it stopped, and **Finish the verdict** runs the steps left, giving what waited once.

**The case schema at the trial.** The right side of the console shows the chapter's schema from the Map, read-only. Drag with the middle mouse button, or drag empty space, to move; scroll to zoom; or use - + and Fit to view under it. Before a trial it shows the schema only. During a trial each deduction, counter and solution has a tick button: press it when the class gets there. Only ticked nodes count as discovered, and any GM can tick. Ticks belong to the current trial: a second trial in the chapter starts with none. A node with a trial mode (Nonstop Debate, Testimony, Panic Round, Closing Argument) also has that mode's start button, grayed while another mode runs. Presented Remnants are marked. A conclusion gets a **hint** mark when students other than the culprit have presented more than half of what it rests on; a hint is not a tick. A presented Truth Bullet with no Remnant behind it gives no hint, and a line over the schema counts them.

**Show summary.** After the verdict, **Show summary** shows what the players will get: the Remnants on the schema someone found, the ticked deductions and counters, and the solution only if the class voted right. Nothing else goes out. **Send to everyone** posts it, once a trial; **Close** sends nothing. It is the console's next step after the verdict until it is sent; then the button reads **Summary sent**. It is grayed before the verdict and in a Final Trial.

### 15.1 The trial hall

The trial can be held on a scene of its own, set up once a season in Season setup's **Scenes** part (the Season checklist's row "The school and the trial hall are linked" opens it):

- **Build the hall** as an ordinary scene. It needs a token of yours only for Monokuma, whom the module never makes, and for anybody you want at a place of your own; the module makes the rest. Link each token you place to its character: the dead overlay and the player's control are read off the character, and the part names a token that is not linked. The hall has no rooms: a region marked as a room there is not read as one, and the part warns about it. So a move in the hall triggers no fog, no discovery, no movement limit and no trail.
- **Link it once**: pick the **School**, the scene the season is played on, and the **Trial hall**. They must be two scenes; **Save** waits until they are. While a Class Trial runs no trial hall can be linked, changed or unlinked: end the trial first, and **Save** waits until then.
- **The hall's cast**: switch on who takes part (**Takes part**, a switch per character), here or in Start the Class Trial's window; **Token in the hall** marks a character whose token you placed there yourself, shown or hidden and never deleted. Until you change a switch, Monokuma and every student a player owns take part - the dead and the Monocubs too, the dead under the dead overlay and immovable - and a student nobody plays (a test character) does not. A second token you place for one character stays hidden, and the part names it. The choice holds for this season only.
- **The hall on the room tile**: during a Class Trial every player's room tile shows the trial hall - the **Name**, **Picture** and **Description** you give it here, or "Class Trial" when you give it no name. Everybody sees them, so write nothing secret there. The picture follows the rules of a room's picture (section 9.1): any other path is not saved, and you are told so.
- **Prepare the hall**, ticked, makes **Save** switch Foundry's exploration fog and token vision off and the global light on, so everybody sees the whole hall; two more ticks clear the hall's playlist and, with Proximity Voice Chat switched on, switch it off in the hall. Prepare stays off until you tick it: while the linked hall keeps token vision on, global light off or exploration fog on, the part says so and entering the trial whispers it to the GMs.
- **The module's tokens last one trial.** When the trial opens, each ticked character with no token of yours in the hall gets one, linked to the character: a copy of the look of its token on the school - picture, size, rotation and opacity - or, with no token there, of its prototype token, and always set not to turn as it moves; where it last stood in the hall, else on a ring round the middle of the scene; when the trial ends those are deleted, their places remembered on the hall, and yours hidden. Yours are shown and hidden, never moved or deleted; one of yours is used instead of a made one. Leave room on the hall's map for the two zones of section 15.2, each large enough for every living student's token; a zone is a region not marked as a room.

**Every road into the Class Trial takes the table to the hall** - Start the Class Trial, Edit campaign, the GM panel's phase select and the console calls that set the phase: the hall is activated, so Foundry moves every connected browser there, the GMs' included, and the ticked characters' tokens are made or shown. Every road out - End the trial, the chapter end, the same phase select and calls, the season reset - deletes the module's tokens, hides yours and takes the table back: End the trial to the room you chose in it (section 15, step 5), every other road to the school, or, with no school linked, to the scene that was active when the trial opened; with neither, the table stays in the hall and you are told. Before any of this, every road but the season reset carries out a sentence the verdict left waiting (section 15, step 4), so the executed die in the hall and only the living are gathered. With no hall linked the trial opens wherever the table is.

A ticked Monokuma with no token in the hall, or a character whose token the module could not make, is named to the GMs when the trial opens. A player still loading when the hall is activated is taken there once their map is first drawn, and one still loading when the table leaves the hall follows it to the scene the table went to. A player's change to whether a token of the hall's cast is hidden is put back to what a GM last left it as, and the GMs are told once for each change undone. A token of a student that a player makes in the hall is hidden, and the GMs are told; one a player deletes there is made again by the module at the next opening while its character is ticked (a Monokuma's stays gone), and the GMs are told.

Inside a running trial the console says which scene the table is on and offers one door that keeps the phase: **Show the hall** while the table is elsewhere, **Back to school** while it is in the hall - the module's tokens deleted on the way out and made again, at their places, on the way back, yours hidden and shown.

### 15.2 The hall's zones: Straw Poll, Logic Dive and Scrum Debate

**Zone A and Zone B.** Season setup's scenes part picks two regions of the trial hall as **Zone A** and **Zone B** (regions not marked as rooms). The scenes part, the Scenes report and the Season checklist's further checks warn when the hall has no zones, when only one is picked or its region is gone, when both name one region, when the zones overlap and when they leave part of the hall uncovered; a hall with no grid that cannot be checked in time says so. The zones are read only by the three zone modes: outside them the hall is still a place for nobody, and a token's move between zones is never a crossing: it is not refused or charged, and it leaves no fog change and no Remnant.

**Who stands where.** Every participant (one student per connected player, no Monocub, nobody dead) is on the side whose zone holds their hall token's center. A token on the line both zones hold, or outside both, is on neither side. A participant with no token in the hall gets a window to pick a side. A token's stand is where it stood when the zone mode started. Tokens start on their stands, and **a player who does not move answers with the zone their stand lies in** - say so before the count. When a zone mode ends, every token goes back to its stand.

**Starting a mode.** **Straw Poll**, **Logic Dive** or **Scrum Debate** in the console's mode picker (while a Class Trial runs and no other mode holds the floor) opens the **Hall zones** window on that mode; with no zones they are grayed. A question holds up to 200 characters, each answer up to 80 and a Scrum Debate's thesis up to 120. The console's middle shows the question, each zone's answer and who stands there. The bar adds **Count now** and, in Logic Dive, **Skip question** to Skip, -30 s, +30 s and End this mode; every press is told to the table. The zone modes play the debate's music, and no Objection is raised in them.

**Straw Poll.** A question and two answers, 45 s for everyone to stand in a zone, then one count (the clock or **Count now**). Two thirds of those counted on one side is a **Finding**. The card reads *The class thinks: answer. (Zone A n, Zone B n)*. Anything less is *The class is split: Zone A n, Zone B n. A Scrum Debate can settle it.*, and Scrum Debate becomes the console's next step. The module never starts a Scrum Debate by itself.

**Logic Dive.** A set of 1 to 5 questions you write ahead in **Logic Dive sets...** (only the GMs see that window; the players see each question and its two answers, never which one is right). A student's name in a question is warned of: no zone question should ask who did it. Each question runs 60 s, closes early once everybody stands on one side (after 10 s) or on **Count now**, shows the count for 5 s, then a simple majority is judged: right goes on to the next question, and the last one right gives the set's Finding. **A wrong answer or a tie - 0:0 too - ends the set and reveals nothing.** **Skip question** goes on with no answer kept; **End this mode** keeps the question it stopped at, and the set starts there next time. Any set can be played again; the window warns you where and how it ended.

**Scrum Debate.** A question and two answers, an optional thesis, then three phases:

- **Sides**: 45 s for the camps to form; **Sides set** (the bar's Skip) ends it early, +30 s extends it, and a student in neither zone at its end sits the Scrum out.
- **Camps confer**: 120 s in which each camp talks in a voice room of its own - Zone A's members hear only Zone A, Zone B's only Zone B - while you, the dead and anyone outside both camps stay in the trial's room; **End the confer** ends it early, +30 s extends it. Without LiveKit AVClient, or with **Separate voice in each room** off, it runs as a timer and you get one whisper that the voices are not split.
- **Debate**: everyone back in the trial's room, and the camps speak in turn, the smaller first, each camp's speakers in rotation. There are twice as many turns as the larger camp has members when the Confer ends, and each lasts 300 s divided by the turns, held between 20 and 40 s: camps of 3 and 2 get 6 turns of 40 s, camps of 4 and 3 get 8 turns of 37.5 s. Anyone may cross at any time; the next speaker of a camp is taken from the camp as it stands. The speaker may post a short thesis.

A camp empty at the end of Sides or of the Confer, or during the turns, ends the Scrum with the other camp's answer as a Finding; after the last turn the camps are told and you decide. End this mode or the trial's end in any phase puts every voice back in the trial's room.

**Findings.** **Findings (n)** in the console lists them. You may add one, edit or delete one (up to 240 characters), and mark one **Monokuma confirms**; each press is a public card. The list is on the vote's opening card.

### 15.3 The entry and the verdict's cut-in

Every screen at the table plays short full-screen sequences:

- **The entry.** When the phase becomes the Class Trial - Start the Class Trial, a debate opened outside a trial, a console call that sets the phase (section 15.1) - the screen closes for about a second and the title stands on it: **CLASS TRIAL** with the chapter's line. Under Stained Glass the curtain closes with new panes of its own kind: each slides out at its own size from behind the edge of the glass beside it, the outer ones first, and the closed curtain is one cut of the curtain; it opens the same way onto the trial's cut. Under Monokuma Legacy two black lids with a red edge close and open. 3.4 seconds in all.
- **The exit.** When End the trial (or the End of chapter screen) takes the table back to Daily Life, the same: the screen closes in the color of the hour, **TRIAL ADJOURNED** with "Chapter N · Back to school" stands on it, and it opens onto the school. 3.4 seconds. Its only sound is End the trial's card. If the same Finish also opens the next morning, the day's boards come after the exit.
- **Edit campaign plays none of them.** Moving the phase into or out of the trial from Edit campaign or Season setup only recolors the curtain and the clock.
- **The verdict's cut-in.** Your verdict card (section 15, step 4) plays it: the sentenced student's portrait and name, the votes as they were counted, the stamp (**GUILTY** when the class got it right, **NOT GUILTY** when not) and the card's sentence; nobody sentenced, no portrait and no stamp. 3.7 seconds.

Esc skips the one playing, on that screen only. With reduced motion a still frame stands instead (the closed curtain and the title for 1.5 s; the verdict's last frame for 3 s). The game's settings (the GM panel's **Settings** tile) have **Full-screen sequences**, on by default: off, nothing plays on any screen, the curtain only changes color, and the sounds still play (section 17).

A screen that loads within 10 minutes of the event - a player who joins late, or a browser reloaded - plays the newest one it missed, once: the entry, the cut-in or the start-of-day board, with the switch, Esc and reduced motion as above. After 10 minutes it plays nothing and shows the table as it stands. The end-of-day board is not played late.

---
## 16. End of chapter and season reset

### 16.1 End the chapter

**End the chapter** is one screen with checkboxes, each counted before it is offered. You find it at the foot of **Edit campaign** (in its own window or at the top of Season setup), on the Next line, and on the trial console once the verdict is applied. The boxes:

- **Reveal what the Truth Bullets really are**: every Truth Bullet shows what it really is, with its reading, as an Analyze would. The box counts what it would reveal, and is unticked and grayed out when there is nothing to reveal. A Faint stays unread, but every Final, Faint or not, shows its kind without its reading; both are still to be analyzed in the next chapter. A Truth Bullet not analyzed with no real type recorded cannot be revealed, and a warning in the window names who holds it: take it, and give one with its type from Give / take items.
- **Collect the Truth Bullets** takes the students' Truth Bullets; Faint and Final ones stay.
- **Clear the Faint Remnants** takes them off the maps; Reinforced Remnants and anything tied to the crime stay. In a chapter with a murder, the victim's death tied every Remnant of the chapter nobody had decided about, so this also leaves that chapter's Daily Life noise until you set its **Tied to crime** to **No** in the Investigation.
- **Take this chapter's Key Remnants off the map** removes the Key Remnants planted this chapter.
- **Close the trial and return everyone to Daily Life** does so when a Class Trial is still sitting.
- **Move to chapter** N, **Count this as session** N, and **Open the next chapter on the morning of day** N are three boxes: the next chapter, the next session, and the following Morning, one day on, with actions and Search Tokens refilled.

The next chapter starts clean. The Key Remnant plan keeps each chapter's rows under that chapter, so the next chapter opens on an empty plan; the Blackened register counts by chapter, so it starts the next chapter empty; and no body card carries into the next chapter. Moving the chapter or the session on from the Investigation ends the Investigation, and the next chapter opens in Daily Life. With the trial's box unticked while a trial sits and the next morning ticked, the morning opens into that trial, as you chose.

A death nobody has found is not mentioned and not published: make it known by hand first if the table should have it (section 13.4). A note in the window says whether a Final Truth Remnant was placed this chapter and, if none was, where to place one.

**Chapter 6 is the last of a season.** There the next chapter's box starts unticked and a warning says so: reset the season (section 16.2) instead of moving to 7.

Only the primary GM can end the chapter: on another GM's browser the window does not open, and says whom to ask. The window keeps the chapter, session, day and phase it was opened on. If any of them moves before you confirm - by Edit campaign, by a time of day turning into a new day, by another End of chapter, by a Class Trial opened or closed, or by the Investigation started - nothing is done, and the GMs are told to open the window again.

The steps run one after another. A step that fails is named in a warning and the rest still run, except the next morning, which waits when closing the trial failed. The phase is read again before every step: a Class Trial opened or an Investigation started while the end runs stops it there, what ran stays done, and the GMs are told which of the steps you asked for did not run.

**An end that stops** - a step failed, the phase moved, the GM's tab closed half way, or another GM's browser became the primary GM's - is kept with what it did. The Next line says so, and **End the chapter** asks **Finish the chapter's end**, **Drop the rest** or **Cancel** instead of showing its form. **Finish the chapter's end** does only the steps not yet done, to the chapter, the session and the morning the end began on plus one, so each moves once however often you press it; it runs on the primary GM, back in the phase the end stopped in. **Drop the rest** leaves those steps undone and names them on the GMs' card. Until the end is finished or dropped, no new end of the chapter starts.

### 16.2 Reset the season

**Reset the season** (the red button at the foot of **Season setup**) wipes the season and keeps the cast. Its window lists exactly what goes, with counts, as **30** tickable groups in five sections, all ticked by default. Untick a group and the reset leaves it alone; the choice is remembered, unticked, for the next reset. With every group ticked, this goes:

| Section | What goes |
| --- | --- |
| **The case** | Remnants on the maps, and what was taken off each body; Truth Bullets and the answer key; the incident, with the declarations made in the dark; the trial and its progress and vote; the Key Remnant plan; Search Tokens; which rooms each character has discovered; the body waiting to be answered |
| **The cast** | deaths and Monocubs, and the deaths nobody has found; every item carried or stowed; every advancement and what it bought, and the Level Ups waiting for the class; the action budget, refilled, and each student's rests; the pre-session notes; which stashes each student has found |
| **The board** | projects, with who builds each trap and what sets it off; the Mastermind; who knows each secret passage (who knew one at the season's start knows it again), the secret passages projects made and every breach (each wall given back first, its room no longer forced); Despair Calls in force; the motive; the killing game rules; doors, back to how the season opened; Eclipse placements, with the crossings; a called assembly |
| **The log** | every card the module wrote and every messenger thread; the rest of the chat log |
| **The world** | the Despair pools to zero, with what they owe, and Hope back to 2; Despair Flow's division of the students between the Monokumas; the Overflow and its count; the clock, to Chapter 1, Day 1, Morning with everyone's actions refilled, the season counted one on and the Final Trial flag down, and with it a readiness round and an End of chapter that stopped |

After the division between the Monokumas goes, every student feeds the first pool until you divide the class again, as the season's checklist row *Every student has a Monokuma watching* asks. *The Key Remnant plan*, left unticked, keeps only the rows of the chapter the season was in.

Each group takes with it what its label names, and what the GMs keep of it (section 14.8). *Deaths and Monocubs* makes every student's Health and Sanity whole again. *What the cast is carrying* hands each bedroom's key back to its owner. *Advancement* takes the experiences a Level Up added (an older starting sheet: section 22.16). *Despair Calls still in force* takes every Call armed for a roll. *The stashes each student has already found* opens every hidden stash again. *Projects* removes every project token on every scene. *The body waiting to be answered* clears the record of which bodies were found.

The groups run one after another, the incident first. A running incident is abandoned, not closed: nobody is killed or put on the Blackened register, no tool breaks, and no card is posted. A group that fails is named on the report card, and the rest still run. A reset that did not finish - a group failed, another GM became the primary, or the GM's tab closed half way - is remembered: the next **Reset the season** says so and opens with only the groups it did not finish ticked, and a reset run from it leaves the remembered exceptions as they are. Once the clock has moved on from where that reset left it - a time of day passed, or a day, session, chapter or season begun - the record is not offered, and the window opens as usual.

After a reset, last season's Chapter 1 is not read as this one's: the Remnants, the motive, the Final Truth, the autopsy and a Monocub's silence about the crime are each stamped with their season, and the Next line, the Key Remnant plan and its fee, and the autopsy's line read only this season's. Three records are read by their chapter alone, and so carry into this season's chapter of the same number when their group is unticked: the trial's progress and its vote (*The trial's progress and its vote*), a betrayal on offer (*The incident*), and a Truth Bullet locked by a failed Analyze (*Truth Bullets in the cast's packs*).

Below the groups, **Where the cast's tokens go** has three choices: they stay where they stand (the default, and not remembered), each to their own bedroom as Room setup assigns it, or everyone to one room. Each player whose student moves has their screen moved to that token. A token moves only on the map its room is drawn on; a student with no bedroom, or with no token on that map, stays where they are and the report names them, and a body stays where it fell. Where the tokens go is not a group, since a reset with nothing ticked does not run: when the cast could not all be moved, the report says to move them by hand. On the report card, where the tokens were sent has a line of its own rather than a place among the groups cleared.

**What stays:** the cast with names, portraits and Ultimates, the maps, the rooms and who owns them, the Monokuma team and the names of their pools, and the campaign name.

The **Notice history** each browser keeps (section 18) ends with the season only on a reset that clears the clock, the incident, this module's cards or the rest of the chat log. That reset clears every account's history of this world, at once in a browser that is open, and in any other the next time it loads the world. A reset with none of those four ticked clears no history.

**Only the primary GM can reset the season** (section 6.3): another GM is told who that is, and nothing happens. The window names every GM who is not connected. A GM's browser keeps its copy of the case (section 14.8) until it next opens the world, and a browser that was away drops what the cleared groups held the first time it loads, whether or not anybody else is connected. Back up the case first if you might want any of it back. If another GM becomes the primary while the window stands, **Reset the season** resets nothing and says who the primary GM is now. If one connects once the reset has begun, it stops at its next step: what ran stays done, nothing after it runs (the cast's tokens and the clock included), and the error and the report name what did not run and who the primary GM is now, so you can finish with another reset.

> [!CAUTION]
> You type **RESET** to confirm, in capitals as shown. Anything else resets nothing, and nothing can undo the reset.

---

## 17. Sound and SFX

> [!NOTE]
> **The module ships no audio.** The files are yours, and an event with no file stays silent.

The **Sound** window (Right now > Sound) has three tabs for a GM: **Play**, **Music** and **Effects**.

- **Play** puts a cue from the playlist named **"Situational"** on repeat, holding whatever was playing, and **Stop the track** gives that back. If the world has no playlist of exactly that name, a button creates it. The match is by name: an almost-right name is a playlist the module ignores.
- **Music** maps one playlist to each state of the game. The tab opens on one sentence, with the order's notes folded under **How the order works**.
- **Effects** has one row per event, under its category. A row takes a file, or several separated by `|`, drawn at random and never the same twice in a row, with **Choose** beside it. In the **Test or clear** column, **Test** plays it and **Clear** empties the row, leaving the event silent. A Test that cannot play says why and what to do, such as *This event has no file yet. Choose one in the File column.*

**Music follows the game state** is the switch at the top of the Music tab, off until you turn it on. While it is on, the first state that applies wins, in this order, and the primary GM's playback is everyone's:

| Order | State | Notes |
| --- | --- | --- |
| 1 | Game on hold | |
| 2 | Eclipse (placement window) | |
| 3 | Objection | a random track per takeover, starting at once; the rebuttal keeps the same music, and an Objection in any trial mode plays it |
| 4 | Debate | |
| 5 | Discussion | Testimony, a Panic Round and the Closing Argument play it too |
| 6 | A body has been found (silence unless mapped) | silence by default: the previous music is paused, and the silence stops a track you put on yourself too |
| 7 | Investigation | |
| 8 | Each of the five times of day | |

**The murder row** stands outside that order, whatever the switch says. It plays one track off its playlist, the same one for everybody in the incident, only in the browsers of the incident's participants and the GMs, so nobody else learns from the music that a murder is happening; a trap's builder, somewhere else, hears nothing. There it silences the room's music until the incident ends: a player hears the room's music pause and pick up again where it stopped, and a GM hears it turned down. The track plays on the Music channel at its own volume, so each player hears it at their own Music volume. A track that will not load leaves the room's music playing, and the next incident tries it again. Left empty, an incident holds whatever was playing.

**Every change saves as you make it.** The window has no Apply: a Music row says *Saving...*, then *Saved* (or *Not saved - see the console*), and every tab ends in one **Close**. The mapping is the world's, so any GM may change it, and the table's music follows within a few seconds. Two GMs saving different rows in the same moment both keep theirs. With the window open on two GMs' screens, open it again to see the other GM's changes. The **"Situational"** playlist is the Play tab's cue source alone, and no Music row offers it.

Two **volume sliders** belong to each browser, in the gear's settings window (section 18) and, for players, in the Sound window. *Sound* is for the effects, as a plain percentage. *Music* is Foundry's own playlist volume rather than a second one, drawn on Foundry's scale, so it should read the number Foundry's playlist slider reads. A GM finds the table-wide switch **Vary the sounds you hear often** on the Effects tab, beside the note on the *varies* chip: a frequent sound comes out slightly different each time.

The catalog, by category:

| Category | Events |
|---|---|
| **Safety** | the safeword - whatever the *Sound* slider says, at the player's Foundry Interface volume, once they have clicked on the page |
| **Interface** | windows opening and closing, buttons, the chat opening |
| **Chat** | message sent, received, a player calling for a GM, a Hope Call, a Despair Call, a new rule, a motive, an assembly |
| **World** | room discovered, room entered, a crossing refused, a secret passage opening to you, a wall breached, an action spent, a project finished, a critical, a search finding nothing, Observe failing, a secret project noticed, sabotage failing or witnessed, a tool breaking, something stolen, the Eclipse beginning and ending, the Overflow firing |
| **Incident** | a death, the death fade, a body found, cleaning up failing, Breakdown, Wounded, a Monocub changing, a Monocub interfering, Confusion, your turn in an incident or in a round of the trial, a Truth Bullet found, evidence identified, analysis failing, the start-of-day board, the end-of-day board, the panes' flash as the Investigation begins, the Class Trial's title, the debate opening, an Objection, the rebuttal, an Overrule, a Panic Round starting, the Closing Argument opening, Monokuma's Reveal, a Straw Poll's result, a Logic Dive's right and wrong answers, a zone entered, the vote opening, the vote's result, the verdict's cut-in (its stamp), an execution, the case summary, the trial ending, a level up |

Each event's audience is fixed in the catalog. A death is heard only by the GMs and the participants, except the victim's player, who hears the death fade instead (the death's own sound while the death fade has no file). A body found is heard by everyone, and by one player alone, once a body, when their student walks into a room where a body lies. The rebuttal is heard by the whole table, once as it starts, whether the Objection's minute ran out or you opened it.

**The sequences' sounds** (section 15.3, and the day's boards in section 4) are five rows of *Incident*, each heard by the whole table: **Start of the day** and **End of the day** as each board rises, **Pane flash** at each of the Investigation's flashes (marked *varies*), **The Class Trial starts** as the trial's title lands, and **Verdict cut-in** as the verdict's stamp lands. With **Full-screen sequences** off, the two boards and the flash are silent, and the flash is silent under reduced motion too; the trial's title and the verdict's stamp still play. **The vote's result** is the card of the vote's count, not the cut-in.

**Critical** plays when a roll is a critical, as its notice cuts in. A critical action result's notice is the only card that enters on a cut: it opens with the result in words, the critical's glyph and who rolled which action. The chat's roll cards keep their plain entry.

A browser plays nothing until it has been clicked, and the module drops those sounds rather than queueing them. Section 20 gives the console calls that say what was dropped and why a sound did not play.

---

## 18. The settings window, themes and the Language setting

The gear in the bottom-right corner opens **DRPG Settings**, and so does the DRPG Settings button in Foundry's Configure Settings. Everything in it belongs to this browser alone, and it is the same window for a GM and a player, except **Verbose console logging** in **Technical**, which only a GM's window shows. The table-wide switches are the game's settings, behind the GM panel's **Settings** tile (section 1.3); the music's switch and **Vary the sounds you hear often** are the Sound window's (section 17).

The sections stand in a list on the left - **Look**, **Effects and accessibility**, **Sound and voice** and **Technical** - and the picked one on the right. **Save changes** writes your changes, and **Cancel** leaves them. **Sound and voice** holds the two volume sliders, **Messenger sounds**, and, where the world has voice, the microphone, the output, always on or push to talk and its key, with a button to Foundry's Configure Controls; the sliders and the voice settings apply at once, as you move them. The rest:

| Setting | Details |
|---|---|
| **Language** | English or Polski, per browser, English by default, separate from Foundry's core language on purpose; a change asks to reload, and game names such as Truth Bullet stay in English |
| **Theme** | *Stained Glass* (the current identity: black broken glass along the screen edges, color in the seams) or *Monokuma Legacy* (the look before it, with the **Pixel font** switch) |
| **Interface scale** | 80% to 140% on the module's own type and panels |
| **Glass pulse**, **State name behind the clock** and **Glass blurs the map** | under Stained Glass |
| **Reduced motion** and **High contrast** | under both themes; each is also switched on by the operating system's own preference |

The switches of the other theme stay in their place, grayed out, with the reason in their tooltip.

> [!TIP]
> **Glass blurs the map** is the theme's most expensive effect, and the first thing to turn off if the interface stutters. Section 20 says how to measure what it, and each of the theme's other effects, costs on that machine.

Foundry's own two rails are not part of the screen under either theme. A player has neither the sidebar nor the scene controls: their token is still selected and dragged on the Tokens layer, and the module changes none of Foundry's keys, but drawing, map notes and the target button go with the bar. A player has no view of the chat: what you type there - out of character, or another module's /roll - is read by no player; what the module tells a player reaches them as a notice card or in the messenger.

A GM has both, in two windows of the module's: **Foundry tools** holds the sidebar (the chat, the Scenes tab and the other directories), and **Map tools** the scene controls. The button with a white anvil above the book, **Open or close Foundry tools**, opens both and closes both; the red GM button stands above the gear beside it. Drag a window by its title bar: this browser remembers where you left it, and keeps it wholly on the screen and clear of the corner's buttons, also after the browser window is resized. Foundry's own caret at the foot of the sidebar's rail narrows Foundry tools to its tabs and widens it back.

Whatever opens a tab of the sidebar opens Foundry tools first, Foundry's **Shift+C** among them. **Escape** stays Foundry's: it closes Foundry's windows and menus and releases the selection as it does without the module, and closes the two windows only when nothing of Foundry's is left to close. Closing Foundry tools collapses the sidebar, which is when Foundry shows its chat notifications.

The world switch **The module's windows for Foundry's sidebar and scene controls**, in the game's settings and on by default, is the way back to Foundry's own layout. With it off, after a reload, a GM's sidebar and scene controls stand where Foundry puts them, the glass is cut around them again, and the Foundry tools button is not drawn; a player's screen is the same either way. With it off, a GM's expanded chat lies over the corner's buttons, which stay where they are, and folds back in the rhythm it slides out with, at once under **Reduced motion**.

A module that did not start takes its stylesheets off the page, so then the Scenes tab, the scene navigation and the hotbar are Foundry's own again (section 1). While the module runs, Foundry's scene navigation and the macro hotbar are hidden on every screen, a GM's included: scenes switch from the Scenes tab, and macros run from the Macro Directory. Foundry's combat tracker (its sidebar tab and its popped-out window) and Daggerheart's effects display are hidden on every screen too; a condition still shows on the token's status icons and on the sheet.

**The glass and the windows.** Under Stained Glass a new phase or time of day turns the glass: the new color arrives from the middle within about 1.2 seconds and the seams flash once. Where the panels must move - a phase that moves a panel, a panel arriving or leaving - the panes slide whole to their new places with their texture; a new time of day never cuts the glass anew, with music or without. Under **Reduced motion** the glass takes its end state at once.

Foundry's own notices - a warning, an error - stand under the glass on a dark plate with a colored rule on the left, under the Despair rail and not over it. An action tile its student cannot use or pay for now has one look under the glass, dark with a dashed edge, whatever it would cost; under Monokuma Legacy the tiles keep that theme's own look. A window the game waits on - a roll, Observe, an action's declaration, a ruling, the vote, a Level Up, the trial's prompts - stays over a character sheet that overlaps it, also after a click on the sheet or its redraw. The module's other windows, the GM panel among them, come to the front as Foundry's do, so a Hope change that redraws a sheet does not bring the panel over the window you work in.

**Hours.** Under Stained Glass the time of day gives the glass its color, the hour's color: one step of a quiet ramp for each of Morning, Noon, Afternoon, Evening and Night. A phase takes the hour's place while it runs - the Investigation its blue, a Class Trial the Despair color, an Eclipse its violet - and every screen at the table shows the same color. One exception: while an incident runs, the screens of the people in it (the killer, the victim, whoever walked in, and every GM; not the killer of a trap) wear the incident's red over the hour and the phase. The color changes when the clock does, with the glass's turn. Under Monokuma Legacy no hour colors anything: the clock's edge and phase line wear the phase's color, and the map's lines are Bone.

**Colors.** Under Stained Glass a color means one thing: gold is Hope and nothing else, Bone (the attention color) marks a focus ring and a selected row, and the hour's color is decoration on the glass, the frames, the headings and the map's lines, never on a control or a card. Section 22.18 lists where the hour's color stands and where it never does. Under Monokuma Legacy these keep their own colors.

**On a narrow screen** the module's panels stand in one column at the top, and the board stays visible and playable under it: no pane of glass covers it, and the glass stands only along the rails and the corner's buttons. A player's status strip and Projects tray come before the Despair rail there; a GM's panels keep their usual order. When the column is longer than its room, it scrolls, and its foot fades while there is more below. A GM's player list is one line on the screen's foot, left of the corner's buttons; a player has none.

**Folding a window.** A double-click on a window's title bar folds it to the bar, and a second one opens it again, Foundry's own gesture. It works on the module's windows (the GM panel, the windows its tiles open, the room's description window), the character sheets and other modules' windows. A short window that asks one question, such as a confirmation, does not fold, as Foundry's own do not. A tile pressed while its window is folded opens the window again. A messenger window folded to its bar does not mark a message read until it is opened again.

The **book**, under the messenger at the bottom right against the edge of the screen, the size of the gear on its left, opens the handbooks in the game, in the module's language: the Student Brochure and the Player Handbook for everybody, and this GM Handbook for GMs only.

Clicking any standing panel - the clock, the Despair rail, the status strip, the Projects tray - opens a window that explains what it is and where things stand, showing each user only what the panel already shows them. In the Projects tray each project is one row, its name and its count on one line. A GM's tray is live. A player's shows each project as one of their characters last saw it in the project's room, live while one stands there, and **?** where that browser never saw it; a project or a repair made since their last visit shows only after the next. A GM's minus and plus say what they do when you point at them, and with more than five rows the list scrolls and its foot fades.

**Notices** are the cards that surface results, refusals and announcements; a GM gets the ones addressed to the table or to them. A notice stays until its reader closes it: an ordinary one with a click anywhere on it, a sticky one from its X. Only a "waiting for the GM" card closes itself, once the answer arrives. The newest goes on top and pushes the older ones down. When there are more than the stack shows (**2** on the Stained Glass tile, **4** under Monokuma Legacy), the older ones wait underneath behind a "+N" badge and come back as cards are closed; a click on "+N" closes every card at once except the sticky ones. The Class Trial's evidence stage in the middle of the map shows two and keeps arrival order, so an Objection reads after the presentation it answers. The theme decides whether the cards stand over the windows: under Stained Glass the notice tile stands under every window, whatever card it shows, so a window dragged over the tile covers its cards; under Monokuma Legacy every card stands over the windows.

A GM's browser keeps the notices it draws in its **Notice history**, as a player's browser keeps theirs. The stack-of-cards button in the bottom-right corner of the notice tile opens it: with Monokuma Legacy on a computer it is under the clock, even with no card on screen, and on a narrow screen at the bottom-right corner of the lowest card while a card is on screen. A keybinding, unbound until the table picks one, and `game.drpg.openNotices()` open it too. It holds what this browser showed you - at most the newest 150 for a GM (250 for a player), and 40 from any one sender - until a season reset that clears the clock, the incident, this module's cards or the rest of the chat log (section 16). Its window filters them: **All**, **For you** and **Not carried out** on top, and **Announcements**, **From players**, **Evidence** and **Messenger** under **More filters**, each with how many it holds; a filter with none is grayed out. A card the module takes back - an incident's opening requests when it moves on, a crisis you undo - leaves every browser's history with it. **Clear** it before you share your screen; on a shared computer, read section 19 first.

---

## 19. The safeword

Every character sheet carries a **safeword button** bottom-left, captioned with the table's word (set in Season setup; blank means the default "Safe Word"). A keybinding does the same, unbound until the table picks one. **Anyone may press it** - player, GM, dead, Monocub, Spectator - and each of these doors asks first, *Stop the scene?*. **Stop the scene**, the default (Enter), does three things at once, and **Cancel** sends nothing:

1. the game pauses; only the primary GM's browser can pause it, so a GM has to be connected;
2. everybody sees the same "THE SCENE IS STOPPED" card and hears the safeword sound - whatever their *Sound* slider says, at the volume of their own Foundry Interface slider, and only once they have clicked somewhere on the page since it loaded, since a browser plays nothing before that; the card is what everybody is sure to get;
3. every GM gets a sticky note saying who called it and, when it was pressed on a sheet, from which room. The note is kept in that GM's **Notice history** like every other notice, within the limits section 18 gives.

Nobody else is told who. A player's press asks the primary GM's browser to post the card, so no player's name is on it. With no GM connected, the caller's own browser posts it: its header shows no name, but the card's record names the caller as its author, as every card a player's browser posts does (section 1.6). The same goes for a press no GM's browser answers within three seconds, such as a GM connected but reloading: the caller's browser posts the card then, and the caller's own card says so. A GM whose browser was not listening is not told who called it, and the game pauses only if the primary GM's browser sees the card arrive: if yours was still loading, pause it by hand. A player who presses again within a minute of the card posts nothing new; the card already up stands. The Event panel keeps a "The scene is stopped" card up, with no name on it, for as long as the game stays paused.

> [!CAUTION]
> There is no reason field and no target: the scene is being stopped, not an accusation filed. Sort it out with the person, then resume from a point everyone agrees on.

**On a shared computer**, every account of this world that logs in on that browser can read the other accounts' **Notice history** from the console, this note and a killer's cards included. When the histories fill the browser's room, the history of the account logged in now is kept only until its page closes, and its window says so (section 22.19). A season reset that clears the clock, the incident, this module's cards or the rest of the chat log clears them all (section 16.2), and one with none of those four ticked clears none. So on a shared computer, clear the history before you hand the computer over, and before you share your screen.

The **pre-session note** in the messenger is the other half of this: seven questions a player answers before every session - whether they plan to kill, whether they are open to dying, whether they consent to their character being tortured, whether they are open to a romance, their triggers, how they mean to play, and the large project they aim at. The first four are boundaries. Read the notes before deciding whether to approve a murder. A note's words are the GMs' and its writer's alone: no other player's browser holds them, and a note saved while no GM is online waits on its writer's browser until one connects.

---

## 20. Troubleshooting

Every call below is under `game.drpg` in the browser console (F12), and an actor argument takes a document, an id or a name.

### 20.1 One report for whoever is helping you

`game.drpg.diagnose()` opens a window with everything this browser can check, as one text, and returns the same text, so a macro has it too. **Copy report** puts it on the clipboard, to paste wherever somebody is helping you. Each `diagnose...()` call below is one part of this report on its own.

The text is English, like the console, and its parts come in this order: The contract with Foundry, Daggerheart and the modules; Data migration; Failures since this page loaded; Silenced warnings; Dice; Dice look; Despair; Styles; Windows; Truth Bullets; GM stores; Voice; Characters; Scenes; Fog; Room visibility; Token frames; Windows that keep themselves true; Music; Sound effects; Private cards; Traps. On a player's browser the parts that read what only GMs may know (Despair, Truth Bullets, GM stores, Characters, Scenes, Room visibility, Music, and Traps) are named and say *This part of the report can only run in a GM's browser.*, and nothing of the GMs' is in a player's report.

The window also lists the warnings this browser silenced, each by its id with **Show again**. The module keeps one such silence: the warning that Daggerheart is newer than the version the module was tested on, silenced for that version.

### 20.2 The regression suite

| Call | What it does |
|---|---|
| `game.drpg.runTests()` | runs the source regressions and the read-only invariants; safe during play: at the end it checks that nothing in the world moved and names what did, a player acting during the run included |
| `game.drpg.runTests({ tier: 2 })` | adds the scenarios, which write, so only on a copy of a world; it asks first, in a window that names the world, with Cancel first and the default |
| `game.drpg.runTests({ tier: 0 })` | reads the module's own source alone |

> [!CAUTION]
> **Tier 2 writes**: it opens incidents, kills students and resets seasons in fixtures it builds and removes, so never run it in a world somebody is playing in. It is refused while an incident is open, and a second run on the same client is refused while one is in flight. A scenario that needs more people or rooms than the world has is skipped and says what the world lacks.

The result is a count, "passed, failed, skipped", followed by one `ok`, `FAIL`, `skip` or `red` line a test; when tests marked to fail until a named stage ships have failed as marked, the count ends with ", N red until a later stage". A skip is a test that said what the environment lacks, never a result that came out wrong.

### 20.3 Calls by symptom

**Fog and visibility.**

| Call | What it does |
|---|---|
| `diagnoseFog()` | the fog looks wrong to a player: run it on the *player's* client, since a GM's fog is lighter and clears every room the class has found, so it cannot show a player's problem. It says which look-alike cause it is: the setting off, no named regions, the layer not mounted, every room already discovered, or the scene not prepared |
| `diagnoseScenes()` | lists the scenes with rooms and whether each is ready; `prepareScenes()` fixes them all |
| `whyBlack()` | lists what the fog layer has on screen while the picture is wrong |
| `checkRegions()` | checks the rooms of the scene on screen and lists, gravest first: a room whose shape cannot be read, two rooms overlapping, a border that runs away from its walls, a room with no way out, a region with no name, a room still bearing the name Foundry gave it, a room whose pieces differ in No privacy, owner or height, a named region that is not a room (and why), and corners off the map's own lattice; on a scene of several floors each floor is checked apart and named in the `floor` column (the `level` column is the finding's weight: error, warning or info) |
| `doorwayReport()` | explains each stretch of the current room's border |
| `fogPeek()` | hides the fog for a few seconds |
| `fogAnimations(false)` | turns the reveal off mid-session |
| `seedDiscovery()` | records the room every character already stands in |
| `diagnoseVisibility()` | a token in another room is visible: run it on the complaining client, and it explains why |

**Despair and dice.**

| Call | What it does |
|---|---|
| `diagnoseDespair()` and `diagnoseDice()` | read Despair and the dice |
| `diagnoseCharacters()` | the setup report |
| `diagnoseDiceLook()` | the dice look different on two screens: each person runs it on their own browser. It reads only that browser: its Dice So Nice and Daggerheart versions, its display, its Hope and Despair preset, the names it lacks, and the last roll's dice; on a GM's, also every user's Dice So Nice settings and whether they hold the table's look. A player copies the text at the foot of its window and sends it to the GM. A GM also opens it with **Open the dice look**, at the foot of the **Season checklist** and in the **Debug log** window's **Foundry and modules** (Diagnostics) |
| `diagnoseDiceLook({ test: true })` | the same, and it also throws a Hope and a Despair die on that screen alone |

Despair that does not arrive usually means no primary GM is connected, **Rolls grant Despair** is off, or the roll was a reaction. When the primary GM's browser loses to a reload whose roll it was, the roll counts for the roller's one living character, and without one it awards no Despair.

**Other tools.**

| Call | What it is for |
|---|---|
| `diagnoseVoice()`, `diagnoseSfx()`, `testSfx()` and `diagnoseMusic()` | voice, sound effects and music |
| `diagnoseTruthBullets()` | are the bullets and their answer key in step |
| `diagnosePatches()` | is every override still where it expects (section 20.4) |
| `diagnoseWindows()` and `diagnoseStyles()` | a window cut off or a sheet that looks wrong |
| `traceClicks()` | a click that does nothing |
| `fileSizes()` | a hosted world that seems to serve the old files |
| `openTimes()` | a window slow to open: each window opened on this page since it loaded, its first open against the middle of its later ones, from the click to the render and to the frame that shows it; `{ reset: true }` forgets the opens read |
| `perf()` | a theme that stutters, and what the rolls your browser drew cost on their way, over the last fifty draws this browser took part in: packet in to answer out here, asked to dice started (which comes before the answer), and asked to dice shown on a player's |
| `fps({ toChat: false })` | a table that lags: five seconds of the frame rate (the middle frame, the slowest twentieth, how many frames took over 33 and over 50 ms), what the module did in them, and what each of its effects costs, switched off one at a time for about a second and put back, the map last, which stands still for that second. One run at a time; `counters()` reads the module's counts alone. How to read it: section 20.6 |
| `a11y()` | controls a screen reader cannot name |
| `relayGuard()` | whether the guard on Daggerheart's GM relay is standing (`state: "ok"`), and what it has refused this session |
| `rollFlags()` | the players' rolls drawn in the last half hour (as long as a Reroll can reach) whose roll window claimed a statistic, an experience, a bonus or dice the list of the GM's browser that drew them did not give, or left out a bonus or an advantage die the list gave, or that waited for a statistic no GM picked; each was whispered to the GMs as it was drawn and counted as the list gives, and a line may end with what the GM counted |
| `sheetWrites()` | the changes players' browsers made on their students in the last day that the primary GM's browser put back, flagged or listed, or let stand on what covered them: who, which student, the reason the change named, each field before and after, what a refund took back of what was paid before, and how and by whom a flagged one was decided; also the rows `refused`, `forged` and `rewrite` (what was refused, forged or put back, and how many times) and a relay gain covered by the player's own roll |
| `publicRoll(formula, { flavor })` | the one roll everybody reads while rolls are forced private, such as a vote's tie or Monokuma's lottery; GM only, and from a macro, since the panel has no tile for it |
| the panel's **Debug log** (Diagnostics) | its **Copy to clipboard** produces the paste a bug report needs |

**Repairs.** `resetAllActions()` for a botched advance; `ruleOnParkedMurder(killerId, true)`, `applyChapterEnd({...})`, `setMotive(null)`, `refreshMusic()`, `repaintFog()` and `resetAllVoice()`.

### 20.4 The contract with Foundry, Daggerheart and the modules

The module reaches into code that is not its own (Foundry's, Daggerheart's, other modules') at many places, and each place is a row of one register, which `diagnosePatches()` lists. At each load the primary GM's browser reads every row as *ok*, *failed* or *unknown*; unknown means nothing here could tell, and it is a warning, never a pass. Nothing is written to the world.

When a row fails, the module does what its own file has always done without that place, and you get one notice, which stays until you close it, naming each such place with its file and function and what the table gets instead. A place found failing later in the same load (the first character sheet, a scene with floors opened later) gets a notice of its own, and no place is named twice in a load. The **Debug log** window's **Foundry and modules** (Diagnostics) and the report show the same lines. The rows that guard trust (the guard on Daggerheart's GM relay, the roll draw, what a player may read of a roll) keep their own words and their own fallbacks, and a failed one never becomes a looser one.

To fix it, update Danganronpa RPG, or tell its author which versions of Foundry and Daggerheart you run, with the report (section 20.1). Some places can be read only at a table (a notice's lifetime, the voice client's mute and volume), and they stay *unknown* until somebody checks them.

The notice names what the table gets instead at each place. The whole register, row by row, is in section 22.20.

### 20.5 The data migration and the macro API

**The data migration** runs by itself at load, on the primary GM's browser, whenever the installed version has moved, and does nothing on a world that is already current. By hand it is `game.drpg.migrate()`; `game.drpg.migrate({ force: true })` runs it whether or not the version moved, which is the repair when a world's data plainly is not current. Running it twice changes nothing the second time. `game.drpg.migrationStatus()` says what it would do and writes nothing. `migrate1_2_0` is its name from the 1.2.0 update, the same function, kept as an alias (below): call `migrate()`.

**The macro API.** A macro calls everything under `game.drpg`, with actor arguments as above. A name that is no actor's id and no actor's name gives a warning that names the call and the word you gave it; a name two actors share warns too and acts on the first. `tools/api-surface.json` in the module's repository lists every key of `game.drpg` with its kind, and a test holds the live object to it: a key leaves `game.drpg` only after at least one release under its old name as an alias. The aliases today follow that file; *no end set* means no release is set for removing the old name, so it stays until a release says otherwise.

| Old name | Now | Kept until |
|---|---|---|
| `migrate1_2_0` | `migrate` | 1.3.1 |
| `advanceFloorNow` | `skipStep` | no end set |
| `extendFloor` | `adjustTime` | no end set |
| `endFloor` | `endMode` | no end set |
| `exportLedger` | `backupCase` | no end set |
| `importLedger` | `restoreCase` | no end set |
| `isSilenced` | `isCrimeSilenced` | no end set |
| `musicDialog` | `soundDialog` | no end set |
| `currentRoom` | `roomOfActor` | no end set |

### 20.6 When the table lags

Measure before you change anything, on the GM's machine and on the weakest player's, and send one block a machine:

1. Note the browser and whether it draws on the GPU (`chrome://gpu`, "Canvas: Hardware accelerated"), the screen size and the page zoom, Foundry's *Performance Mode* and *Maximum Framerate* (core settings), the theme, how many players are connected, and how many tokens and Remnants stand on the scene. DevTools -> Rendering -> "Frame Rendering Stats" shows the frame rate live.
2. Everyone stands still, and one player stands in a room with everything else under fog. In the console: `await game.drpg.perf()` (its report is whispered to you), then `await game.drpg.fps({ toChat: false })`. Copy what both print.
3. In the settings window, one at a time and reading the frame rate each time: **Glass blurs the map** off and **Glass pulse** off (in **Effects and accessibility**), **State name behind the clock** off (in **Look**), **Reduced motion** on (in **Effects and accessibility**), then the theme **Monokuma Legacy** (in **Look**). Note the number for each, and put every switch back.
4. While another player walks across three rooms: `await game.drpg.whySlow()`, then `fps()` again. `whySlow()` lists only frames over 50 ms, so an empty table with a low frame rate puts the cost in drawing, outside the module's script.
5. On the GM's machine, with the most Remnants placed, step 2 again: the GM sees every ring.
6. Voice: the GM turns on **Verbose console logging** (the gear's **Technical** section, a GM's alone); one player, whose window does not show it, types `game.settings.set("danganronpa-rpg", "debug", true)` in the console (`false` turns it off again); both set the console to Verbose. After a cut-out, copy every line starting "Voice:" with its time, and say whether anybody crossed a door or stood in a doorway or a corridor, whether an Eclipse was running, and whether the same account was open in a second window. Turn proximity-voice-chat off for this.

**A token dragged across rooms.** While a player drags their own token across a room and into the next, run `await game.drpg.fps({ seconds: 5 })` at the same moment on the mover's browser, on the browser of a player who is only watching, and on your own, and send the three results with the theme each was in. Read the lines below, and the module's work during the drag: the changes of `refreshToken.*`, `visibility.applyAll.tokens`, `visibility.sightRefresh` and `visibility.myRooms.walk`. The module's own counts in the test suite are counts on a model, not frame times; only a table's `fps()` says whether a drag runs smoother, so do not take a lower count for a higher frame rate.

Neither the drag's lag nor the flickering edges of the Stained Glass buttons (the GM panel's tiles, the footer buttons) are known to be gone (technical notes: section 22). Send back the `fps()` result from the mover, from a watcher and from the GM's browser; for an edge that still vanishes or flickers, which control, the theme, the screen size and page zoom, and a screenshot.

**Reading `fps()`, and what to turn off.** Its first lines are the screen, the theme and the window watched: the frames counted, the frame rate, the middle frame and the slowest twentieth in milliseconds, and how many frames took over 33 ms (under 30 a second) and over 50 ms; a frame at 60 Hz has 16.7 ms. *On the canvas now* counts the filters standing on the map; the light of the rings and of the room outline is drawn once and worn as a picture (*Seams' light drawn once*: one picture for each frame shape, however many tokens wear it), so a blur at rest names by its name what is still drawn every frame. *Foundry's own filters* counts the filters on the map that are not the module's (Foundry's vision, lighting and masks, other modules'), which fps() reads and never switches off. *The module's work* is what the module did in the window, per second: at rest under Stained Glass the glass pulse alone, and a step of another player's adds one refresh of that token for each of the module's four listeners (`refreshToken.*`) and none of the other tokens on the scene. *Each held alone* switches one effect off for 60 frames or one second, whichever ends first, and reads the frames again; the outline's and the rings' light are each held twice, as a live filter and as its picture drawn once. The line with the most *ms less* is the effect that costs this machine most, and *the canvas* line is the whole map, so a large saving there and little elsewhere means the cost is Foundry's own drawing. Turn things off in that order, one at a time and on that browser alone, from the gear's settings window: **Glass blurs the map** first, then **Glass pulse**, **State name behind the clock**, **Reduced motion**, and last the theme **Monokuma Legacy**; Foundry's *Performance Mode* and *Maximum Framerate* and the browser's hardware acceleration are the next places to look. Two readings of the same state on one machine move by several milliseconds, so run it twice and read the two together.

### 20.7 Common pitfalls

| Symptom | Cause and fix |
|---|---|
| *Players see a black screen.* | The scene has rooms but Foundry vision is still on. The **Season checklist**'s rooms row names each such scene; `prepareScenes()`, on the primary GM's browser with **Rooms decide what players can see** on, switches every scene with rooms to the module's vision at once. |
| *"Morning · ECLIPSE" and murders keep being refused.* | The clock was edited while an Eclipse ran. End the Eclipse from the HUD's play button. |
| *Nobody got their actions back.* | Actions come back when the Eclipse opens, not when the clock moves. For a boundary without an Eclipse, use the panel's **Skip the Eclipse**, or tick **Also refill actions and Search Tokens** in **Edit campaign**. **Never use both.** |
| *Search never produces what I put in the tables.* | A tier pool is found by the category and tier the installer or the **Tier pools** tab wrote on it, or by a name of the `DRPG <category> - Tier n` shape: make it on the **Tier pools** tab or install it from the editor. Room pools must be pointed at from **Room setup**, and a room's own tables answer before the tier pools. |
| *The Play button does nothing.* | There is no playlist named exactly "Situational". **Create the “Situational” playlist** in the **Play** tab makes one. |
| *Silence for the first minutes of a session.* | The browser had not been clicked yet; `diagnoseSfx()` counts what was dropped. |
| *The panel says the debate is open, but the chapter is over.* | The trial outlived its chapter. Press **End the trial** in the Class Trial console; the chapter-end screen has a checkbox that does it for you. |
| *A Despair Call or a ruling did nothing.* | With two GMs, the primary writes. Check which connected full Gamemaster is the primary (the lowest user id), and look at the **Debug log**. |
| *A player is told a Daggerheart change was not carried out, because this game leaves it to the GM.* | Their Daggerheart feature asked for something this game keeps to the GM (an area on the map, a new countdown, another student's Health). The warning on your screen names what; do it by hand. |
| *A player's Daggerheart cost did not land while a GM was reloading.* | With two GMs, only the primary one makes Daggerheart's changes for players, and one sent in the moments around its reload can be lost. Set it by hand. |
| *Chat says Daggerheart asked for a change for a sender Foundry did not name.* | Every such change is refused. If players' Hope, Sanity or Fear stop moving when they roll, this is why: tell the module's author, with `game.drpg.relayGuard()`. |
| *A player's change to their sheet snapped back, or a card asks you about it.* | Nothing the module knows of covered it (section 6.3); `game.drpg.sheetWrites()` shows what and why. If it was a ruling of yours, set the value yourself: a GM's change is never judged. |
| *A door stays locked after the season reset.* | The reset restores the **Doors** tab's **Locked at start** column. |
| *"The data migration stopped short" stays on screen after an update.* | A step that moves world data into the GMs' store could not read it back and left the world as it was (section 1.5). The console has the details, and the next load of the world tries again, on the primary GM's browser. |
| *A notice says something Danganronpa RPG relies on in Foundry, Daggerheart or another module is not as this version expects.* | The contract (section 20.4): the notice names each place and what the table gets instead, and nothing else is lost. Update the module, or send its author the report (`game.drpg.diagnose()`, then **Copy report**). |
| *The table sees nothing of a death.* | The running incident's victim is kept by the GMs until the body is found (section 13.4). To make it known, set them to **Dead** in the **Students** window. |

---

## 21. Session checklist

**Before the session**
- Open **Season setup > Season checklist**: every row that is not optional ticked, the rooms row among them (no black-screen scene), and nothing left in the further checks under the rows (no sheet a player can read).
- **Room setup**: bedrooms owned, doors as intended, rests allowed in the right rooms, Search tables and good and bad places set, Search Tokens restocked.
- **Despair Flow**: every student watched, pools named, and the Overflow's threshold and the effects it draws from as you want them.
- Item tables installed, and opening items in every bag.
- Sound: playlists mapped (and "Situational" exists), effect files assigned, and volumes checked on your browser.
- Read the pre-session notes in the messenger, and confirm the safeword with the table.
- If a murder is likely this session, draft the Key Remnant plan; if the chapter needs a Final Truth Remnant, place it.
- Clock: the right chapter, day, session, time of day, and phase.

**Each time of day**
- Watch the **Next** line and **Still to act** on your status strip for who still has actions.
- Rule promptly on the cards in the messenger: Experience, Ultimate, Dynamic Actions, proposals, Observe targets, reshaped Remnants, Direct Murder declarations, and trap alerts.
- When everyone is done, start the Eclipse (it refills), let them place, and end it (it advances). Judge parked murders at the lights.
- Spend Despair like a Monokuma: the table is told of every Despair Call but the Bounty.

**When a murder runs**
- Take the incident to the end before anything else, and finish the prose the cards hand you.
- Let the killer clean up while the scene is warm. Place the remaining Key Remnants (the after-incident screen counts them).
- When the body is found, pick which Faint Remnants belong, start the Investigation when the room is ready, and issue the autopsy.

**Investigation**
- Keep the **Investigation** window open on the Remnants, the Key Remnants found of those planted, and **Who has what**. Aim for a suspect circle of 2 to 4.
- Honor critical hints. Start the trial when the class is ready, knowing what the Key Remnant fee will be.

**Trial**
- Start, discussion, open debates as needed and close them; vote, remind stragglers, count; verdict; Level Ups; end of chapter.

**After**
- End of chapter: reveal, sweep, clear, next chapter, next session, next morning.
- **Back up** the case (GM panel, **Diagnostics**, **The case**) and keep the file where no player can open it: the answer keys, the Remnants, the Mastermind, the traps' builders and triggers, the Key Remnant plan, the notes, and the deaths nobody has found live only in GM browsers.
- Copy the Debug log if anything misbehaved. Note what the next chapter needs.

---

## 22. Appendix: technical notes

What the sections above leave out for a reader at the table: the files and functions behind a rule, the console, what each browser holds, and when a rule changed. Each part names the section it belongs to.

### 22.0 Before section 1

The rules file the head's note names is `scripts/config.mjs`. A few numbers live beside the code that applies them: the Fear note's 4 steps in 10 seconds is `FEAR_STEPS_NOTED` and `RECENT_MS` in `scripts/relay-guard.mjs`, and the notice history's budgets are `BUDGET` in `scripts/notice-history.mjs`.

### 22.1 Installation and dependencies

**The required modules.** The list of required modules is `relationships.requires` in `module.json`, which Foundry's own module browser reads too; `scripts/requirements.mjs` reads it back. The window's reasons are `DRPG.Requirements.reason.<id>` in the language files, and the window speaks the module's language stored on that browser, else Foundry's language where the module ships it, else English. A module that did not start also takes its own stylesheets off the page (`removeModuleStyles`), which is why the hotbar, the scene navigation and the players list stay where Foundry draws them.

**A newer Daggerheart.** `announceNewerSystem` (`scripts/requirements.mjs`) warns every GM at each load while the system is newer than the verified one, and runs the patch probe so a place the module changes or relies on that was not found is named in the window. Its checkbox *Do not mention ... again on this computer* silences it for that version on that browser (the client setting `systemWarningSilenced`); **Show again** under Silenced warnings in the diagnostics report undoes it.

**The Next line.** The line is built by `scripts/gm-panel.mjs`, and the first row still to do is `firstOutstandingStep` (`scripts/season-setup.mjs`), which skips optional rows and rows the module cannot finish. The season counts as started (`seasonUnderway`) once the clock has left the first time of day of its first day, or a boundary has refilled the students (`refilledFor`, written by the first Eclipse). **Where to start** is shown once per browser (the client setting `startHereShown`).

**What the module holds.** The held settings are `ENFORCED` and `FOUNDRY_WRITES` in `scripts/enforced.mjs`. The dice look is two world settings read together by settings.mjs `diceLookChoice`: `forceDiceLook` (on or off; off is each player's own) and `diceLookKind` (which look, default `dsn`); whose look it is is `diceLookSource` (`scripts/dice-look.mjs`, `scripts/dice-sync.mjs`). Version history: the Hope and Despair look on Daggerheart 2.9 and older since 1.2.98; the three choices, *Everyone: Daggerheart* and Daggerheart's own colors on 2.10 and later since 1.2.112, when a world's old on/off switch became the Dice So Nice choice (on) or each player's own (off); the Gamemaster's looks in Dice So Nice's Dice Roles, and a role's own look going back to it, in the 1.2.113 assembly. A look that keeps changing straight back is left as it is for a minute (`FUSE_WINDOW_MS`, 60000 ms), then put back at its next change or throw, so the first throw after that minute still shows it; the primary GM is told once.

**The players' accounts.** `scripts/user-match.mjs`, since 1.2.79. Only accounts of players (Player or Trusted Player) are matched, never a GM's or an Assistant GM's; the primary GM's browser does it, at its start and when a user connects, a user is made or renamed, or a student is made or renamed. **A student two players own** since 1.2.83: read in the code and the harness; a co-owner and an observer at a real table are not measured (S01-33).

**Updating from a build before 1.2.63.** Two builds moved what only the GMs may know out of the world's data into a store kept for each world in each GM's browser: 1.2.63 moved the case (section 14), and 1.2.64 moved more of it (below). 1.2.63 reads the store the earlier builds kept in the browser and never writes it. If you also want the browser's own copy, open the world in each GM's browser and paste this into the console (F12); it saves every `danganronpa-rpg.` key of that browser to one file and answers how many it saved. That file holds every answer key this browser keeps, of every world it has opened: keep it where no player can open it, as you keep a case backup.

```
(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("danganronpa-rpg.")) o[k] = localStorage.getItem(k); } foundry.utils.saveDataToFile(JSON.stringify(o), "application/json", `drpg-browser-${game.world.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`); return Object.keys(o).length; })()
```

A world copied before the update opens holding the same case as the original in a browser that played both: the old store in the browser did not say which world it was, so each copy takes the rows its own actors, scenes and items match. From the first load on, each world keeps its own. Whether Foundry's Duplicate World gives the copy a world id of its own, which that depends on, has not been checked at a table.

**Updating from a build before 1.2.64.** 1.2.64 takes more of what only the GMs may know out of the world's data and into the same store: who builds each trap, what sets it off and who sabotaged a project; the Direct Murders declared in the dark and the crossings of a running Eclipse; the Key Remnant plan; the players' pre-session notes; how a running incident happened; the Overflow's count; what was taken off each body; and which Remnant each Truth Bullet came from. It drops a Reroll's bookmark and a Search card's facts from the world's data, puts the neutral name and picture back on Remnants' tokens that earlier builds had named, and moves the answer keys still left on old Remnants' tokens into the case. This runs once, on the primary GM's browser, a moment after the first load of 1.2.64.

**Requests from players' browsers.** A refusal is logged on the primary GM's browser. A few refusals are only logged and never told, because nobody waits on them: among them a trap report, the Level Up catch-up and a Search's look for a planted item. A Daggerheart request of a kind the module does not know at all is noted without a name. Since 1.2.67 the dice of a player's action and of a statistic clicked on a sheet are thrown by the primary GM's browser; since 1.2.68 what the roll adds is that browser's reading, and a change a player's browser makes on their own student is checked there. `game.drpg.rollFlags()` lists what a roll window put on that was not counted; since 1.2.69 a die the window shows at other faces, in another number or with a modifier of its own is named there too, and never thrown. Since 1.2.69 the GM's browser keeps the three Remnants (`refused`, `forged` and `rewrite` rows) that `game.drpg.sheetWrites()` lists beside the writes; a message a player's browser wrote with a flag only a GM's browser writes is read by no browser as a drawn roll, never granted and never a Reroll's.

**What every browser holds.** Since 1.2.111 the picture on a project's token is the project's tray icon, a secret project's too: a choice accepted on 13.11.2026, because the tray icon was already in the projects' world data, so the token adds no new fact, only a second place to read it.

**What the chat still says, in detail** (since 1.2.65; how far each was measured):

- Veiling was measured on the test harness for an item used in a fight, a Call bought for a participant and a bystander's cards.
- **Who created a roll or a card.** Foundry stamps both on the document with the user whose browser created it. Since 1.2.67 a player's roll (an action's, and a statistic clicked on a sheet) is thrown on the primary GM's browser, which writes its message (measured on the test harness, where a bystander's browser holds the killer's opening roll with the GM as its author). The roller still sees it as their own: their dice fall on their screen in the roller's look (with one look for the table, the one full Gamemaster's look every player throws in; with each player's own look, their own colors), or the dice sound plays without Dice So Nice, and they read the result. A GM sees the dice in that same look while one of that GM's own Monokumas stands in the roller's room (since 1.2.98); a Monokuma whose GM cannot be told (several full Gamemasters, no pool set and no single one of them named its owner) admits nobody, and every GM reads the card either way. An incident's participants see each incident roll, and nobody else sees anything (measured on the test harness's model of Dice So Nice, not at a table).
- **A roll with no GM connected.** A roll thrown while no GM is connected, or on a Daggerheart whose rolls the module does not draw (you are told once per version), is thrown in the player's browser and names that player as before. With no GM connected an action is refused before it is paid for, and any other roll is stamped and moves nothing until a GM grants it (section 6, the primary GM).
- **A private card during an incident.** A private card a player's browser would post while an incident runs is posted by the primary GM's browser at its asking, so its author is a GM as well (measured on the test harness, where the bystander's browser holds the fight's cards, an item used and a tool broken, and a player's message to the GM with a GM as their author). With no GM connected it is not posted, and the player is told that no GM is connected. Any other card a player's browser posts, veiled or not, carries its author the same way (Foundry's rule, not measured card by card).
- **A veiled card and a GMs' whisper.** Measured for the trap's receipt: a bystander's browser holds it as a card that names no thread and no player, without its words.
- **A roll's formula.** Read in the code, not measured.
- **Daggerheart's own reroll** is taken off a player's chat menu since 1.2.67, and dice a player's browser rewrites anyway (Daggerheart's own reroll on the card, a console) are put back by the primary GM's browser, and the GMs are told, once per message and player (read in the code), with a `rewrite` row in `game.drpg.sheetWrites()` naming who (measured on the test harness for a console's rewrite; the menu and the card's reroll not, as the harness does not run Daggerheart's chat log). A roll thrown before the primary GM's browser loaded cannot be put back, only told. The 3D dice of such a rewrite may still fall on every screen before it is put back (not measured). The module's Reroll shows its dice only to the roller, the GMs and, in an incident's fight, its participants.
- **Foundry's user activity**: Foundry's own, not measured here.
- **A statistic clicked on a sheet** at your request keeps Daggerheart's card, written by the GM's browser and naming nobody, whispered to the GMs; the roller's browser alone may read it beside them (measured on the test harness). Wherever it is read, its header shows the roller's character, portrait and name, or, on a browser that no longer knows whose roll it was (after a reload), nobody; never the GM (measured on the test harness's model of Daggerheart's header, not at a table).
- **A roll the module did not throw**, Daggerheart's own item rolls, keeps Daggerheart's card and its speaker, whispered to the GMs and that character's player (read in the code).
- **A Monocub's Meddle** is thrown by the GM's browser since 1.2.67, after it has checked the target. Its card is the module's own, posted by the Monocub's player's browser under the Monocub's name, and the room sees it like every Monocub roll. A Meddle the GM's browser refuses throws nothing and posts no card, and the Monocub's player is told it was refused (read in the code; the refusal measured on the test harness).
- **The chat log written before 1.2.65, where its first load could not rewrite it.** That load rewrites the module's old rolls and private cards as they are written today: what is veiled now is veiled (the trap's receipts, a reshape card, Confusion's cards, a Loaded Die's notice, a worn or broken tool, a Hope Call's receipt, the time of day told during an incident), and a roll's list loses an incident's other players. It leaves a whisper that carries its words in its document (the module's from before it kept private words off the document, and every whisper that is not the module's), 1.2.64's public card for the end of a secret project's repair, an old card of a veiled kind known only by its words when the primary GM's browser no longer holds them or holds them in another language, a Monocub's roll, and the other private cards posted while an incident ran (an item used in a fight, a Call armed on a participant), which are veiled today because an incident is running, and an old card does not record whether one was. A veiled thread card keeps its place in its thread only on the browsers connected at that load; elsewhere its words stay in the chat log. Measured on the test harness for a receipt, Confusion's card and a fight's roll, not on a real world's log.

### 22.2 The season setup checklist

Season setup and the Season checklist are `scripts/season-setup.mjs` (`openSeasonSetup`, `openSeasonChecklist`; the rows are `steps()`). Edit campaign's fields and what its Apply writes are gm-campaign.mjs `campaignRows` and `applyCampaignForm`, which Season setup's Save runs.

Since E101 the Season checklist holds what Pre-season checks held; until E101 the Pre-season checks button stood under the rows. The cast and scenes parts of that report became rows (the characters no player owns the `npcs` row, a scene's Foundry vision the rooms row), and its contract with Foundry and the dice look's console line moved to the Debug log's **Foundry and modules** (`openFoundryReport`). The Sound files row went in E101 item 2. Since E101 F4 a tile's window opens in front of Season setup without closing it.

The chapter's range is config.mjs `CHAPTERS_PER_SEASON` (6); the safeword's default is settings.mjs `DEFAULT_SAFEWORD`. The starting numbers are config.mjs `STARTING` (Health 4, Sanity 6, Hope 2 of 6, 2 Experiences at +2, `startingItemTier` 2) and `TRAIT_ARRAY`. **Give the starting resources** runs `initCharacter` on every student whose max Health or max Sanity is below `STARTING` (character.mjs `needsStartingResources`), so a maximum a Level Up raised is left alone.

*At least one Monokuma*: **Open** opens the Students window since E101 item 6 (Despair Flow made a Monokuma until then). **Mark as Monokuma** is on the sheet header since 1.2.101 and no longer on the Actors list's menu. *Everybody has an Ultimate* reads the Ultimate flag; *Everybody carries something* counts inventory.mjs `carriableCategories()`.

*Every student has a Monokuma watching* asks each assignment itself (`explicitPool`). Despair Flow's division is a world setting every player's browser reads, which is why the one student set to "- nobody -" stands out. *The Mastermind feeds a Despair pool* is drawn, as a cross, only while mastermind.mjs `mastermindUnpooled()` holds; the case health check (`game.drpg.gmStoreHealth()`, `game.drpg.diagnoseGmStores()`) lists it too.

The overflow suggestion is overflow.mjs `overflowSuggestion`: 12 plus half the living students, rounded and held to `OVERFLOW.range` (6 to 60); the default is `OVERFLOW.threshold`. *Enough rooms for the cast* is vault-store.mjs `roomCensus` against `roomsWantedFor`, the living students times `ROOMS_PER_PLAYER` (1.5), rounded up. **This is a room** and **No privacy** are columns of Room setup's Rooms tab since E101 item 4 (the Doors tab until then).

*The map has rooms*: the limit is `UNCOVERED_LIMIT_PCT` (10), read on the worst floor of a scene of several. The errors of the last **Check the rooms on this scene** are kept in this browser until a reload, and a scene never checked has none on record. Foundry's vision is fog.mjs `sceneVisionReady` (since E101 item 2). On a scene that is no place the rows read the school (rooms.mjs `homeScene`). *Every named region is decided* reads rooms.mjs `unmarkedRegions`; from 1.2.74 a region is a room only when a GM marked it.

*The GM's pointer is private*: **Hide the GMs' cursor** takes the two GM roles off core's `SHOW_CURSOR` permission, read as Foundry applies its permissions. *The voice server's secret* is voice.mjs `liveKitSecretWarning`, and `game.drpg.diagnoseVoice()` says the same; the row is `external`, so `firstOutstandingStep` does not wait on it.

The First session rows are the group `FIRST_SESSION`. The hall row took in *The trial hall and its tokens* in E101 item 2; with no scene linked the trial is held wherever the table is, as before 1.2.74. The Foundry settings row is drawn only while enforced.mjs `foundryGivenBack()` holds. Dice So Nice's **Open** is offered only where this Foundry has `foundry.applications.sidebar.apps.ModuleManagement`. The Dice So Nice row is ticked when `dice-so-nice` is active (season-setup.mjs `diceSoNice`); since `module.json` requires it and `requirementsMet` stops the module without it, the row can only read ticked while the module runs.

The room pictures' limits are config.mjs `ROOM_IMAGE_LIMITS` (4096 px on a side, 8 MB, and 8 s for a picture to load, `probeMs`). **Open the dice look** runs `diagnoseDiceLook()` (since 1.2.98).

### 22.3 The GM panel

The panel is `scripts/gm-panel.mjs`, the Students window `gm-students.mjs` and Edit campaign `gm-campaign.mjs`. The standing's count is monokuma.mjs `actingStudents`; the table of the living cast that stood there is two columns of the Students window since E49 A2.

The Next line is gm-panel.mjs `nextStep`: its buttons are `NEXT_GO`, and the steps that are not tiles `EXTRA_ACTIONS`. Whether the season has started is `seasonUnderway`; the row it names is season-setup.mjs `firstOutstandingStep`, judged on the school (`homeScene`). The body two witnesses found that waits for your word is a step since 1.2.113.

**Skip the Eclipse** runs boundary.mjs `nextTimeOfDay`, then clock.mjs `advanceTimeOfDay({ resetActions: true })`; it stands in every phase since E49 A3 (`advanceHtml`). The time of day's summary also opens for the console's `game.drpg.setTimeOfDay` and `advanceTimeOfDay` (day-summary.mjs `summaryWindow`).

The Murder tile opens the incident tracker during an Eclipse since E47-C3. The Settings tile reads Foundry's `SETTINGS_MODIFY` permission. **Fix voice** is voice.mjs `resetAllVoice`, run on the primary GM. **Foundry and modules** is a button of the Debug log since E101 (season-setup.mjs `openFoundryReport`; the contract is patches.mjs `runContract`), and it says how another browser's dice look is read since E101.

In Students, the **State** dropdown writes the state's flags alone, while the **Do** column runs the real step. The Spectators are a group since E92 C1, and the sheet and Items buttons a column of their own since E92. **Refund last crossing** (E17 C3) reads the GMs' `crossingStore` and is given back on the primary GM; **Silence now** (E72 C8) is incident-store.mjs `silenceDeadNow`.

### 22.4 The clock

The clock is `scripts/clock.mjs`: the times of day are config.mjs `TIMES_OF_DAY` and the phases `PHASES`; a time-of-day change is `applyTimeOfDayChange`, in the order of section 4. The module refills a boundary once (`refilledFor`). The Wounded note is `DRPG.Clock.woundedNote`, whispered to the GMs with the time of day's card.

A rewind is `rewindTimeOfDay`. It is refused while an Eclipse runs because the Eclipse sits before the next time of day, so there is nothing to step back to. What a boundary gave is kept for `TAKE_BACK_MS` (5 minutes) and up to `TAKE_BACK_DEPTH` (4) boundaries deep; five minutes is a design number, not yet checked at a table.

Edit campaign is also a window of its own, from the console (`game.drpg.editClock()`, gm-campaign.mjs `openClockDialog`), with **Apply** in place of Save. Whether a change calls the assembly off is `correctsTheHour`.

The HUD's marks are `TIMING.elapsedMarksMinutes` (15 and 30). The minutes hold to within a minute because the primary GM's browser notes the time once a minute while the game runs (hud-elapsed.mjs `CLOCK_BEAT_MS`, `beatClock`); that note lives in that browser, which is why another computer or a cleared browser counts from the clock's last change. Not yet checked over two sessions at a table: LIVE-E17-01.

The track band under the clock's lines keeps its place with music and without (an empty line when that browser plays nothing), so a track starting or stopping changes neither the clock's height nor the cut of the glass: since 1.2.101, measured in a browser, not yet at a table: LIVE-E23-02, LIVE-E23-09. *Still to act* is hidden while an incident runs since 1.2.101, and the Event panel keeps one size since 1.2.101.

The clock's turns and the day's boards are in since 1.2.109; the day's number and the session move at the Morning Eclipse's end as they did before. Not yet tried at a table: the boards' frame time with Dice So Nice and the curtain (LIVE-E94-01), a player who joins mid-day (LIVE-E94-02), the boards under a running incident (LIVE-E94-03) and the turns' directions on a real v14 (LIVE-E62-01).

### 22.5 Actions and budgets

Sources: `config.mjs` `ACTIONS`, `ACTION_GRID` (the tiles' order), `STARTING`, `STATES`, `INFILTRATE`, `REST`, `SABOTAGE_CONCEAL`, `DYNAMIC_THRESHOLDS`, `CRITICAL`, `OBSERVE_DC`, `OBSERVE_FAIL_STRESS`, `ANALYZE_DC`, `PRICE_CHAINS`, `TIMING`; `scripts/actions.mjs`.

The budget: `STARTING.actions` (2). Wounded's lost action is taken only in the phases `STATES.wounded.actionsLostIn` names (`dailyLife`, `investigation`), read by actions.mjs `actionBudget` off the clock's phase; the state, its badge and its icon stay in every phase. A Monocub loses no action to a wound (`actionBudget` reads `FLAGS.monocub`). Panic is the Overflow's `panic` state (`by: 1, floor: 1`); its floor of 1 is applied only while the darkening is on. The budget is derived, never stored: `resetActionsFor` writes it, and its maximum, at each refill, which is why a heal mid-day shows only then. The order a price is paid in is actions.mjs `spendAction` (a banked Burst, `FLAGS.freeActionGrants`, covers one whole call before any action is spent) and `takeMove` with `nextCrossingPrice` (the Free Move, a banked crossing, a Burst, an action; D113).

The tiles' numbers: Search `ACTIONS.search.thresholds` and `critical.tierBonus` (action-search.mjs `searchTier`); Observe's DC `OBSERVE_DC`, its failure `OBSERVE_FAIL_STRESS` (1 Sanity); Analyze's DC `ANALYZE_DC`, its `hintThresholds`, `stashThreshold` and `passageThreshold`, its trial price `PRICE_CHAINS.analyze` (an action, then 1 Hope, then 1 Sanity, the steps after the first only in the Class Trial); Palm `ACTIONS.palm` (`threshold`, `unseen`, `plant`, `frisk`, `rummage`), the Frisk's clocks `TIMING.friskAnswerMs` (60 s) and `TIMING.friskForceMs` (30 s); a Plant into full pockets is a try and stays paid (palm.mjs, D42; D091); Tamper `PRICE_CHAINS.tamper` with cleanup.mjs `tamperPriceSkip`; Infiltrate's rows `INFILTRATE`; Projects `ACTIONS.project`; Sabotage `ACTIONS.sabotage` (`simpleRepair` 2) and `SABOTAGE_CONCEAL` (Shadow 16, `despairPenalty` -1); the Dynamic bands `DYNAMIC_THRESHOLDS`; the rests `REST`; a critical's Hope `CRITICAL.hope` (2).

The statistic proposal is trait-ruling.mjs's. **Players' statistics without approval** is the world setting `autoApproveTraits`.

The sabotage's damage is applied by a GM's client; with no GM confirming in time, the roll stands and the project may not be broken.

The character sheet's reserve (since 1.2.101): `scripts/character.mjs` `reserveView` is the one helper the sheet, the Event panel, the tracker, the token bars and the Party sheet read, and `sheet.mjs` draws it; the field writes what has gone, `max - n`. With *Lock players' resources on the sheet* off, the GMs' audit treats what a player types as any change of theirs to Health or Sanity: a heal is listed in `game.drpg.sheetWrites()` and stands, a hurt stands with no row (section 6.3). Table checks: the pips drawn the same with Daggerheart's pips on and off (LIVE-E24-02); the token HUD's two inputs disabled for everybody, read on Foundry's v13 as recalled (LIVE-E24-01); the Party sheet's toggles off for players (LIVE-E24-03).

Who reads what (since 1.2.101): the Breakdown and Wounded badges are public on the sheet since 1.2.104, and since then no token draws either icon; the dead overlay still drawn on a token is a table check, LIVE-E95-05. A roll's card never naming Breakdown is a table check, LIVE-E24-10 (measured headless, with no card drawn). The GMs' audit that names Breakdown is the whisper and the roll's `rollFlags`.

The state icons: `config.mjs` `STATES` and `DEAD_ICON`, `icons/state-*.svg`, states.mjs `ownDeadIcon`. The dead icon is the module's only while Daggerheart's Automation setting for the dead icon is at its default. A change of that setting takes effect at once, without a reload, for new dead markers (the module's skull at the default, the GM's own icon otherwise); a marker already on a token keeps its image, a table check, LIVE-E24-13. The Breakdown and Wounded effects a world already holds get the new images when the primary GM loads the world (that browser puts them on, once a load), while a dead effect already on a token keeps the tombstone it was made with. The effects of an unlinked token are not reached; the module's students are linked.

The sheet's other parts: each part the sheet adds is drawn in its own step, so when one fails the others still draw; the primary GM's notice comes once a load, and the console (F12) has the error. A save that writes over somebody else's Background since 1.2.101 (`DRPG.Sheet.biographyChanged`); a dead student's and a Monocub's items have no item buttons (D15). One gate, five sheets: every part the module adds to a character's sheet first asks whose sheet it is and who is looking, and draws what the answer allows; since 1.2.101, `sheet.mjs` `sheetMode`. A sheet that does not blink: when a write changes only Health, Sanity or Hope, every browser holding the sheet open paints the change in place, the writer's and everyone else's: the bars or the pips and their rows, the Hope diamonds, and the Calls and tiles whose price moved. The window is not drawn again. Anything else in the write (an item, a flag, Hope's maximum) draws the sheet again, and a write the lock or the Overflow cuts to nothing draws nothing and leaves the next draw whole. Since 1.2.101; a table check, LIVE-E45-01, with LIVE-E45-02 and LIVE-E45-03 for the rest.

### 22.6 Hope Calls and Despair Calls

Sources: `config.mjs` `HOPE_CALLS`, `DESPAIR_CALLS` and `MOTIVE` (`minTimesOfDay` 1, `maxTimesOfDay` 10, `defaultTimesOfDay` 3); calls.mjs `callBarred` and `hopeCallRefusal` (the locks).

Buying a Call that changes a roll: the primary GM's browser takes the Hope and arms the Call. With no GM connected the GM's browser refuses the request before its price (read in the code; measured for a Search, not for a Call). A roll the primary GM's browser draws applies only the Calls the GMs hold armed; a roll thrown in the player's browser, with no GM connected or on a Daggerheart whose rolls the module does not draw, spends there the Calls its window shows (read in the code).

Talent (E72): an Experience or an Ultimate armed before the update still works, each keeping its own key. Resolve costs 2 Hope since 1.2.104 (3 before).

The Reroll: the browser of the GM making it makes the Hope, the dice, the message, the undo and the replay. A second Reroll of a character is refused while one is being made, on any GM's browser. A Reroll of a roll that browser drew throws the same dice and what it counted, never what the roll window claimed.

Experience and Ultimate: the yes is kept by the primary GM's browser, which arms the Call only with it; since 1.2.83 a card put up by a primary GM who has since left takes a yes again once the player's browser has asked the new primary.

The Bounty: the Monocubs are told of a lapse since 1.2.113.

Armed Calls: on a roll a GM's browser draws, that browser's list decides (since 1.2.68), and the rule of section 6.2 holds there: a hindering Call counts when the window names it, whatever its age, and when it was armed more than a minute before the roll, whether the window shows it or not. Since 1.2.69 the bonus a Call arms is written into the window's bonus field, and the window never sends a number the GM's browser does not hold: measured on the test harness's stand-in of the window; on Daggerheart's own window a table check, LIVE-E33-09, not yet run.

Rulings, cards and the messenger (section 6.3): a card's buttons are GM-only and checked again when the press arrives, so a forged click does nothing. The files are `scripts/call-gm.mjs`, `gm-bridge.mjs`, `bridge-wire.mjs`, `bridge-table.mjs`, `bridge-runs-acts.mjs`, `bridge-runs-records.mjs`, `bridge-asks.mjs` and `messenger.mjs`. Each GM's browser keeps its own read marks, and the cards counted unread for the GM who posted them are the bridge's cards in a player's thread. Since 1.2.83: a question is not posted at all with no GM connected; one ruling per card; a private card a player missed. A GM's browser keeps each reader's lines of a card beside its own copy, which is how a line written for one player comes back as it was written.

The primary GM's writes: another GM's browser asks the primary GM's browser for a pip or a stepper of the Despair bar; a pool set, filled or emptied; a pool granted, taken away or renamed; the Despair Feed the Overflow pours in; a point taken back off the Overflow; and the Overflow's check when the time of day moves, which names the time of day it checks, so the primary arms nothing for another one, and which runs on the asking GM's browser when the primary does not answer.

Rolls made while no GM was connected: a statistic from the sheet is thrown as a reaction since 1.2.69; a message a player's browser wrote with a GM's flags is not on the card and is never granted: it is a `forged` row in `game.drpg.sheetWrites()` (since 1.2.69).

What a player writes on their own sheet (since 1.2.68): since 1.2.69 `game.drpg.sheetWrites()` also keeps the three kinds of row of section 1.6, `refused`, `forged` and `rewrite`, with a `what` column saying what was refused, forged or put back and a `times` column that counts the same `refused` or `forged` row from the same player within half a minute. A Hope gain Daggerheart's relay credits for a player's own roll the GM's browser did not draw stands on a `covered` row. A Call taken off by hand is put back only with no roll of the player's about that student after it was armed; a roll a player's console posts first counts as one, and it is in the chat for you to read. The list of section 6.3's **Listed** row is `game.drpg.sheetWrites()`.

*Lock players' resources on the sheet*: the token HUD's other bar inputs disabled for players is a table check, LIVE-E29-02, not yet run; the Party sheet's display-only pips are LIVE-E24-03, and a student's Health and Sanity inputs disabled for everybody LIVE-E24-01.

### 22.7 Despair pools, assignments and overflow

The code: `scripts/despair.mjs`, `scripts/despair-award.mjs`, `scripts/assignments.mjs`, `scripts/overflow.mjs`, `config.mjs OVERFLOW`. The pool's cap is `STARTING.despairMax` (12).

A roll's point of Despair is awarded by the primary GM's browser alone, while the setting **Rolls grant Despair** (`despairFromRolls`) is on. The division of the students is the world setting `gmAssignments`, which every player's browser receives: that is why a Mastermind set to **- nobody -** stands out.

Who is a Monokuma has been set in the Students window's **Role** column since E101.

A conversion's Despair waits as a row of the GMs' store `despairOwed` and is paid at the next time of day because the receiver's Hope is actor data every browser holds (section 1): a drop of the donor pool at the same moment would pair the two. The debt has shown on a GM's screen (the dimmer skulls, the tooltip, the Despair window's *(2 owed)* and the giver's notice) since the owner's report of 13.11.2026 on 1.2.112.

Despair past a full pool used to evaporate before the Overflow existed. Since 1.2.64 the Overflow's count is kept by the GMs (section 14), so a player's console reads no more of it than the screen shows. The world holds only what the GM changed from config.mjs's defaults: the threshold, and each effect's `on` and `by`. So a later update's defaults still reach a world. The five room-action states (Lockdown to Power cut) joined the draw later, ticked: before them each of the older eight effects came up 1 time in 8, and unticking the five keeps that draw.

**Clear the overflow** is carried out by the primary GM's browser, whichever GM presses it; with no primary GM connected, the GM who pressed it clears it.

### 22.8 Monokuma, Monocubs and the Mastermind

The code: `scripts/monokuma.mjs` (a Monokuma is a `character` actor carrying a flag, `FLAGS.monokuma`), `scripts/spectator.mjs`, `scripts/spectator-dead.mjs`, `scripts/body-tile.mjs`, `scripts/monocub.mjs` with `MONOCUB` in config.mjs, `scripts/mastermind.mjs` and `scripts/verdict.mjs`.

Since 1.2.101 **Mark as Monokuma** is on the sheet's header and no longer on the Actors list's right-click menu, and **Not in the class** (`FLAGS.notInClass`) arrived in the same version. The Spectator role arrived in 1.2.109, the dead as Spectators in E62.

From 1.2.113 a student no player owns at the moment of death gets no Spectator; the Spectators an NPC was given before 1.2.113 stay until a GM removes them: delete its faint token where the body lies, then its character in the Actors directory, the one the Students window lists with the Role "Dead student's Spectator". Since 1.2.113 an execution plays the execution's sound, then the trial's end.

The body tile has been laid fully transparent since 1.2.113, and tiles laid before 1.2.113 are made transparent once, when a GM loads the world. The headless harness has no canvas, so the body tile has not been seen at a table; nor have the Spectator's making and taking away (a revive, two GMs at once, a Monocub's token), nor whether a wall stops a Spectator's drag.

`game.drpg.monocubDialog()` opens the Students window. What a Monocub carried is its body's by decision D15. Since 1.2.69 a Monocub's abilities are one table, `MONOCUB.abilities` in config.mjs, with five rows: Confusion (key `meddle`), Redeem, Ask for Hope, Tinker and Ghost Bet. They have one executor (`game.drpg.performCubAbility`), one picker and one bridge action (`monocub.ability`). The primary GM's browser checks the move's blocks, the target and the caps first, takes the action and the Hope only then, throws the 2d12 and scores it, so a refusal is told to the Monocub and costs nothing (since E72). Another ability is one row and one resolver (read in the code).

Since 1.2.65 the Call a Confusion arms waits in the GMs' browsers and its target's player's alone.

The Mastermind's identity lives in a GM store on GM browsers only and is synced GM to GM.

### 22.9 Rooms, regions, fog and discovery, movement, voice

**Marking rooms (9.1).** The first load of 1.2.74 marked once, scene by scene, every named region with no behaviors that no player created, and whispered the GM what it marked, what it left and why (*Rooms marked*); a region drawn after that is the GMs' to mark. The judge of a player's change to the mark is the primary GM's browser, against its own record of the mark.

**Rooms and pieces (9.1).** The Rooms tab carried No privacy from E101; until then it was a column of the Doors tab. The Broken column is in the Doors tab since E74.

**Renaming (9.1).** The primary GM's browser carries a rename. The name a renamed piece left is written on the piece itself, so a GM who connects between the renames of a room's pieces, or becomes the primary GM between them, reads them as the GM who saw the first one does; the primary GM takes it off the pieces once the room is carried.

**Bedroom stashes (9.1).** Since 1.2.91 a bedroom gives its owner an open stash on every usual road, the console's `setVaultRoom` among them, and Apply on the Stashes tab no longer erases a stash the same Apply has made a moment before. On the first load of 1.2.91 the primary GM got one report, *Bedroom stashes given*, naming the bedrooms (by scene, with their owners) that had no stash for their owner and were given an open one; a world where every bedroom already had its stash got no report, and only the primary GM's browser did this. It runs once: a stash a GM had removed on purpose is removed again on the Stashes tab, and it is not put back at the next load.

**The console and rooms on several scenes (9.1).** The console's `setStash`, `setVaultRoom` and `setRestRoom` given no scene take the first scene with a room of that name; `placeRemnant` and `applySceneVisionMode` given none do nothing and say so, and `createProject` refuses a room no scene has and says so.

**Search Tokens (9.1).** The count per room is `ROOMS.searchTokensPerRoom` in `scripts/config.mjs` (3), editable in the settings. A player's Search waits 5 seconds (`TIMING.searchTokenAckMs`) for the GM's browser's answer before the token is given back.

**The room tile (9.1).** `scripts/room-tile.mjs` draws it; `scripts/room-setup.mjs` holds the Room setup data.

**Fog (9.2).** `scripts/fog.mjs`, `fog-geometry.mjs`, `fog-doorways.mjs`, `fog-reveal.mjs` and `fog-diagnostics.mjs`. Discovery is written by the primary GM; the full record stays in the GMs' browsers (section 14), and each player's browser holds only its own characters' rows. `game.drpg.prepareScenes()` prepares every scene with rooms at once and remembers what it changed, so `restoreSceneVisionMode` can give a scene back. When a scene gains its first room during play, the primary GM's browser prepares it as `prepareScenes()` would. The behavior changes of a region are scenario 66's X3 and X4, and a Teleport switched off in place is its X7. Token visibility is `scripts/visibility.mjs`.

**A region's caption (9.2).** Since 1.2.94. Daggerheart's own token captions are held off by the contract row `no-scrolling-text` (section 20). The check asks whether any shown token stands where the caption is drawn. Read in the module's code and on the test harness's stand-in of the behavior; at a table, LIVE-E51-05, not yet run.

**Movement (9.3).** `scripts/movement.mjs`. The refusals are made in the mover's own browser; the primary GM's browser judges every player's arrival again. A crossing also fires the trap watcher. The crossing price a Refund gives back is the move's own spend the player's browser made within 5 seconds of the crossing; whether that holds at a table is not yet checked. The sheet button on a Students row is there since 1.2.104.

**Floors (9.4).** When Foundry's own hit test turns a point down in every room, the module falls back to each room's own shape on that floor, and to its bounding box only where that shape cannot be asked - never to a room on another floor, and never to the part of an L-shaped room's box that the room does not cover. A scene with floors and no stairs region is judged by the rooms' footprints as before 1.2.74. `checkRegions()` checks each floor apart and names it in its `floor` column (section 20). What the module knows of Levels is its reading of v14, measured on the test harness's model of it and not yet at a table: what floors a newly drawn region gets, whether Foundry lets a player look at a floor where they have no token, and what one switch of floor costs (`game.drpg.perf()`) are live checks.

**Voice (9.5).** `scripts/voice.mjs`, the setting **Separate voice in each room** (`voiceEnabled`) and LiveKit AVClient; every mapped room is a LiveKit breakout room. During an Eclipse each player's browser leaves voice. The trial's microphone blocks are written by the primary GM's browser. Whether avclient-livekit stops and starts sending without a reload has been tried only on the harness's stand-in for it, not at a table (LIVE-E70-04). The dead talk in the Spectators' voice channel since E62.

**Voice after a reload (9.5).** While the GM's browser has not yet read the incident (right after a reload), a player whose student died in this chapter and who asks for their room is sent there at once, and a living player who walks into a room where a student who died in this chapter lies is sent nothing until it has. Only those rooms are held: a student dead since an earlier chapter (or season) is placed at once as after an incident, and a living player who walks into the room where that student's token stands is sent that room. A page that loads while separate voice is on waits in a room of its own until the primary GM's browser says which room it belongs in; with no GM connected it joins the main room (read in the code and in the test suite, not yet at a table). All of the voice rules have been read in the code and run in the harness, not yet heard at a table.

**Listening at a door and Echoes (9.5).** Since 1.2.113. The primary GM's browser moves the listener's voice and writes the block (`scripts/eavesdrop-gm.mjs`); the block is lifted 4 seconds after the voice goes back (`EAVESDROP_GRACE_MS`). Echoes is read on the primary GM's browser too (`scripts/echoes-gm.mjs`). Both have been run in the harness, not yet at a table (LIVE-E69-03, LIVE-E69-06).

**A doorway or a corridor (9.5).** Since 1.2.89; before it, a player's token outside every room went to the main room, as a Monokuma's still does. The primary GM's browser remembers the room a token came from until it reloads or stops being the primary, and a GM's browser that becomes the primary starts from the main room (run in the harness). Each connect's line in the Debug log says how many connects that page has made. **Fix voice** runs `resetAllVoice` in `scripts/voice.mjs`, on the primary GM's browser only. `game.drpg.voicePlan()` prints where everybody *would* be sent, with no microphone and nobody else connected, so most of a voice test is one person's minute; the voice diagnosis of 9.5 is `game.drpg.diagnoseVoice()`, and it also carries the line about the voice server's secret.

**The voice tile (9.5).** `scripts/voice-tile.mjs`, since 1.2.77. Whether a blocked player who tries from their own browser can still be heard has not been tried at a table yet (LIVE-E78-06). What only a table can show - speech heard, sound from the hidden dock after a reload, the block's effect, a lost connection - is LIVE-E78-01 to LIVE-E78-10 in the audit, not measured here. What the warning about the voice server's secret reads - the server types avclient-livekit 0.6.8 offers, and a filled-in secret with any type but the Tavern - comes from that module's source, not from a table.

**Secret passages (9.6).** `scripts/passages-gm.mjs`, `passages.mjs`. Find Passage's 16 is `ACTIONS.analyze.passageThreshold`. The primary GM's browser decides a tunnel as it decides a door and moves the token, which is why it needs a GM connected. Whether Foundry marks a GM's own teleport as one has not yet been checked at a v14 table. `game.drpg.passages.log()` keeps every show, grant, revoke, Close and Open, the newest first (its last 200). For a Foundry secret door, the primary GM's browser puts a secret door a player changed back as a GM last left it (the door itself keeps that; a door no GM has changed yet, as it stood when a GM's browser first found it), and one changed while no GM was connected as soon as a GM connects, naming its scene on the GM's screen. `game.drpg.passages.audit()` in the primary GM's console lists the moves through a wall since that browser loaded, the newest 1000 rows, the same move again within half a minute counted on one row.

### 22.10 Items

Source files: `config.mjs ITEM_*`, `scripts/inventory.mjs`, `tables.mjs`, `tables-pools.mjs`, `tables-editor.mjs`, `gm-items.mjs`, `handover.mjs`, `vault.mjs`, `vault-store.mjs`, `stash-reach.mjs`, `palm.mjs`, `use-items.mjs`. The durability column is `ITEM_DURABILITY`, a Tool held ready is `TOOL_IN_HAND`, a stash's size is `VAULT_LIMIT`, Palm's numbers are `ACTIONS.palm`, and taking from a body is `LOOT` (its Remnant bands `LOOT.bands`, the Shadow cover `LOOT.cover`).

An item has no tier recorded when it was made by hand or comes from a world older than tiers; it counts as Tier 0.

**The key check** (10.3) runs at the primary GM's load and at Room setup's Apply. It points an owner's own key that names a room that is no bedroom anywhere at their bedroom instead of giving them a second one, as long as it is the key they were given for their own bedroom (a copy of somebody else's key keeps its own owner's name), it is their only such key, and that bedroom is the only one of theirs they hold no key to. Otherwise a new key is made and the old one stays for you to delete. A key in a stash counts as held: its owner is not given a second one, and a key they steal or loot to that room is not copied to them. When an owner holds more than one key to their own bedroom, the same check keeps one (a carried key before a stashed one, then the oldest), takes the rest and tells you on screen. Copies of their key that other students hold are not touched.

The type of the Remnant a thrown-away item leaves (Tamper or Prep) is filed by the GM's browser, not the player's. A handover's write goes through a GM client, which checks the room again.

A bedroom given to somebody else with `game.drpg.setVaultRoom` takes the old owner's keys and their copies as Room setup does. An owner can hold more than one key to their own bedroom from before 1.2.88, or from two GMs giving it at once; the key check at the primary GM's load and at Room setup's Apply repairs both cases.

Since 1.2.112 a Search never reaches into a stash, and the owner finds out on return: a reach that took something while its owner stood elsewhere marks the stash in the GMs' ledger. Since 1.2.113 the owner is told however they come to stand in the room. `game.drpg.inspectVaults()` shows you every stash's contents.

A Frisk ask's answer is received as the other asks' answers are. When the answer leaves the ask open (a refusal, or no answer, with forcing on), the GMs wait for the searcher's browser to confirm it has the answer; when no confirmation comes in the usual time, the ask ends as the searcher's **Leave it** would, and you are told. An answer that ends the ask needs no confirmation.

Whether a Take from a body needs a Shadow is the GM browser's reading of the room, not the taker's. A player's write of a use or a stash for a dead student is put back.

### 22.11 Projects and traps

Source files: `scripts/projects.mjs`, `projects-secrecy.mjs`, `projects-ui.mjs`, `projects-tray.mjs`, `traps.mjs`, `config.mjs PROJECT_SCALE`, `TRAP_TRIGGERS`, `TRAP_MODIFIERS`, `INDIRECT_MURDER`; the six kinds of 11.2 are `passages-gm.mjs PASSAGE_PRESETS`.

`game.drpg.setProjectMeta(countdownId, data)` patches a project's row from the console or a macro, GM only: the change is made on the primary GM in the one queue every other change of a project goes through, the secret fields still go to the GMs' store, and it answers the project's row as this browser reads it once the change has run.

A project stored with no statistic is one made before 1.2.66. Descriptions came in 1.2.99, so a project made before 1.2.99 has none until you open its edit window. Since 1.2.99 a project's token is at full opacity, and since 1.2.111 it wears the project's tray icon.

The primary GM's browser keeps the project tokens in step with their projects after every change of one; it also follows a token's move and puts back a missing one. A token whose project no longer exists is removed whenever the primary GM's map is drawn, and was removed once when the world first loaded 1.2.73, which told you how many went. A public project approved before 1.2.88 was told to its proposer once, at the primary GM's next load.

What a project of 11.2 does when its bar fills is done on the primary GM's browser, which judges the target again first. The proposal's card names the target as the builder's browser offered it: the room beyond by its place among the rooms beyond the walls, the passage, breach or item by its id. Since 1.2.113 the card to a student who found a secret project with Observe waits in the GMs' browsers until one of that player's characters is in the project's room.

A breached wall keeps its id; the hole and the copy are walls every browser holds. The bedroom owner's card about a forced door dates from privacy line 1 (13.11.2026).

The trap card's "roughly 4 to 5 actions" is murder-ui.mjs `indirectCostText`: per Work, the lowest band of `ACTIONS.project.thresholds` (+1) plus `INDIRECT_MURDER.concealIntent.aloneBonus` (+1), so ceil(4/2) + ceil(3/2) = 4 at the parts' smallest scales and ceil(6/2) + ceil(4/2) = 5 at their largest.

A fired trap disarms itself so that a trap in a busy room, the Main Hall say, does not send twenty cards a session. A trap alert's title, "A ruling to make", is the one line of the card every browser's copy carries. The planted item's poisoned identity lives in your browser's ledger, never on the item. A Search may still ask for the planted item up to 120 s after its Search Token is spent, and a plant handed out waits 120 s to be known as delivered (`TIMING.plantWindowMs`; the primary GM's answer to the ask itself is given 5 s, `TIMING.plantRequestMs`).

A project is a Daggerheart Countdown, and the Countdowns are a world setting every browser holds: each project's name, its progress, and the ownership that says who may see it; this version does not move the Countdowns. The module's own record of each project, also world data, says its room, whether it is secret, whether it is an indirect murder, its statistic and glyph, its token on the map, and whether it is sabotaged and being repaired. Since 1.2.64 the rest is the GMs' (section 14).

### 22.12 The Eclipse

Source files: `scripts/eclipse.mjs`, `ECLIPSE_MOVES` (the 2 crossings), `ECLIPSE_FREE_PLACEMENT` (the Night Eclipse's free placement). The take-back window of End without advancing is clock.mjs `TAKE_BACK_MS`, 5 minutes.

A parked Direct Murder whose card is lost is ruled from the console with `game.drpg.ruleOnParkedMurder(killerId, true)` (section 20.3).

Of the console, `startEclipse`, `endEclipse` and `advanceTimeOfDay` ask nobody, as Edit campaign and the rewind do, and a clock moved by any of them ends an open round. The round is the primary GM's to write.

A declaration's card is whispered to the GMs with a title that says nothing, since a card in the killer's thread would tell every browser who had declared something. Since 1.2.64 the declarations are the GMs' from the moment one is made to the lights. The crossings are counted by the GMs too: the primary GM's browser judges each against the allowance and posts its card, each player's browser holds only its own characters' count, and a crossing the primary GM's browser sees without being asked is counted as well.

### 22.13 The murder engine, end to end

The murder engine lives in `scripts/murder.mjs`, `incident-store.mjs`, `murder-rules.mjs`, `murder-ui.mjs`, `cleanup.mjs` and `chapter.mjs`, and reads `config.mjs` `MURDER_OPENING`, `INCIDENT`, `CRISIS_ACTIONS`, `CLEANUP` and `INDIRECT_MURDER`. The Key Remnant floor of 3 is `KEY_REMNANTS.minimum`; the drain is `INCIDENT.drain`; the opening roll is re-offered `TIMING.openingAttempts` times (`murder-rules.mjs` `throwOpeningRoll`) before the GMs get *{name} did not throw the opening roll* (`DRPG.Murder.openingDeclined`), and the tracker's re-ask waits `TIMING.reaskCooldownMs` on a client.

**The killer behind a "?"** (since 1.2.113). The mask is put on by the primary GM's browser before Stage 5 is written. One flag on each token says only that it is masked; what the killer looked like is kept in the GMs' records alone and put back exactly. Every copy of the cast but the killers' holds no killer, and another player's browser closes the killer's sheet. The microphone is held by the module's own block, which leaves a block a GM made alone and gives back exactly what it wrote. A token document keeps its actor, so a player who opens the browser's console can resolve the "?" to the killer. Run in the harness, not yet at a table (LIVE-E69-05).

**Who sees the opening and the dice.** A failed opening's notice goes to the GM whose browser scored it. In a direct murder the victim's browser holds nothing of the incident while the killer rolls. The participants' dice are shown to each other by the primary GM's browser.

**Stage 6 prices.** The killer's own Stage 6 charges `RESOLUTION_STRESS_COST` (1 Sanity) per attempt. The Tamper tile's price is `PRICE_CHAINS.tamper` with its Sanity step skipped (`cleanup.mjs` `tamperPriceSkip`). The warm scene is `CLEANUP.freshScene` (bonus 3, ending at the Investigation or the trial phase, only with a running incident or an unfound body of this chapter, its `onlyWith`); on a GM it counts only the unfound bodies one of the roller's players may know of, so the player's window and the GM's score read one number (`freshSceneBonus`, `unfoundBodyIn`). The floor of 8 is `CLEANUP.minDc`. Move the Body's reach is `CLEANUP.actions.moveBody.rooms` (a critical's 2, any other hit's 1), read by `cleanup.mjs` `applyMoveBody` through `bodyReach` and `bodyLanding`, with no room on either list a bedroom and none carried through one. The critical's refund on Misleading Trail and Move the Body is their `refundStress.critical` (1), handed back as the step that paid; the cover roll's is `CLEANUP.conceal.refundStress.critical` (1 Sanity, `concealFromWitnesses`).

**Reshape rulings and refusals.** An Assistant GM's ruling on a reshape is made on the primary GM's browser and recorded as theirs. A Stage 6 attempt the GMs' browser refuses gives back what it cost.

**What breaks.** Until the body is found, the module keeps a ledger of the Cleaning Tools each killer's clean-up attempts wore on the GMs' browsers.

**The betrayal offer** is held, of the players, only in the browser of the player it is offered to.

**Body discovery** (the ask since 1.2.113). The discovery runs on the primary GM's browser; a waiting discovery is kept over a reload and asked again when the primary GM's browser loads. The module records which bodies were found, which is why a body found this chapter is announced once.

**A death kept until the body is found** (since 1.2.64). The death is recorded in the GMs' store and no deceased flag is written; each knowing user's browser holds the deaths it may know of, and no other. Publishing writes the deceased flag with the kill's chapter, day and time of day. That the trial counts a killer only for a known death was measured by the suite's tier 2 in the headless harness, and the later-chapter case in the headless harness; neither has been tried at a table yet.

**The discovery sound for the one who walks in** (since 1.2.113). The primary GM sends the sound to that character's players alone, naming the sound and nothing else, and the GMs keep who has heard it over a reload. Not yet heard at a real table (LIVE-E113-01).

**The lone finder.** The finder's dead marker is drawn by the module on that one screen; the headless harness has no canvas, so it has not been seen at a table yet.

### 22.14 Investigation

The code: `scripts/remnants.mjs`, `investigation.mjs`, `truth-bullets.mjs`, `observe.mjs`, `analyze.mjs`, with the case map in `case-map.mjs`, `case-schema.mjs` and `case-realize.mjs`; the numbers are `config.mjs` `REMNANT_TYPES`, `KEY_REMNANTS`, `OBSERVE_DC` and `ANALYZE_DC`. The Key Remnant counts of section 14.4 are `KEY_REMNANTS` (`prepared` 5, `minimum` 3, `scale`, `suspectRange` 2 to 4), and the opening roll's counts are `MURDER_OPENING.killer.keyRemnants` (5 with Hope, 4 with Despair, 3 on a critical). The Observe table is `OBSERVE_DC` (Neutral and Final read through `OBSERVE_TYPE_ALIAS`), the secret project's 18 is `PROJECT_OBSERVE.dc` (Hidden on the Prep column), and the miss's 1 Sanity is `OBSERVE_FAIL_STRESS`. The Analyze table is `ANALYZE_DC` (an Autopsy handed out as Neutral reads the Key column through `ANALYZE_TYPE_ALIAS`); the hint's 14 and 18 are `ACTIONS.analyze.hintThresholds`, Find Stash's 16 `stashThreshold` and Find Passage's 16 `passageThreshold`; the trial's price is `PRICE_CHAINS.analyze`, and the rows shut in a Class Trial are action-analyze.mjs `ANALYZE_TRIAL_FILTER`.

How Remnants are drawn. A running incident's own Remnants are made un-hidden so that its players' screens can draw them for them alone; when the incident closes, the module hides again those nobody has copied. Since 1.2.64 the name and picture a GM gives a Remnant are never written on the token, which every browser holds: the screens that may know more draw it on their own copy of the map, the GM's from the case and a finder's from their own Truth Bullet, and the module draws these on each screen. The headless harness has no canvas, so this drawing has not yet been seen at a table. A world updated to 1.2.64 hid, once, at its first load, the Remnants of the incidents closed before it that nobody had copied; an incident still running then kept its own.

The three tie states (since 1.2.71). Until 1.2.71 Not tied and undecided were one value, so a world updated to it reads each old Not tied once as undecided, and so it reads a pre-1.2.63 token's Not tied and one that a Reroll of an older clean-up gives back. Mark your red herrings again in such a world.

The Investigation window's layout: each list in it is a table no wider than the window, in both themes; a long column head of Who has what takes two lines; the footer is always in two rows, and the window keeps one size whatever it shows. **Delete** on a Remnants row exists since 1.2.99, and the Map since 1.2.107. The Map's tools row writes at once to the GMs' case, never through Save. The GM panel lists no planned Remnants since 1.2.113: a planned Remnant is placed from its node on the Map.

Observe and Analyze are scored on a GM's client, since the difficulty is what the roll buys: the describe window opens on that GM's browser. The Observe declarations waiting for their roll stay on the primary GM's browser alone. A planned Autopsy is sent from the primary GM's browser when the body's discovery is announced, and the question whether to open the realization's preview is asked there too.

The GMs' browsers exchange their copies of the case field by field when one of them joins: the newer decision wins, a deletion included.

What the GMs' browsers hold, and since when. Since 1.2.63: every Truth Bullet's answer key; every Remnant's real type and reading; who the Mastermind is and where the lair is; the running incident's cast, and the Blackened of each chapter; which planted object is which trap's, and what waits in which room; the Level Ups on offer; which rooms each character has found. Since 1.2.64 also: who builds each trap, its condition and its trigger, and who sabotaged a project (section 11); the Direct Murders declared in the dark, and who has crossed how often in the Eclipse (section 12); the Key Remnant plan, chapter by chapter; the players' pre-session notes (section 19); how an incident happened (a trap, a death by the victim's own hand, how it ended); the deaths nobody has found yet (section 13.4); the Reinforced Level Ups waiting for the class (section 15); the Overflow's count, and the Despair each pool owes for its conversions to Hope (section 7); what has been taken off each body, and its Remnant (section 10); and which Remnant each Truth Bullet came from. Since 1.2.65 also: a Confusion armed on a character and not rolled yet (section 8). Since 1.2.66 also: how a running incident's fight stands (the round, whose side acts, what is hindered, blocked or spent; section 13.2), while the world holds only that an incident runs, and at which stage; the statistic picked for its opening; the free clean-up attempt a critical Finishing Blow earned (its killers' browsers hold it too, so the striker's is quoted free); the last three turns the tracker lists; who walked into the fight and out of it; a betrayal declared in an Eclipse; and which Cleaning Tools the killers' clean-up attempts wore, until the body is found (section 13.3). Since 1.2.111 also: a secret project's name and who is in on it (section 11). The restore window names each store it holds, by the names of `DRPG.Case.store`.

What a player's browser holds: whether they are the Mastermind, and where the lair is when they are; in an incident they are part of, its cast, which includes how it happened: every name in it but a trap's builder on the victim's side; the betrayal offer only on the browser of the third it is offered to, who keeps it, and nothing of a later incident that is not theirs, for the rest of the day; never the record a Reroll of a crisis action takes it back from, which only a GM reads; the Level Ups offered to their own characters; and the rooms their own characters have found. Since 1.2.64 also how often their own characters have crossed in a running Eclipse, their own pre-session note, the deaths they know of, and which Remnant each of their own Truth Bullets came from. Since 1.2.65 also a Confusion armed on their own character. Since 1.2.66 an incident's cast includes its fight (the round, whose side acts, what is hindered, blocked or spent) for those who fought it; never the Key Remnant count, the opening's statistic, the free clean-up attempt (but for its killers), the last turns or who walked into the fight and out of it, which stay the GMs', and not for a trap's builder, who is let back in at Stage 6 without it. A Reroll's bookmark (the last roll and what it did) stays on the browser that rolled it, with nobody else's copy and no backup.

The health check runs when the primary GM's browser opens the world. It counts, since 1.2.64, an indirect murder whose killer, condition and trigger this browser does not hold. The update to 1.2.64 leaves a Faint Prep promotion a later correction stood against, and flags with no ledger row to carry them into, on the token for a GM to decide, and says so on screen when it does. From the console, `game.drpg.gmStoreStatus()` and `game.drpg.gmStoreHealth()` report on the case; `game.drpg.backupCase()` and `game.drpg.restoreCase()` are **Back up** and **Restore from a file** (`exportLedger()` and `importLedger()` are their old names, kept as aliases).

### 22.15 The Class Trial

The trial's code: `scripts/trial-floor.mjs`, `trial-floor-ui.mjs`, `trial.mjs`, `vote.mjs`, `trial-progress.mjs`, `verdict.mjs`, `level-up.mjs`; its numbers are `config.mjs TRIAL`. The console's *Trial time* counts the minutes on the server's clock, and so does the debate's clock, so a player whose computer clock is off reads the seconds you read.

The console's layout: it opens 1280 pixels wide (less on a narrower screen) and as tall as the screen, 8 pixels from its top. It was measured in a browser at 1366x768 and 1920x1080 in both themes, not yet in Foundry at a table - a live check.

The dead's microphones: the primary GM's browser makes the trial's list of the dead and sets the blocks. `game.drpg.setClock` moving the phase into the trial asks nothing, not even the second-trial question.

The debate: a budget under 30 seconds handed to `game.drpg` also runs 30 and is remembered as 30. `game.drpg.objectionLog()` lists everything presented this chapter, grouped by the debate question, and lists an overruled Objection as overruled by the GM. An Objection's target is the speaker the primary GM's browser's voice room hears, whatever the player's own voice room is doing; with no voice room on that browser the player names the target. A forged Objection is refused as well: an Objection posted in a dead student's name is refused on the primary GM's browser and its player told.

The GM's bar: **Skip** runs on the primary GM's browser whichever GM presses it, so a press while the clock is moving the floor on does not move it a second time, and a press that reaches it after the floor has moved on moves nothing and tells you so; every other button of the bar runs there too, another GM's console asking the primary for it. Each button is a `game.drpg` function as well - `skipStep()`, `adjustTime(seconds)`, `overruleObjection()`, `endMode()`, `returnToDebate()` - and the older `advanceFloorNow()`, `extendFloor()` and `endFloor()` stay.

The vote: the ballots go to the primary GM, who checks each one before recording it, and they are kept by the GMs' browsers alone (section 14) until the next vote is opened. **Close and count** runs on the primary GM's browser, whichever GM presses it.

The verdict is written into the world's trial record before anything else, then done step by step. The console calls that end the trial and carry out its sentence are `game.drpg.setPhase` and `game.drpg.setClock`. Since 1.2.64 the Blackened's Reinforced Level Up after a wrong vote waits in the GMs' store. A Final Trial's sentence waits in the GMs' store, not in the world.

Finish the verdict: since 1.2.97 the row being given is kept in the GMs' store before its Level Up is written, so a GM who leaves between a row's Level Up and the write that records it no longer leaves that row to be given again: Finish the verdict reads the row as given once its offers grew (measured headless, not at a table) or its advances did (the row the GM picks, read in the code). One gap is left open, read in the code and not measured: in the moment the verdict's GM disconnects, the GM who becomes its runner can press Finish the verdict before the first one's last write has landed.

The Level Ups: the three options are `LEVEL_UP_OPTIONS`, the rises a statistic's point brings are `LEVEL_UP_TRAIT_RESOURCES`. The primary GM's browser checks a player's pick against the offer and against the sheet as the GMs hold it, and writes it once. Every GM's browser holds the offers, which is why they survive a change of primary GM. Until this rule a Level Up also offered +1 Health and +1 Sanity; those are no longer options. A player's Level Up picked while a take-back of that offer is being written is refused as busy, and a second take-back of the same character in that time is refused in its own words on the primary GM's browser and on the browser of the GM who asked for the first (that one read in the code), and as busy on any other GM's.

Level Ups taken under the older rule: once per world, when the primary GM loads the world, a window lists students whose Health or Sanity max is above the start (4 and 6) - each point above counts as an old +1 pick - and their Head, Body or Leg points from this season that raised nothing. Tick each change to make: a pick taken back gives the student a statistic point to place, a past point gets its rise, and anything unticked stays. A maximum you raised by hand looks like an old pick, so check the list; **Cancel** asks again next time. A student no player owns gets no offer: give the points with your own Level Up.

Ending the trial: the copy of a token the module brings into the room keeps the old token's flags, its hidden state and its place in a combat. Of the living students left with a token in the room and another elsewhere, the ones whose every token in the room is hidden while one elsewhere is shown are named on a line of their own, since the shown one is the one their player sees. A copy of a token carries a mark naming the token it was made from until that token is gone; that mark is how a return cut short between the two, by the GM's browser closing, is found at the next GM's load.

The rounds: a turn whose time has run out is ended by the participants' browsers too, which is why a round goes on while the GM's tab is in the background. `game.drpg.startTestimony({ seconds, order })` and `game.drpg.startPanicRound({ seconds, order })` start them from the console.

The Closing Argument: `game.drpg.startClosing()`, `confirmClosingSpeaker()`, `pickClosingSpeaker(actorId)`, `continueClosing(actorId)` and `resumeClosing()` do the same as the console on any GM. Who volunteered and whom the draw named are kept by the GMs' browsers, never in world data.

Present: the card and the copies are made on the primary GM's browser, which is why Present is refused with no GM connected.

Monokuma's Reveal: *Left to reveal* is the fee's own count, written when it was charged and never counted again. `game.drpg.missingKeys()` and `game.drpg.revealMissingKey(slot, { text, beyondPaid })` do the same from the console, on any GM.

The Final Trial verdict: `game.drpg.verdictDialog()` and `game.drpg.applyVerdict()` open that window too, so no road gives a Final Trial the ordinary verdict. It stops and is finished as the ordinary verdict does (since 1.2.97).

#### The trial hall (section 15.1)

The hall's code: `scripts/trial-scene.mjs`. The console calls that set the phase, and so take the table into or out of the hall, are `game.drpg.setPhase` and `game.drpg.setClock`. The hall's cast is kept by the GMs' browsers. Before 1.2.74 every trial opened wherever the table was. That the executed die in the hall before the table leaves it is read in the code; LIVE-E70-06 tries it at a table. A player's browser still loading when the hall is activated moves itself there once, when its map is first drawn, and one still loading when the table leaves the hall moves itself to the scene the table went to.

From the browser's console, `game.drpg.showCourtroom()` and `game.drpg.showSchool()` are the same two doors as **Show the hall** and **Back to school**, `game.drpg.trialSceneReport()` answers the linked scenes, the cast's tokens shown in the hall now, the tokens the module made there and the tab's warnings, and `game.drpg.openTrialCast()` opens the tab.

Not yet tried at a table: whether Foundry v14 lets a player change whether their own token is hidden, where a browser that was loading during the activation lands, how the hall draws with Isometric Perspective, whether Foundry v14 makes a token from a character's prototype as the module asks, and what making and deleting the cast's tokens costs at a table - live checks.

#### The hall's zones (section 15.2)

`game.drpg.startStrawPoll`, `startLogicDive`, `startScrumDebate`, `countNow`, `skipQuestion`, `findings`, `addFinding`, `editFinding`, `deleteFinding` and `confirmFinding` do the same as the console's buttons.

Not yet tried at a table: regions with holes and Levels in v14, a move just before the count on a real server, the zones drawn on the canvas, and a GM reload during a question (LIVE-E73-01 to LIVE-E73-04).

#### The entry and the verdict's cut-in (section 15.3)

The sequences' code: `scripts/sequence.mjs`, `glass.mjs`, `glass-close.mjs`. A late screen plays the newest sequence it missed since 1.2.112 (the owner's choice).

Not yet tried at a table: the entry's motion and cost on a real Foundry at 1366x768 and 1920x1080 in both themes, as GM and as player (measured in headless Chromium on the glass harness: LIVE-E61-01), and the microphone's keybinding while a sequence covers the voice tile (LIVE-E61-08).

### 22.16 End of chapter and season reset

**The end of the chapter.** Only the primary GM's browser ends a chapter so that one browser counts the chapter once. An end that stops is kept with what it did since 1.2.97. The stopped end and its Finish and Drop the rest are measured in the headless harness, not yet tried at a table. From the console: `game.drpg.finishChapterEnd()`, or `game.drpg.finishChapterEnd({ drop: true })` to drop the rest.

**The reset's record of how far it got** is kept since 1.2.97. The record of an unfinished reset is measured in the headless harness for a group that failed; the other two cases (another GM who became the primary, the GM's tab closed half way) are read in the code. The record not being offered once the clock moved on is measured in the headless harness for one time of day on.

**Season stamps.** The records a chapter stamps (the Remnants, the motive, the Final Truth, the autopsy, a Monocub's silence about the crime) carry the season. An autopsy or a silence recorded before 1.2.73 carries no season and counts as this chapter's until the chapter ends (measured by the suite's tier 2). That the trial's progress and its vote, a betrayal on offer and a Truth Bullet locked by a failed Analyze are read by their chapter alone is read in the code.

**An older starting sheet.** A starting sheet kept before 1.2.73 cannot tell a Level Up's experience from yours, so *Advancement* treats it this way: one that recorded experiences takes every experience it did not record, the ones you added by hand included, and one that recorded none leaves them all. The report names them.

**The reset and the GMs' browsers.** The reset writes on the clock when it happened, for each group it cleared; a GM's browser that was away compares that with its copy of the case the first time it loads, and drops what those groups held. Another GM becomes the primary by connecting with a lower user id than the GM who opened the window. A GM who connects once the reset has begun stopping it is measured in the headless harness, not yet tried at a table.

### 22.17 Sound and SFX

The code is `scripts/music.mjs`, `music-states.mjs`, `music-play.mjs`, `murder-music.mjs`, `sfx.mjs`, `sfx-play.mjs` and `sound*.mjs`, with `config.mjs`'s `SFX_CATEGORIES`, `SFX_EVENTS`, `SFX_SLIDERS` and `SITUATIONAL_PLAYLIST`.

**The murder row.** A player's browser pauses the room's music and picks it up where it stopped; a GM's browser turns it down and lets it run, rather than pausing it, because a GM's browser moves the table's playlists on. A browser nobody has clicked in since it loaded starts the murder's track at the first click, and not at all once the incident is over.

**Saving.** Every change saves as you make it since 1.2.94. The primary GM's music follows about two seconds after the last change, and several changes in a row are followed once; that is measured on the test harness with a second GM, and two real GMs are not. A GM who takes a row out, or puts back the playlist it had, within about four seconds of another GM changing that row sees the other GM's choice come back once, and the next change of it stands: the other browser cannot tell a row taken out from two saves in the same moment. With the window open on two GMs' screens, the other GM's selects show the old choice until that window is opened again. A state mapped to the "Situational" playlist before 1.2.94 is unmapped by the primary GM's browser when the world loads, without a warning.

**The sliders.** Since 1.2.94 the *Music* slider is drawn on Foundry's own scale for the playlist volume (`AudioHelper`'s, read in its types, not yet compared at a v14 table). **Vary the sounds you hear often** applies `SFX_VARIATION`: a rate up to 14% faster or slower, never under 0.5, and small gain changes (0.18).

**History.** The sequences' sounds arrived in 1.2.109; **The vote's result** was called *The verdict* until then. Since 1.2.105 a critical action result's notice is the only card that enters on a cut.

**Diagnosis.** `game.drpg.diagnoseSfx()` counts what was dropped and lists what is mapped, muted or has already failed; `game.drpg.testSfx(key)` says why a sound did not play; `game.drpg.diagnoseMusic()` prints every state, whether it applies and what it is mapped to.

### 22.18 The settings window, themes and the Language setting

The gear's window is `scripts/settings-window.mjs`; Foundry's rails are `scripts/foundry-windows.mjs`; the book is `scripts/handbooks.mjs`, rendered from `docs/handbooks`; the notices are `scripts/popup.mjs` and the Notice history `scripts/notice-history.mjs`. On a narrow screen a GM's player list is Foundry's `#players`.

**Foundry tools and the glass.** Opening and closing Foundry tools and Map tools never recuts the glass, and neither does Foundry's caret at the foot of the sidebar's rail.

**Where the hour's color stands.** Under Stained Glass it is on the panes and their seams, the curtain and the pause screen; the clock's lines (not its buttons); the room and voice tiles' frames; the corner's buttons and Foundry's own rails; the windows' headers, frames and scrollbars and the tooltip's edge; the tables' heads and a hovered row; the Projects tray's title, frame and tools; a field's or a checkbox's edge at rest; the notices' edge and the messenger's frame; the GM panel's Next line and phase stamp; the sheet's headings and its action marks; and on the map, the room outline, the doorway's light, the passage marks and a token's ruler. It is never on the Event panel's cards, the action and Call tiles, the buttons and tabs of the panels and the sheet, the state bars, a focused field or checkbox, the clock's buttons or the GM panel's section bars.

**The Notice history and a full storage.** When another of the module's stores finds this browser's storage full, the history gives way: other worlds' histories go, then the older half of this one, and for the rest of the session it keeps half as many.

**Not yet confirmed at a table.** What every key does for a player on a real canvas: LIVE-E77-11. The two windows never recutting the glass, measured in a browser with a stand-in sidebar: LIVE-E77-02. The sidebar's caret not recutting it either (since 1.2.79), measured the same way: LIVE-E79-15. Shift+C opening Foundry tools first, read from Foundry 14's code by the design, not measured beside other modules: LIVE-E77-10. Foundry's chat notifications when Foundry tools closes: LIVE-E77-06. The world switch's way back to Foundry's layout: LIVE-E77-17. Whether Foundry v14 still loads the module's stylesheet when the module refused to start: LIVE-E13-11. How smooth the glass's turn is at a table, with the board drawn under it: LIVE-E23-01. Foundry's notices under the Despair rail, measured in a browser on a stand-in: LIVE-E23-08. A waited-on window staying over a sheet, read on the harness's model of Foundry's windows: LIVE-E23-04. A GM's expanded chat folding back: LIVE-E23-06. The narrow screen, measured on the harness's page: LIVE-E23-03, LIVE-E23-07. The Projects tray's scrolling list with the real icons: LIVE-E23-12.

**History.** The glass and the windows, and the narrow screen, are as described since 1.2.101; the seams flash as brightly as before. Hours and Colors are since 1.2.105, and R3412 holds both lists of where the hour's color is and is not. Folding a window works since 1.2.99; until then the module blocked it on all of them. The Projects tray's list scrolls with more than five rows since 1.2.101, and a player's tray shows a project as last seen since 1.2.113. Since 1.2.99 the theme decides whether the notice cards stand over the windows.

**Measuring the theme.** `game.drpg.perf()` says what **Glass blurs the map** costs on that machine, and `game.drpg.fps()` what each of the theme's effects costs beside it (section 20).

### 22.19 The safeword

The code is `scripts/safeword.mjs`. `game.drpg.safeword()` presses it from the console, through the same *Stop the scene?* window. The wait for a GM's browser to answer a player's press is `TIMING.safewordAnswerMs` (3 seconds). A player's second press within `TIMING.safewordRepeatMs` (60 seconds) of the card is logged and not posted again, and a GM's note from the same sender inside that minute is shown but not kept in the Notice history again. Since 1.2.64 a pre-session note's words are the GMs' and its writer's alone.

**On a shared computer** the Notice history of every account of this world is in one value of the browser's storage, and another account's history is never cut to make room: when this world's histories fill the browser's share, only the history of the account logged in now gives way.

### 22.20 Troubleshooting

**The contract's register** is `scripts/patches.mjs`, and `diagnosePatches()` lists it. The Debug log's **Foundry and modules** has shown the contract's lines since E101; until then they were part of Pre-season checks, which since E101 are the further checks under the Season checklist's rows.

What the table gets instead, by row. A setting or flag the module holds has a row named `held-` and its id, with the sentence of its kind (`held-flag`, `held-permissions`, `held-rtc` or `held-setting`); `held-automation` and `held-dice-look` name their own:

| Row | What the table gets instead |
|---|---|
| `critical-rule` | a critical keeps Daggerheart's own numbers |
| `roll-dialog-context` | what a Call forces is filled into the roll window once it is open, as before |
| `roll-draw` | rolls are thrown in the player's own browser, as in 1.2.66 |
| `roll-marks-move-context` | the module's marks on a roll are lost: an action's roll reads as a statistic from the sheet, and the Loaded Die is not loaded |
| `roll-outcome-evaluated` | an action's roll has no total where the module reads it, so the action is not carried out |
| `dice-random-uniform` | nothing stands in for Foundry's randomiser |
| `no-scrolling-text` | captions float over tokens as Foundry draws them |
| `window-close` | windows close without the module's exit or its sound |
| `window-await-transition` | a window with no transition running waits out Foundry's own delay before it closes |
| `livekit-toasts` | avclient-livekit's own notices show beside the module's |
| `iso-refresh-state` | Isometric Perspective's own override runs while a token is edited |
| `chat-notify` | a veiled card may light up the Chat tab on every screen |
| `chat-content-visible` | the player who rolled cannot read a roll the GM drew |
| `sheet-render-guard` | a character sheet redraws on every resource change, as Foundry draws it |
| `passages-move` | no token can pass a secret passage in this browser, and the GM is told at every load |
| `selection-drag-rectangle` | the drag rectangle stays Foundry's orange |
| `selection-controlled-colour` | token borders stay Foundry's orange |
| `countdown-row-menu` | a project row's menu is Daggerheart's: Reveal and Hide are shown, and Delete removes only the countdown |
| `countdown-update` | Daggerheart's own tick of the countdowns runs outside the projects' queue, and a project's change made in the same moment can be lost |
| `door-controls` | every door control is shown as Foundry shows it |
| `token-ruler` | a token's ruler keeps the colour that Foundry or another module gives it |
| `actions-resource` | a character has no Actions resource |
| `sidebar-calls` | Foundry's own calls neither show nor place the Foundry tools window |
| `relay-guard` | requests from a player's Daggerheart that the module has not reviewed are refused on the GM's browser, and the GMs are told once per version; where the guard cannot stand at all, the relay is not guarded and the GMs are told at every load |
| `region-included-in-level` | a region that names no floor counts as being on every floor; one that answers with an error about its floor is read by the floors it names |
| `hook-duality-configured` | a Free Critical's die is not loaded |
| `hook-roll-dialog-render` | the opening's roll window is not marked as the opening's |
| `hook-character-sheet-render` | the character sheet is drawn as Daggerheart draws it |
| `hook-character-sheet-close` | a closed sheet's observer keeps watching a detached element until the page is reloaded |
| `hook-countdowns-render` | the countdown tray is drawn as Daggerheart draws it, and the HUD is not redrawn with it |
| `hook-dice-so-nice-ready` | the dice looks are not swept |
| `hook-dice-so-nice-message` | Dice So Nice throws such a roll on every screen, in the GM's colours |
| `hook-dice-so-nice-roll-start` | every Hope and Despair die is drawn in the look its thrower's Daggerheart gave it, and the dice look's report names no throw seen on this browser |
| `hook-livekit-initialized` | the voice rooms, the voice tile and the trial's speakers do not follow the voice client |
| `hook-image-popout-header` | a room picture's window shows Foundry's share control and any a module adds |
| `token-bars-reserve` | a student's token bars fill up as they are hurt, as Daggerheart draws them, and another player sees their Sanity bar |
| `state-icons-off-token` | Breakdown's and Wounded's icons show on every token, to everybody |
| `dead-icon-own` | the dead overlay is Daggerheart's tombstone |
| `hook-party-sheet-render` | the Party sheet counts what each member has lost, as Daggerheart draws it, and shows every member's Sanity to every player |
| `user-permission-broadcast-audio` | nobody's microphone is blocked: the GM's button says why, and so does the trial |
| `rtc-client-keys` | a key Foundry no longer keeps reads as its default (not muted, full volume, shown), and writing to it changes nothing |
| `push-to-talk-key` | the push-to-talk line names no key |
| `av-config-menu` | the held fields are not greyed out in the window; their values are held all the same |
| `chat-delete-options` | a history entry may stay after its card is withdrawn, or go on Clear chat |
| `notifications-lifetime` | the history keeps its own timing, whatever Foundry's toasts do |
| `tooltip-clean-html` | a tooltip's words in the history may differ from what Foundry's tooltip showed |
| `client-setting-sync-write` | the last notices before a reload may be missing from the history |
| `livekit-room-events` | the voice tile and the trial's speakers show nobody speaking and follow no one joining or leaving |
| `livekit-participant-user` | a participant the call cannot name is left out of the voice tile and the trial's speakers |
| `livekit-attach-audio` | a speaker muted here may be heard again after LiveKit attaches their audio anew |
| `voice-modes` | a mode the tile does not know is shown as an open microphone |
| `livekit-connected-users` | the room's state is read from the call's room alone |
| `scene-controls-activate` | the layer stays as it was |
| `chat-notifications` | with the window closed, chat notifications may not show and the chat's input may stay hidden |
| `escape-dismiss-order` | Escape may close the windows before Foundry's own steps, or never |
| `focus-chat` | the chat key may focus an input in a hidden window |
| `image-popout-options` | the picture window may show Foundry's title and controls |
| `sheet-anchors` | what the module adds at a place it cannot find is not drawn there, and the rest of the sheet is drawn as usual |
| `foundry-rails` | a rail not found by its id stays where Foundry puts it, outside the module's window |
| `interface-theme` | the windows wear no theme class, and the rails inside take the page's |
| `camera-popout-id` | a popped-out camera's speaker is not found, and counts as not audible |
| `mic-audio-anchor` | a speaker whose element is not found counts as not audible |
| `held-flag` | the account's flag is left as it stands for the system to read |
| `held-permissions` | the permissions stay as the world has them |
| `held-rtc` | the dock is not held: each browser keeps its own dock and popouts |
| `held-setting` | the setting is not held: it stays as each browser has it |
| `held-automation` | nothing is switched off: Daggerheart's Vulnerable and Defeated automations run beside the module's |
| `held-dice-look` | no look is held: each player's dice keep their own look |

**Versions of the calls.** `perf()` has also shown what a roll your browser drew cost on its way since 1.2.69, and the step "asked to dice started" since 1.2.82. `fps()` and `counters()` are there since 1.2.89. `sheetWrites()` has shown the `refused`, `forged` and `rewrite` rows and a relay gain covered by the player's own roll since 1.2.69. `publicRoll(formula, { flavor })` is there since 1.2.69, and the GM panel's tile for it was removed in 1.2.98 (read in the code).

**Whose roll it was.** Since 1.2.65 a roll the module throws names nobody on its document (section 1), and the primary GM's browser learns whose it was from the roller's browser. What counts when that word is lost to a reload is in section 20.3.

**The macro API's history.** A name that is no actor's id and no actor's name once did nothing; it now warns. A name two actors share acted on the first before the warning, and still does. `migrate1_2_0` is kept until at least 1.3.1.

**fps() and the light drawn once.** Since 1.2.89 the light of the rings and of the room outline is drawn once and worn as a picture, which is what *Seams' light drawn once* counts. **Glass blurs the map** comes first in the order of what to turn off because, on a browser drawing without its graphics card, it was most of the frame in the module's own measurement.

**What 1.2.91 changed.** The reading of a token dragged across rooms dates from 1.2.91. A move of the player's own token within the rooms they already stand in now asks again for fewer tokens' verdicts on the mover's browser, and so does a `sightRefresh` during a move, on every browser. That was counted in the module's tests on a model of a drag; it was not measured at a table, and the lag is not known to be gone. 1.2.91 also changed the shared cut of the buttons in Stained Glass (the GM panel's tiles, the footer buttons) so that it no longer covers the border; that was read in software Chromium only, and the flickering edges are not known to be gone.

### 22.21 Session checklist

**What only the GMs' browsers hold.** The answer keys, the Remnants and the Mastermind live only in GM browsers, and since 1.2.64 so do the traps' builders and triggers, the Key Remnant plan, the notes and the deaths nobody has found. That is why the case's backup file belongs where no player can open it.
