# Daggerheart 2.12.8 against the module's contract (DH212, 12.11.2026)

What this is: every place the module changes or relies on in Daggerheart, read against the system's source at
tag **2.12.8** (commit `71c318de2506faaac89c3a6f37161b03e9787578`, `system.json` compatibility 14.364 - 14.370), with
2.10.11 (`a093ec5c0f`, the relay copy's tag) and 2.6.5 (the manifest's "verified") beside it. Read from a clone of
`github.com/Foundryborne/daggerheart` at those three tags. The module side is `origin/main` at 4dfac3a9 (1.2.108);
where 1.2.109 (PR #56, its branch at b30f9444, in CI on the day of writing) changes a row,
the row says so.

What it is not: a run. Nothing here was measured on a Foundry with 2.12.8 installed. The local gate's record for
1.2.108 (`audit/gate/local-gate.json`) has `sandbox.reachable: false` and `system: null`, so no part of the module has
been run against any real Daggerheart for that release; and on main the harness throws Daggerheart's dice from copies
of **2.10.5** (`audit/harness/lib/dh-dice/`) and relays through a copy of **2.10.11** (`dh-relay.mjs`). The 1.2.109
branch re-copies both from 2.12.8 (E76 C3b 0674ac33, with `move-context.mjs` and two helper files; E76 C1b ec6b04c3;
headers read on that branch, 12.11.2026). Every "same" below is a reading of source text, not a behaviour seen.

Where the list comes from: the contract register (`scripts/patches.mjs` `PATCHES`, the 16 rows whose `owner` is
`"daggerheart"`, with `SHEET_ANCHORS`), `scripts/enforced.mjs` (`ENFORCED`'s `dhWelcome`, `FOUNDRY_WRITES`' `automation`),
and a grep of `scripts/` (tests left out) for `game.system.api`, `CONFIG.DH`, `game.settings.get("daggerheart", ...)`,
`daggerheart.*` hooks and the actor's `system.*` paths. Rows marked "not in the register" are reaches the register does
not list.

## 1. The table

States: **same** (the target and the shape the module reads are the same text as in 2.10.11), **changed** (present,
different in a way the module's code meets), **gone**.

| # | Row (patches.mjs line) | Module side | 2.12.8 | State | What it means |
| --- | --- | --- | --- | --- | --- |
| 1 | `critical-rule` (:281) - `DualityRoll.addDualityResourceUpdates` | critical.mjs:74 reads `config.roll.isCritical` | dualityRoll.mjs:237-262 reads `config.evaluated?.isCritical / withHope / withFear`; `config.roll.isCritical` is written by nobody (2.10.11 wrote it at d20Roll.mjs:180 `data.isCritical = roll.isCritical`; 2.12.8's `D20Roll.buildEvaluate`, d20Roll.mjs:117-128, no longer does). The `config.rerolledRoll` branch (2.10.11 dualityRoll.mjs:290-301) is gone | **changed** | On 1.2.108 the wrapper is installed and the probe says ok (`ours: true`), but `!config?.roll?.isCritical` is always true, so it returns at once: a critical pays Daggerheart's own 1 Hope and clears 1 Sanity, not `CRITICAL`'s numbers. Silent: no notice. **1.2.109 fixes it** (critical.mjs reads `config.evaluated.isCritical` when there is one, R3605) |
| 2 | `roll-draw` (:317) - `DualityRoll.build` | roll-draw.mjs `reviewBuild` :104, `reviewTraitRoad` :155 | dhRoll.mjs:47-58 `build` still calls `buildConfigure`, `buildEvaluate`, `buildPost` in order; `getHooks` still answers `'Duality'` (dualityRoll.mjs:117-119). But `actor.rollTrait` (actor.mjs:727-743) builds a `MoveContext` (`MoveContext.build({...options, actor: this})`) | **changed** | On 1.2.108 `reviewTraitRoad` finds `MoveContext` in `rollTrait`'s source and the seam reads "changed": the draw stands down, every roll is thrown in the player's browser, the GMs are told once per version (D1). 1.2.109 carries the marks through `MoveContext` (roll-marks.mjs) and draws again. Part 2 has the timing of both roads |
| 3 | `MoveContext` itself - not in the register | action-pipeline.mjs, roll-dialog.mjs, forced-roll.mjs pass `drpgActionRoll`, `drpgRollNonce`, `drpgLoadedDie`, `drpgTraitByGm` and `dialog.configure` on `rollTrait`'s options | move-context.mjs:21-117: the constructor copies only the properties it names; `this.dialog = {}` (:88); `this.event ??= data.event` (:39) is the one caller object kept | **changed** (new in 2.12) | On 1.2.108 every module mark is dropped before the build: an action's roll is not known as an action's, the Loaded Die is not loaded (forced-roll.mjs:153 reads `config?.[LOADED_DIE]`), the window's `dialog.configure` is lost. 1.2.109's roll-marks.mjs hangs the marks on the event object and puts them back in `daggerheart.preRollDuality`. The register has no row for this road; it should (section 3, item 4) |
| 4 | Outcome on `config.roll` - not in the register | action-pipeline.mjs `dualityOf`, action-report.mjs's bar, forced-roll.mjs's face, all read `config.roll.total / result / hope / fear / isCritical` | dhRoll.mjs:98-107: `buildEvaluate` writes `config.roll = deepClone({...config.roll, ...roll.options.roll, breakdown})` and `config.evaluated = roll`; dualityRoll.mjs:198-202 adds nothing to `config.roll` (2.10.11 wrote `hope`, `fear`, `rally`, `result` at :213-239) | **changed** | On 1.2.108 the readers find no outcome on `config.roll`. 1.2.109's `fillRollFacts` (roll-marks.mjs) writes each fact back from `config.evaluated` where missing. The coordinator's open red (the total not on `config.roll`) is this row |
| 5 | `roll-dialog-context` (:299) - `D20RollDialog.prototype._prepareContext` | roll-dialog.mjs:215 `wrapPrepareContext`: wraps only when the method mentions `canRoll` and `.config.costs` | d20RollDialog.mjs:67-126: still its own `_prepareContext`, `context.canRoll = true` (:71), `this.config.costs.length` (:82) | **same** (the wrap's test) / **changed** (around it) | Installs. Around it: `config.experiences = []` and `config.costs ??= []` are no longer set by the window (2.10.11 :12, :84) but by `MoveContext` (move-context.mjs:54, :50); experiences are read from `config.data.experiences` (:110), not `config.data.system.experiences`; the actor is `config.actor` (:44), not `config.data.parent`. An experience's cost still carries `extKey` and `key: 'hope'` (:189-199), which `isExperienceCost` (roll-dialog.mjs:561) reads |
| 6 | `config.data.parent` - not in the register | roll-dialog.mjs:533 `actorOf`: falls back to `config.data?.parent` | move-context.mjs:95 `this.data = pick(this.getRollData(), ['experiences','traits','rules','action','criticalThreshold'])` - no `parent`, no `system` | **gone** | Only a fallback: `config.source.actor` is set from the resolved actor (:115), and that is tried first. Where it is empty (a companion's roll: `source.actor` is the companion), the next try is the speaker, then the user's character. `config.actor` (the partner) is never tried. Low |
| 7 | `config.data.rules.roll` - not in the register | roll-dialog.mjs:1256 | `rules` is one of the five picked keys (:95); the window itself reads `this.config.data.rules.roll?.defaultAdvantageDice` (d20RollDialog.mjs:176) | **same** | - |
| 8 | `getActionRelevantEffects` - not in the register | reroll.mjs:162 `game.system?.api?.data?.actions?.actionsTypes?.base?.getActionRelevantEffects?.(actor) ?? []` | gone from the base action class; now an instance method of `MoveContext` with no arguments (move-context.mjs:198) | **gone** | A GM's Reroll of a drawn roll with no `scored` builds its roll with `effects: []`, so no Active Effect's roll bonus is in it. Not new: 2.10.11's signature was `(rollData, actor)` (baseAction.mjs:369) and the module passes one argument, so `actor` was undefined and the answer `[]` there too; it matched only 2.6.5's `(actor, effectParent)` (baseAction.mjs:351). Measured on no table |
| 9 | `hook-duality-configured` (:696) - `daggerheart.postDualityRollConfiguration` | forced-roll.mjs:136 `(roll, config)` | dhRoll.mjs:84-89 fires `${CONFIG.DH.id}.post${hook.capitalize()}RollConfiguration` with `(roll, config, message)` for each of `getHooks()` (`'Duality'`, `''`) | **same** (the hook) | Fires, same arguments. What it hands over is a `MoveContext` (rows 3, 4) |
| 10 | `hook-roll-dialog-render` (:707) - `renderD20RollDialog` | murder-rules.mjs `registerMurder` | class still `D20RollDialog` (d20RollDialog.mjs:6) | **same** | - |
| 11 | `countdown-row-menu` (:552) - `DhCountdowns.prototype._getCountdownContextOptions` | projects-ui.mjs `wrapCountdownMenu` | applications/ui/countdowns.mjs:366 | **same** (file byte-identical to 2.10.11) | - |
| 12 | `countdown-update` (:567) - `DhCountdowns.updateCountdowns` | projects-ui.mjs:248 `wrapCountdownUpdate` | countdowns.mjs:329 `static async updateCountdowns(...progressTypes)`; called from dualityRoll.mjs:262-278 (`dualityUpdate`) with `config.evaluated?.withFear` | **same** | The call site reads the outcome from `config.evaluated` now; the method is unchanged |
| 13 | `hook-countdowns-render` (:741) - `renderDhCountdowns` | projects-ui.mjs, hud.mjs | class `DhCountdowns` (countdowns.mjs:12) | **same** | - |
| 14 | Countdowns data and config - not in the register | gm-stores.mjs:642, calls.mjs:813 (`Countdowns` setting `.countdowns[id]`), reroll.mjs:220 (`countdownProgressionTypes.fear.id`), projects-tray.mjs:86-88 (`countdownAppMode`, `FLAGS.userFlags.countdownMode`) | data/countdowns.mjs byte-identical; generalConfig.mjs:761 `countdownProgressionTypes`, :858 `countdownAppMode`; flagsConfig.mjs:25 `countdownMode: 'countdown-mode'` | **same** | generalConfig.mjs changed elsewhere (range `short` became an i18n key, `shortKey` beside it; two icons gained `fa-solid`); the module reads neither |
| 15 | `actions-resource` (:627) - `CONFIG.DH.RESOURCE.character.custom / all` | resources.mjs:38 | config/resourceConfig.mjs:97-98 `custom: {}, // module stuff goes here` / `all: {...characterBaseResources}` | **same** (byte-identical) | - |
| 16 | `relay-guard` (:667) - the system's socket `system.daggerheart` | relay-guard.mjs `REVIEWED_CASES` :105, `fingerprintOf` :277 | socket.mjs:3-38: the same eight cases and the same `default: EVENT_HANDLERS[data.action]?.(data.data);`; `socketEvent` and `GMUpdateEvent` the same names. One handler changed: `UpdateSaveMessage` (:100-109) now reads `data.data.saveTotal, data.data.isCritical` (2.10.11 `data.data.result`) | **same** (the fingerprint) / **changed** (the save packet) | The fingerprint reads "ok". The save packet's new shape is handled already: relay-guard.mjs:826-851 reads `saveTotal` as 2.12.5's. The files that send through the relay are the same files with the same number of calls (14 files, counted in both tags). On main the harness's copy is still 2.10.11's; the 1.2.109 branch re-copies it from 2.12.8 (ec6b04c3) |
| 17 | `hook-character-sheet-render` / `-close` (:718, :730) | sheet.mjs `registerSheetTweaks` | sheets/actors/character-sheet.mjs:18 `export default class CharacterSheet` | **same** (the class name) | The sheet gained a Versatile weapon toggle (character-sheet.mjs:919-927) that writes `flags.daggerheart.versatileActive` on an item from the player's browser. Not a module item; sheet-audit.mjs's census has not been read against it |
| 18 | `sheet-anchors` (:1049) - `SHEET_ANCHORS` (patches.mjs:237-258) | sheet.mjs `onRenderCharacterSheet` | every class and `data-action` of the 20 selectors is in 2.12.8's character templates (counted file by file: the same counts as 2.10.11); header.hbs byte-identical; sidebar.hbs: `equipment-section`, `loadout-section`, `experience-section` are `<section>` where they were `<div>` (sidebar.hbs:92, :113, :128) | **same** (for the selectors) | All selectors are by class, so the element change does not move them. sheet.mjs:2221 `closest(".loadout-section, section, fieldset")` finds the same element. Daggerheart's own CSS for `section` was not compared |
| 19 | `hook-party-sheet-render` (:1186) - `renderPartySheet` | sheet.mjs | party-sheet.mjs:15 `export default class PartySheet` | **same** | Seven changed lines: comments and two `if (!item) continue;` |
| 20 | `state-icons-off-token` (:1145) - `_drawEffect` on `CONFIG.Token.objectClass` | states.mjs `wrapEffectIcons` | canvas/placeables/token.mjs byte-identical: `DhTokenPlaceable extends foundry.canvas.placeables.Token` (:4), calls `this._drawEffect(...)` (:62), inherited from Foundry | **same** | - |
| 21 | `dead-icon-own` (:1166) - `Automation.defeated.deadIcon` | states.mjs:619 `ownDeadIcon` | data/settings/Automation.mjs byte-identical; `deadIcon` at :109 | **same** | - |
| 22 | `FOUNDRY_WRITES` `automation` - the Automation setting | states.mjs `suppressSystemAutomation` | Automation.mjs byte-identical; settingsConfig.mjs byte-identical (`Automation: 'Automation'` :31) | **same** | - |
| 23 | `Resources.Fear` setting key - not in the register | relay-guard.mjs:866 `CONFIG.DH?.SETTINGS?.gameSettings?.Resources?.Fear ?? "ResourcesFear"` | settingsConfig.mjs:39 `Fear: 'ResourcesFear'` | **same** | - |
| 24 | `Appearance` setting - not in the register | dice-sync.mjs:871, diagnostics.mjs:145 | data/settings/Appearance.mjs: the same fields; added `resetAndRerenderActors()` after a change (:75) | **same** (the fields) | A change of the setting now re-renders every actor sheet; the module's sheet hooks run again on each |
| 25 | `ENFORCED` `dhWelcome` - user flag `daggerheart.welcome-message` | enforced.mjs:102, `holdUserFlag` :466 | daggerheart.mjs:395-399 reads and sets `CONFIG.DH.FLAGS.userFlags.welcomeMessage`; flagsConfig.mjs:24 `welcomeMessage: 'welcome-message'` | **same** | - |
| 26 | Dice So Nice look by roles - not in the register | dice-look.mjs:139 lays no look on Daggerheart newer than 2.9.99 | (version gate, no source read) | **same** | 2.12.8 is past 2.9.99, as 2.10.x was |
| 27 | Actor data paths - not in the register | `system.resources.hope/hitPoints/stress .value/.max`, `system.traits`, `system.experiences`, `system.partner`, `system.rules` (grep of scripts/) | unchanged in the data models read (no field renamed in actor.mjs's diff); `takeDamage` changed its second argument to `{ actionUuid, isDirect }` (actor.mjs:903), which the module does not call | **same** (as read) | The character data model files were not diffed field by field; only actor.mjs and the paths above |

Summary: of the 16 register rows owned by Daggerheart, 14 read **same**; **critical-rule** and **roll-draw** read
**changed**, and both are on 1.2.109's list. Outside the register, four reaches changed or went: the MoveContext road
(3), the outcome on `config.roll` (4), `config.data.parent` (6) and `getActionRelevantEffects` (8).

## 2. What 1.2.108 does on 2.12.8, from the code

- The newer-system warning fires on every load: `newerSystemFindings` (requirements.mjs:291) compares the running
  version to `relationships.systems[daggerheart].compatibility.verified` = `"2.6.5"`. Its `missing` list names register
  rows with `present: false`; on 2.12.8 none of the 16 should read absent (rows 1-2 are present, of another behaviour),
  so the warning names the version and no target. Read from the code, not seen.
- The draw stands down (row 2) and the module's marks are lost (row 3), so an action's roll is thrown in the player's
  browser and its outcome is read where 2.12.8 no longer writes it (row 4). A critical pays the system's numbers
  (row 1). These are the reds 1.2.109 is being fixed for.

## 3. What must change for an honest "verified 2.12.8", by risk

1. **Ship 1.2.109's roll road and see it green on 2.12.8 dice** (rows 1-4). High: a wrong number on every action roll
   (outcome, critical, the GM's draw) is what the module is for. The evidence for it is 1.2.109's CI on the harness's
   2.12.8 copies (item 2), not a table.
2. **The harness's Daggerheart from 2.12.8 reaches main with 1.2.109** - done on its branch: `lib/dh-dice/` with
   `move-context.mjs` (E76 C3b, 0674ac33) and `lib/dh-relay.mjs` (E76 C1b, ec6b04c3). On main they are still 2.10.5's
   and 2.10.11's, whose `buildEvaluate` writes the outcome to `config.roll`, so a run on main cannot see rows 1 and 4.
   Nothing more to re-copy for the files this report reads; check again at the next Daggerheart tag.
3. **One run on a real Foundry 14.365 with Daggerheart 2.12.8** - the local gate (`npm run gate:local`), and
   LIVE-E33-01 (scenario 83 on a real table). High for the claim: no part of 1.2.108 has run against a real
   Daggerheart (`local-gate.json`: `sandbox.reachable: false`).
4. **Register the MoveContext road** (row 3) and the outcome's place (row 4) in `PATCHES`, with probes that read
   whether `rollTrait` builds a `MoveContext` and whether the marks arrived (1.2.109's `adoptMarks` answer) - so the
   next system change to this road is a failed row at load, not a wrong number. Medium.
5. **Make `critical-rule`'s probe read behaviour, not presence.** Row 1 said `ours: true` on a wrapper that could
   never fire. A probe that checks `addDualityResourceUpdates`' source for the place it reads the critical
   (`config.evaluated` or `config.roll`) would have failed the row. Medium.
6. **`getActionRelevantEffects`** (row 8): a GM's Reroll ignores Active Effects' roll bonuses on 2.12.8, and has on
   2.10.x as well. Read the effects from the roll's own `MoveContext` (`config.getActionRelevantEffects()`) or from
   `actor.allApplicableEffects()` as 2.12.8 does. Medium, a roll file: after 1.2.109 is on main.
7. **`actorOf`** (row 6): try `config.actor` before `config.data.parent`. Low, roll-dialog.mjs.
8. **The Versatile toggle** (row 17): read sheet-audit.mjs's census for a player's write of
   `flags.daggerheart.versatileActive` on an item; say whether it is judged, listed or not seen. Low.
9. **Then** write `"verified": "2.12.8"` in `module.json`'s `relationships.systems` (this line does not touch it), and
   say in the release notes what was run and what was only read.

## 4. How this was read

- `git clone --depth 1 --branch <tag> https://github.com/Foundryborne/daggerheart.git` for 2.12.8, 2.10.11 and 2.6.5
  (12.11.2026). `cmp` on each file the module reaches: byte-identical between 2.10.11 and 2.12.8 are
  `applications/ui/countdowns.mjs`, `data/countdowns.mjs`, `config/settingsConfig.mjs`, `config/resourceConfig.mjs`,
  `canvas/placeables/token.mjs`, `dice/baseRoll.mjs`, `data/settings/Automation.mjs`, `sheets-configs/character-settings.mjs`,
  `data/fields/action/countdownField.mjs`, `applications/ui/fearTracker.mjs`, `data/actor/resource-update-map.mjs` and
  `templates/sheets/actors/character/header.hbs`; changed are `systemRegistration/socket.mjs` (6 lines),
  `config/generalConfig.mjs` (27), `config/flagsConfig.mjs` (7), `applications/dialogs/d20RollDialog.mjs` (35),
  `documents/actor.mjs` (176), `dice/dualityRoll.mjs` (82), `dice/dhRoll.mjs` (268), `dice/d20Roll.mjs` (77),
  `data/settings/Appearance.mjs` (4), `daggerheart.mjs` (12), the two actor sheets (29, 7) and the character sidebar
  template; `data/action/move-context.mjs` is new in 2.12.
- Not read: Daggerheart's built bundle (the module reads source text with `Function.prototype.toString`; the probes
  assume the shipped files are the unminified source, as `reviewBuild`'s comment says), the character data model
  field by field, Daggerheart's CSS.
