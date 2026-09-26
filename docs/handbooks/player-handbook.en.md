# Danganronpa RPG - Player Handbook

*For students of the killing game. Module version 1.2.63, built on Daggerheart for Foundry VTT v14.*

This is the whole game from your chair: what the numbers on your sheet mean, what an action costs, what Hope buys, what happens when somebody dies, and what to press. Every number in here is the module's own; where a decision belongs to a human, it says "the GM decides".

> [!NOTE]
> The game's proper names stay in English on every table and in every language: Hope, Despair, Sanity, Truth Bullet, Remnant, Blackened, Class Trial, Daily Life, Eclipse, Mastermind, Monokuma, Monocub, the Calls, the actions, Ultimate, Key Remnant, Vault, Stash.

---

## 1. Who you are

You are an **Ultimate** - the one thing this character does best, written under their name on the sheet. The title is the character. Your Ultimate is also a Hope Call (see chapter 5): when it genuinely applies to something you are attempting, it buys advantage.

### Statistics

Daggerheart's six traits are renamed. Your sheet shows these:

| Statistic | Short | What it is | Used for |
|---|---|---|---|
| **Leg** | LEG | Physical speed | Projects, running, crisis actions |
| **Body** | BOD | Physical strength | Projects, fighting, moving heavy things |
| **Hand** | HAN | Dexterity and precise action | Search, Palm, Projects, crisis actions |
| **Eye** | EYE | Perceptiveness and noticing things | Search, Observe, sensing a trap |
| **Shadow** | SHA | Hiding and the sixth sense | Listen, Tamper, staying unseen, covering traces |
| **Head** | HEA | Connecting facts | Analyze, Projects, sensing a trap |

At character creation the spread is **+2, +1, +1, 0, 0, -1**, placed where you like.

### Starting resources

| Resource | Start | Maximum |
|---|---|---|
| Health | 4 | 4 (grows with Level Ups) |
| Sanity | 6 | 6 (grows with Level Ups) |
| Hope | 2 | 6 |
| Actions per time of day | 2 | - |
| Free Move per time of day | 1 | - |
| Experiences | 2, at +2 each | - |
| Starting item | one Tier 2 item tied to your Ultimate, agreed with the GM | - |

### Two states you do not want

| State | When | Effect |
|---|---|---|
| **Breakdown** | every point of Sanity is marked | disadvantage on every roll until some Sanity comes back |
| **Wounded** | every point of Health is marked | one action fewer per time of day until somebody patches you up |

> [!NOTE]
> Both apply on their own the moment the track fills; Daggerheart's own Vulnerable and Death Move are switched off. Nothing in this module kills you for reaching zero Health. Dying is something a person does to you, and it is announced.

### Rolling

Every action is a Daggerheart duality roll: a Hope die and a Despair die (both d12) plus your statistic. The higher die decides the flavour, a matched pair is a **critical**.

- A roll **with Hope** earns you 1 Hope.
- A roll **with Despair** feeds the Despair pool of the Monokuma who watches you. That is where Monokuma's money comes from - your bad luck and your risks.
- A **critical** earns 2 Hope and nothing else (it does not clear Sanity here, unlike plain Daggerheart).

The roll window is locked for players: dice, statistic, advantage, experiences and bonuses come from the action, from a Call you paid for, from where you are standing, or from the GM. What you can touch is what the action lets you choose.

---

## 2. Time

### A day, a session, a chapter

One session is one in-fiction day, and a day is five **times of day**: **Morning, Noon, Afternoon, Evening, Night**. Every time of day refills your two actions, your Free Move and each room's search tokens. When Night ends, the day turns over.

A canonical chapter is five sessions: three of **Daily Life** (the third usually carries the murder), one of **Investigation**, one of **Class Trial**. The GM may stretch a chapter when no murder has happened yet. A season is six chapters; a modular season runs a single one.

The three phases:

| Phase | What it is |
|---|---|
| **Daily Life** | You live inside a closed area. Two actions per time of day. Nobody has died yet this chapter - this is the part where you decide who you trust. |
| **Investigation** | A body was found. Observe and Analyze to build Truth Bullets. What you fail to find, you will not have. |
| **Class Trial** | Everyone is in the room and one of you did it. Testimony, Objections, and finally the vote. |

### The Eclipse

Before each time of day the lights go out. That placement window is the **Eclipse**:

- Nobody sees anybody else's token, in any room. Every player is in a voice channel of their own.
- You place your token: up to **2 connected room crossings**, doors and gaps still apply. The **Night Eclipse** is the exception - pick **any room on the map**.
- Your actions are already refilled when the Eclipse opens, but nothing spends them except a **Direct Murder**. No Calls until the lights come up.
- A summary card of what you did during the previous time of day opens for you - what you found, what you left behind.
- The Eclipse is the game's one moment of total cover, and it is where a murder usually starts. It is not part of the day: the clock does not move until the GM ends it.

A darkened time of day (see the overflow, chapter 6) can pull the crossings down or take the free placement away.

---

## 3. Moving and seeing

### Rooms

The school is drawn as rooms. Everything - movement, Search, Listen, who can hear you, every incident - is answered in terms of the room your token stands in.

| Move | Cost |
|---|---|
| Moving inside your own room | free, always |
| First crossing into a connected room this time of day | your **Free Move** |
| Every further crossing | **1 action** each |
| A crossing bought with the Sprint Hope Call | free |

Drag your token; the cost is applied when you arrive. A crossing that you cannot pay for is refused and the token goes back.

You are turned back by:

