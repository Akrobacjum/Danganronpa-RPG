# Daggerheart 2.10.5 - static compatibility probe

**Static probe: source diff only, no Foundry run. 24.09.2026.**

Nothing here was executed against a live Foundry. Every conclusion below is a
reading of source code, and says so where the reading stops. Anything that
depends on what Foundry core, Dice So Nice or a browser does at runtime is
marked **needs the live probe**.

| What | Version | Where from |
| --- | --- | --- |
| This module | 1.2.56, HEAD `6d69c5a` | `/home/user/Danganronpa-RPG` |
| Daggerheart, old | tag `2.6.5`, commit `c2984980ef`, 02.08.2026 | `git clone https://github.com/Foundryborne/daggerheart` |
| Daggerheart, new | tag `2.10.5`, commit `6bf4b69f98`, 23.09.2026 | same clone |
| Dice So Nice | master, 6.3.1, commit `89c0e3c`, 17.09.2026 | `git clone https://gitlab.com/riccisi/foundryvtt-dice-so-nice`, read for one API question |

Size of the gap: 254 commits between the two tags. Under `module/`, `templates/`,
`styles/` and `daggerheart.mjs`: 406 files changed, +12642 / -5642.

**The headless suite cannot see any of this.** `audit/harness/client-entry.mjs`
stubs Daggerheart as 2.6.5: a `DualityRollMock` (321-367, with
`version: "2.6.5"` at 366), a `rollTrait` stand-in (414-460) and
`RESOURCE: { character: { custom: {} } }` (570). A green headless run on a
2.10.5 world would measure the shim, not the system.

File references: `module/...`, `templates/...` and `daggerheart.mjs` paths are
Daggerheart's. `scripts/...`, `styles/...` and `lang/...` paths are this
module's.

---

## 1. Verdict

- **Broken, 1 item:** since 2.9.0, Daggerheart deletes the module's
  `system.resources.actions` whenever the acting client updates or deletes an
  item on a character (E24, section 6).
- **At risk, needs the live probe:** secrecy of Projects under the new countdown
  ownership model (E03), and sheet trait rolls that skip the roll window (E16).
- **Dead code or dead diagnostics, no crash:** the dice colouring on reroll and
  the dice diagnostics (E28).
- **Unchanged:** the patched function, every Daggerheart hook the module
  listens to, the roll-window template and class, the character-sheet nesting
  the module injects into, every data path the module reads or writes on actors
  (except the Actions resource above), and 92 of the 94 translation overrides.
- **The GM relay (`DhGMUpdate` / `DhGMCreate`) is unchanged and still
  validates nothing.** Two lines changed between the tags. Neither adds a check.
  Details are in section 4.

---

## 2. Foundry core compatibility of Daggerheart 2.10.5

`system.json` `compatibility`, read at each tag:

| Tag | minimum | verified | maximum |
| --- | --- | --- | --- |
| 2.6.5 | 14.364 | 14.365 | 14 |
| 2.7.0 | 14.364 | 14.365 | 14 |
| 2.8.0 | 14.364 | 14.367 | 14 |
| 2.9.0 | 14.364 | 14.367 | 14 |
| 2.10.0 | 14.364 | 14.368 | 14 |
| **2.10.5** | **14.364** | **14.368** | **14** |

- **14.364 and 14.365 are still inside the declared range.** Daggerheart itself
  has only declared verification on 14.367 (since 2.8.0) and 14.368 (since
  2.10.0). Whether it still works on 14.364/14.365 **needs the live probe.**
- Core globals: `_del`, `_replace` and `_loc` were already used by 2.6.5 (32,
  11 and 24 hits), so they exist on 14.364.
- New core read in 2.10.5: `game.data.systemUpdate`, in
  `module/applications/sidebar/tabs/settings.mjs:16,20`, inside
  `DhSettings._onRender`. 2.6.5 has 0 hits for it. 2.10.5 also installs
  `CONFIG.ui.settings = DhSettings` (daggerheart.mjs:111). If
  `game.data.systemUpdate` is missing on 14.364/14.365, the GM's Settings
  sidebar tab throws on render. There is no Foundry source in this environment,
  so **this needs the live probe.**
- The module's own gate: `module.json` gives the system a `minimum` of 2.6.0, a
  `verified` of 2.6.5 and no `maximum`. `scripts/module.mjs:88-89,447-461` only
  warns below 2.6.0. By reading, 2.10.5 loads without a refusal. How Foundry
  labels the unverified pairing in the package UI **needs a live look.**
- Dice So Nice: master declares a `minimum` of 14 and a `verified` of 14.368.

---

## 3. Dependency table

Status words: **unchanged**, **moved**, **renamed**, **changed behaviour**,
**removed**, **new**.

### 3.1 Monkey-patches (the `PATCHES` table in `scripts/patches.mjs`)

