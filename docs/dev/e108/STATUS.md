# E108 - the table's dice look: Dice So Nice's or Daggerheart's

Target 1.2.112. R5460-R5489. No new scenario. Branch: dh-212b (E108 sits on top of the DH212 line; it can move to a branch
of its own if the coordinator wants).

The owner's report (13.11.2026): "Mamy maly blad - ustawieniach rolls and privacy jest wybor tylko kostek dice so nice.
Chcialbym miec wybor kostek z dice so nice vs z daggerheart. Chodzi o wyglad."

## Step 1 - the root cause and the survey

Every line below is marked **read** (read in source, file:line given) or **assumed** (not read, not measured). Nothing
here was tried at a table.

### What was read

| Source | Where | How it was had |
| --- | --- | --- |
| Daggerheart 2.12.8 | the system's tag 2.12.8, unpacked in this session's scratch space; the dice classes the harness runs (`audit/harness/lib/dh-dice/`, commit 71c318de25) are the same files | read |
| Dice So Nice 6.4.5 | gitlab.com/riccisi/foundryvtt-dice-so-nice, archive of tag 6.4.5 (the newest, as E76's STATUS.md found), fetched 13.11.2026 | read |
| the module | wt of dh-212b with origin/main 44f9d690 merged | read |

### 1. What Daggerheart 2.12.8 offers for the dice's look

- **No dice look setting of its own.** The Appearance setting (`module/data/settings/Appearance.mjs`, 78 lines) holds
  no dice field at all; until 2.9 it held `diceSoNice.{hope,fear,advantage,disadvantage}` presets. 2.10's migration
  (`module/systemRegistration/migration-handlers/2_10_0-dsn.mjs:9-42`) moved what was left of them (the effects) into
  Dice So Nice's own user flags. **read**
- **Four Dice So Nice colorsets and four Dice So Nice roles.** `module/config/dsnConfig.mjs:1-49` defines
  `daggerheart-hope-colorset` (gold #ffe760, white numbers), `daggerheart-fear-colorset` (blue #0032b1, black numbers),
  `daggerheart-advantage-colorset` (green #008000) and `daggerheart-disadvantage-colorset` (red #b30000), each texture
  `astralsea`, material `metal`. `:65-102` registers roles `hope`, `fear`, `advantage`, `disadvantage`, each
  `customizable: true`, detected by the die modifier `h`, `f`, `a`, `d`, defaulting to its colorset and the system
  `standard`. `daggerheart.mjs:417-429` adds them at `diceSoNiceReady`. **read**
- **No dice of its own without Dice So Nice.** Every 3D throw in the system goes through `game.dice3d`
  (`module/dice/die/dualityDie.mjs:19-26`, `baseDie.mjs:126-138`, `module/helpers/utils.mjs:956-963`, and the
  `if (game.dice3d)` guards across `module/`): with Dice So Nice absent the system draws no dice, only the chat card
  (and Foundry's dice sound). **read**

So on 2.12.8 "Daggerheart's dice" means one thing: the Hope, Fear, advantage and disadvantage dice drawn by Dice So
Nice in Daggerheart's four colorsets. Daggerheart gives no look for any other die (a d20 of a statistic, a damage
die).

### 2. How Dice So Nice 6.4.5 picks a Hope die's look

`module/engine/DiceRoleRegistry.js:245-279` `resolveRoleSlot` lays three layers, last wins: the role's **defaults**
(Daggerheart's colorset), the **world**'s role scopes (DSN's world setting `roleScopes`, `main.js:333`, written by a GM
in DSN's Dice Roles window), then - for a `customizable` role, which all four of Daggerheart's are - the **player**'s
own: the thrower's User flag `dice-so-nice.roleAppearance`, with the actor's `roleAppearance` laid over it
(`module/settings/DsnSettings.js:208-246`, `ROLE_APPEARANCE` and `ROLE_CONTEXT`). Each browser builds this from the
thrower's flags when it draws the throw (`ALL_CUSTOMIZATION`, `DsnSettings.js:264-279`). **read**

Above all three, a die's own options win: `module/engine/DiceFactory.js:2179-2234` - a term's `options.colorset` first
("priority 1", which also drops a library die the role slot named), then `options.appearance` merged over. **read**

### 3. What the module does with it today on 2.12.8 - the root cause

The switch `forceDiceLook` (settings.mjs:1314-1322, shown in the game's settings, section privacy,
settings-window.mjs:90) is one Boolean: on, every user below full Gamemaster holds the source full Gamemaster's DSN
`appearance` and `sfxList` (dice-sync.mjs:12-15, written by `writeLooks`, :1095-1100). It has two parts:

1. **The Dice So Nice part works** on 2.12.8: the basic dice (any die with no role) of every player are the GM's.
2. **The Daggerheart part is switched off on 2.10 and later, by design, and nothing replaced it.** The source GM's
   Daggerheart preset is written to the world (`keepDualityLook`, dice-sync.mjs:890-903) only where
   `dualityPresetHere` finds one (:869-884: `appearance.diceSoNice`, absent on 2.12.8), and laid on each throw
   (`layOnThrow`, dice-look.mjs:107-131) only where `tableDualityLook` (:132-141) answers - and it answers null for any Daggerheart
   newer than 2.9.99 (:139). The setting's hint says so in brackets ("(Daggerheart 2.9 and older)", lang/en.json:279, the key `DRPG.Settings.forceDiceLook.hint`);
   the diagnostic says `rolesUnforced` ("Daggerheart 2.12.8 colours its Hope and Despair dice by Dice So Nice roles,
   which the table's forced look does not set", lang/en.json:3881). E60's note (dice-look.mjs:101-105) left forcing the
   roles to "E76"; E76 did not take it up. **read**

So the owner's "only Dice So Nice's dice" is accurate: on 2.12.8 the switch can only force the GM's Dice So Nice look,
and there is no way to choose Daggerheart's.

A gap found on the way (**read**, not reported by the owner): with the switch on, a player's own look for a role -
`roleAppearance` on its User or its actor - is never written or put back. The module's write replaces `appearance`,
`sfxList` and DSN 6.4's `saved` marker (dice-sync.mjs:1095); `roleAppearance` appears nowhere in scripts/. So today a
player who sets a Hope die of its own in Dice So Nice 6.4's Dice Roles throws it, forced look or not. Whether any player
at the owner's table has done so is not known.

### 4. What "Daggerheart's dice" can mean for a player

| The player's browser | What can be drawn |
| --- | --- |
| Dice So Nice installed and on | Hope, Fear, advantage and disadvantage dice in Daggerheart's colorsets - every screen that draws the throw has Daggerheart's `diceSoNiceReady` registration, so the four colorset names are known there (**read**: daggerheart.mjs:417-429 runs on every client) |
| no Dice So Nice, or it off | no 3D dice at all, whatever the setting (**read**: point 1). The module cannot draw Daggerheart's dice there; nothing is changed for that player |

Daggerheart gives no look for the basic dice, so "Daggerheart's look" cannot be applied to them faithfully: there is
nothing of Daggerheart's to apply.

## Step 2 - what is built (the default the coordinator took, owner to confirm)

One choice, three values, in the game's settings, Rolls and privacy, where the switch stood:

| Value | Basic dice of users below full GM | Hope, Fear, advantage, disadvantage dice |
| --- | --- | --- |
| Each player's own look | their own (nothing written; today's off) | their own |
| One look for the table: Dice So Nice | the source GM's DSN look (today's on) | as today: Daggerheart 2.9 and older the source GM's preset; 2.10 and later DSN's roles, each thrower's own role look where it set one (the gap above) |
| One look for the table: Daggerheart | the source GM's DSN look, as the value above (Daggerheart has none for them) | Daggerheart's own colorsets, on every screen, whoever throws - a GM too |

**How the Daggerheart value is applied.** Display only, as E60 C5d laid the 2.9 preset: at `diceSoNiceRollStart` each
browser hands Dice So Nice a copy of the roll whose Hope, Fear, advantage and disadvantage dice carry
`options.colorset` = Daggerheart's colorset of that kind and `options.appearance.system = "standard"` (Daggerheart's
default system). Priority 1 of DiceFactory.js:2183-2186, so it is above the world's role scopes, the player's and the
actor's role looks, and a library die. The roll itself, the message's, is never changed. On Daggerheart 2.9 and older the
value lays the source GM's preset (today's behaviour), since that preset is Daggerheart's own look there.

**How an existing world reads it - read-time mapping, no migration.** The choice is stored in two world settings: the
old `forceDiceLook` (Boolean; off is "each player's own") and a new `diceLookKind` (String, `dsn` or `daggerheart`,
default `dsn`). A world from before reads `true` as the Dice So Nice value and `false` as each player's own, without a
write. Why not one new key: every forced-look rule, the Assistant's put-back (dice-sync.mjs `SWITCHES`) and some forty
tests read the Boolean; a second key beside it leaves all of that as it is. Both keys are held to a full Gamemaster's
value as the switches are (an Assistant's write is put back).

## Not tried, and open

- What the throw looks like at a table, on each screen, in each value: LIVE-E108-01 (audit/AUDIT-1.2.42.md 9.2, row 508).
- The registry stamps R5460-R5466 with stage E93, not E108: tools/stages.json has no E108 (`registry.mjs --write --stage E108` refuses), and this stage may not edit stages.json. The coordinator's to add.
- Q-E108-1 (owner): in the Daggerheart value, should the basic dice stay the GM's DSN look (built), or be each player's
  own?
- Q-E108-2 (owner): close the `roleAppearance` gap in the Dice So Nice value (force the GM's role looks on users and
  actors too)? Not built: it changes what today's "on" does, and the actor overlays' store (gm-stores.mjs
  `diceLookStore`) would need a second field.