| Cause | Details |
|---|---|
| a room that is **not connected** to yours | the refusal names only the neighbouring rooms you have already been in |
| a **locked door** | the GM locked the room |
| a **sealed room** | the Behind Closed Doors Despair Call, for one time of day |
| being **Chained** by a Despair Call | you cannot leave your room until the time of day ends |
| **somebody else's bedroom** | when you hold no key to it |
| being **dead** | the body stays where it fell |
| being in a **murder** while it runs | nobody walks out of an incident |
| a **Class Trial** in session | nobody leaves the courtroom |

### What you can see

- The room you are in is in full colour. Rooms you have already visited show through a veil. The rest of the school is fogged until you walk into it - a room is discovered by entering it, once, per character. During an Eclipse even the room you stand in is only veiled.
- You only see the people standing in your room. Nobody else is on the map for you.
- The clock in the left column can be clicked: it explains the phase, the time of day, where you are, and prints the room's description if the GM wrote one.
- Another player's sheet opens redacted: name, portrait, Ultimate, Health, Sanity, what they hold ready and how many Experiences they have. Nothing else.

### Voice

With regional voice on, every room is its own voice channel: you hear only whoever stands in the room with you, and your voice client follows your token the moment it crosses into another room. During an Eclipse every player is alone in a channel of their own. A Monokuma who walks into your room hears you like anyone else, and you see them.

> [!TIP]
> To find out who is next door without walking in, use **Listen** (chapter 4).

### Search tokens

Every room has a number of **search tokens** per time of day (the default is **3**; the GM sets it anywhere from **0 to 10**). Each Search spends one. A searched-out room is searched out for everybody until the clock moves. The HUD tells you how many are left where you stand.

---

## 4. Actions

You get **2 actions** per time of day (1 while Wounded). The action grid on your sheet has ten tiles.

Every action's briefing shows its cost, the statistics it rolls, the room you are in, the numbers it will be scored against (worked out for you as you stand), and anything that will cost you Sanity.

> [!NOTE]
> A tile with a GM mark on it hands the turn to a human: your roll and your request go into your messenger thread and you wait for a ruling.

### Search - Eye or Hand, 1 action

Loot the room for something you name. Spends one of the room's search tokens.

| Roll | Result |
|---|---|
| under 8 | nothing found |
| 8+ | a Tier 0 item - a random, seemingly useless object |
| 12+ | Tier 1 |
| 18+ | Tier 2 |
| critical | one tier higher than the roll says |

What you can ask for:

| You ask for | Meaning |
|---|---|
| *something to patch me up* | a Healing usable |
| *something to settle my nerves* | a Sanity Relief usable |
| *something that could kill* | a Murder Weapon |
| *something to clean with* | a Cleaning Tool |
| *something to work with* | a Tool |
| *something specific* | describe it and the GM rules on what was really there |

Some rooms are good places to look for a category and some are bad; the roll window tells you when where you stand changes your roll. If somebody else keeps a stash with something in it in this room, a successful Search takes from that stash instead - an open one first, a hidden one at a penalty.

> [!WARNING]
> Taking a Murder Weapon or a Cleaning Tool **leaves a Prep Remnant** in the room - a trace that you were here gathering tools. A Tool leaves nothing unless what turns up is also a weapon.

### Observe - Eye, 1 action

Look for evidence. A hit copies a Remnant into your inventory as a **Neutral Truth Bullet** and leaves the original in place for others. A miss costs you **1 Sanity**. A critical also identifies what kind of trace it is and earns you a substantial hint from the GM.

You choose how you are looking:

| Way of looking | What it targets |
|---|---|
| Sweep the room | whatever is easiest to spot in this room - settled by the dice |
| Look past the obvious | the hardest thing here - settled by the dice |
| Follow my traces | retrace your own steps and find what you left behind |
| Focus your gaze | say what you are looking for; the GM decides what your gaze lands on |
| Examine point of interest | something that is not a trace - a person, a machine, the weather; the GM rules |

You are told what you found, never the difficulty. Traces tied to the crime are always shown first. *Look past the obvious* can also turn up a secret project in the room (18+, or a critical); finding it lets you in on it.

### Analyze - Head, 1 action

Three things behind one tile:

- **Identify a Truth Bullet.** Turns a Neutral Truth Bullet into its real category. **A failure locks that bullet for you until the chapter ends** - hand a copy to somebody else and their copy is not bound by your failure.
- **Ask for a hint.** No evidence in hand? Ask the GM to point you somewhere. 14+ buys a subtle hint ("you are far from the target"), 18+ a direct one ("search the pool room"), a critical lets them ask you one question ("did the victim really die in this room?"). Below 14, no help.
- **Locate a hidden stash.** 16+ opens one hiding place in this room to you. The GM is told; the owner is not.

### Projects - Hand, Body, Leg or Head, 1 action

The slow game: many actions over many times of day, and the one thing that can change how this ends.

| Roll | Progress |
|---|---|
| under 12 | none |
| 12+ | +1 |
| 18+ | +2 |
| critical | +2, and the action is returned |

| Scale | Progress needed |
|---|---|
| Trivial | 3 |
| Standard | 4 |
| Complex | 6 |
| Desperate | 8 |

- A project lives in a room. Only somebody standing there can work on it.
- **Proposing a project** costs no action and sends a card to the GM. Nothing exists until they approve it, and they may change the scale, the room or the wording first.
- A project may demand a specific statistic; otherwise you pick.
- A **Tool held ready** gives advantage and takes its tier off every threshold on the roll.
- Some projects are secret to the people working on them. If you cannot see one, it is not on your list.
- A project with a room also stands on the map, as a hammer token that never says which project it is. A public one appears once you have stood in its room; a secret one only for the people in on it. Double-click it for its card.
- **Sabotage** (same tile, same statistics): break a project in the room you stand in so it needs a repair project. 12+ a simple repair, 18+ a complex one, a critical a repair of hidden difficulty. With witnesses present you first roll Shadow against **16** to cover what you are doing; failing that does not stop you, it only means everyone watched.