| Module | Relies on | 2.6.5 | 2.10.5 | Consequence |
| --- | --- | --- | --- | --- |
| `scripts/critical.mjs:39-111`, probe in `scripts/patches.mjs:38-49` | static `game.system.api.dice.DualityRoll.addDualityResourceUpdates(config)`; `config.resourceUpdates` is a `ResourceUpdateMap` whose `addResources` replaces entries | `module/dice/dualityRoll.mjs:309`, called by class name at :368; map at `module/data/action/baseAction.mjs:494-533` | **unchanged.** Body identical at `module/dice/dualityRoll.mjs:278-316`, called as `DualityRoll.addDualityResourceUpdates(config)` at :333. Export path is `daggerheart.mjs:135-143` and `module/dice/_module.mjs:5`. `CONFIG.Dice.daggerheart.DualityRoll` is the same class object (daggerheart.mjs:31-37). Map unchanged at `baseAction.mjs:490-529` | The patch still takes effect. |
| `scripts/forced-roll.mjs:86-130` | an own-property shadow of `roll.evaluate` on the hook's roll instance, plus core `CONFIG.Dice.randomUniform` | `D20Roll` has no `evaluate` of its own | **changed.** `D20Roll#evaluate` added at `module/dice/d20Roll.mjs:197-208`; it calls `super.evaluate` and then sets SFX. Hope, Fear, advantage and disadvantage dice now carry modifiers `h` / `f` / `a` / `d` (`module/dice/die/*.mjs`, `BaseDie.MODIFIERS`), which run after the dice are rolled | By reading, the instance shadow still wins over the new prototype method. The assumption "the first `randomUniform` call is the Hope die" is core behaviour, so it **needs the live probe** on 2.10.5. |
| `scripts/no-scrolling-text.mjs` | core `InterfaceCanvasGroup.prototype.createScrollingText` | - | **new caller:** `DhActiveEffect#_displayScrollingStatus` (`module/documents/activeEffect.mjs:286`) goes through `canvas.interface.createScrollingText` | Already covered by the same patch. |
| `scripts/sheet.mjs:537-560` (render guard), hooks at `scripts/sheet.mjs:68-72` | class name `CharacterSheet`, so the `renderCharacterSheet` and `closeCharacterSheet` hooks fire | `module/applications/sheets/actors/character.mjs` | **renamed file** (`character-sheet.mjs`); class name unchanged | Works. |
| `scripts/motion.mjs`, `scripts/voice.mjs`, `scripts/iso-shield.mjs` rows | core or third-party code | - | not Daggerheart | Out of scope. |

### 3.2 Daggerheart hooks the module listens to

| Module | Hook | 2.6.5 | 2.10.5 | Consequence |
| --- | --- | --- | --- | --- |
| `scripts/forced-roll.mjs:77` | `daggerheart.postDualityRollConfiguration(roll, config, message)` | `module/dice/dhRoll.mjs:75` | **unchanged**, `module/dice/dhRoll.mjs:76`; same arguments | Works. |
| `scripts/projects-ui.mjs:24`, `scripts/hud.mjs:200` | `renderDhCountdowns` | `module/applications/ui/countdowns.mjs` | **unchanged.** Class `DhCountdowns`, `id: 'countdowns'`, same classes (:9-11). `ui.countdowns` is still created in `ready` (daggerheart.mjs:376-378) | Works. |
| `scripts/sheet.mjs:68,72` | `renderCharacterSheet`, `closeCharacterSheet` | - | **unchanged** class name | Works. |
| `scripts/roll-dialog.mjs:30-33,68-72` | core `renderApplicationV2` / `closeApplicationV2`, recognised by the class `roll-selection` | `module/applications/dialogs/d20RollDialog.mjs` | **unchanged**: `classes: ['daggerheart','dialog','dh-style','views','roll-selection']` (:28) | Works. |
| `scripts/murder.mjs:3808` | `app.constructor.name === "D20RollDialog"` | - | **unchanged** class name | Works. |

Daggerheart hooks available but unused by the module keep the same names:

- roll hooks: `daggerheart.preRoll<X>`, `daggerheart.post<X>RollConfiguration`
  and `daggerheart.postRoll<X>` (`module/dice/dhRoll.mjs:59,76,109`)
- action hooks: `daggerheart.pre/post<Key>Action` and
  `daggerheart.pre/postUseAction` (`module/data/action/baseAction.mjs:241-274`)
- damage and healing: `daggerheart.preTakeDamage`, `postCalculateDamage`,
  `postTakeDamage`, `preTakeHealing` and `postTakeHealing`
  (`module/documents/actor.mjs:772-884`)

### 3.3 Data paths on actors, items and settings

