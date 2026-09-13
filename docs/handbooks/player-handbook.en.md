# Danganronpa RPG - Player Handbook

*For students of the killing game. Module version 1.2.43, built on Daggerheart for Foundry VTT v14.*

This is the whole game from your chair: what the numbers on your sheet mean, what an action costs, what Hope buys, what happens when somebody dies, and what to press. Every number in here is the module's own; where a decision belongs to a human, it says "the GM decides".

The game's proper names stay in English on every table and in every language: Hope, Despair, Sanity, Truth Bullet, Remnant, Blackened, Class Trial, Daily Life, Eclipse, Mastermind, Monokuma, Monocub, the Calls, the actions, Ultimate, Key Remnant, Vault, Stash.

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

Both apply on their own the moment the track fills; Daggerheart's own Vulnerable and Death Move are switched off. Nothing in this module kills you for reaching zero Health. Dying is something a person does to you, and it is announced.

### Rolling

Every action is a Daggerheart duality roll: a Hope die and a Despair die (both d12) plus your statistic. The higher die decides the flavour, a matched pair is a **critical**.

- A roll **with Hope** earns you 1 Hope.
- A roll **with Despair** feeds the Despair pool of the Monokuma who watches you. That is where Monokuma's money comes from - your bad luck and your risks.
- A **critical** earns 2 Hope and nothing else (it does not clear Sanity here, unlike plain Daggerheart).

The roll window is locked for players: dice, statistic, advantage, experiences and bonuses come from the action, from a Call you paid for, from where you are standing, or from the GM. What you can touch is what the action lets you choose.

---

## 2. Time

### A day, a session, a chapter

One session is one in-fiction day, and a day is five **times of day**: **Morning, Noon, Afternoon, Evening, Night**. Every time of day refills your two actions, your free Move and each room's search tokens. When Night ends, the day turns over.

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
| First crossing into a connected room this time of day | your **free Move** |
| Every further crossing | **1 action** each |
| A crossing bought with the Sprint Hope Call | free |

Drag your token; the cost is applied when you arrive. A crossing that you cannot pay for is refused and the token goes back.

You are turned back by:

- a room that is **not connected** to yours (the refusal names the rooms you can reach),
- a **locked door** (the GM locked the room),
- a **sealed room** (the Behind Closed Doors Despair Call, for one time of day),
- being **Chained** by a Despair Call (you cannot leave your room until the time of day ends),
- **somebody else's bedroom** when you hold no key to it,
- being **dead** - the body stays where it fell.

### What you can see

- The room you are in is in full colour. Rooms you have already visited show through a veil. The rest of the school is fogged until you walk into it - a room is discovered by entering it, once, per character.
- You only see the people standing in your room. Nobody else is on the map for you.
- The clock at the top of the screen can be clicked: it explains the phase, the time of day, where you are, and prints the room's description if the GM wrote one.
- Another player's sheet opens redacted: name, portrait, Health, Sanity and what they hold ready. Nothing else.

### Voice

With regional voice on, every room is its own voice channel: you hear only whoever stands in the room with you, and your voice client follows your token the moment it crosses into another room. During an Eclipse every player is alone in a channel of their own. A Monokuma who walks into your room hears you like anyone else, and you see them.

To find out who is next door without walking in, use **Listen** (chapter 4).

### Search tokens

Every room has a number of **search tokens** per time of day (the default is 3; the GM sets it anywhere from 0 to 10). Each Search spends one. A searched-out room is searched out for everybody until the clock moves. The HUD tells you how many are left where you stand.

---

## 4. Actions

You get **2 actions** per time of day (1 while Wounded). The action grid on your sheet has ten tiles. A tile with a GM mark on it hands the turn to a human: your roll and your request go into your messenger thread and you wait for a ruling.

Every action's briefing shows its cost, the statistics it rolls, the room you are in, and anything that will cost you Sanity.

### Search - Eye or Hand, 1 action

Loot the room for something you name. Spends one of the room's search tokens.

| Roll | Result |
|---|---|
| under 8 | nothing found |
| 8+ | a Tier 0 item - a random, seemingly useless object |
| 12+ | Tier 1 |
| 18+ | Tier 2 |
| critical | one tier higher than the roll says |