> [!WARNING]
> Sabotage **always leaves a trace**, even on a failure, and a roll with Despair shows you to the room.

### Dynamic action - any statistic, 1 action

Anything at all, provided you describe it in detail. The GM sets the difficulty and the statistic, or refuses (nothing is spent). Dynamic thresholds are gentler than the standard actions, as a deliberate reward for inventing something:

| Difficulty | Range | Item tier it can yield | Trace it leaves |
|---|---|---|---|
| Trivial - anyone could do it | 8-12 | Tier 0 | Obvious |
| Takes practice | 13-15 | Tier 1 | Evident |
| Foreign to most people | 16-18 | Tier 2 | Subtle |
| Demands very niche expertise | 19-21 | Tier 3 | Hidden |

> [!IMPORTANT]
> The scale is upside down on purpose: the easier the thing, the louder the trace.

### Rest - no roll, 1 or 2 actions

| | Short Rest | Long Rest |
|---|---|---|
| Cost | 1 action | 2 actions |
| Choose | 1 of the three | 2 of the three |
| How often | once per time of day | once per session |
| Where | rooms the GM marked for it | rooms the GM marked for it |

| Option | Long | Short |
|---|---|---|
| Sleep | restores all Health | restores half Health |
| Meal | restores all Sanity | restores half Sanity |
| Breath | grants 2 Hope | grants 1 Hope |

The dialog prices both against what you have and names the rooms that allow each.

### Listen - Shadow, 1 action

Work out who is in a neighbouring room. No GM needed. You pick the room before you roll, and the answer arrives as a card only you and the GMs can read.

| Roll | Result |
|---|---|
| under 14 | you learn nothing |
| 14+ | whether anyone is in that room, and how many |
| 18+ | who is in that room, by name |
| critical | who is in every neighbouring room, by name |

A neighbouring room you have never been in is listed as *Unexplored room 1*, *Unexplored room 2* and so on, in the picker and in the answer: Listen tells you who is behind a door, not what the room behind it is.

### Palm - Hand, 1 action

A hand in somebody's pocket, going either way. Two independent rolls: **Hand** decides whether it worked, **Shadow** decides whether they noticed.

| | Take something | Leave something |
|---|---|---|
| It works (Hand) | 10+ | 8+ |
| Unseen (Shadow) | 15+ | 13+ |

Four outcomes, and the interesting ones are the mismatches: caught with nothing to show for it, or robbed by somebody you never noticed. What you take is whatever comes out; a critical lets you choose. Their carry limit still applies - what does not fit in a full pocket goes into their stash, and with no stash it stays with you. Palm never reaches into a stash.

### Tamper - Shadow, 1 action

Two things behind the tile. An attempt costs **1 action**; with no action left, it costs **1 Sanity** instead.

**Cover your tracks.** Wipe out one trace in this room that you know is there: one you hold a Truth Bullet copy of, or a trace of the fight you are in. The easier it is to see, the harder it is to erase:

| Visibility | Needs |
|---|---|
| Hidden | 9 |
| Subtle | 12 |
| Evident | 15 |
| Obvious | 18 |

Each is 3 lower while no body has been found. A Cleaning Tool in hand gives advantage and takes its tier off the number.

| Result | What happens |
|---|---|
| Clean success | the trace is removed |
| Critical | removed, and it also gives back what the attempt cost |
| Success with Despair | removed, but it leaves a Tamper Remnant of its own |
| Failure | the trace stays, and a Tamper Remnant is added beside it (Subtle on Hope, Evident on Despair) |

Reinforced traces never come off.

**Misleading trail.** Leave a Prep Remnant pointing at somebody else. Needs **15**. A failure with Hope still plants one, a Hidden, Faint one that probably nobody finds; a failure with Despair plants nothing.

> [!WARNING]
> If anybody else is in the room you first roll Shadow against **16** to cover what you are doing, and being caught at it costs Sanity: 1 on a success with Despair, 1 on a failure, 2 on a failure with Despair. The briefing warns you how many people are watching. Walking into an empty room first is a real alternative.

### Direct Murder - 1 action, GM rules

A face-to-face killing, agreed with the GM beforehand and <ins>consented to by the victim's player</ins>. It can only be declared **during an Eclipse** - the one moment you can be alone with somebody. The action is spent whether or not it comes off, and nobody, not even you, learns how it went until the Eclipse ends and the room settles. If you end up alone with them and the GM allows it, the incident opens (chapter 10).

### Move - free, then 1 action

Not a tile, just drag your token. See chapter 3.

---

## 5. Hope and the Hope Calls

Hope is yours. You hold at most **6**. It comes back when rolls go your way (+1 with Hope, +2 on a critical), from a Breath on a Rest, and from a Tier 3 usable. You spend it on **Hope Calls**, from the sheet:

| Call | Cost | What it does |
|---|---|---|
| **Support** | 1 | Give another player advantage on one roll. You have to be in the same room. |
| **Experience** | 1 | Add your experience level to a roll that experience genuinely applies to. Waits for the GM - you write what you intend, the Hope is charged only on a yes. |
| **Ultimate** | 1 | Advantage on a roll your Ultimate genuinely applies to. Waits for the GM the same way. |
| **Contribution** | 2 | +1 progress to a project being worked on in the room you are in. |
| **Sprint** | 2 | One more room crossing this time of day without paying an action for it. |
| **Reroll** | 3 | Reroll your last action. It reverts the previous outcome - the trace, the item, the Sanity go with it. Some things stand: a hand already in a pocket, a trail already planted. |
| **Resolve** | 3 | For one roll, choose which statistic to add yourself. |
| **Burst** | 4 | Your next action costs nothing - the whole action, however many it would have cost. |
| **Relief** | 4 | Take a Short Rest right now: no action, no marked room, and it does not use up this time of day's. |
| **Loaded Die** | 6 | On the next roll one die is set to 12 and the other is thrown. A very high total, and a critical only if that other die comes up 12 too. |