| Module | Path | 2.6.5 | 2.10.5 | Consequence |
| --- | --- | --- | --- | --- |
| everywhere; about 180 reads and writes of `system.resources.{hitPoints,stress,hope}.{value,max}` | base resources | prepared in `ResourcesField.initialize` (`module/data/fields/actorField.mjs:67-96`) | **moved:** now prepared in `DhCreature.prepareBaseData` (`module/data/actor/creature.mjs:77-107`) and clamped by `clampResources` (:114). The `max` / `value` logic is the same by reading | No change expected. |
| `scripts/resources.mjs:38-61`; writes in `scripts/actions.mjs:171-345`, `scripts/monocub.mjs:466`, `scripts/monokuma.mjs:85`, `scripts/murder.mjs:1875,2073`; guard in `scripts/resource-guard.mjs:49-55` | `system.resources.actions`, registered into `CONFIG.DH.RESOURCE.character.custom` and `.all` | `refreshConfig` at `i18nInit` (daggerheart.mjs:267-269) | Registration **unchanged**: `i18nInit` at daggerheart.mjs:304-316, `Homebrew.refreshConfig` at `module/data/settings/Homebrew.mjs:236-252`, `.all` rebuilt from `{...homebrew, ...custom, ...base}`. **New and destructive:** `_cleanupOptionalResources` (`module/documents/actor.mjs:230-257`, called at :1399 and :1408) | **BROKEN.** See section 6, E24-1. |
| `scripts/action-rolls.mjs:1030`, `scripts/level-up.mjs:399,529-530`, `scripts/character.mjs:167` | `system.traits.<dh>.value` | `attributeField` | **unchanged** | Works. |
| `scripts/level-up.mjs:502,534-539`, `scripts/character.mjs:170` | `system.experiences.<id>.{name,value,description,core}` | `module/data/actor/character.mjs:59-66` | **unchanged**, same lines | Works. |
| `scripts/sheet.mjs:2050-2070`, `scripts/season-setup.mjs:760` | `system.biography.*`, `system.notes` | - | **unchanged** (no diff in schema or template) | Works. |
| `scripts/analyze.mjs:93`, `scripts/truth-bullets.mjs:831`, and others | item `system.description`, `system.quantity` | - | **unchanged** fields. The description helpers changed signature; the module does not call them (0 hits) | Works. |
| none (0 hits) | `system.bonuses.*`, `system.rules.*` | persisted, with `bonuses.roll.{attack,trait,...}` | **changed:** `persisted: false`, and `bonuses.roll` collapsed to a single field | No effect on the module. |
| `scripts/states.mjs:148,223`, `scripts/chapter.mjs:120,297` | status ids `vulnerable`, `deathMove`, `defeated`, `unconscious`, `dead` | `module/config/generalConfig.mjs` | **unchanged** | Works. |
| `scripts/states.mjs:109-138`, `scripts/reroll.mjs:126-146,169-172` | setting `daggerheart.Automation`: `hopeFear.{gm,players}`, `countdownAutomation`, `vulnerableAutomation`, `defeated.enabled` | direct `game.settings.get` everywhere | Fields **unchanged** (`module/data/settings/Automation.mjs:9-28,74-78`). **Removed** fields `actionPoints` (migrated to `VariantRules.actionTokens` by `2_9_3.mjs`) and `roll.roll`; the module uses neither. **Changed behaviour:** Daggerheart now reads a cache, `game.system.settings.automation`, built at `i18nInit` (daggerheart.mjs:308-313) and refreshed by `onChange -> handleChange` (`module/systemRegistration/settings.mjs:88-91`, `Automation.mjs:204-206`) | The module's switch-off in `scripts/states.mjs:126` uses `game.settings.set`, so by reading the cache follows it. That `onChange` reaches every client before the first roll **needs the live probe.** |
| `scripts/projects.mjs:461-545,1093-1319`, `scripts/calls.mjs:579`, `scripts/season-setup.mjs:783`, `scripts/observe.mjs:333` | setting `daggerheart.Countdowns`: `countdowns.<id>.{name,img,type,ownership,progress}`, including `ownership[userId] = 0` (NONE) and a `default` key | `defaultOwnership` field (`module/data/countdowns.mjs:10`); per-countdown ownership choices include NONE (`simpleOwnershiplevels`, :106); `getUserLevel` falls back to `defaultOwnership` (:208) | **changed behaviour** (since 2.7.0): `defaultOwnership` **removed**. New `hidden` boolean (`module/data/countdowns.mjs:117`). Ownership choices are now `countdownOwnershipLevels` = `{-1, 2, 3}`; **NONE is no longer a valid value** (`module/config/generalConfig.mjs:810-814`). `migrateData` rewrites any NONE to INHERIT and sets `hidden: true` (`countdowns.mjs:54-95`, see :84). INHERIT now resolves to OBSERVER, or to NONE when `hidden` (`getUserLevel`, :227). The tray filters on `visible` (`module/applications/ui/countdowns.mjs:138-147`) | **At risk.** See section 6, E03-2. |
| `scripts/diagnostics.mjs:122-146` | setting `daggerheart.Appearance` `.diceSoNice` / `.diceSoNiceData` | `module/data/settings/Appearance.mjs:50,92` | **removed** in 2.10.0; the Dice So Nice data moved into Dice So Nice itself (migration `2_10_0-dsn.mjs`) | The dice diagnostic always prints "Could not read Daggerheart's Appearance settings." See E28-2. |
| `scripts/reroll.mjs:104` | `CONFIG.DH.GENERAL.getDiceSoNicePresets` | `module/config/generalConfig.mjs:784` | **removed** in 2.8.0; 0 hits in 2.10.5 | Optional chaining: no throw, nothing painted. See E28-1. |
| `scripts/reroll.mjs:141-144` | `game.system.api.applications.ui.DhCountdowns.updateCountdowns({type, undo})`, `CONFIG.DH.GENERAL.countdownProgressionTypes.fear.id` | `module/applications/ui/countdowns.mjs:329` | **unchanged** signature (:329); it now reads the automation cache (:331) | Works. |
| `scripts/projects-ui.mjs:146-157` | `CONFIG.DH.FLAGS.userFlags.countdownMode`, `CONFIG.DH.GENERAL.countdownAppMode` | - | **unchanged** (`module/config/flagsConfig.mjs:25`, `generalConfig.mjs:835-838`) | Works. |
| `scripts/player-status.mjs:438` | i18n key `DAGGERHEART.GENERAL.hope` | present | **unchanged** | Works. |
| - | Actor and Item document classes | `DhpActor`, `DHItem` | **renamed** `DhActor`, `DhItem` (daggerheart.mjs); new `DhFolder`; new Item type `transformation` | The module never names these classes (0 hits). |

### 3.4 DOM and CSS selectors

**Measured at token level.** The module targets 495 distinct class and
attribute tokens, excluding its own `drpg-*`. They come from CSS selectors in
`styles/*.css` and from `querySelector`, `closest` and `matches` in
`scripts/*.mjs` (excluding `tests.mjs`). Against every class and attribute token
in each Daggerheart tree (templates, JavaScript strings, LESS):

- 268 exist in both trees.
- **0 exist in 2.6.5 but not in 2.10.5.**
- 4 exist only in 2.10.5: `addNewItem`, `fa-rotate-left`, `fa-table-list`,
  `theme`.
- 223 exist in neither: Foundry core, Font Awesome, other modules, and
  `data-action` values defined in JavaScript.

A token-level pass can be clean while nesting is wrong, so the three surfaces
the module injects into were also read by hand:

- **Roll window.** `templates/dialogs/dice-roll/rollSelection.hbs` and
  `header.hbs` are byte-identical between the tags (`git diff` is empty).
  `D20RollDialog` changed 3 lines, all in cost labels, which now go through
  `getAllResources()[x.key].label` (`d20RollDialog.mjs:94`). Every selector in
  `scripts/roll-dialog.mjs` is present in 2.10.5: `button.submit-btn i.fa-dice`,
  `.advantage-chip` and `.disadvantage-chip`, `[data-action=selectExperience]`,
  `select[name=trait]`, `input[name=extraFormula]`,
  `select[name=selectedMessageMode]`, `input[name^="costs."]`,
  `.roll-dialog-container`, and `[data-action=toggleReaction]` (in
  `header.hbs:5`). The Daggerheart LESS for the dialog is unchanged.