What you can ask for: *something to patch me up* (Healing usable), *something to settle my nerves* (Sanity Relief usable), *something that could kill* (Murder Weapon), *something to clean with* (Cleaning Tool), *something to work with* (Tool), or *something specific* - describe it and the GM rules on what was really there.

Taking a Murder Weapon or a Cleaning Tool **leaves a Prep Remnant** in the room - a trace that you were here gathering tools. A Tool leaves nothing unless what turns up is also a weapon. Some rooms are good places to look for a category and some are bad; the roll window tells you when where you stand changes your roll. If somebody has hidden a stash in the room, a Search may turn it up, at a penalty.

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

You are told what you found, never the difficulty. Traces tied to the crime are always shown first.

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
- **Proposing a project** sends a card to the GM. Nothing exists until they approve it, and they may change the scale, the room or the wording first.
- A project may demand a specific statistic; otherwise you pick.
- A **Tool held ready** gives advantage and takes its tier off every threshold on the roll.
- Some projects are secret to the people working on them. If you cannot see one, it is not on your list.
- **Sabotage** (same tile, same statistics): break a project in the room you stand in so it needs a repair project. 12+ a simple repair, 18+ a complex one, a critical a repair of hidden difficulty. It **always leaves a trace**, even on a failure, and a roll with Despair shows you to the room. With witnesses present you first roll Shadow against 16 to cover what you are doing; failing that does not stop you, it only means everyone watched.

### Dynamic action - any statistic, 1 action

Anything at all, provided you describe it in detail. The GM sets the difficulty and the statistic, or refuses (nothing is spent). Dynamic thresholds are gentler than the standard actions, as a deliberate reward for inventing something:

| Difficulty | Range | Item tier it can yield | Trace it leaves |
|---|---|---|---|
| Trivial - anyone could do it | 8-12 | Tier 0 | Obvious |
| Takes practice | 13-15 | Tier 1 | Evident |
| Foreign to most people | 16-18 | Tier 2 | Subtle |
| Demands very niche expertise | 19-21 | Tier 3 | Hidden |

Note the scale is upside down on purpose: the easier the thing, the louder the trace.

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

Work out who is in a neighbouring room. No GM needed.

| Roll | Result |
|---|---|
| under 14 | you learn nothing |
| 14+ | pick one room; learn whether anyone is there and how many |
| 18+ | pick one room; see the tokens of everyone in it |
| critical | see every player token in all adjacent rooms |

### Palm - Hand, 1 action

A hand in somebody's pocket, going either way. Two independent rolls: **Hand** decides whether it worked, **Shadow** decides whether they noticed.

| | Take something | Leave something |
|---|---|---|
| It works (Hand) | 10+ | 8+ |
| Unseen (Shadow) | 15+ | 13+ |

Four outcomes, and the interesting ones are the mismatches: caught with nothing to show for it, or robbed by somebody you never noticed. What you take is whatever comes out; a critical lets you choose. Their carry limit still applies - a pocket that is full stays full. Palm never reaches a stash.

### Tamper - Shadow, 1 action

Two things behind the tile:

- **Cover your tracks.** Wipe out one trace *you* left in this room. The easier it is to see, the harder it is to erase: **Hidden 9, Subtle 12, Evident 15, Obvious 18**. A Cleaning Tool in hand gives advantage and takes its tier off the number. A clean success removes it. A success with Despair removes it but leaves a Tamper Remnant of its own. A failure leaves the trace and adds a Tamper Remnant beside it (Subtle on Hope, Evident on Despair). Reinforced traces never come off.
- **Misleading trail.** Leave a Prep Remnant pointing at somebody else. Needs **15**. It plants something either way - a failure with Hope leaves a Hidden, Faint one that probably nobody finds; a failure with Despair plants nothing.

If anybody else is in the room you first roll Shadow against **16** to cover what you are doing, and being caught at it costs Sanity: 1 on a success with Despair, 1 on a failure, 2 on a failure with Despair. The briefing warns you how many people are watching. Walking into an empty room first is a real alternative.