A Call that affects a roll waits on your next roll and is spent the moment you throw. Sprint and Burst bank instead and last until the time of day ends.

> [!IMPORTANT]
> Nobody can spend Hope Calls during an Eclipse, while Silenced by Monokuma, or while the overflow's Silence darkens the time of day.

---

## 6. Despair - the other side

Every roll of yours that lands with Despair feeds the pool of the Monokuma who watches you. A pool holds **12**, and every pool's count is on every screen, yours included, in the Despair Pools bar at the top.

### Despair Calls - what Monokuma can do to you

| Call | Cost | Effect |
|---|---|---|
| Obstacle | 1 | Disadvantage on your roll. |
| Approval | 1 | Advantage on your roll. Yes, sometimes he helps. |
| Fuel a Monocub | 1 | 1 Despair becomes 1 Hope for a Monocub, so they can use Confusion. |
| Feed the Overflow | 1 | Pours Despair into the overflow that darkens the world. |
| Behind Closed Doors | 2 | Seals a room for one time of day. |
| Paranoia | 2 | You lose 2 Sanity. |
| Chained | 3 | You cannot leave your room until the time of day ends. |
| Game Integrity | 3 | Removes 2 progress from a project. |
| Patronage | 3 | Adds 2 progress to a project. |
| Pain | 4 | You lose 2 Health. |
| Silence | 4 | You cannot spend Hope Calls until the time of day ends. |
| Contraband | 4 | Destroys any one item. |
| Public Announcement | 6 | Everyone is called to one room at the start of the next time of day. You have until then; where you are when it starts is up to you. |
| Motive | 6 | A demand, a deadline in times of day, and the price of ignoring it - announced to everyone word for word. The countdown sits on the Event panel. |
| New Rule | 9 | One new killing game rule of Monokuma's choice. Rules land on the Rules tab of every sheet. |

### The overflow

Despair earned past a full pool does not vanish - it collects in one shared counter. When the counter reaches its threshold (**20** by default; the GM may tune it) the school gets worse for **one time of day**, and **one** thing is drawn at random from what the GM put in the hat:

| Darkening | For one time of day |
|---|---|
| Darkness | 1 fewer Eclipse crossing; a free-placement Eclipse is pulled back to two rooms |
| Shift | 1 fewer search token in every room |
| Panic | 1 fewer action each, on top of Wounded |
| Despair | no Hope is earned at all - spending still works |
| Silence | no Hope Calls, by anybody |
| Fog | no Free Move - crossings cost actions as usual |
| Rot | every item with more than one durability point loses one (one-off, nothing breaks) |
| Earthquake | every project loses 1 progress (one-off) |

None of these ever takes you below one action or one search token. You see "?" for the counter; a trial verdict empties it.

---

## 7. Things

### Tiers and durability

| Tier | Usable | Murder Weapon / Cleaning Tool | Durability |
|---|---|---|---|
| 0 | a random, seemingly useless item - open to creative use; the GM rules | a random, seemingly useless item | 1 |
| 1 | restores 1 Health (Healing) or 1 Sanity (Sanity Relief) | meant for something else, but usable | 1 |
| 2 | restores 2 Health or 2 Sanity, by its kind | partly intended for the job | 2 |
| 3 | restores 2 Health **or** 2 Sanity - your choice - plus 2 Hope | made strictly for the job | 3 |

**Durability:** every roll with Despair made using a tool costs it one point, whether or not the work succeeded. At zero it is **Broken**. A used usable is Broken too.

> [!WARNING]
> A Broken item stays in your inventory, in its slot, useless - and still evidence. Two ways out: **throw it away** (a Shadow roll decides how obvious the trace is, and the trace stays in the room) or put it in your **stash**.

### Categories and what you can carry

| Category | Limit | Notes |
|---|---|---|
| **Usables** | 3 | Healing restores Health, Sanity Relief clears Sanity. Use from the inventory row. |
| **Gear**: Murder Weapons, Cleaning Tools, Tools | 2 slots shared | Only **one** may be stowed - carrying two means one is in your hand. |
| **Truth Bullets** | none | Evidence. What you know, not a thing in a drawer. |
| **Room Keys** | none | Opens one bedroom. |

An item can also serve as another category (a screwdriver under Tools that is also a Murder Weapon) and still takes one slot.

> [!IMPORTANT]
> **Holding ready.** Gear must be held ready to count: only what is in your hand matters in an incident, a clean-up or project work. At most one thing is ever in a hand; readying one puts the others down. A Tool in hand gives advantage on project work and sabotage and takes its tier off the threshold. A Cleaning Tool in hand does the same for cleaning up. A Murder Weapon's tier is its damage.

**Handing over.** Anyone in the same room: **Hand it over** (it leaves you for good; their limit applies) or, for a Truth Bullet, **Share a copy** (you both have it, and their copy is not bound by any failed analysis of yours). No action, and not during an Eclipse.

### Bedrooms, keys, stashes