- **Character sheet.** Template changes:
  - `header.hbs`: 2 lines, domain tooltip and heritage tooltip.
  - `sidebar.hbs`: 2 lines, `usedUnarmed` became `usesUnarmed` plus
    `system.attack`.
  - `biography.hbs` and `inventory.hbs`: unchanged.
  - `features.hbs`: rebuilt on its own `fieldset.drop-section > legend +
    ul.items-list`. Group legends can now hold `a[data-action=editDoc]` links
    to the ancestry, community or transformation item.
  - `loadout.hbs`: card view is an inline partial.
  - The effects tab now uses the global `templates/sheets/global/tabs/tab-effects.hbs`.
    The part id and `data-tab="effects"` are unchanged (`character-sheet.mjs:148-151`).

  By reading, the module's selectors still resolve:

  - `scripts/sheet.mjs:806-831` (feature creators): feature rows still carry
    `li.inventory-item[data-type="feature"]` (`inventory-item-V2.hbs:25`).
    `styles/danganronpa.css:5972` still hides `.features-sections` once no
    `.items-list li` is left.
  - `scripts/sheet.mjs:3152-3160` (effects tab takeover) and `:3267-3283`
    (action panel).
  - `scripts/sheet.mjs:1883` (equipment list), `:1735` (status bars), `:604`
    (Hope), `:1116` (traits), `:2050` (biography).

  The Daggerheart LESS for the character sheet changed 2 lines.
- **Countdown tray (Projects).** Every selector in
  `scripts/projects-ui.mjs:82-110,221-303,348-350` is present in
  `countdowns-view.hbs` and `parts/countdowns.hbs`: `.header-type-toggles`,
  `[data-action=toggleViewMode]`, `[data-action=editCountdowns]`,
  `.countdowns-header`, `.countdown-container[data-countdown]`, `.progress-tag`
  and `.countdown-content > header`. One difference: `.countdowns-container` is
  now rendered only when a visible type has entries. The Daggerheart LESS for
  the tray changed 3 lines.

Other markup changes that reach module surfaces:

- Daggerheart now adds `themed theme-dark` to `adversaryRoll`, `damageRoll`,
  `dualityRoll` and `fateRoll` chat cards, after the core render hook
  (`module/documents/chatMessage.mjs:45-48`). The module already renders its
  surfaces dark (`styles/danganronpa.css:595-640`). What this does to a card
  **needs a screenshot.**
- The character sheet gains header controls "Portrait artwork" and "Refresh
  from compendium" (`module/applications/sheets/api/base-actor.mjs:67-83`).
  A right-click on the portrait opens an image popout. It is wired by
  `addEventListener('contextmenu')` (:167), not by `data-action`, so
  `scripts/anonymity.mjs`'s disarm pass, which strips `data-action`, does not
  remove it. Name and portrait are "shown" in that file's own design, so this
  is not a leak by that design.
- Daggerheart styles overall: 62 files, +2230 / -1099. The `.dh-style`
  typography moved from a mixin (`styles/less/utils/fonts.less`) into
  `styles/less/global/global.less`. The Google Fonts import became local
  `@font-face` rules. The rules read the same, but **the rendered result needs a
  screenshot.** Per `CLAUDE.md`, the numbers can be clean and the picture wrong.

### 3.5 Translation overrides

`lang/en.json` and `lang/pl.json` each override 94 `DAGGERHEART.*` keys. All 94
exist in 2.6.5. **92 still exist in 2.10.5.** The English text of those 92 is
unchanged, so the overrides land where they did.

Gone in 2.10.5, so these overrides are dead:

- `DAGGERHEART.UI.Countdowns.noPlayerAccess`
- `DAGGERHEART.APPLICATIONS.CountdownEdit.defaultOwnershipTooltip`

2.10.5 adds 395 keys and removes 37. None of the new keys is overridden. That
includes:

- 15 new countdown keys, such as "Hidden", "Reveal Countdown", "Hide Countdown"
  and "This countdown is hidden to all players."
- 9 new strings that say "Fear".

They appear in Daggerheart's own English wherever Daggerheart draws them.

---

## 4. The GM relay: `DhGMUpdate` / `DhGMCreate` in 2.10.5

### 4.1 Where it is

- Socket listener: `game.socket.on('system.daggerheart', handleSocketEvent)`,
  registered during `init` at daggerheart.mjs:278 (2.6.5: daggerheart.mjs:250).
- `handleSocketEvent({ action, data })`: `module/systemRegistration/socket.mjs:3-26`.
  It destructures only the payload. **Foundry's second handler argument, the
  sender's user id, is not read.** The module's own note on that argument is at
  `scripts/gm-bridge.mjs:428-430`.
- It turns socket messages into Hooks: `Hooks.callAll('DhGMUpdate', data)` (:6)
  and `Hooks.callAll('DhGMCreate', data)` (:9). The hook payload carries no
  sender either.
- GM-side listeners are added by `registerSocketHooks()` (:56-116), called in
  `ready` at daggerheart.mjs:391 (2.6.5: :337).
- Sender side: `emitAsGM` (:131-138). A non-GM's request always goes over the
  socket, even for a document that player owns.

### 4.2 Every action it accepts in 2.10.5