### Direct Murder - 1 action, GM rules

A face-to-face killing, agreed with the GM beforehand and consented to by the victim's player. It can only be declared **during an Eclipse** - the one moment you can be alone with somebody. The action is spent whether or not it comes off, and nobody, not even you, learns how it went until the Eclipse ends and the room settles. If you end up alone with them and the GM allows it, the incident opens (chapter 8).

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

A Call that affects a roll waits on your next roll and is spent the moment you throw. Sprint and Burst bank instead and last until the time of day ends. Nobody can spend Hope Calls during an Eclipse, while Silenced by Monokuma, or while the overflow's Silence darkens the time of day.

---

## 6. Despair - the other side

Every roll of yours that lands with Despair feeds the pool of the Monokuma who watches you. A pool holds **12**. What is in it is the GMs' to know - you see that the pools exist, not how full they are.

### Despair Calls - what Monokuma can do to you

| Call | Cost | Effect |
|---|---|---|
| Obstacle | 1 | Disadvantage on your roll. |
| Approval | 1 | Advantage on your roll. Yes, sometimes he helps. |
| Fuel a Monocub | 1 | 1 Despair becomes 1 Hope for a Monocub, so they can use Confusion. |
| Feed the Overflow | 1 | Pours Despair into the overflow that darkens the world. |
| Behind Closed Doors | 2 | Seals a room for one time of day. |
| Paranoia | 2 | You lose 2 Sanity. |
| Pain | 3 | You lose 2 Health. |
| Chained | 3 | You cannot leave your room until the time of day ends. |
| Game Integrity | 3 | Removes 2 progress from a project. |
| Patronage | 3 | Adds 2 progress to a project. |
| Silence | 4 | You cannot spend Hope Calls until the time of day ends. |
| Contraband | 4 | Destroys any one item. |
| Public Announcement | 6 | Everyone is called to one room at the start of the next time of day. You have until then; where you are when it starts is up to you. |
| Motive | 6 | A demand, a deadline in times of day, and the price of ignoring it - announced to everyone word for word. The countdown sits on the HUD. |
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
| Fog | no free Move - crossings cost actions as usual |
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

**Durability:** every roll with Despair made using a tool costs it one point, whether or not the work succeeded. At zero it is **Broken**: it stays in your inventory, in its slot, useless - and still evidence. Two ways out: **throw it away** (a Shadow roll decides how obvious the trace is, and the trace stays in the room) or put it in your **stash**. A used usable is Broken too.

### Categories and what you can carry

| Category | Limit | Notes |
|---|---|---|
| **Usables** | 3 | Healing restores Health, Sanity Relief clears Sanity. Use from the inventory row. |
| **Gear**: Murder Weapons, Cleaning Tools, Tools | 2 slots shared | Only **one** may be stowed - carrying two means one is in your hand. |
| **Truth Bullets** | none | Evidence. What you know, not a thing in a drawer. |
| **Room Keys** | none | Opens one bedroom. |

An item can also serve as another category (a screwdriver under Tools that is also a Murder Weapon) and still takes one slot.

**Holding ready.** Gear must be held ready to count: only what is in your hand matters in an incident, a clean-up or project work. At most one thing is ever in a hand; readying one puts the others down. A Tool in hand gives advantage on project work and sabotage and takes its tier off the threshold. A Cleaning Tool in hand does the same for cleaning up. A Murder Weapon's tier is its damage.

**Handing over.** Anyone in the same room: **Hand it over** (it leaves you for good; their limit applies) or, for a Truth Bullet, **Share a copy** (you both have it, and their copy is not bound by any failed analysis of yours). No action.

### Bedrooms, keys, stashes