- One student, one bedroom. The **door is locked** to everyone but the owner; anybody else needs a **key**. You hold your own key and can give a copy to somebody - the owner keeps theirs. A key opens its door whoever holds it: one Palmed off somebody, lifted from a stash or taken from a body works like one that was given.
- Your bedroom comes with a **stash**. A stash holds **3** things, and you have to be standing in the room to put things in or take them out. Truth Bullets cannot be stashed.
- An **open** stash is a drawer: anyone standing in the room can go through it for free and take one thing. Your bedroom's stash is open unless a hiding place has been built for it (a project the GM approves).
- A **hidden** stash has to be found first: a Search in the room at a penalty, or Analyze's *Locate a hidden stash* at 16+, which opens it to you for good. If the GM removes a stash, whoever had found it forgets it.
- Somebody helping themselves from a stash of yours is not announced. Only a thief whose Search came up with Despair leaves it disturbed enough to notice: you are told somebody has been in it - never who.
- The GM may give you a stash in another room. It does not come with a key to that room.
- Your hands were full when something reached you - found, stolen, taken off a body, or slipped into your pocket? It goes into your stash - your bedroom's, if you have one - wherever you are standing and however full that stash already is, and you are told. With no stash at all, it does not reach you. Something handed to you over the limit is simply refused.

---

## 8. Traces and evidence

### Remnants

A **Remnant** is a trace on the map. Most of what you do in a room leaves one: taking a weapon, a Dynamic action, sabotaging, working on a murder project, throwing something away, going through a body's pockets, a fight, a clean-up. How hard it is to see is its **visibility**: Obvious, Evident, Subtle, Hidden. Some are **Reinforced** - nobody can remove them.

A trace appears on your map <ins>only once you hold a Truth Bullet copied from it</ins> (the traces of a fight you are in show as they are made). It wears a question mark until your copy is analysed, and then the icon of what left it - a Search, a Dynamic action, a project, a sabotage, the fight itself, a clean-up, a thing thrown away, a body gone through, the GM's own hand. Its frame takes the colour of what your copy says it is.

| Remnant | What it means |
|---|---|
| **Key Remnant** | Placed by the GMs so the case is solvable. Unremovable. Becomes a Truth Bullet whose kind shows the moment you pick it up; what it says takes an Analyze. |
| Prep Remnant | Left while preparing a murder or gathering tools. |
| Incident Remnant | Left during the confrontation or the victim's death. |
| Tamper Remnant | Left by tampering - the too-clean patch, the thing moved back slightly wrong. |
| Faint Remnant | Doubtful connection to the case. Cleared by the GM unless tied to the murder. |
| Autopsy Remnant | The state of the body. Handed out at the start of an Investigation, no roll. |
| Final Truth Remnant | One per chapter. Points at the Mastermind. Unremovable. |

### Truth Bullets

A **Truth Bullet** is what an Observe gives you: a copy of a Remnant, in your inventory under Truth Bullets. Most arrive **Neutral** - you do not yet know what kind of trace it is - and need an Analyze. A Key or a Final Truth shows its kind the moment you pick it up, but what it says still waits for an Analyze; only the Autopsy arrives fully read.

A Truth Bullet card shows:

- its name,
- the description the finder was given,
- what kind of trace it is as far as you know (Faint only once identified),
- how visible the original was (Obvious, Evident, Subtle or Hidden),
- the chapter,
- the room you picked it up in,
- "Analyzed in vain" when an analysis of yours failed on it this chapter.

The pack can be grouped by Chapter or by Location. A Truth Bullet is the only thing you can present at a trial.

You cannot rename or edit an item. What a thing is called is part of the evidence.

### Reading the difficulty ladder

You are never shown a difficulty at the roll, but the shape of the ladder is not a secret:

| Original trace | Observe (to spot it) | Analyze (to read it) |
|---|---|---|
| Key Remnant, Final Truth | 6 / 9 / 12 / 15 | 6 / 9 / 12 / 15 |
| Prep, Incident, Tamper | 9 / 12 / 15 / 18 | 12 / 15 / 18 / 21 |
| Faint | 12 / 15 / 18 / 21 | 8 / 12 / 15 / 18 |
| Something from Daily Life | 8 / 12 / 18 / 21 | 8 / 12 / 18 / 21 |

Columns are Obvious / Evident / Subtle / Hidden. A faint trace is hard to spot and obvious once in your hand; a prepared one is easy to pick up and hard to read.

---

## 9. Traps and projects that kill

An **indirect murder** is built as projects, kept secret from everyone but the builder and the GMs - *Prepare the weapon* (Standard or Complex, 4-6 progress, may need a specific room) and *Set the trap* (Trivial or Standard, 3-4 progress, always needs a specific room). Budget about **6 progress** in total.

Working on one when somebody else is in the room adds a **Shadow roll against 16** to hide your intent: a success and you may lie freely; a failure and the others get a general description ("fiddling with test tubes"). Alone, the project simply gains +1. Every project action also rolls Shadow to hide its traces:

| Shadow roll | Trace it leaves |
|---|---|
| under 12 | Obvious |
| 12+ | Evident |
| 18+ | Subtle |
| critical | Hidden |

A finished trap waits for a condition - somebody alone in the room, somebody entering, searching, resting, hunting for a stash, working or sabotaging a named project, or using a planted item, or a condition of the builder's own that the builder watches for - optionally only after dark (Evening, Night, or any Eclipse), and by default never the builder. The module watches for the others; the GM decides whether it fired.

A **planted item** arrives as whatever the finder was searching for. It only springs for somebody who <ins>searched for a usable and then uses it</ins>.

> [!TIP]
> If you are the one who walks into a trap, see the next chapter - you get a roll.

---

## 10. The murder

What follows is what a player is allowed to know. Who is doing what to whom is the incident's business, not yours, until a body is found.

Where a roll below lists more than one statistic, the module rolls the first; the Resolve Hope Call lets you choose another.