| Socket `action` | Sub-action | 2.10.5 line | What the GM client does | Sender check |
| --- | --- | --- | --- | --- |
| `DhGMUpdate` | `DhGMUpdateDocument` | socket.mjs:61-63 | `(await fromUuid(data.uuid)).update(data.data)`, on **any** UUID with **any** data | none |
| `DhGMUpdate` | `DhGMUpdateEffect` | :64-67 | `EffectsField.applyEffects.call(document, data.data)`: applies the effects of the document at `data.uuid` to the targets in `data.data`, as GM (`module/data/fields/action/effectsField.mjs:47`) | none |
| `DhGMUpdate` | `DhGMUpdateSetting` | :68-70 | `game.settings.set('daggerheart', data.uuid, data.data)`: **any** `daggerheart.*` setting | none |
| `DhGMUpdate` | `DhGMUpdateFear` | :71-80 | sets `ResourcesFear` to `data.data`, clamped to `[0, homebrew.maxFear]` | none |
| `DhGMUpdate` | `DhGMUpdateCountdowns` | :81-84 | `game.settings.set('daggerheart','Countdowns', data.data)`: **replaces the whole setting** | none |
| `DhGMUpdate` | `DhGMUpdateSaveMessage` | :85-93 | `SaveField.updateSaveMessage(result, message, token)` on any message id (`saveField.mjs:138-145`) | none |
| `DhGMUpdate` | any, with `data.refresh` | :96-102 | re-broadcasts a `DhRefresh` to everyone and calls it locally | none |
| `DhGMCreate` | any `documentType` | :106-115 | `getDocumentClass(documentType).create(data, { parent: game.scenes.get(scene) })`: **any document type**, created as GM, not awaited | none |
| `DhFearUpdate` | - | :11-12 | `Hooks.callAll('DhFearUpdate')` on every client | none; UI only |
| `DhRefresh` | - | :14-15 | `Hooks.call('DhRefresh', data)`: re-renders tray, browser and dialogs | none; UI only |
| `DowntimeTrigger` | - | :17-18 | hook -> `Party.downtimeMoveQuery` (`party-sheet.mjs:374-380`): opens a downtime window if the receiving client owns `actorId` | owner check on the receiver only |
| `DhTagTeamStart`, `DhGroupRollStart` | - | :20-24 | hooks at daggerheart.mjs:434-456: open the tag-team or group-roll dialog for `data.partyId` on every client | none; UI only |

Separate from the socket: `CONFIG.queries.armorSlot` and
`CONFIG.queries.reactionRoll` are registered at socket.mjs:118-121 (2.6.5:
:122-125). Those use Foundry's own `User#query` routing.

### 4.3 What changed from 2.6.5

`git diff 2.6.5 2.10.5 -- module/systemRegistration/socket.mjs` touches two
behaviours:

1. `DowntimeTrigger` now goes through a hook instead of a direct call.
2. `UpdateFear` reads `maxFear` from the cache instead of `game.settings`.

**No sender validation was added. There is no primary-GM check, and no
allow-list of UUIDs, setting keys or document types.**

### 4.4 Consequences

By reading; nothing was executed here.

- **Any player can make a connected GM perform any update.** For example:

  ```js
  game.socket.emit('system.daggerheart', {
    action: 'DhGMUpdate',
    data: { action: 'DhGMUpdateDocument', uuid: game.user.uuid, data: { role: 4 } }
  })
  ```

  The GM client runs `User#update({ role: 4 })`: the player grants
  themselves Gamemaster. Same code path as 2.6.5 (socket.mjs:57-63 there too).
- **Any player can make the GM create any document.** Through `DhGMCreate` with
  `documentType: 'User'` and `role: 4`, a player can create a new Gamemaster
  account. With `ChatMessage`, a player can post a message whose author is the
  GM. **Server-side permission outcomes need the live probe.**
- **Any player can rewrite any world `daggerheart.*` setting.** That includes
  `Countdowns` (every Project, secret murder plans included), `Automation` (it
  can switch back on the Vulnerable and Defeated automation that
  `scripts/states.mjs` turns off), `Homebrew`, `LevelTiers`, `ResourcesFear` and
  `LastMigrationVersion`. World-scoped settings registered in 2.10.5:
  `SpotlightRequestQueue`, `VariantRules`, `Automation`, `Metagaming`,
  `Homebrew`, `LastMigrationVersion`, `LevelTiers`, `ResourcesFear`,
  `Countdowns`, `CompendiumBrowserSettings`, `SpotlightTracker`, `ActiveParty`.
- **The module's resource guard does not stand in the way.**
  `scripts/resource-guard.mjs:122-126` returns early when `game.user.isGM`. A
  relayed write executes on the GM's client, so the guard never inspects it.
- **Every client with `isGM` executes each request, not one primary GM.** That
  includes Assistant GMs (socket.mjs:58, :107). With two GMs online,
  `DhGMCreate` creates two documents and `UpdateCountdowns` writes twice.
- **A module cannot filter by sender at the hook level**, because the
  `DhGMUpdate` / `DhGMCreate` hook payload has no sender. Enforcing a check
  means intercepting the `system.daggerheart` socket listener itself. The
  handler is not exported on `game.system.api`; that object holds only
  `applications, data, models, documents, macros, dice, fields`
  (daggerheart.mjs:135-143). **Whether it can be replaced cleanly needs the
  live probe.**

### 4.5 Legitimate traffic an E03 guard must keep working

These module flows reach the relay today. Any allow-list has to pass them.

| Module call | Daggerheart path | Relay sub-action |
| --- | --- | --- |
| `scripts/action-rolls.mjs:1007` `updates.updateResources()`; `scripts/reroll.mjs:183` `target.modifyResource(...)` | `DhActor#modifyResource` (`actor.mjs:930-1005`) | `UpdateDocument` on the sender's actor with `system.resources.*` (:986), and on the sender's items with cost paths (:995) |
| Daggerheart's own pipeline on every duality roll with `countdownAutomation` on (`dualityRoll.mjs:318-331`), and `scripts/reroll.mjs:141` | `DhCountdowns.updateCountdowns` (`countdowns.mjs:329-363`) | `UpdateCountdowns` carrying the sender's **whole snapshot** of the setting (:358) |
| a Fear result in a player's roll (`modifyResource` case `fear`) | `DhFearTracker.updateFear` (`fearTracker.mjs:195-201`) | `UpdateFear` |
| Daggerheart features only: saves, party rolls, region placement, scene environments, countdown actions | `chatMessage.mjs:276,383`, `groupRollDialog.mjs:250`, `tagTeamDialog.mjs:291`, `sceneNavigation.mjs:71`, `countdownField.mjs:82` | `UpdateSaveMessage`, `UpdateDocument` on a party actor or scene, `DhGMCreate` `Region`, `UpdateCountdowns` |