- One student, one bedroom. The **door is locked** to everyone but the owner; anybody else needs a **key**. You hold your own key and can give a copy to somebody - the owner keeps theirs.
- Your bedroom comes with a **stash**. A stash holds **3** things, and you have to be standing in the room to put things in or take them out. Truth Bullets cannot be stashed.
- An **open** stash is a drawer: anyone standing in the room can go through it for free and take one thing. Your bedroom's stash is open unless a hiding place has been built for it (a project the GM approves).
- A **hidden** stash has to be found first: a Search in the room at a penalty, or Analyze's *Locate a hidden stash* at 16+. When something goes missing from your hiding place you are told something was moved - never by whom.
- The GM may give you a stash in another room. It does not come with a key to that room.
- Your hands were full when you found something? It goes into your stash if you are standing in that room.

---

## 8. Traces and evidence

### Remnants

A **Remnant** is a trace on the map. Most of what you do in a room leaves one: taking a weapon, sabotaging, working a project, throwing something away, a fight, a clean-up. How hard it is to see is its **visibility**: Obvious, Evident, Subtle, Hidden. Some are **Reinforced** - nobody can remove them.

| Remnant | What it means |
|---|---|
| **Key Remnant** | Placed by the GMs so the case is solvable. Unremovable. Becomes a Truth Bullet identified the moment you pick it up. |
| Prep Remnant | Left while preparing a murder or gathering tools. |
| Incident Remnant | Left during the confrontation or the victim's death. |
| Tamper Remnant | Left by tampering - the too-clean patch, the thing moved back slightly wrong. |
| Faint Remnant | Doubtful connection to the case. Cleared by the GM unless tied to the murder. |
| Autopsy Remnant | The state of the body. Handed out at the start of an Investigation, no roll. |
| Final Truth Remnant | One per chapter. Points at the Mastermind. Unremovable. |

### Truth Bullets

A **Truth Bullet** is what an Observe gives you: a copy of a Remnant, in your inventory under Truth Bullets. Most arrive **Neutral** - you do not yet know what kind of trace it is - and need an Analyze. Key, Autopsy and Final Truth arrive identified. A Truth Bullet card shows its name, the description the finder was given, how hard the original was to spot (Slight, Modest, Firm or Deep lead), the chapter, and whether an analysis of yours failed on it. It is the only thing you can present at a trial.

You cannot rename or edit an item. What a thing is called is part of the evidence.

### Reading the difficulty ladder

You are never shown a difficulty at the roll, but the shape of the ladder is not a secret:

| Original trace | Observe (to spot it) | Analyze (to read it) |
|---|---|---|
| Key Remnant | 6 / 9 / 12 / 15 | no roll |
| Prep, Incident, Tamper | 9 / 12 / 15 / 18 | 12 / 15 / 18 / 21 |
| Faint | 12 / 15 / 18 / 21 | 8 / 12 / 15 / 18 |
| Something from Daily Life | 8 / 12 / 18 / 21 | 8 / 12 / 18 / 21 |

Columns are Obvious / Evident / Subtle / Hidden. A faint trace is hard to spot and obvious once in your hand; a prepared one is easy to pick up and hard to read.

---

## 9. Traps and projects that kill

An **indirect murder** is built as projects, kept secret from everyone but the builder and the GMs - *Prepare the weapon* (Standard or Complex, 4-6 progress, may need a specific room) and *Set the trap* (Trivial or Standard, 3-4 progress, always needs a specific room). Budget about 6 progress in total.

Working on one when somebody else is in the room adds a **Shadow roll against 16** to hide your intent: a success and you may lie freely; a failure and the others get a general description ("fiddling with test tubes"). Alone, the project simply gains +1. Every project action also rolls Shadow to hide its traces: under 12 leaves an Obvious trace, 12+ Evident, 18+ Subtle, a critical Hidden.

A finished trap waits for a condition - somebody alone in the room, somebody entering, searching, resting, hunting for a stash, working or sabotaging a named project, or using a planted item - optionally only after dark (Evening, Night, or any Eclipse), and never the builder. The module watches; the GM decides whether it fired.

A **planted item** arrives as whatever the finder was searching for. It only springs for somebody who searched for a usable and then uses it.

If you are the one who walks into a trap, see the next chapter - you get a roll.

---

## 10. The murder

What follows is what a player is allowed to know. Who is doing what to whom is the incident's business, not yours, until a body is found.

### The opening roll

There is exactly one, and the kind of murder decides whose it is.