### The opening roll

There is exactly one, and the kind of murder decides whose it is.

**Direct murder:** the killer rolls (Body or Hand, against **8**; advantage at Night).

| Killer's roll | What happens |
|---|---|
| Failure | nothing happens and the victim never learns anything was attempted |
| Success | the incident begins |
| With Despair | the victim loses all their Sanity on the spot and loses Role reversal for this incident |
| Critical | the victim learns who is attacking them |

**Indirect murder (a trap):** the **victim** rolls (Eye or Head, against **20**; disadvantage at Night). Being asked to roll is itself the warning.

| Victim's roll | What happens |
|---|---|
| Hope | something is wrong with this room - a Free Move and no idea why; spend it and you live |
| Despair | you work out what has been set up here and can tell the others |
| Critical | you spot the trap and know whose hands built it |
| Failure | you notice nothing and the trap closes |

On any success the trap does not close: your struggle to notice leaves an Evident trace, and the GM decides what happens next.

A death by one's own hand uses the killer's roll and skips straight to the clean-up.

### If you are the victim

The incident is turn-based. **You go first**. Alone with a trap, you roll every crisis action with advantage. Every other tile on your sheet goes dark; the Direct Murder tile opens your crisis actions. Hope Calls still work.

> [!WARNING]
> From your second turn on, every turn costs you: **1 Sanity** in a direct murder, **2** when you are alone with a trap - Sanity until it runs out, then Health.

| Crisis action | Roll | What it does |
|---|---|---|
| **Leave a clue** | Hand / Leg / Shadow, 12 | Leaves a trace meant to help the others (Evident on Hope, Subtle on Despair, Obvious and Reinforced on a critical - and you keep the turn). A failure with Hope gives advantage on the next attempt. Against a trap: Hand / Leg / Body, and Hope leaves a Reinforced trace, a critical two. |
| **Secure a trace** | Hand / Leg / Shadow, 15 | Take something off the killer and turn it into a trace tied to their identity. Same shape as above. |
| **Self-defence** | Hand / Leg / Body, 18 | You fight. One attempt. Hope opens Survive and Role reversal, Despair opens Role reversal only, a critical stops the drain outright and lets you take one of them this turn without rolling. An item usable as a weapon gives advantage. A failure with Despair costs 1 extra. |
| **Survive** | Leg, 18 | Withdraw. The incident ends and the drain stops. Despair adds a hint about who they were; a critical also gives immunity for this chapter and the next. A failure costs 1 extra. Needs Self-defence first. |
| **Role reversal** | Hand / Leg / Body, 15 | Tip the scales and become the killer. Hope also restores all your Health and Sanity; a critical kills them outright. A failure with Despair costs 1 extra. Needs Self-defence first. |
| **Use an item** | Hand, 15 | Press *use* on the item. It works on a critical or a success with Hope; a success with Despair leaves a trace and nothing else. A failure with Despair costs 1 extra. |

Survive and Role reversal are resolution actions: they cost **1 Sanity** instead of an action, or **1 Health** once your Sanity is gone. Nothing the killer does can take Reinforced traces off the map.

> [!CAUTION]
> A victim who runs out of both Health and Sanity dies.

### If you are the killer

Your side of the same table:

| Action | Roll | What it does |
|---|---|---|
| Strike | Hand / Leg / Body, 15 | 1 Health and 1 Sanity off them; a critical puts both marks on the one track you choose, Health or Sanity. A failure with Despair still takes 1 Sanity and leaves an Evident trace. |
| Pin them down | Body, 12 | Two turns of disadvantage on Leave a clue and Survive. |
| Keep your distance | Leg, 12 | Two turns of disadvantage on Secure a trace and Role reversal. |
| Attack with a weapon | Body / Hand / Leg, 15 | Damage 1 + half the weapon's tier (rounded up); 1 + the full tier on a critical. Unarmed: disadvantage, and a success snatches an improvised weapon (Tier 2 on Hope, Tier 1 on Despair). A Tier 0 object is rated by the GM. |
| Finishing blow | Body / Leg / Hand | Threshold is five times their remaining Health - free at 0. Ends the incident; a critical grants a free action in the clean-up. |
| Use an item | Hand, 15 | As the victim's. |

Finishing blow is a resolution action too: 1 Sanity, or 1 Health once your Sanity is gone.

Then the **clean-up**. Your Tamper tile now lists every trace in the room you are standing in - not only yours - and you can spend **1 Sanity** per attempt:

| Option | Roll, and what it does |
|---|---|
| **Erase a trace** | the Tamper table, chapter 4 |
| **Reshape a trace** | three lower than erasing - rename it and describe it as something innocent; the GM approves your words before they land, it always ends up a Tamper Remnant, and a critical makes it quieter and hands the Sanity back |
| **Misleading trail** | 15 |
| **Move the body** | Body, 16 - you pick a room connected to the body's before the roll, never a bedroom; a success carries it there and always leaves an Evident trace, a critical also hands the Sanity back, and a failure leaves the body where it is |

Tonight, at your own scene, the clean-up costs no action. A Cleaning Tool in hand gives advantage and takes its tier off the number. Witnesses in the room mean the same Shadow-16 concealment roll, and the same Sanity for being caught - except for Move the body, which rolls no concealment.

> [!WARNING]
> The Murder Weapon you swung is destroyed when the clean-up closes; the Cleaning Tool is destroyed when the body is found - both stay in your inventory as broken evidence.

### If you walk in on it

Crossing into a room where a direct murder is running gives you **one free choice** (a trap has nobody in it to interrupt):