**Pre-existing in 2.6.5 and unchanged:** `CountdownField.execute`
(`module/data/fields/action/countdownField.mjs:38-96`) builds
`data = { countdowns: {} }` holding only the new countdowns. For a player it
relays that object. The GM handler writes it as the **entire** `Countdowns`
setting (socket.mjs:82). By reading, a player running any Daggerheart action
that has a countdown part would wipe every existing countdown, which here means
every Project. Whether any item in this game carries such an action **needs the
live probe.**

---

## 5. The roll-building flow in 2.10.5 vs 2.6.5

| Step | 2.6.5 | 2.10.5 | Change |
| --- | --- | --- | --- |
| `DhActor#rollTrait(trait, options)` | `actor.mjs:568` | `actor.mjs:657-686` | Same signature. `event: event`, a read of the **global** `window.event`, became `event: null`; the options spread still overrides it. Effective title and headerTitle are the same. |
| `DhActor#diceRoll(config)` -> `rollClass.build(config)` | `actor.mjs:560` | `actor.mjs:649-655` | unchanged |
| `DHRoll.build` | `dhRoll.mjs:31` | `dhRoll.mjs:32-43` | unchanged; `config.evaluate === false` still skips evaluation |
| `DualityRoll.buildConfigure` (a guaranteed-critical effect forces `dialog.configure = false`) -> `DHRoll.buildConfigure` | `dualityRoll.mjs:192`, `dhRoll.mjs:52` | `dualityRoll.mjs:192-205`, `dhRoll.mjs:53-81` | unchanged. Hooks `daggerheart.preRoll` and `daggerheart.preRollDuality` (`Hooks.call`, cancellable, :59) -> `applyKeybindings` -> `temporaryModifierBuilder` -> `createRollInstance` -> `D20RollDialog.configure` if `config.dialog.configure !== false` -> hooks `daggerheart.postRollConfiguration` and `daggerheart.postDualityRollConfiguration` (:76; returning `false` aborts with `[]`) |
| `D20Roll.applyKeybindings` | `d20Roll.mjs:54`, default `normal: true` | `d20Roll.mjs:54-78`, default **`normal: false`** (since 2.7.1) | **Changed behaviour.** With no event, 2.6.5 skipped the window and 2.10.5 opens it. The module always passes `event` and `dialog.configure` explicitly (`scripts/action-rolls.mjs:674-693`), so its action rolls are unaffected. |
| Roll window `D20RollDialog.configure` | `d20RollDialog.mjs:236` | `d20RollDialog.mjs:237` | unchanged apart from cost labels |
| Experience selection (`selectExperience` appends to `config.experiences`) | - | - | unchanged; `scripts/roll-dialog.mjs:865-884` still holds it to one |
| `buildEvaluate`: `roll.evaluate()`, then `config.roll = {...roll.options.roll, total, formula, dice}` plus `hope`, `fear`, `rally`, `result.duality` | `dhRoll.mjs:87`, `dualityRoll.mjs:236` | `dhRoll.mjs:88-100`, `dualityRoll.mjs:213-243` | unchanged. The module's readers still match: `dualityOf` (`scripts/action-rolls.mjs:843`), `traitRolled` (:758), `findDualityDice` (`scripts/despair-award.mjs:200`) |
| `buildPost`: hooks `daggerheart.postRoll` and `daggerheart.postRollDuality`, then `toMessage` with `messageMode: config.selectedMessageMode`, then `dualityUpdate` and `handleTriggers` | `dualityRoll.mjs:269` | `dualityRoll.mjs:246-251`, `dhRoll.mjs:107-116` | **Changed.** `setDiceSoNiceForDualityRoll` removed. Dice are coloured by Dice So Nice "roles" detected from die modifiers `h` / `f` / `a` / `d` (`module/config/dsnConfig.mjs:65-102`, registered at daggerheart.mjs:416-428) |
| Hope and Fear: `addDualityResourceUpdates` | `dualityRoll.mjs:309` | `dualityRoll.mjs:278-316` | unchanged (this is the module's patch point) |
| `dualityUpdate`: countdowns, then resources | `dualityRoll.mjs:349` | `dualityRoll.mjs:318-334` | Reads the automation cache. The "lose the spotlight on a failed or Fear roll" block was **removed**; the module does not use spotlight. |
| `handleTriggers` | `dualityRoll.mjs:284` | `dualityRoll.mjs:253-276` | The `fearRoll` trigger now fires **only for `actionType === 'action'`**. No effect on the module: its sheet trait rolls are forced to `reaction`. |
| Resources applied by the caller: `config.resourceUpdates.updateResources()` -> `modifyResource` -> relay | - | `baseAction.mjs:523-528` | unchanged. `clear: true` on a non-reversed resource now fills it to max instead of 0 (`actor.mjs:949`); the module never sends `clear` (0 hits). |
| `DualityRoll#reroll` | `dualityRoll.mjs:381` | `dualityRoll.mjs:336-354` | DSN appearance painting removed; `updateResourcesForDualityReroll` unchanged (`dice/helpers.mjs` has no diff). The module does its own settling (`scripts/reroll.mjs:97-149`). |
| `isCritical`, `withHope`, `withFear` before evaluation | return `undefined` | return `false` | The module wraps these in `Boolean()` or tests them for truth: no effect. |
| `DualityRoll` constructor, advantage faces | reads `rules.roll.defaultAdvantageDice` | reads `rules.roll.advantageFaces` (`dualityRoll.mjs:15`), which no actor schema defines (the character keeps `defaultAdvantageDice`, `character.mjs:289`) | **Daggerheart regression.** A cloned or rebuilt duality roll always gets d6 advantage dice. The module fixes the advantage die at d6 by rule, so no effect unless a GM changes an actor's default. |
| Multi-die advantage | `modifiers = ['kh']` | `modifiers: ['a']`, then overwritten by `['kh']` when `advantageNumber > 1` (`dualityRoll.mjs:152-155`) | The Dice So Nice `advantage` role is not detected on multi-die advantage. Cosmetic. |

Switches that still exist unchanged, and are the only built-in seams for E28:

- `config.skips.createMessage` (`dhRoll.mjs:36,112`)
- `config.skips.triggers` (`dualityRoll.mjs:254`)
- `config.skips.resources` (:283)
- `config.skips.updateCountdowns` (:320)
- `config.evaluate === false`
- `config.dialog.configure`

The whole pipeline runs on the roller's client, dice included; the module's
own Free Critical depends on that. The only GM-to-owner request/response
channel Daggerheart uses is `actor.owner.query('reactionRoll' | 'armorSlot')`.
There is no "GM rolls for the player" path in either version.

---

## 6. Damage list

Severity words: **BROKEN** (a code path is certain to misbehave), **AT RISK**
(likely or conditional, needs the live probe), **DEAD** (code that now does
nothing, with no crash), **COSMETIC**.

### E24 - the character sheet

**E24-1 BROKEN, high. The Actions resource is deleted whenever the acting
client updates or deletes an item on a character.** Since 2.9.0, commit
`62627a84`, "[Feature] Feature Resources (#2276)":

- `DhActor#_onUpdateDescendantDocuments` and `_onDeleteDescendantDocuments`
  (`module/documents/actor.mjs:1390-1410`) call `_cleanupOptionalResources()`
  (:230-257) when `collection === 'items'` and the current user made the change.
- That method issues `actor.update({'system.resources': {<key>: _del}})` for
  every key in `_source.resources` that is not one of:
  - in `CONFIG.DH.RESOURCE.character.base`, a frozen object holding only
    `hitPoints`, `stress` and `hope` (`resourceConfig.mjs:16-38`);
  - granted by a feature's `actorResources`;
  - a Homebrew-setting resource.
- The module registers `actions` only into `custom` and `all`
  (`scripts/resources.mjs:55-56`), so `actions` qualifies for deletion.
- `DhCreature.prepareBaseData` (`creature.mjs:77-107`) then re-seeds it from
  `ACTIONS_DEFINITION`: `value = initial = 2`, `max = 2`
  (`scripts/config.mjs:253`).

Expected effect, by reading: any item change on a character refills that
character's Actions to 2/2. It also drops any time-of-day total the module
wrote to `actions.max` (`scripts/actions.mjs:344-345`).

Triggers include:

- Daggerheart's own equip, vault and item-use updates;
- the module's own 6 `update/deleteEmbeddedDocuments("Item", ...)` sites
  (`scripts/chapter.mjs:157,826`, `scripts/inventory.mjs:412`,
  `scripts/migrate.mjs:297`, `scripts/season-setup.mjs:1002,1078`);
- about 31 `item.update` / `setFlag` / `delete` sites.

`scripts/resource-guard.mjs:49-55` guards `...actions.value` and
`...actions.max`, not the key itself. By reading, it does not catch a
whole-key deletion.

Needs the live probe: update any item on a character with 1/2 Actions and read
`system.resources.actions` before and after. The headless suite cannot show this
(see the harness note at the top: it stubs 2.6.5).

Options, none tested:

- register Actions as a Homebrew resource;
- wrap `_cleanupOptionalResources` on `CONFIG.Actor.documentClass.prototype`;
- grant the key through a feature's `actorResources`.

**E24-2 no damage expected.** 2.10.5 only lists resources marked `isExtra`, or
Homebrew resources, in the header pop-out (`availableExtraResources`,
`creature.mjs:37-45`; `character-sheet.mjs:294,1169`). Actions no longer appears
there. The module already hides that pop-out (`styles/danganronpa.css:846-853`).

**E24-3 COSMETIC or needs a screenshot.** New header controls, a right-click
portrait popout outside `data-action`, rebuilt feature legends with `editDoc`
links, `.dh-style` typography moved, fonts made local. The token-level selector
check found nothing missing (section 3.4). What the sheet looks like needs a
screenshot.

### E03 - the GM socket bridge and the Daggerheart relay

**E03-1 AT RISK, security, unchanged from 2.6.5.** The relay accepts any
update, any Daggerheart setting write and any document creation from any
client. It executes on every GM and Assistant client, with no sender check
(section 4). The module's resource guard is bypassed by construction.
Confirmed by reading 2.10.5 `module/systemRegistration/socket.mjs:3-26,56-116`.
Not executed.

**E03-2 AT RISK, high, secrecy of Projects.** The countdown ownership model
changed in 2.7.0: `defaultOwnership` removed, `hidden` added, and NONE is no
longer a valid ownership value (section 3.3). The module writes explicit NONE
per player (`ownershipMap`, `scripts/projects.mjs:1093-1101`) and a `default`
key. Two possible outcomes, and which one happens is Foundry core's business
(**needs the live probe**):

- (a) `game.settings.set` runs `DhCountdowns.migrateData` before validating.
  The write lands as `hidden: true` plus INHERIT, and secrecy holds.
- (b) Strict validation sees the raw 0. Every secret-project write throws:
  `createProject` (:490-539), `makeSecret`, `shareWith`, `unshareWith` and
  `resealSecretProjects`.

Even under (a), three things change:

- `resealSecretProjects` (:1120-1152) never converges. It compares 0 against the
  stored -1, so it rewrites every secret project on each load and on each
  `createUser`, and logs "Re-sealed N" every time.
- `revealProject` (:1212-1230) leaves `hidden: true`. A player who joins after
  a reveal does not see the revealed project in the tray.
- The GM's tray has new "Reveal Countdown" and "Hide Countdown" context-menu
  entries (`countdowns.mjs:375-394`, new; 2.6.5 had only Delete). They flip
  `hidden` without touching the module's `projectMeta`.

The comments at `scripts/projects.mjs:1079-1091,1206-1210,1245-1250` describe
the 2.6.5 fallback and would be wrong on 2.10.5.

**E03-3 AT RISK, conditional, pre-existing.** `CountdownField.execute`, relayed
for a player, overwrites the whole `Countdowns` setting with only the new
countdowns (section 4.5). That would wipe every Project. It fires only if a
player uses a Daggerheart action that has a countdown part.

**E03-4 AT RISK, conditional, pre-existing.** With `countdownAutomation` on,
every player duality roll relays the player's whole snapshot of `Countdowns`
(`countdowns.mjs:358`). That is a lost-update race against the GM's
`writeCountdown` (`scripts/projects.mjs:1307-1319`).

**E03-5 DEAD, 2 strings. Nearest stage; the Projects tray is this relay's UI.**
Two overridden keys no longer exist. 15 new countdown strings, such as "Hidden"
and "Reveal Countdown", appear un-rebranded (section 3.5).

### E16 - the roll window

**E16-1 no breakage found.** Template, header, class and classes are unchanged,
and every selector resolves (section 3.4).

**E16-2 AT RISK, probably pre-existing.** The sheet's trait roll passes the
real click event (`character-sheet.mjs:847`). `applyKeybindings`
(`d20Roll.mjs:54-78`) skips the window on Shift, Alt or Ctrl, and sets advantage
on Alt and disadvantage on Ctrl. When the window is skipped, the module's
render-hook rules never run: `forceReaction`
(`scripts/roll-dialog.mjs:192-214`) and the advantage lock (:417-465). So a
modifier-click on a sheet trait may roll as an `action`, earning Hope, or with
self-served advantage.

In 2.6.5, `rollTrait` read the global `event` (`actor.mjs:571`), which by
reading is the same click. So this is probably not new. The Despair side is
protected independently (`scripts/despair-award.mjs`). **Needs the live probe
on both versions.**

### E28 - the roll-building flow and "GM rolls the dice"

**E28-1 DEAD.** Dice colouring on reroll (`scripts/reroll.mjs:100-114`) calls
`CONFIG.DH.GENERAL.getDiceSoNicePresets`. That function has been gone since
2.8.0, so the block silently paints nothing.

In 2.10 the colours come from Dice So Nice roles, keyed on die modifiers that
survive `clone()`. By reading, rerolled dice should be coloured without this
block. Dice So Nice must provide `addRole`: master 6.3.1 does
(`module/Dice3D.js:104`). An older Dice So Nice would throw inside Daggerheart's
`diceSoNiceReady` hook (daggerheart.mjs:416-428). **Needs the live probe with
the table's installed Dice So Nice.**

Separately, `scripts/dice-sync.mjs` syncs only `dice-so-nice.settings`. Whether
per-user role appearance lives there **needs the live probe.**

**E28-2 DEAD diagnostic.** `scripts/diagnostics.mjs:122-146` reads
`Appearance.diceSoNice`, which was removed in 2.10.0. It now always reports
"Could not read Daggerheart's Appearance settings." It also tells the GM to
look under Daggerheart > Appearance > Dice So Nice, a menu that no longer
exists.

**E28-3 COSMETIC.** Daggerheart roll formulas now read like
`1d12h + 1d12f + 1d6a`. The module parses no Daggerheart formula. The only
`roll.formula` it prints is its own core roll, at `scripts/monocub.mjs:191`.
Multi-die advantage loses its `a` role (section 5). Daggerheart roll cards get
`themed theme-dark` (`chatMessage.mjs:47`).

**E28-4 AT RISK, low.** `DualityRoll` rebuilt through
`scripts/reroll.mjs:66-78` (`clone()` then `constructFormula`) now always uses
d6 advantage dice (section 5). The module wants d6 anyway.

**E28-5 note for the design, not damage.** Section 5 lists the hooks and
switches that exist in both versions:

- hooks `preRoll*`, `post*RollConfiguration`, `postRoll*`;
- `config.evaluate`;
- `config.skips.*`;
- `config.dialog.configure`.

The pipeline, the dice and `randomUniform` all run on the roller's client.
Resource writes for players go through the unauthenticated relay (E03-1).
Daggerheart's only request/response channel to a document owner is Foundry's
`User#query` (`CONFIG.queries.armorSlot` and `CONFIG.queries.reactionRoll`,
socket.mjs:118-121).

---

## 7. What this probe could not determine

Each of these needs the live probe on a Foundry 14.364 or 14.365 table:

1. Whether 2.10.5 runs on 14.364/14.365 at all. In particular:
   `game.data.systemUpdate` in the GM's Settings tab; the migrations
   `2_8_0-hotfix`, `2_9_1`, `2_9_3`, `2_10_0-dsn` and `2_10_0-refresh`, which run
   once on first load; and the Dice So Nice role registration.
2. E24-1: the Actions refill after an item update, and whether any migration
   run touches items on characters and so triggers it on the GM's client.
3. E03-2: what `game.settings.set('daggerheart','Countdowns', ...)` does with
   `ownership: 0`. Is it migrated, or rejected?
4. E03-1: server-side outcomes of the relay abuse (role change, `User`
   creation), and whether the system socket listener can be wrapped from a
   module.
5. E16-2: a modifier-click on a sheet trait, on 2.6.5 and on 2.10.5.
6. E28-1: dice colours on a fresh roll and on a reroll, with the installed Dice
   So Nice.
7. Every visual consequence in sections 3.4 and E24-3: screenshots of the sheet,
   the roll window, the Projects tray and the chat cards, before and after.