- **Direct murder:** the killer rolls (Body or Hand, against 8; advantage at Night). On a failure nothing happens and the victim never learns anything was attempted. On a success the incident begins. With Despair the victim loses all their Sanity on the spot and loses Role reversal for this incident. On a critical the victim learns who is attacking them.
- **Indirect murder (a trap):** the **victim** rolls (Eye or Head, against **20**; disadvantage at Night). Being asked to roll is itself the warning. **Hope:** something is wrong with this room - a free Move and no idea why; spend it and you live. **Despair:** you work out what has been set up here and can tell the others. **Critical:** you spot the trap and know whose hands built it. **Failure:** you notice nothing and the trap closes.
- A death by one's own hand uses the killer's roll and skips straight to the clean-up.

### If you are the victim

The incident is turn-based. **You go first**, and every turn costs you: 1 Sanity in a direct murder, 2 when you are alone with a trap - Sanity until it runs out, then Health. Your crisis actions are on your sheet under Actions. Hope Calls still work.

| Crisis action | Roll | What it does |
|---|---|---|
| **Leave a clue** | Hand / Leg / Shadow, 12 | Leaves a trace meant to help the others (Evident on Hope, Subtle on Despair, Obvious and Reinforced on a critical - and you keep the turn). A failure with Hope gives advantage on the next attempt. Against a trap: Hand / Leg / Body, and Hope leaves a Reinforced trace, a critical two. |
| **Secure a trace** | Hand / Leg / Shadow, 15 | Take something off the killer and turn it into a trace tied to their identity. Same shape as above. |
| **Self-defence** | Hand / Leg / Body, 18 | You fight. One attempt. Hope opens Survive and Role reversal, Despair opens Role reversal only, a critical stops the drain outright and lets you take one of them this turn without rolling. An item usable as a weapon gives advantage. A failure with Despair costs 1 extra. |
| **Survive** | Leg, 18 | Withdraw. The incident ends and the drain stops. Despair adds a hint about who they were; a critical also gives immunity for this chapter and the next. A failure costs 1 extra. Needs Self-defence first. |
| **Role reversal** | Hand / Leg / Body, 15 | Tip the scales and become the killer. Hope also restores all your Health and Sanity; a critical kills them outright. Needs Self-defence first. |
| **Use an item** | Hand, 15 | Press *use* on the item. It works on a critical or a success with Hope; a success with Despair leaves a trace and nothing else. |

Survive and Role reversal are resolution actions: they cost **1 Sanity** instead of an action, or **1 Health** once your Sanity is gone. A victim who runs out of both Health and Sanity dies. Nothing the killer does can take Reinforced traces off the map.

### If you are the killer

Your side of the same table:

| Action | Roll | What it does |
|---|---|---|
| Strike | Hand / Leg / Body, 15 | 1 Health and 1 Sanity off them; a critical puts both marks where you choose. A failure with Despair still takes 1 Sanity and leaves an Evident trace. |
| Pin them down | Body, 12 | Two turns of disadvantage on Leave a clue and Survive. |
| Keep your distance | Leg, 12 | Two turns of disadvantage on Secure a trace and Role reversal. |
| Attack with a weapon | Body / Hand / Leg, 15 | Damage 1 + half the weapon's tier (rounded up); 1 + the full tier on a critical. Unarmed: disadvantage, and a success snatches an improvised weapon (Tier 2 on Hope, Tier 1 on Despair). A Tier 0 object is rated by the GM. |
| Finishing blow | Body / Leg / Hand | Threshold is five times their remaining Health - free at 0. Ends the incident; a critical grants a free action in the clean-up. |
| Use an item | Hand, 15 | As the victim's. |

Then the **clean-up**. You now see the traces you left and can spend **1 Sanity** per attempt: **Erase a trace** (the Tamper table, chapter 4), **Reshape a trace** (three lower than erasing - rename it and describe it as something innocent; it always ends up a Tamper Remnant, and a critical makes it quieter and hands the Sanity back), **Misleading trail** (15), or **Move the body** (Body, 16 - one room on Hope or Despair, two on a critical; it always leaves an Evident trace, and bedrooms are never on the list). Tonight, at your own scene, it costs no action. A Cleaning Tool in hand gives advantage and takes its tier off the number. Witnesses in the room mean the same Shadow-16 concealment roll, and the same Sanity for being caught. The Murder Weapon you swung is destroyed when the clean-up closes; the Cleaning Tool is destroyed when the body is found - both stay in your inventory as broken evidence.