| Choice | Roll | What it does |
|---|---|---|
| Escape together | Leg, 15 | Both of you get out; Hope restores the victim's Health and Sanity, a critical adds immunity for this chapter and the next. On a failure only you get out. |
| Double role reversal | no roll | You and the victim turn on the attacker together. They become the victim. |
| Partners in crime | no roll | You side with the attacker. The victim is unlikely to walk out. |
| Averted eyes | no roll | You leave and take no part. It leaves no trace of you. |

Escape together costs the same as the victim's resolution actions: 1 Sanity, or 1 Health once your Sanity is gone. The three no-roll choices are free.

Having thrown in and survived, you may afterwards **turn on your partner** - the one killing that needs no declaration in advance. A fourth person walking in cancels the incident: nobody dies, the wounds stand.

> [!NOTE]
> The module applies the damage, the traces, the turns, and a Role reversal's swap with the Health and Sanity it restores. The rest of what these tables promise is the GM's to apply: a critical Role reversal's kill, the Health and Sanity that Escape together restores, every immunity, and Survive's hint about who they were.

### The morning after

Somebody finds the body. The moment <ins>two students stand in the room with it</ins>, and at least one of them is not among its killers, it is discovered - never during an Eclipse. The killers themselves, still cleaning up, can stand over it without finding it. The GM can also announce it by hand. Everyone is called to the scene, and the game holds there until the Investigation starts. A killing by one's own hand is a killing like any other - the class has only the scene to go on.

---

## 11. Investigation

- Every living student receives an **Autopsy Truth Bullet** - time of discovery, cause of death, what the body shows. No roll.
- **Observe** the traces on the map, **Analyze** what you collect, **Share** copies with people in your room. Traces tied to the crime are shown first.
- The GMs prepared **Key Remnants** for this case - up to five, never fewer than three, and the better the killer's opening roll went, the fewer there are. Together they narrow the suspects to two to four people; a clue narrows the circle, it never names a name.
- The **body** can be searched: open the dead student's sheet and press *Take* on what they carried. You get the thing itself, plus a Truth Bullet recording what you took and off whom - and the body gets a trace that somebody has been through the pockets (one per body, however many things leave it).
- Investigators and killers alike can **Tamper**. A too-clean patch is evidence of tidying.
- What you fail to find, you will not have at the trial.

> [!WARNING]
> Every Key Remnant below four that you fail to find is worth **3 Despair** to every Monokuma.

---

## 12. The Class Trial

Everyone is in one room, and nobody leaves it. You start the trial with a fresh time of day's actions (a banked Sprint or Burst stays banked), and only Analyze is open on your sheet, with the Hope Calls and your items; inside a trial Analyze costs **1 action**, or **1 Hope** when your actions are gone, or **1 Sanity** when both are.

The trial opens as an **open discussion**: everybody talks, and a Truth Bullet can be **Presented** from your inventory for free - it goes on the table as a card for everyone, with a comment of yours, and takes nobody's turn away. Only what you can see goes on the card.

