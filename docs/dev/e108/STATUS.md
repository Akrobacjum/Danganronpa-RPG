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

A gap found on the way (**read**, not reported by the owner; closed for 1.2.113, "Q-E108-2 built" below): with the switch on, a player's own look for a role -
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
| Each player's own | their own (nothing written; today's off) | their own |
| Everyone: Dice So Nice | the source GM's DSN look (today's on) | as today: Daggerheart 2.9 and older the source GM's preset; 2.10 and later DSN's roles, the source GM's role looks since 1.2.113 (Q-E108-2), each thrower's own until then |
| Everyone: Daggerheart | the source GM's DSN look, as the value above (Daggerheart has none for them) | Daggerheart's own colorsets, on every screen, whoever throws - a GM too |

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

**The choices' words.** The coordinator's default was "Each player's own look", "One look for the table: Dice So
Nice", "One look for the table: Daggerheart". The stage's shots (Chromium, probe 08's captures of the game's settings,
1366x768) showed Stained Glass's select cut the last two at "One look for the table:", so the chosen look could not be
read; Monokuma Legacy wrapped them. They are now "Each player's own", "Everyone: Dice So Nice", "Everyone: Daggerheart"
(PL "Każdy gracz własny", "Wszyscy: Dice So Nice", "Wszyscy: Daggerheart"), which the shots show whole in both themes.
The setting's name: "Dice look for the table" / "Wygląd kości przy stole". The owner may want other words.

## Measured (13.11.2026, this worktree)

| Run | Result |
| --- | --- |
| R5460-R5466 before the code (d2dcfb9c) | 7 numbered and 3 named tier-2 tests, all 10 failed |
| `npm run quick`, at the last commit's tree | lint, check (17 parts), gate all green |
| `node run-tests.mjs --tier 1`, whole, after the choices' rename | 1394 ran: 1379 passed, 0 failed, 16 skipped, 0 red (439.6 s) |
| the same on 71331273, before R1256's count | 1378 passed, 1 failed (R1256 counts the table's settings by hand: 38, now 39), 16 skipped |
| tier 2 by name: "dice look" and E60-T16 | 40 ran: 44 passed (the run's own 4 guards included), 0 failed |
| tier 2 by name: the three E108 tests | passed (on 71331273) |
| scenario 83-roll-integrity | 110/110 |
| scenario 17-assistant (reads dice-sync.mjs) | 46/46 |
| scenarios 12-social, 13-murder-signals, 33-bridge-paths (throw dice through `diceSoNiceRollStart`) | 28/28; 86/86; 77/78 with 1 expected red (foundry-cub-purse, as before) |

The scenarios and the tier-2 tests ran before the rename of the choices' words; the rename touches lang/*.json and the
GM handbooks only, and the tiers 0-1 run above is after it. No scenario reads settings-window.mjs; none was found that
does (grep of scenarios/ for the file, `saveSettings`, `settingRowHtml` and the window openers).

Shots: the private review page, artifact id UPggd89JQ1c6ZJ3eANjcTP (its full link is in the report to the coordinator: the host's name is a word this repository's docs do not hold; Polish captions): the game's settings,
section Rolls and privacy, EN and PL, both themes, and the row with each choice selected. No die is shown: the harness
cannot draw Dice So Nice's 3D dice, so the page lists Daggerheart's four colorset colours as read in its source instead.

## Not tried, and open

- What the throw looks like at a table, on each screen, in each value: LIVE-E108-01 (audit/AUDIT-1.2.42.md 9.2, row 508).
- The registry stamps R5460-R5466 with stage E93, not E108: tools/stages.json has no E108 (`registry.mjs --write --stage E108` refuses), and this stage may not edit stages.json. The coordinator's to add.
## Q-E108-2 built (13.11.2026, for 1.2.113; the coordinator's default, owner to confirm)

The forced look now carries the source full Gamemaster's `roleAppearance` too (dice-sync.mjs `lookFrom`, "THE ROLE
LOOKS"): written on every user below full Gamemaster with the appearance, compared, put back, and the source's own held to
the GMs' copy as its appearance is. An actor's role looks are a second field of its row in the GMs' store (`roles`,
beside `look`; "AN ACTOR'S ROLE LOOKS"), taken from a full Gamemaster's write and put back after anyone else's. A row
from before has no `roles` and is filled weakly at the comparison at load, by the unseen actor's rule; until then that
actor's role looks are not judged. Tests: R5467 (tier 1) and two named tier-2 tests, red at 3a841287; R940 and R3603 read
the look's new shape (an empty `roleAppearance`).

- Q-E108-1 (owner): in the Daggerheart value, should the basic dice stay the GM's DSN look (built), or be each player's
  own?
- Q-E108-2: built (above), on the coordinator's default "yes"; the owner may still say otherwise.