### If you walk in on it

Crossing into a room where an incident is running gives you **one free choice**:

| Choice | Roll | What it does |
|---|---|---|
| Escape together | Leg, 15 | Both of you get out; Hope restores the victim's Health and Sanity, a critical adds immunity for this chapter and the next. On a failure only you get out. |
| Double role reversal | no roll | You and the victim turn on the attacker together. They become the victim. |
| Partners in crime | no roll | You side with the attacker. The victim is unlikely to walk out. |
| Averted eyes | no roll | You leave and take no part. It leaves no trace of you. |

Having thrown in and survived, you may afterwards **turn on your partner** - the one killing that needs no declaration in advance. A fourth person walking in cancels the incident: nobody dies, the wounds stand.

### The morning after

Somebody finds the body. The GM announces it, everyone is called to the scene, the game holds there until the Investigation starts. A killing by one's own hand is a killing like any other - the class has only the scene to go on.

---

## 11. Investigation

- Every living student receives an **Autopsy Truth Bullet** - time of discovery, cause of death, what the body shows. No roll.
- **Observe** the traces on the map, **Analyze** what you collect, **Share** copies with people in your room. Traces tied to the crime are shown first.
- The GMs prepared **Key Remnants** for this case - up to five, never fewer than three, and the better the killer's opening roll went, the fewer there are. Together they narrow the suspects to two to four people; a clue narrows the circle, it never names a name. Every Key Remnant below four that you fail to find is worth 3 Despair to every Monokuma.
- The **body** can be searched: open the dead student's sheet and press *Take* on what they carried. It becomes a Truth Bullet of yours - and it leaves a trace that somebody has been through the pockets.
- Investigators and killers alike can **Tamper**. A too-clean patch is evidence of tidying.
- What you fail to find, you will not have at the trial.

---

## 12. The Class Trial

Everyone is in one room. The trial opens as an **open discussion**: everybody talks, and a Truth Bullet can be **Presented** from your inventory - it goes on the table as a card for everyone, with a comment of yours, and takes nobody's turn away. Only what you can see goes on the card.