When the room is ready to argue, the GM opens the **Nonstop Debate**. The debate has a clock (the GM's budget, **180 seconds** by default; overrunning turns it red and nothing else). Inside the debate, presenting a Truth Bullet becomes an **OBJECTION**, priced like Analyze - 1 action, else 1 Hope, else 1 Sanity - and when the price is all that stops you, you are offered a free Present instead:

| Mode | Who may speak | How long |
|---|---|---|
| Nonstop Debate | everyone | the GM's budget |
| OBJECTION | the objector alone | 60 seconds |
| Rebuttal | the objector and the person they named | 120 seconds, then the floor closes and the trial is back to open discussion |

You name who you are contradicting. Nobody may object while somebody else's objection is running; anybody may cut into a rebuttal, but only against one of the two already on the floor. On every screen the clock names the mode, and the Event panel's trial card shows the mode, who holds the floor (in a rebuttal, also whom they answer) and the time left. Silence is kept by the table, not by the software.

### The vote

Each living player receives a **ballot**. Vote for whoever you believe is the **Blackened**: you may vote for yourself, for Monokuma and for the dead. Nobody sees your vote; only the totals are published.

> [!IMPORTANT]
> A conviction needs **more than half** of the ballots issued. **A tie counts as a wrong vote** unless the table settles it.

| Outcome | What happens |
|---|---|
| **Right** | The Blackened is executed. Every survivor takes a **Level Up** (pick 1). |
| **Wrong** | The accused is executed. The Blackened stays anonymous and in play with a **Reinforced Level Up** (pick 3) and one new rule of their choosing, and every Monokuma fills their Despair pool. |

A chapter can produce two Blackened (a betrayal leaves two bodies); the vote has to name <ins>all of them</ins>.

### Level Up

| Option |
|---|
| Increase Health by +1 |
| Increase Sanity by +1 |
| Increase one statistic by +1 |
| Increase one experience by +1 |
| Add a new experience worth +2 |

The same option may be taken more than once on a Reinforced Level Up.

### The Final Trial

Somebody among you may have built this place. The **Final Truth Remnants** - one per chapter, unremovable - point at the Mastermind. Name them at the Final Trial and the killing game is over. Name the wrong person and nobody new is executed; the class is simply shown that the game was never what it looked like.

---

## 13. Death, and after

- The dead take no actions and spend no Hope. You keep your sheet and your voice at the table.
- Your **Truth Bullets die with you**, carried and stashed alike, unless the GM keeps them. Everything else stays on the body to be found.
- The body stays where it fell and can be moved by the killer. The dead do not count as being in a room: no witnessing, no handovers.
- The GM can end a chapter by revealing what every Truth Bullet really was, collecting them (Faint and Final Truth stay), and clearing the Faint traces.

### Playing a Monocub

Once your own Class Trial has ended, you may join the GMs as a **Monocub**. Same actor, same sheet; the action panel becomes **Move** and **Confusion**.

- You have the same action budget as a living student and see only your own room. Your rolls are shown to everyone standing in it.
- **Confusion** costs **1 action and 1 Hope**, and your Hope exists only because a Monokuma converted Despair into it (Fuel a Monocub). It is a flat 2d12 with no statistic. Pick somebody in your room and help or hinder their next roll (see the table below). They are told something steadied or rattled them, never who.
- A Monocub who stumbles onto the crime scene is sworn to silence about it until the chapter ends. Confusion still works.

| Confusion roll | Help | Hinder |
|---|---|---|
| 12+ | +1 | -1 |
| 16+ | advantage | disadvantage |
| critical | returns their action | wastes their action |

Monokumas themselves - the GM side - have no actions and no Hope, walk through walls and locked doors, and spend Despair where you spend Hope.

---

## 14. The messenger and asking for rulings

The button in the bottom-right corner opens **GM Chat**: one thread between you and every GM. There is no player-to-player text channel - in-room talk is voice.

Everything that needs a human lands in the same thread: an Observe aimed at a point of interest, an Analyze hint, a Dynamic action, a project proposal, a Search for something specific, the Experience and Ultimate Calls, a Tier 0 item you want to use creatively. You see your roll, your own words, and the ruling when it comes. If no GM answers, nothing is spent.

The messenger also has a **Note** tab: your plans for the session, for the GMs to read before it. The template asks seven questions:

- whether you plan to kill and how,
- whether you are open to dying,
- whether you are open to torture,
- whether you are open to romance,
- your triggers,
- your goals,
- the game-changing projects you intend to try.

> [!TIP]
> The first four are boundaries, not a dare. "No changes" is a complete answer.

---

## 15. The safeword

Bottom-left of your character sheet is a button with a word on it - **Safe Word** unless your table chose its own (a world already in play before the word became a setting keeps MISIUBOMBO). Press it and the scene stops. It also works without a sheet: through a key your table can bind in Foundry's Controls. The game pauses, every GM is told who pressed it (and from which room, when it was pressed on a sheet), and everybody sees the same card: the scene is stopped, a GM will pick this up, and play resumes from a point everyone agrees on. While the game stays paused, the Event panel says the scene is stopped.

> [!CAUTION]
> You do not have to justify it, now or later. There is no reason field. Nobody else is told who pressed it - only that the scene stopped.

---

## 16. Interface tips

**The HUD** (left column): campaign name, chapter, day, phase and time of day, how many minutes this time of day has been running, the room you stand in, whether it holds a project you can work on, its search tokens, and the name of the track you are hearing. During a trial it shows only the mode (Discussion, Debate, Objection or Rebuttal) in place of the time of day; the minutes line and the room go, and who holds the floor is on the Event panel. Click it for an explanation of where things stand and the description of your room.

**The Event panel** (under the Despair rows): what is happening now - the Motive with its countdown and what ignoring it costs, a called assembly, a darkening that is running, a body found, the trial's mode, speaker and time left, an open vote, a stopped scene. A murder's own cards show only to the people in it.

**The status strip** (right, above the Projects tray): your actions left, whether your Free Move is still there, your Hope, and Eclipse crossings while one runs. Anything banked with Sprint or Burst shows on your sheet, in the line above the action grid. Click the strip for the explanation.

**The Despair rows** show every pool and how full it is, and under them the overflow: "?" where its count would be, beside the number it fires at. Click for what Despair is.

**Your sheet:**
- *Actions* - the ten tiles, Hope Calls below; during an incident the Direct Murder tile opens your crisis actions; Move and Confusion here as a Monocub.
- *Inventory* - Usables, Gear (with *hold ready*), Truth Bullets (Analyze, Present, Share; group them by Chapter or Location), Room Keys, and your stash when you stand in that room.
- *Rules* - Monokuma's standing rules, everyone's, all the time.
- The safeword, bottom-left. Level Up, when you earned one.

**The messenger** (bottom-right) has two tabs: *Chat*, your GM Chat thread, and *Note*, the pre-session note.

**The book** beside it, the smallest of the three corner buttons, opens the handbooks in the game: this Player Handbook and the Student Brochure, in the language you picked for the module. The contents list on the left jumps to any section.

**Cards and popups:** results of your actions arrive as notice cards, and a card stays until you close it - a click on it, or its X for evidence and other cards that must be read. The newest goes on top and pushes the older ones down; when there are more than fit, the rest wait underneath behind a "+N" beside the close button, and closing a card brings the next one back. A "waiting for the GM" card closes itself when the answer arrives. The chat log keeps them. During an Eclipse a summary of the time of day opens for you.

**The Look dialog:** the gear in the bottom-right corner opens settings that are this browser's own - nobody else sees or hears the difference:
- **Language** - English or Polski for the module's windows, cards and sheet. Separate from Foundry's own language on purpose. Takes effect after a reload. The glossary stays English in both.
- **Theme** - Stained Glass (the current look) or Monokuma Legacy (with its pixel font switch).
- **Interface scale** (80% to 140%), and under Stained Glass **glass pulse**, **state name behind the clock** and **glass blurs the map** (the first thing to turn off if the screen stutters).
- **Reduced motion** and **high contrast**, under both themes; each also follows your operating system when it asks for them.
- **Messenger sounds**, and the **Sound** and **Music** volumes.

> [!NOTE]
> **Rolls are private:** every roll you make is whispered to you and the GMs. Nobody sees anyone else's dice - except that a roll inside a murder is shown to the people in it, and a Monocub's to their room.

---

*Somebody will do something terrible soon enough. Decide who you trust.*