When the room is ready to argue, the GM opens the **Nonstop Debate**. The debate has a clock (the GM's budget, 180 seconds by default; overrunning turns it red and nothing else). Inside the debate, presenting a Truth Bullet becomes an **OBJECTION**:

| Mode | Who may speak | How long |
|---|---|---|
| Nonstop Debate | everyone | the GM's budget |
| OBJECTION | the objector alone | 60 seconds |
| Rebuttal | the objector and the person they named | 120 seconds, then back to the debate by itself |

You name who you are contradicting. Nobody may object while somebody else's objection is running; anybody may cut into a rebuttal, but only against one of the two already on the floor. The HUD shows the mode, who holds the floor and how long is left, on every screen. Silence is kept by the table, not by the software.

### The vote

Each living player receives a **ballot**. Vote for whoever you believe is the **Blackened**: you may vote for yourself, for Monokuma and for the dead. Nobody sees your vote; only the totals are published. A conviction needs **more than half** of the ballots issued. **A tie counts as a wrong vote** unless the table settles it.

| Outcome | What happens |
|---|---|
| **Right** | The Blackened is executed. Every survivor takes a **Level Up** (pick 1). |
| **Wrong** | The accused is executed. The Blackened stays anonymous and in play with a **Reinforced Level Up** (pick 3) and one new rule of their choosing, and every Monokuma fills their Despair pool. |

A chapter can produce two Blackened (a betrayal leaves two bodies); the vote has to name all of them.

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
- Your **Truth Bullets die with you**, carried and stashed alike. Everything else stays on the body to be found.
- The body stays where it fell and can be moved by the killer. The dead do not count as being in a room: no witnessing, no handovers.
- The GM can end a chapter by revealing what every Truth Bullet really was, collecting them (Faint and Final Truth stay), and clearing the Faint traces.

### Playing a Monocub

Once your own Class Trial has ended, you may join the GMs as a **Monocub**. Same actor, same sheet; the action panel becomes **Move** and **Confusion**.

- You have the same action budget as a living student and see only your own room.
- **Confusion** costs **1 action and 1 Hope**, and your Hope exists only because a Monokuma converted Despair into it (Fuel a Monocub). It is a flat 2d12 with no statistic. Pick somebody in your room and help or hinder their next roll: 12+ gives +1 or -1, 16+ gives advantage or disadvantage, a critical returns their action or wastes it. They are told something steadied or rattled them, never who.
- A Monocub who stumbles onto the crime scene is sworn to silence about it until the chapter ends. Confusion still works.

Monokumas themselves - the GM side - have no actions and no Hope, walk through walls and locked doors, and spend Despair where you spend Hope.

---

## 14. The messenger and asking for rulings

The button in the bottom-right corner opens **GM Chat**: one thread between you and every GM. There is no player-to-player text channel - in-room talk is voice.

Everything that needs a human lands in the same thread: an Observe aimed at a point of interest, an Analyze hint, a Dynamic action, a project proposal, a Search for something specific, the Experience and Ultimate Calls, a Tier 0 item you want to use creatively. You see your roll, your own words, and the ruling when it comes. If no GM answers, nothing is spent.

The messenger also has a **Note** tab: your plans for the session, for the GMs to read before it. The template asks seven questions - whether you plan to kill and how, whether you are open to dying, to torture, to romance, your triggers, your goals, and the game-changing projects you intend to try. The first four are boundaries, not a dare. "No changes" is a complete answer.

---

## 15. The safeword

Bottom-left of your character sheet is a button with a word on it - **MISIUBOMBO** unless your table chose its own. Press it and the scene stops. The game pauses, every GM is told who pressed it and from which room, and everybody sees the same card: the scene is stopped, a GM will pick this up, and play resumes from a point everyone agrees on.

You do not have to justify it, now or later. There is no reason field. Nobody else is told who pressed it - only that the scene stopped.

---

## 16. Interface tips

**The HUD** (left column): campaign name, chapter, day, phase and time of day. It also carries the Motive countdown, an assembly order, "Body found", and during a trial the mode and its clock. Click it for an explanation of where things stand and the description of your room.

**The status strip** (right, above the Projects tray): your actions left, whether your free Move is still there, your Hope, Eclipse crossings while one runs, and anything banked with Sprint or Burst. Click it for the explanation.

**The Despair rows** show that pools exist, never how full. Click for what Despair is.

**Your sheet:**
- *Actions* - the ten tiles, Hope Calls below; crisis actions here during an incident; Move and Confusion here as a Monocub.
- *Inventory* - Usables, Gear (with *hold ready*), Truth Bullets (Analyze, Present, Share), Room Keys, and your stash when you stand in that room.
- *Rules* - Monokuma's standing rules, everyone's, all the time.
- *Note* and *Chat* - the pre-session note and GM Chat.
- The safeword, bottom-left. Level Up, when you earned one.

**Cards and popups:** results of your actions arrive as popups that dismiss themselves. The chat log keeps them. During an Eclipse a summary of the time of day opens for you.

**The Look dialog:** the gear in the bottom-right corner opens settings that are this browser's own - nobody else sees or hears the difference:
- **Language** - English or Polski for the module's windows, cards and sheet. Separate from Foundry's own language on purpose. Takes effect after a reload. The glossary stays English in both.
- **Theme** - Stained Glass (the current look) or Monokuma Legacy (with its pixel font switch).
- **Interface scale** (80% to 140%), **glass pulse**, **state name behind the clock**, **reduced motion**, **messenger sounds**, and the **Sound** and **Music** volumes.

**Rolls are private:** every roll you make is whispered to you and the GMs. Nobody sees anyone else's dice.

---

*Somebody will do something terrible soon enough. Decide who you trust.*
