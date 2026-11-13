# E54 - the comment sweep's inventory

Work line e54-prep, 13.11.2026, read on origin/main 421f2395 (1.2.109). The coordinator's brief: for the five cuts
whose manifests are on this line (the sheet; W1, windows; K1, key-remnants; P1, cleanup-reshape; D1+D2, death and
body), every comment that names where its code stands - "here and not in X", "in this file", "R### reads it here", a
file's name, a line - in the code that moves and in the code that stays and points at it; and the suite's own words
(test names, failure messages) that name a file a cut changes. No tree is changed here: each row says what the comment
reads after its cut, and what it would say instead. The cut's result is the tree tools/e54/split.mjs and
tools/e54/repoint.mjs write from each manifest (SPLIT-STATUS.md), each cut on main alone.

## The counts

| | Found | Becomes false | Unchanged by the cuts |
| --- | --- | --- | --- |
| Comment lines (scripts/, styles/, tools/, audit/; the suite's comments included) | 830 | 203 | 25 name code the file did not declare at the base (gone before E54, an import, a field, a local) |
| of them in code that moves, naming "here", "this file", "below" ... | 107 | 12 | |
| of them naming a cut's file and a function of it (`<file> \`name\``) | 419 | 188 | 25 |
| of them naming a cut's file alone | 310 | 3 | |
| Test texts: names and `ok`/`equal`/`must`/`needs` messages | 141 (names 78, messages 63) | 40 | 2 |

Per cut, the false comment lines (a line naming two cuts' files counts in each):

| Cut | False comments | False test texts |
| --- | --- | --- |
| sheet (sheet.mjs) | 79 | 32 |
| W1 (utils.mjs) | 6 | 0 |
| K1 (investigation.mjs) | 22 | 0 |
| P1 (cleanup.mjs) | 14 | 1 |
| D1+D2 (chapter.mjs) | 82 | 7 |

Line references (`<file>:<n>`) to the five files: none in a comment at the base. Documents (docs/, the handbooks)
were not read for this inventory; the one census document a test holds, docs/dev/e92/CENSUS.md, is repoint's.

## How each was judged

- **A comment in code that moves** belongs to the declaration whose text holds it (split.mjs's rule: a statement owns
  its text from the line after the one before it), and lands in that declaration's file. "this module" is the module
  and stays true. "below" and "above" with nothing named are read within the declaration, which moves whole, and stay
  true; where they name a declaration, its place in the new file was looked up (`rel.mjs`, appendix): all but one keep
  their side, and that one (sheet.mjs:3543, `INVENTORY_GROUPS`) becomes false. Every "this file" and "here" was read by
  hand, with its paragraph.
- **`<file> \`name\``** is false when the name moves: the facade still exports it, but the sentence says where it
  stands. The replacement names the holder, or "this file's" where the holder is the comment's own new file.
  "<file> exports `name`" stays true: the facade re-exports every name the file exported.
- **A file's name alone** stays true - the facade keeps the file and its name, the family's top (code.md) - unless the
  same sentence names code of that file which moves; then the holders are named.
- **A test text** is judged as a comment, with "exports no", "has no" (of a module the test imported), "gives a test no road" and an `import()` of the file true.
  A test name that changes changes its row in docs/dev/R-REGISTRY.md (`node tools/registry.mjs --write`) and the key of
  its results; none of the names below is in audit/harness/skip-baseline.json.

Wording, house style: the replacement says where the code stands and, where the sentence gave a reason, the reason
as it holds after the cut; a historical clause ("until then", "before E54") keeps the file it was true of.

## 1. Comments that become false (203)

Ordered by file and line on 421f2395. "Lands in" is the file the comment stands in after its cut.

| file:line (421f2395) | Lands in | Why it becomes false | Reads now | Would read |
| --- | --- | --- | --- | --- |
| audit/harness/lib/versions.mjs:105 | audit/harness/lib/versions.mjs | `renderPlan` goes to sheet-repaint.mjs | sheet.mjs `renderPlan` | sheet-repaint.mjs `renderPlan` |
| audit/harness/scenarios/41-trial-scene.mjs:726 | audit/harness/scenarios/41-trial-scene.mjs | names `announcedAlready`, which goes to body.mjs | chapter.mjs | body.mjs |
| audit/harness/scenarios/67-trial-modes.mjs:420 | audit/harness/scenarios/67-trial-modes.mjs | `addPresentButton` goes to sheet-inventory.mjs | sheet.mjs `addPresentButton` | sheet-inventory.mjs `addPresentButton` |
| audit/harness/scenarios/71-sheet.mjs:8 | audit/harness/scenarios/71-sheet.mjs | `installRenderPlan` goes to sheet-repaint.mjs | sheet.mjs `installRenderPlan` | sheet-repaint.mjs `installRenderPlan` |
| audit/harness/scenarios/72-canary.mjs:661 | audit/harness/scenarios/72-canary.mjs | `runDiscovery` goes to body.mjs | chapter.mjs `runDiscovery` | body.mjs `runDiscovery` |
| audit/harness/scenarios/74-room-tile.mjs:742 | audit/harness/scenarios/74-room-tile.mjs | `markDeceased` goes to death.mjs | chapter.mjs `markDeceased` | death.mjs `markDeceased` |
| audit/harness/scenarios/83-roll-integrity.mjs:965 | audit/harness/scenarios/83-roll-integrity.mjs | `writeReserve` goes to sheet-sidebar.mjs | sheet.mjs `writeReserve` | sheet-sidebar.mjs `writeReserve` |
| scripts/action-murder.mjs:85 | scripts/action-murder.mjs | `actionButton` goes to sheet-actions.mjs | sheet.mjs `actionButton` | sheet-actions.mjs `actionButton` |
| scripts/action-tamper.mjs:77 | scripts/action-tamper.mjs | `proposeReshape` goes to cleanup-reshape.mjs | cleanup.mjs `proposeReshape` | cleanup-reshape.mjs `proposeReshape` |
| scripts/api.mjs:942 | scripts/api.mjs | `applyReshapeRuling` goes to cleanup-reshape.mjs | cleanup.mjs `applyReshapeRuling` | cleanup-reshape.mjs `applyReshapeRuling` |
| scripts/body-tile.mjs:50 | scripts/body-tile.mjs | `bodiesToDiscover` goes to body.mjs | chapter.mjs `bodiesToDiscover` | body.mjs `bodiesToDiscover` |
| scripts/body-tile.mjs:182 | scripts/body-tile.mjs | `markDeceased` goes to death.mjs | chapter.mjs `markDeceased` | death.mjs `markDeceased` |
| scripts/body-tile.mjs:236 | scripts/body-tile.mjs | `clearSeasonDeaths` goes to death.mjs | chapter.mjs `clearSeasonDeaths` | death.mjs `clearSeasonDeaths` |
| scripts/body-tile.mjs:253 | scripts/body-tile.mjs | `reviveCharacter` goes to death.mjs | chapter.mjs `reviveCharacter` | death.mjs `reviveCharacter` |
| scripts/body-tile.mjs:254 | scripts/body-tile.mjs | `clearSeasonDeaths` goes to death.mjs | chapter.mjs `clearSeasonDeaths` | death.mjs `clearSeasonDeaths` |
| scripts/bridge-guards.mjs:1422 | scripts/bridge-guards.mjs | `sheetMode` goes to sheet-mode.mjs | sheet.mjs `sheetMode` | sheet-mode.mjs `sheetMode` |
| scripts/bridge-runs-records.mjs:731 | scripts/bridge-runs-records.mjs | `chargeForUnfoundKeys` goes to key-remnants.mjs | investigation.mjs `chargeForUnfoundKeys` | key-remnants.mjs `chargeForUnfoundKeys` |
| scripts/bridge-runs-records.mjs:894 | scripts/bridge-runs-records.mjs | `ruleReshape` goes to cleanup-reshape.mjs | cleanup.mjs `ruleReshape` | cleanup-reshape.mjs `ruleReshape` |
| scripts/bridge-table.mjs:950 | scripts/bridge-table.mjs | `askToChargeForUnfoundKeys` goes to key-remnants.mjs | investigation.mjs `askToChargeForUnfoundKeys` | key-remnants.mjs `askToChargeForUnfoundKeys` |
| scripts/bridge-table.mjs:1309 | scripts/bridge-table.mjs | `claimRuling` goes to cleanup-reshape.mjs | cleanup.mjs `claimRuling` | cleanup-reshape.mjs `claimRuling` |
| scripts/bridge-wire.mjs:55 | scripts/bridge-wire.mjs | `askToChargeForUnfoundKeys` goes to key-remnants.mjs | investigation.mjs `askToChargeForUnfoundKeys` | key-remnants.mjs `askToChargeForUnfoundKeys` |
| scripts/bridge-wire.mjs:95 | scripts/bridge-wire.mjs | `ruleReshape` goes to cleanup-reshape.mjs | cleanup.mjs `ruleReshape` | cleanup-reshape.mjs `ruleReshape` |
| scripts/call-pickers.mjs:129 | scripts/call-pickers.mjs | `runCall` goes to sheet-actions.mjs | sheet.mjs `runCall` | sheet-actions.mjs `runCall` |
| scripts/calls.mjs:633 | scripts/calls.mjs | `runCall` goes to sheet-actions.mjs | sheet.mjs `runCall` | sheet-actions.mjs `runCall` |
| scripts/case-realize.mjs:165 | scripts/case-realize.mjs | `runDiscovery` goes to body.mjs | chapter.mjs `runDiscovery` | body.mjs `runDiscovery` |
| scripts/case-schema.mjs:205 | scripts/case-schema.mjs | `keyPlan` goes to key-remnants.mjs | investigation.mjs `keyPlan` | key-remnants.mjs `keyPlan` |
| scripts/case-schema.mjs:217 | scripts/case-schema.mjs | `setKeyPlan` goes to key-remnants.mjs | investigation.mjs `setKeyPlan` | key-remnants.mjs `setKeyPlan` |
| scripts/config.mjs:241 | scripts/config.mjs | `injectClassControls` goes to sheet-header.mjs | sheet.mjs `injectClassControls` | sheet-header.mjs `injectClassControls` |
| scripts/config.mjs:510 | scripts/config.mjs | `growForCalls` goes to sheet-fit.mjs | sheet.mjs `growForCalls` | sheet-fit.mjs `growForCalls` |
| scripts/config.mjs:610 | scripts/config.mjs | `wearMarkup` goes to sheet-item.mjs | sheet.mjs `wearMarkup` | sheet-item.mjs `wearMarkup` |
| scripts/config.mjs:1381 | scripts/config.mjs | `keyFeeOf` goes to key-remnants.mjs | investigation.mjs `keyFeeOf` | key-remnants.mjs `keyFeeOf` |
| scripts/eclipse.mjs:130 | scripts/eclipse.mjs | `runDiscovery` goes to body.mjs | chapter.mjs `runDiscovery` | body.mjs `runDiscovery` |
| scripts/frisk.mjs:100 | scripts/frisk.mjs | `publishDeath` goes to death.mjs | chapter.mjs `publishDeath` | death.mjs `publishDeath` |
| scripts/frisk.mjs:183 | scripts/frisk.mjs | `witnessesOf` goes to body.mjs | chapter.mjs `witnessesOf` | body.mjs `witnessesOf` |
| scripts/gm-stores.mjs:485 | scripts/gm-stores.mjs | `killCharacter` goes to death.mjs | chapter.mjs `killCharacter` | death.mjs `killCharacter` |
| scripts/gm-stores.mjs:724 | scripts/gm-stores.mjs | `killCharacter` goes to death.mjs | chapter.mjs `killCharacter` | death.mjs `killCharacter` |
| scripts/gm-stores.mjs:1158 | scripts/gm-stores.mjs | `claimRuling` goes to cleanup-reshape.mjs | cleanup.mjs `claimRuling` | cleanup-reshape.mjs `claimRuling` |
| scripts/gm-stores.mjs:1298 | scripts/gm-stores.mjs | `keyPlan` goes to key-remnants.mjs | investigation.mjs `keyPlan` | key-remnants.mjs `keyPlan` |
| scripts/gm-stores.mjs:1303 | scripts/gm-stores.mjs | `keepOnlyKeyPlanChapter` goes to key-remnants.mjs | investigation.mjs `keepOnlyKeyPlanChapter` | key-remnants.mjs `keepOnlyKeyPlanChapter` |
| scripts/gm-stores.mjs:1311 | scripts/gm-stores.mjs | `recordCaseKeys` goes to key-remnants.mjs | investigation.mjs `recordCaseKeys` | key-remnants.mjs `recordCaseKeys` |
| scripts/gm-students.mjs:210 | scripts/gm-students.mjs | `injectClassControls` goes to sheet-header.mjs | sheet.mjs `injectClassControls` | sheet-header.mjs `injectClassControls` |
| scripts/gm-students.mjs:380 | scripts/gm-students.mjs | `injectAdvanceButton` goes to sheet-header.mjs | sheet.mjs `injectAdvanceButton` | sheet-header.mjs `injectAdvanceButton` |
| scripts/handover.mjs:468 | scripts/handover.mjs | `publishDeath` goes to death.mjs | chapter.mjs `publishDeath` | death.mjs `publishDeath` |
| scripts/handover.mjs:636 | scripts/handover.mjs | `publishDeath` goes to death.mjs | chapter.mjs `publishDeath` | death.mjs `publishDeath` |
| scripts/hud.mjs:1468 | scripts/hud.mjs | `sheetMode` goes to sheet-mode.mjs | sheet.mjs `sheetMode` | sheet-mode.mjs `sheetMode` |
| scripts/incident-store.mjs:1179 | scripts/incident-store.mjs | `killCharacter` goes to death.mjs | chapter.mjs `killCharacter` | death.mjs `killCharacter` |
| scripts/incident-store.mjs:1656 | scripts/incident-store.mjs | `checkBodyFound` goes to body.mjs | chapter.mjs `checkBodyFound` | body.mjs `checkBodyFound` |
| scripts/investigation.mjs:2479 | scripts/investigation.mjs | `setKeyPlan` goes to key-remnants.mjs | investigation.mjs `setKeyPlan` | key-remnants.mjs `setKeyPlan` |
| scripts/level-up.mjs:1020 | scripts/level-up.mjs | `killCharacter` goes to death.mjs | chapter.mjs `killCharacter` | death.mjs `killCharacter` |
| scripts/messenger-app.mjs:737 | scripts/messenger-app.mjs | `claimRuling` goes to cleanup-reshape.mjs | cleanup.mjs `claimRuling` | cleanup-reshape.mjs `claimRuling` |
| scripts/monocub.mjs:72 | scripts/monocub.mjs | `verdictBefore` goes to death.mjs | chapter.mjs `verdictBefore` | death.mjs `verdictBefore` |
| scripts/monocub.mjs:91 | scripts/monocub.mjs | `verdictBefore` goes to death.mjs | chapter.mjs `verdictBefore` | death.mjs `verdictBefore` |
| scripts/monocub.mjs:146 | scripts/monocub.mjs | `markDeceased` goes to death.mjs | chapter.mjs `markDeceased` | death.mjs `markDeceased` |
| scripts/monokuma.mjs:63 | scripts/monokuma.mjs | `livingStudentsForGm` goes to death.mjs | chapter.mjs `livingStudentsForGm` | death.mjs `livingStudentsForGm` |
| scripts/monokuma.mjs:407 | scripts/monokuma.mjs | `injectClassControls` goes to sheet-header.mjs | sheet.mjs `injectClassControls` | sheet-header.mjs `injectClassControls` |
| scripts/movement.mjs:2215 | scripts/movement.mjs | `onTunnelStep` goes to sheet-sidebar.mjs | sheet.mjs `onTunnelStep` | sheet-sidebar.mjs `onTunnelStep` |
| scripts/movement.mjs:2253 | scripts/movement.mjs | `onTunnelStep` goes to sheet-sidebar.mjs | sheet.mjs `onTunnelStep` | sheet-sidebar.mjs `onTunnelStep` |
| scripts/murder-rules.mjs:217 | scripts/murder-rules.mjs | `inCrisis` goes to sheet-inventory.mjs | sheet.mjs `inCrisis` | sheet-inventory.mjs `inCrisis` |
| scripts/passages.mjs:245 | scripts/passages.mjs | `knownPassageRows` goes to sheet-sidebar.mjs | sheet.mjs `knownPassageRows` | sheet-sidebar.mjs `knownPassageRows` |
| scripts/passages.mjs:293 | scripts/passages.mjs | `panToPassage` goes to sheet-sidebar.mjs | sheet.mjs `panToPassage` | sheet-sidebar.mjs `panToPassage` |
| scripts/patches.mjs:228 | scripts/patches.mjs | names `findHeadingByText`, which goes to sheet-sidebar.mjs | sheet.mjs | sheet-sidebar.mjs |
| scripts/patches.mjs:233 | scripts/patches.mjs | `paintReserves` goes to sheet-sidebar.mjs | sheet.mjs `paintReserves` | sheet-sidebar.mjs `paintReserves` |
| scripts/player-status.mjs:381 | scripts/player-status.mjs | `moveSlots` goes to sheet-header.mjs | sheet.mjs `moveSlots` | sheet-header.mjs `moveSlots` |
| scripts/player-status.mjs:417 | scripts/player-status.mjs | `sheetMode` goes to sheet-mode.mjs | sheet.mjs `sheetMode` | sheet-mode.mjs `sheetMode` |
| scripts/player-status.mjs:471 | scripts/player-status.mjs | `moveSlots` goes to sheet-header.mjs | sheet.mjs `moveSlots` | sheet-header.mjs `moveSlots` |
| scripts/remnants.mjs:1430 | scripts/remnants.mjs | `reshapeTrace` goes to cleanup-reshape.mjs | cleanup.mjs `reshapeTrace` | cleanup-reshape.mjs `reshapeTrace` |
| scripts/remnants.mjs:2369 | scripts/remnants.mjs | `incidentVictimDied` goes to death.mjs | chapter.mjs `incidentVictimDied` | death.mjs `incidentVictimDied` |
| scripts/resource-guard.mjs:241 | scripts/resource-guard.mjs | `commitUltimate` goes to sheet-header.mjs | sheet.mjs `commitUltimate` | sheet-header.mjs `commitUltimate` |
| scripts/resource-guard.mjs:242 | scripts/resource-guard.mjs | `tidyBiography` goes to sheet-sidebar.mjs | sheet.mjs `tidyBiography` | sheet-sidebar.mjs `tidyBiography` |
| scripts/rest.mjs:208 | scripts/rest.mjs | `roomBlockFor` goes to sheet-actions.mjs | sheet.mjs `roomBlockFor` | sheet-actions.mjs `roomBlockFor` |
| scripts/room-tile.mjs:114 | scripts/room-tile.mjs | `sheetMode` goes to sheet-mode.mjs | sheet.mjs `sheetMode` | sheet-mode.mjs `sheetMode` |
| scripts/settings.mjs:101 | scripts/settings.mjs | `publishDeath` goes to death.mjs | chapter.mjs `publishDeath` | death.mjs `publishDeath` |
| scripts/settings.mjs:590 | scripts/settings.mjs | `keyPlan` goes to key-remnants.mjs | investigation.mjs `keyPlan` | key-remnants.mjs `keyPlan` |
| scripts/settings.mjs:679 | scripts/settings.mjs | `announceBody` goes to body.mjs | chapter.mjs `announceBody` | body.mjs `announceBody` |
| scripts/settings.mjs:3351 | scripts/settings.mjs | `publishDeath` goes to death.mjs | chapter.mjs `publishDeath` | death.mjs `publishDeath` |
| scripts/settings.mjs:3417 | scripts/settings.mjs | `publishDeath` goes to death.mjs | chapter.mjs `publishDeath` | death.mjs `publishDeath` |
| scripts/settings.mjs:3606 | scripts/settings.mjs | `bodiesToDiscover` goes to body.mjs | chapter.mjs `bodiesToDiscover` | body.mjs `bodiesToDiscover` |
| scripts/settings.mjs:3640 | scripts/settings.mjs | `runDiscovery` goes to body.mjs | chapter.mjs `runDiscovery` | body.mjs `runDiscovery` |
| scripts/settings.mjs:3653 | scripts/settings.mjs | `announceBody` goes to body.mjs | chapter.mjs `announceBody` | body.mjs `announceBody` |
| scripts/sheet-audit.mjs:763 | scripts/sheet-audit.mjs | `bulletsHeldBy` goes to death.mjs | chapter.mjs `bulletsHeldBy` | death.mjs `bulletsHeldBy` |
| scripts/sheet-audit.mjs:906 | scripts/sheet-audit.mjs | `keepBulletDeletions` goes to death.mjs | chapter.mjs `keepBulletDeletions` | death.mjs `keepBulletDeletions` |
| scripts/sheet.mjs:677 | scripts/sheet-repaint.mjs | the hook was sheet.mjs's (`registerSheetTweaks`, which the facade keeps) | (this file's | (sheet.mjs's |
| scripts/sheet.mjs:705 | scripts/sheet-repaint.mjs | the action panel is sheet-actions.mjs's | Actions are drawn by this file's own action panel | Actions are drawn by the sheet's own action panel (sheet-actions.mjs `injectActionPanel`) |
| scripts/sheet.mjs:961 | scripts/sheet-repaint.mjs | what a render does to the sheet is the family's, not sheet-repaint.mjs's | everything this file does to a freshly rendered sheet | everything the sheet's family (sheet.mjs `SHEET_STEPS`) does to a freshly rendered sheet |
| scripts/sheet.mjs:993 | scripts/sheet.mjs | a plan the cut carries out | E54 moves it into the thin sheet.mjs. | E54 moved it into the thin sheet.mjs. |
| scripts/sheet.mjs:2820 | scripts/sheet-sidebar.mjs | `registerSheetTweaks` stays in sheet.mjs | of this file's hooks (`registerSheetTweaks`) | of sheet.mjs's hooks (`registerSheetTweaks`) |
| scripts/sheet.mjs:3543 | scripts/sheet-inventory.mjs | `INVENTORY_GROUPS` goes to sheet-sidebar.mjs; CARRIED_TYPES to sheet-inventory.mjs | The groups above are drawn by category | The groups of sheet-sidebar.mjs `INVENTORY_GROUPS` are drawn by category |
| scripts/sheet.mjs:5514 | scripts/sheet-actions.mjs | the rule is the sheet's tiles', and actionButton now stands in sheet-actions.mjs | which is the rule this file has applied to the Eclipse since it | which is the rule the sheet's tiles have applied to the Eclipse since they |
| scripts/sheet.mjs:5739 | scripts/sheet-actions.mjs | the old test was sheet.mjs's, before the split | separate `isCleaner` test in this file that had to be kept in step by hand | separate `isCleaner` test in sheet.mjs (before E54) that had to be kept in step by hand |
| scripts/spectator-ui.mjs:19 | scripts/spectator-ui.mjs | `sheetMode` goes to sheet-mode.mjs | sheet.mjs `sheetMode` | sheet-mode.mjs `sheetMode` |
| scripts/stat-glyphs.mjs:6 | scripts/stat-glyphs.mjs | `markTraitGlyphs` goes to sheet-header.mjs | sheet.mjs `markTraitGlyphs` | sheet-header.mjs `markTraitGlyphs` |
| scripts/states.mjs:117 | scripts/states.mjs | `reviveCharacter` goes to death.mjs | chapter.mjs `reviveCharacter` | death.mjs `reviveCharacter` |
| scripts/states.mjs:297 | scripts/states.mjs | `paintStateBadges` goes to sheet-sidebar.mjs | sheet.mjs `paintStateBadges` | sheet-sidebar.mjs `paintStateBadges` |
| scripts/states.mjs:481 | scripts/states.mjs | `paintStateBadges` goes to sheet-sidebar.mjs | sheet.mjs `paintStateBadges` | sheet-sidebar.mjs `paintStateBadges` |
| scripts/sync.mjs:413 | scripts/sync.mjs | `monokumaPool` goes to sheet-actions.mjs | sheet.mjs `monokumaPool` | sheet-actions.mjs `monokumaPool` |
| scripts/tests-grid.mjs:708 | scripts/tests-grid.mjs | `runDiscovery` goes to body.mjs | chapter.mjs `runDiscovery` | body.mjs `runDiscovery` |
| scripts/tests-kit.mjs:2253 | scripts/tests-kit.mjs | `markDeceased` goes to death.mjs | chapter.mjs `markDeceased` | death.mjs `markDeceased` |
| scripts/tests-kit.mjs:2595 | scripts/tests-kit.mjs | `markTraitGlyphs` goes to sheet-header.mjs | sheet.mjs `markTraitGlyphs` | sheet-header.mjs `markTraitGlyphs` |
| scripts/tests-tier0.mjs:7199 | scripts/tests-tier0.mjs | `markDeceased` goes to death.mjs | chapter.mjs `markDeceased` | death.mjs `markDeceased` |
| scripts/tests-tier0.mjs:8967 | scripts/tests-tier0.mjs | `announcedAlready` goes to body.mjs | chapter.mjs `announcedAlready` | body.mjs `announcedAlready` |
| scripts/tests-tier0.mjs:8974 | scripts/tests-tier0.mjs | `runDiscovery` goes to body.mjs | chapter.mjs `runDiscovery` | body.mjs `runDiscovery` |
| scripts/tests-tier0.mjs:11914 | scripts/tests-tier0.mjs | `bodiesToDiscover` goes to body.mjs | chapter.mjs `bodiesToDiscover` | body.mjs `bodiesToDiscover` |
| scripts/tests-tier0.mjs:11958 | scripts/tests-tier0.mjs | `witnessesOf` goes to body.mjs | chapter.mjs `witnessesOf` | body.mjs `witnessesOf` |
| scripts/tests-tier0.mjs:11990 | scripts/tests-tier0.mjs | `announceBody` goes to body.mjs | chapter.mjs `announceBody` | body.mjs `announceBody` |
| scripts/tests-tier0.mjs:12000 | scripts/tests-tier0.mjs | `clearSeasonBodies` goes to death.mjs | chapter.mjs `clearSeasonBodies` | death.mjs `clearSeasonBodies` |
| scripts/tests-tier0.mjs:12763 | scripts/tests-tier0.mjs | `claimRuling` goes to cleanup-reshape.mjs | cleanup.mjs `claimRuling` | cleanup-reshape.mjs `claimRuling` |
| scripts/tests-tier0.mjs:14718 | scripts/tests-tier0.mjs | `windowWidthFor` goes to windows.mjs | utils.mjs `windowWidthFor` | windows.mjs `windowWidthFor` |
| scripts/tests-tier0.mjs:14770 | scripts/tests-tier0.mjs | `noteStepStart` goes to sheet-sidebar.mjs | sheet.mjs `noteStepStart` | sheet-sidebar.mjs `noteStepStart` |
| scripts/tests-tier0.mjs:14930 | scripts/tests-tier0.mjs | `onTunnelStep` goes to sheet-sidebar.mjs | sheet.mjs `onTunnelStep` | sheet-sidebar.mjs `onTunnelStep` |
| scripts/tests-tier0.mjs:19474 | scripts/tests-tier0.mjs | `LONGEST_TILE_WORD` goes to sheet-fit.mjs | sheet.mjs `LONGEST_TILE_WORD` | sheet-fit.mjs `LONGEST_TILE_WORD` |
| scripts/tests-tier0.mjs:20423 | scripts/tests-tier0.mjs | `findRemnantToken` goes to cleanup-reshape.mjs | cleanup.mjs `findRemnantToken` | cleanup-reshape.mjs `findRemnantToken` |
| scripts/tests-tier0.mjs:20425 | scripts/tests-tier0.mjs | `saveKeyPlan` goes to key-remnants.mjs | investigation.mjs `saveKeyPlan` | key-remnants.mjs `saveKeyPlan` |
| scripts/tests-tier1.mjs:7292 | scripts/tests-tier1.mjs | `publishDeath` goes to death.mjs | chapter.mjs `publishDeath` | death.mjs `publishDeath` |
| scripts/tests-tier1.mjs:9656 | scripts/tests-tier1.mjs | `askToChargeForUnfoundKeys` goes to key-remnants.mjs | investigation.mjs `askToChargeForUnfoundKeys` | key-remnants.mjs `askToChargeForUnfoundKeys` |
| scripts/tests-tier1.mjs:10809 | scripts/tests-tier1.mjs | `wearMarkup` goes to sheet-item.mjs | sheet.mjs `wearMarkup` | sheet-item.mjs `wearMarkup` |
| scripts/tests-tier1.mjs:22030 | scripts/tests-tier1.mjs | `goThrough` goes to sheet-sidebar.mjs | sheet.mjs `goThrough` | sheet-sidebar.mjs `goThrough` |
| scripts/tests-tier1.mjs:22032 | scripts/tests-tier1.mjs | `knownPassageItem` goes to sheet-sidebar.mjs | sheet.mjs `knownPassageItem` | sheet-sidebar.mjs `knownPassageItem` |
| scripts/tests-tier1.mjs:25850 | scripts/tests-tier1.mjs | `monokumaPool` goes to sheet-actions.mjs | sheet.mjs `monokumaPool` | sheet-actions.mjs `monokumaPool` |
| scripts/tests-tier1.mjs:26586 | scripts/tests-tier1.mjs | `runDiscovery` goes to body.mjs | chapter.mjs `runDiscovery` | body.mjs `runDiscovery` |
| scripts/tests-tier1.mjs:28720 | scripts/tests-tier1.mjs | `moveSlots` goes to sheet-header.mjs | sheet.mjs `moveSlots` | sheet-header.mjs `moveSlots` |
| scripts/tests-tier1.mjs:29918 | scripts/tests-tier1.mjs | `chargeForUnfoundKeys` goes to key-remnants.mjs | investigation.mjs `chargeForUnfoundKeys` | key-remnants.mjs `chargeForUnfoundKeys` |
| scripts/tests-tier1.mjs:34807 | scripts/tests-tier1.mjs | `livingStudents` goes to death.mjs | chapter.mjs `livingStudents` | death.mjs `livingStudents` |
| scripts/tests-tier1.mjs:38722 | scripts/tests-tier1.mjs | `injectClassControls` goes to sheet-header.mjs | sheet.mjs `injectClassControls` | sheet-header.mjs `injectClassControls` |
| scripts/tests-tier1.mjs:38995 | scripts/tests-tier1.mjs | `injectSafeword` goes to sheet-sidebar.mjs | sheet.mjs `injectSafeword` | sheet-sidebar.mjs `injectSafeword` |
| scripts/tests-tier1.mjs:40820 | scripts/tests-tier1.mjs | `paintReserveRow` goes to sheet-sidebar.mjs | sheet.mjs `paintReserveRow` | sheet-sidebar.mjs `paintReserveRow` |
| scripts/tests-tier1.mjs:43439 | scripts/tests-tier1.mjs | `paintStateBadges` goes to sheet-sidebar.mjs | sheet.mjs `paintStateBadges` | sheet-sidebar.mjs `paintStateBadges` |
| scripts/tests-tier1.mjs:47512 | scripts/tests-tier1.mjs | `sheetMode` goes to sheet-mode.mjs | sheet.mjs `sheetMode` | sheet-mode.mjs `sheetMode` |
| scripts/tests-tier1.mjs:47644 | scripts/tests-tier1.mjs | `injectAdvanceButton` goes to sheet-header.mjs | sheet.mjs `injectAdvanceButton` | sheet-header.mjs `injectAdvanceButton` |
| scripts/tests-tier1.mjs:49085 | scripts/tests-tier1.mjs | `bodiesToDiscover` goes to body.mjs | chapter.mjs `bodiesToDiscover` | body.mjs `bodiesToDiscover` |
| scripts/tests-tier2.mjs:139 | scripts/tests-tier2.mjs | `markDeceased` goes to death.mjs | chapter.mjs `markDeceased` | death.mjs `markDeceased` |
| scripts/tests-tier2.mjs:793 | scripts/tests-tier2.mjs | `killCharacter` goes to death.mjs | chapter.mjs `killCharacter` | death.mjs `killCharacter` |
| scripts/tests-tier2.mjs:1125 | scripts/tests-tier2.mjs | `chargeForUnfoundKeys` goes to key-remnants.mjs | investigation.mjs `chargeForUnfoundKeys` | key-remnants.mjs `chargeForUnfoundKeys` |
| scripts/tests-tier2.mjs:2584 | scripts/tests-tier2.mjs | `markDeceased` goes to death.mjs | chapter.mjs `markDeceased` | death.mjs `markDeceased` |
| scripts/tests-tier2.mjs:2990 | scripts/tests-tier2.mjs | `claimRuling` goes to cleanup-reshape.mjs | cleanup.mjs `claimRuling` | cleanup-reshape.mjs `claimRuling` |
| scripts/tests-tier2.mjs:11887 | scripts/tests-tier2.mjs | `witnessesOf` goes to body.mjs | chapter.mjs `witnessesOf` | body.mjs `witnessesOf` |
| scripts/tests-tier2.mjs:12676 | scripts/tests-tier2.mjs | `publishDeath` goes to death.mjs | chapter.mjs `publishDeath` | death.mjs `publishDeath` |
| scripts/tests-tier2.mjs:18422 | scripts/tests-tier2.mjs | `reshapeTrace` goes to cleanup-reshape.mjs | cleanup.mjs `reshapeTrace` | cleanup-reshape.mjs `reshapeTrace` |
| scripts/tests-tier2.mjs:18779 | scripts/tests-tier2.mjs | `saveKeyPlan` goes to key-remnants.mjs | investigation.mjs `saveKeyPlan` | key-remnants.mjs `saveKeyPlan` |
| scripts/tests-tier2.mjs:19809 | scripts/tests-tier2.mjs | `askTransform` goes to cleanup-reshape.mjs | cleanup.mjs `askTransform` | cleanup-reshape.mjs `askTransform` |
| scripts/tests-tier2.mjs:22437 | scripts/tests-tier2.mjs | `destroyBullets` goes to death.mjs | chapter.mjs `destroyBullets` | death.mjs `destroyBullets` |
| scripts/tests-tier2.mjs:22808 | scripts/tests-tier2.mjs | `maybeBodyFound` goes to body.mjs | chapter.mjs `maybeBodyFound` | body.mjs `maybeBodyFound` |
| scripts/tests-tier2.mjs:24875 | scripts/tests-tier2.mjs | `offerStageSix` goes to death.mjs | chapter.mjs `offerStageSix` | death.mjs `offerStageSix` |
| scripts/tests-tier2.mjs:25413 | scripts/tests-tier2.mjs | `keepSeasonKeyPlan` goes to key-remnants.mjs | investigation.mjs `keepSeasonKeyPlan` | key-remnants.mjs `keepSeasonKeyPlan` |
| scripts/tests-tier2.mjs:25691 | scripts/tests-tier2.mjs | `chargeForUnfoundKeys` goes to key-remnants.mjs | investigation.mjs `chargeForUnfoundKeys` | key-remnants.mjs `chargeForUnfoundKeys` |
| scripts/tests-tier2.mjs:29765 | scripts/tests-tier2.mjs | `promoteFaintPrep` goes to body.mjs | chapter.mjs `promoteFaintPrep` | body.mjs `promoteFaintPrep` |
| scripts/tests-tier2.mjs:41620 | scripts/tests-tier2.mjs | `bodiesToDiscover` goes to body.mjs | chapter.mjs `bodiesToDiscover` | body.mjs `bodiesToDiscover` |
| scripts/tests-tier2.mjs:43378 | scripts/tests-tier2.mjs | `actionButton` goes to sheet-actions.mjs | sheet.mjs `actionButton` | sheet-actions.mjs `actionButton` |
| scripts/tests-tier2.mjs:47416 | scripts/tests-tier2.mjs | `publishDeath` goes to death.mjs | chapter.mjs `publishDeath` | death.mjs `publishDeath` |
| scripts/tests-tier2.mjs:47479 | scripts/tests-tier2.mjs | `publishDeath` goes to death.mjs | chapter.mjs `publishDeath` | death.mjs `publishDeath` |
| scripts/tests-tier2.mjs:47576 | scripts/tests-tier2.mjs | `publishDeath` goes to death.mjs | chapter.mjs `publishDeath` | death.mjs `publishDeath` |
| scripts/tests-tier2.mjs:47697 | scripts/tests-tier2.mjs | `killCharacter` goes to death.mjs | chapter.mjs `killCharacter` | death.mjs `killCharacter` |
| scripts/tests-tier2.mjs:47764 | scripts/tests-tier2.mjs | `discoverBody` goes to body.mjs | chapter.mjs `discoverBody` | body.mjs `discoverBody` |
| scripts/tests-tier2.mjs:47885 | scripts/tests-tier2.mjs | `reviveCharacter` goes to death.mjs | chapter.mjs `reviveCharacter` | death.mjs `reviveCharacter` |
| scripts/tests-tier2.mjs:48553 | scripts/tests-tier2.mjs | `injectAdvanceButton` goes to sheet-header.mjs | sheet.mjs `injectAdvanceButton` | sheet-header.mjs `injectAdvanceButton` |
| scripts/tests-tier2.mjs:53912 | scripts/tests-tier2.mjs | `commitUltimate` goes to sheet-header.mjs | sheet.mjs `commitUltimate` | sheet-header.mjs `commitUltimate` |
| scripts/tests-tier2.mjs:55638 | scripts/tests-tier2.mjs | `announceBody` goes to body.mjs | chapter.mjs `announceBody` | body.mjs `announceBody` |
| scripts/tests-tier2.mjs:55688 | scripts/tests-tier2.mjs | `deathAnnounced` goes to body.mjs | chapter.mjs `deathAnnounced` | body.mjs `deathAnnounced` |
| scripts/tests-tier2.mjs:55737 | scripts/tests-tier2.mjs | `publishDeath` goes to death.mjs | chapter.mjs `publishDeath` | death.mjs `publishDeath` |
| scripts/tests-tier2.mjs:55804 | scripts/tests-tier2.mjs | `checkBodyFound` goes to body.mjs | chapter.mjs `checkBodyFound` | body.mjs `checkBodyFound` |
| scripts/tests-tier2.mjs:57207 | scripts/tests-tier2.mjs | `checkBodyFound` goes to body.mjs | chapter.mjs `checkBodyFound` | body.mjs `checkBodyFound` |
| scripts/tests-tier2.mjs:57623 | scripts/tests-tier2.mjs | `bulletsHeldBy` goes to death.mjs | chapter.mjs `bulletsHeldBy` | death.mjs `bulletsHeldBy` |
| scripts/tests-tier2.mjs:58109 | scripts/tests-tier2.mjs | `keepOnlyKeyPlanChapter` goes to key-remnants.mjs | investigation.mjs `keepOnlyKeyPlanChapter` | key-remnants.mjs `keepOnlyKeyPlanChapter` |
| scripts/tests-tier2.mjs:64649 | scripts/tests-tier2.mjs | `onTunnelStep` goes to sheet-sidebar.mjs | sheet.mjs `onTunnelStep` | sheet-sidebar.mjs `onTunnelStep` |
| scripts/tests-tier2.mjs:68080 | scripts/tests-tier2.mjs | `addUseButton` goes to sheet-inventory.mjs | sheet.mjs `addUseButton` | sheet-inventory.mjs `addUseButton` |
| scripts/tests-tier2.mjs:73941 | scripts/tests-tier2.mjs | `killCharacter` goes to death.mjs | chapter.mjs `killCharacter` | death.mjs `killCharacter` |
| scripts/tests-tier2.mjs:75672 | scripts/tests-tier2.mjs | `roomBlockFor` goes to sheet-actions.mjs | sheet.mjs `roomBlockFor` | sheet-actions.mjs `roomBlockFor` |
| scripts/tests-tier2.mjs:87270 | scripts/tests-tier2.mjs | `markDeceased` goes to death.mjs | chapter.mjs `markDeceased` | death.mjs `markDeceased` |
| scripts/tests-tier2.mjs:87293 | scripts/tests-tier2.mjs | `markDeceased` goes to death.mjs | chapter.mjs `markDeceased` | death.mjs `markDeceased` |
| scripts/tests-tier2.mjs:87370 | scripts/tests-tier2.mjs | `recordSecretDeath` goes to death.mjs | chapter.mjs `recordSecretDeath` | death.mjs `recordSecretDeath` |
| scripts/tests-tier2.mjs:87605 | scripts/tests-tier2.mjs | `markDeceased` goes to death.mjs | chapter.mjs `markDeceased` | death.mjs `markDeceased` |
| scripts/tests-tier2.mjs:87624 | scripts/tests-tier2.mjs | `verdictBefore` goes to death.mjs | chapter.mjs `verdictBefore` | death.mjs `verdictBefore` |
| scripts/tests-tier2.mjs:87732 | scripts/tests-tier2.mjs | `reviveCharacter` goes to death.mjs | chapter.mjs `reviveCharacter` | death.mjs `reviveCharacter` |
| scripts/tests-tier2.mjs:87734 | scripts/tests-tier2.mjs | `clearSeasonDeaths` goes to death.mjs | chapter.mjs `clearSeasonDeaths` | death.mjs `clearSeasonDeaths` |
| scripts/tests-tier2.mjs:87951 | scripts/tests-tier2.mjs | `announceBody` goes to body.mjs | chapter.mjs `announceBody` | body.mjs `announceBody` |
| scripts/tests-tier2.mjs:87956 | scripts/tests-tier2.mjs | `clearSeasonBodies` goes to death.mjs | chapter.mjs `clearSeasonBodies` | death.mjs `clearSeasonBodies` |
| scripts/trial-modes.mjs:337 | scripts/trial-modes.mjs | `chargeForUnfoundKeys` goes to key-remnants.mjs | investigation.mjs `chargeForUnfoundKeys` | key-remnants.mjs `chargeForUnfoundKeys` |
| scripts/trial-modes.mjs:356 | scripts/trial-modes.mjs | `missingKeyRows` goes to key-remnants.mjs | investigation.mjs `missingKeyRows` | key-remnants.mjs `missingKeyRows` |
| scripts/trial-progress.mjs:76 | scripts/trial-progress.mjs | `bodiesToDiscover` goes to body.mjs | chapter.mjs `bodiesToDiscover` | body.mjs `bodiesToDiscover` |
| scripts/truth-bullets.mjs:295 | scripts/truth-bullets.mjs | `reshapeCardParts` goes to cleanup-reshape.mjs | cleanup.mjs `reshapeCardParts` | cleanup-reshape.mjs `reshapeCardParts` |
| scripts/use-items.mjs:293 | scripts/use-items.mjs | `sheetMode` goes to sheet-mode.mjs | sheet.mjs `sheetMode` | sheet-mode.mjs `sheetMode` |
| scripts/use-items.mjs:388 | scripts/use-items.mjs | `addUseButton` goes to sheet-inventory.mjs | sheet.mjs `addUseButton` | sheet-inventory.mjs `addUseButton` |
| scripts/use-items.mjs:878 | scripts/use-items.mjs | `addDiscardButton` goes to sheet-inventory.mjs | sheet.mjs `addDiscardButton` | sheet-inventory.mjs `addDiscardButton` |
| scripts/utils.mjs:1144 | scripts/windows.mjs | the three were utils.mjs's | this file's `tableDialog`, `fitWindowToTable` and `fitWindowToTabs` until then). Here and not in | utils.mjs's `tableDialog`, `fitWindowToTable` and `fitWindowToTabs` until then). In windows.mjs and not in |
| scripts/utils.mjs:1145 | scripts/windows.mjs | R168 imports it from utils.mjs, which re-exports it; the kit imports utils.mjs | the kit because R168 reads it here, and the kit may import this file (R161). | the kit because the kit imports utils.mjs, which re-exports it (R161 holds no cycle); R168 imports it from there. |
| scripts/utils.mjs:1383 | scripts/windows.mjs | it stands in windows.mjs now | Here and not in ui-kit.mjs | In windows.mjs and not in ui-kit.mjs |
| scripts/utils.mjs:1384 | scripts/windows.mjs | the old function was utils.mjs's; the rule binds windows.mjs as it bound utils.mjs | this file's `fitWindowToTabs` until then), because utils.mjs may not import | utils.mjs's `fitWindowToTabs` until then), because windows.mjs, like utils.mjs, may not import |
| scripts/utils.mjs:1385 | scripts/windows.mjs | the kit imports utils.mjs, which re-exports windows.mjs | the kit (R161: the kit imports this file). | the kit (R161: the kit imports utils.mjs, which re-exports this file). |
| scripts/voice.mjs:1019 | scripts/voice.mjs | `deathAnnounced` goes to body.mjs | chapter.mjs `deathAnnounced` | body.mjs `deathAnnounced` |
| scripts/voice.mjs:1034 | scripts/voice.mjs | `bodiesToDiscover` goes to body.mjs | chapter.mjs `bodiesToDiscover` | body.mjs `bodiesToDiscover` |
| scripts/voice.mjs:1504 | scripts/voice.mjs | `askToChargeForUnfoundKeys` goes to key-remnants.mjs | investigation.mjs `askToChargeForUnfoundKeys` | key-remnants.mjs `askToChargeForUnfoundKeys` |
| styles/danganronpa.css:64 | styles/danganronpa.css | `paintReserves` goes to sheet-sidebar.mjs | sheet.mjs `paintReserves` | sheet-sidebar.mjs `paintReserves` |
| styles/danganronpa.css:2015 | styles/danganronpa.css | `budgetLine` goes to sheet-actions.mjs | sheet.mjs `budgetLine` | sheet-actions.mjs `budgetLine` |
| styles/danganronpa.css:2130 | styles/danganronpa.css | `wearMarkup` goes to sheet-item.mjs | sheet.mjs `wearMarkup` | sheet-item.mjs `wearMarkup` |
| styles/danganronpa.css:3809 | styles/danganronpa.css | `injectKnownPassages` goes to sheet-sidebar.mjs | sheet.mjs `injectKnownPassages` | sheet-sidebar.mjs `injectKnownPassages` |
| styles/danganronpa.css:3817 | styles/danganronpa.css | `injectKnownPassages` goes to sheet-sidebar.mjs | sheet.mjs `injectKnownPassages` | sheet-sidebar.mjs `injectKnownPassages` |
| styles/danganronpa.css:4342 | styles/danganronpa.css | `markSheetState` goes to sheet-header.mjs | sheet.mjs `markSheetState` | sheet-header.mjs `markSheetState` |
| styles/danganronpa.css:6350 | styles/danganronpa.css | `injectKnownPassages` goes to sheet-sidebar.mjs | sheet.mjs `injectKnownPassages` | sheet-sidebar.mjs `injectKnownPassages` |
| styles/danganronpa.css:7924 | styles/danganronpa.css | `markTraitGlyphs` goes to sheet-header.mjs | sheet.mjs `markTraitGlyphs` | sheet-header.mjs `markTraitGlyphs` |
| styles/danganronpa.css:8891 | styles/danganronpa.css | `paintStateBadges` goes to sheet-sidebar.mjs | sheet.mjs `paintStateBadges` | sheet-sidebar.mjs `paintStateBadges` |
| styles/danganronpa.css:11499 | styles/danganronpa.css | `moveSlots` goes to sheet-header.mjs | sheet.mjs `moveSlots` | sheet-header.mjs `moveSlots` |
| styles/danganronpa.css:11508 | styles/danganronpa.css | `headerButton` goes to sheet-header.mjs | sheet.mjs `headerButton` | sheet-header.mjs `headerButton` |
| styles/stained-glass.css:138 | styles/stained-glass.css | `paintReserves` goes to sheet-sidebar.mjs | sheet.mjs `paintReserves` | sheet-sidebar.mjs `paintReserves` |
| styles/stained-glass.css:4762 | styles/stained-glass.css | `headerButton` goes to sheet-header.mjs | sheet.mjs `headerButton` | sheet-header.mjs `headerButton` |

## 2. Test texts that become false (40)

| file:line (421f2395) | Where | Names | Becomes | The text (around the file's name) |
| --- | --- | --- | --- | --- |
| scripts/tests-tier0.mjs:17252 | name | sheet.mjs | addPresentButton -> sheet-inventory.mjs | 'presentBullet' and the Present row of sheet.mjs 'addPresentButton' refuse a student on the trial's list, and 'regist... |
| scripts/tests-tier0.mjs:17841 | name | sheet.mjs | runCall -> sheet-actions.mjs | mjs, monocub.mjs `cubAbilityDialog` and sheet.mjs `runCall` stands in `callWindow` alone, which names drpg-panel, the... |
| scripts/tests-tier0.mjs:19471 | name | sheet.mjs | LONGEST_TILE_WORD -> sheet-fit.mjs | tile grows by a renamed word (E66-24): sheet.mjs `LONGEST_TILE_WORD` is still taken from the tiles' four tables and c... |
| scripts/tests-tier0.mjs:20728 | name | sheet.mjs | runCall -> sheet-actions.mjs | f monocub.mjs `cubAbilityDialog` and of sheet.mjs `runCall` passes `once`" |
| scripts/tests-tier0.mjs:21254 | name | sheet.mjs | paintReserves -> sheet-sidebar.mjs | key, `.bar-label`, the plate) with what sheet.mjs `paintReserves` adds (`paintResourceBars` until E24 C1a), and with ... |
| scripts/tests-tier0.mjs:21406 | name | sheet.mjs | sheetMode -> sheet-mode.mjs | in sheet.mjs or sheet-audit.mjs outside sheet.mjs `sheetMode`, but in the few declarations the list names, each with ... |
| scripts/tests-tier0.mjs:22628 | name | chapter.mjs | BODY_ANNOUNCED_HOOK -> body.mjs | t once and called from the stamp alone (chapter.mjs `BODY_ANNOUNCED_HOOK`, E95 C4): the hook's name stands in one pla... |
| scripts/tests-tier0.mjs:22766 | name | chapter.mjs | markDeceased -> death.mjs | ody-tile.mjs `leaveBody` is called from chapter.mjs `markDeceased`, the one function every public death passes, hande... |
| scripts/tests-tier1.mjs:28156 | name | sheet.mjs | roomBlockFor -> sheet-actions.mjs | earch still is (E16-T32; audit S03-24): sheet.mjs `roomBlockFor` answers nothing for \"project\" and the room's note ... |
| scripts/tests-tier1.mjs:38552 | name | chapter.mjs | openDeathDialog -> death.mjs | 05; S06-08, S13-04, S13-05): Who died? (chapter.mjs 'openDeathDialog'), the body's announcement ('openBodyDiscoveryDi... |
| scripts/tests-tier1.mjs:42038 | name | chapter.mjs | livingStudentsForGm -> death.mjs | ensus' (the world's and a handed list), chapter.mjs 'livingStudentsForGm' (the murder window's cast), assignments.mjs... |
| scripts/tests-tier1.mjs:42162 | name | sheet.mjs | rowGate -> sheet-mode.mjs | E24 C3a, E24-18, E24-20; audit S03-15): sheet.mjs `rowGate` answers no row buttons for the dead and a Monocub (D15), ... |
| scripts/tests-tier1.mjs:42272 | name | sheet.mjs | paintReserves -> sheet-sidebar.mjs | "R1442 - the reserve on the sheet (sheet.mjs `paintReserves`; E24 C1a, E24-02 and E24-03; the owner's D5 option 1, D4... |
| scripts/tests-tier1.mjs:42325 | name | sheet.mjs | paintReserves -> sheet-sidebar.mjs, writeReserve -> sheet-sidebar.mjs | "R1443 - the reserve's field (sheet.mjs `paintReserves`, `writeReserve`; resource-guard.mjs `sheetReserve`; E24 C1a, ... |
| scripts/tests-tier1.mjs:42456 | name | sheet.mjs | paintReserves -> sheet-sidebar.mjs | R1445 - Sanity is private on the sheet (sheet.mjs `paintReserves`, anonymity.mjs `redactSheet`; E24 C1a, E24-06; the ... |
| scripts/tests-tier1.mjs:42848 | name | sheet.mjs | sheetMode -> sheet-mode.mjs, paintReserves -> sheet-sidebar.mjs | 97 - the reserve's field is the mode's (sheet.mjs `sheetMode(...).reserveField`, `paintReserves`; E24 fix G2B, genera... |
| scripts/tests-tier1.mjs:42933 | name | sheet.mjs | paintPartyReserves -> sheet-sidebar.mjs | , Sanity only to its owner and the GMs (sheet.mjs `paintPartyReserves`; E24 fix G2B, general m4's Party side and secu... |
| scripts/tests-tier1.mjs:43337 | name | sheet.mjs | paintPartyReserves -> sheet-sidebar.mjs | s.mjs `reserveBar`, `wrapBarAttribute`; sheet.mjs `paintPartyReserves`; E24 C1b, E24-10, E24-11; Q-E24-3): a student'... |
| scripts/tests-tier1.mjs:43591 | name | sheet.mjs | leaveLoadoutTab -> sheet-fit.mjs | the Loadout tab is never the one shown (sheet.mjs `leaveLoadoutTab`; E24 C3b, E24-22; audit S03-47, S12-45): a sheet ... |
| scripts/tests-tier1.mjs:43626 | name | sheet.mjs | keepTabScroll -> sheet-fit.mjs | a tab keeps its scroll across a render (sheet.mjs 'keepTabScroll'; E24 C3b, E24-22; audit S03-14): what the active 's... |
| scripts/tests-tier1.mjs:43664 | name | sheet.mjs | noteEmptyExperience -> sheet-sidebar.mjs, injectEquippedTools -> sheet-sidebar.mjs | nd an item in hand shows both its tags (sheet.mjs `noteEmptyExperience`, `injectEquippedTools`; E24 C3b, E24-23; audi... |
| scripts/tests-tier1.mjs:43703 | name | sheet.mjs | callLockNote -> sheet-actions.mjs, freeMovePip -> sheet-header.mjs, budgetLine -> sheet-actions.mjs | "R1460 - the locks on the sheet (sheet.mjs `callLockNote`, `freeMovePip`, `budgetLine`; E24 C3b, E24-24; audit S03-13... |
| scripts/tests-tier1.mjs:43886 | name | sheet.mjs | sheetMode -> sheet-mode.mjs | e modes' matrix (E45 C1; audit S17-37): sheet.mjs `sheetMode(actor, user)` for a student, the dead, a Monocub, an NPC... |
| scripts/tests-tier1.mjs:43960 | name | sheet.mjs | sheetMode -> sheet-mode.mjs | and the room tile take their gate from sheet.mjs 'sheetMode' (E45 C1; the owner's A8 of 11.10): player-status.mjs 'bu... |
| scripts/tests-tier1.mjs:44047 | name | sheet.mjs | sheetMode -> sheet-mode.mjs | another player's sheet is redacted when sheet.mjs `sheetMode(...).redact` says so and a GM's is not; a throw inside t... |
| scripts/tests-tier1.mjs:44089 | name | sheet.mjs | sheetMode -> sheet-mode.mjs | he mode's (E45 C1; E70's `modeAllows`): sheet.mjs `sheetMode(...).present(floor)` hides the button outside a Class Tr... |
| scripts/tests-tier1.mjs:44122 | name | sheet.mjs | renderPlan -> sheet-repaint.mjs, installRenderPlan -> sheet-repaint.mjs | "R1477 - the render's own decision (sheet.mjs `renderPlan`, `installRenderPlan`; E45 C2, E45-08; audit S03-07): \"rep... |
| scripts/tests-tier1.mjs:44187 | name | sheet.mjs | installRenderPlan -> sheet-repaint.mjs | preUpdate leaves the next render whole (sheet.mjs 'installRenderPlan'; overflow.mjs and resource-guard.mjs 'onPreUpda... |
| scripts/tests-tier1.mjs:44251 | name | sheet.mjs | repaintInPlace -> sheet-repaint.mjs | he repaint draws what the render would (sheet.mjs `repaintInPlace` through `installRenderPlan`; E45 C2, E45-10; D46 o... |
| scripts/tests-tier1.mjs:45780 | name | sheet.mjs | moveSlots -> sheet-header.mjs, moveFeetHtml -> sheet-header.mjs, freeMovePip -> sheet-header.mjs | nd the strip, in and out of an Eclipse (sheet.mjs 'moveSlots', 'moveFeetHtml', 'freeMovePip'; player-status.mjs 'buil... |
| scripts/tests-tier1.mjs:45834 | name | sheet.mjs | headerButton -> sheet-header.mjs, injectSafeword -> sheet-sidebar.mjs | ir words, and the Stop says what it is (sheet.mjs `headerButton`, `injectSafeword`; E49 B2, S03-31): Level Up and Giv... |
| scripts/tests-tier1.mjs:45868 | name | sheet.mjs | injectActionPanel -> sheet-actions.mjs, budgetLine -> sheet-actions.mjs, buildRulesPanel -> sheet-actions.mjs | and the Rules tab on Monokuma's rules (sheet.mjs `injectActionPanel`, `budgetLine`, `buildRulesPanel`; styles/danganr... |
| scripts/tests-tier1.mjs:45892 | name | sheet.mjs | budgetLine -> sheet-actions.mjs | rn it is, in the incident card's words (sheet.mjs `budgetLine`, events.mjs `incidentTurnText`, `actingActor`; E49 B2'... |
| scripts/tests-tier1.mjs:47641 | name | sheet.mjs | sheetMode -> sheet-mode.mjs | ; E47-C8): a button exactly on the rows sheet.mjs `sheetMode(actor, game.user).levelUp` holds, its words the standing... |
| scripts/tests-tier1.mjs:50496 | name | chapter.mjs | livingStudentsForGm -> death.mjs | 's and a handed list), `ownedStudents`, chapter.mjs `livingStudentsForGm` (the murder window's cast, the body's witne... |
| scripts/tests-tier1.mjs:50651 | name | sheet.mjs | sheetMode -> sheet-mode.mjs | r's (E92 C5; the owner's E92 goal (5)): sheet.mjs `sheetMode` answers mode \"spectator\" - no action panel, no Calls,... |
| scripts/tests-tier2.mjs:85788 | name | cleanup.mjs | askTransform -> cleanup-reshape.mjs | ad (E22 C5c; A4, audit S02-25, S05-49): cleanup.mjs `askTransform` (the critical's) and `askTransformChange` (the Tam... |
| scripts/tests-tier2.mjs:86117 | name | sheet.mjs | sheetMode -> sheet-mode.mjs | d for its owner and for another player: sheet.mjs `sheetMode`'s mode and row buttons; the sheet drawn by the render h... |
| scripts/tests-tier2.mjs:87288 | name | chapter.mjs | killCharacter -> death.mjs | QUESTIONS E63 Q5, Q7): a public death (chapter.mjs `killCharacter`) lays one tile at the token's corner, its size in ... |
| scripts/tests-tier2.mjs:87367 | name | chapter.mjs | publishDeath -> death.mjs | s Move the body would, its publication (chapter.mjs `publishDeath`) lays one at the token's new place" |

Each would read the holder's name in place of the old file's beside the function it names (the "Becomes" column), as
the comments above.

## 3. Comments that stay true (602 lines) and those the cuts do not change (25)

One line each: file:line on 421f2395, the file it stands in after its cut, and why it holds.

| file:line (421f2395) | Lands in | Verdict | Why |
| --- | --- | --- | --- |
| audit/harness/lib/operators.mjs:18 | audit/harness/lib/operators.mjs | true | `replaceFlag` stays in utils.mjs |
| audit/harness/lib/shim.mjs:346 | audit/harness/lib/shim.mjs | true | names `_id`, which stay |
| audit/harness/lib/shim.mjs:841 | audit/harness/lib/shim.mjs | true | the file, which stays as the family's facade |
| audit/harness/lib/shim.mjs:865 | audit/harness/lib/shim.mjs | true | `primaryGmId` stays in utils.mjs |
| audit/harness/lib/shim.mjs:1568 | audit/harness/lib/shim.mjs | true | `dialogContent` stays in utils.mjs |
| audit/harness/scenarios/12-social.mjs:512 | audit/harness/scenarios/12-social.mjs | true | the file, which stays as the family's facade |
| audit/harness/scenarios/13-murder-signals.mjs:683 | audit/harness/scenarios/13-murder-signals.mjs | true | `markResolutionStress` stays in cleanup.mjs |
| audit/harness/scenarios/13-murder-signals.mjs:1578 | audit/harness/scenarios/13-murder-signals.mjs | true | `applyMoveBody` stays in cleanup.mjs |
| audit/harness/scenarios/17-assistant.mjs:5 | audit/harness/scenarios/17-assistant.mjs | true | the file, which stays as the family's facade |
| audit/harness/scenarios/30-security.mjs:199 | audit/harness/scenarios/30-security.mjs | true | `record` stays in utils.mjs |
| audit/harness/scenarios/30-security.mjs:2215 | audit/harness/scenarios/30-security.mjs | true | `record` stays in utils.mjs |
| audit/harness/scenarios/30-security.mjs:3268 | audit/harness/scenarios/30-security.mjs | true | `gmReport` stays in utils.mjs |
| audit/harness/scenarios/30-security.mjs:5944 | audit/harness/scenarios/30-security.mjs | true | the file, which stays as the family's facade |
| audit/harness/scenarios/41-trial-scene.mjs:126 | audit/harness/scenarios/41-trial-scene.mjs | true | `primaryGmId` stays in utils.mjs |
| audit/harness/scenarios/41-trial-scene.mjs:140 | audit/harness/scenarios/41-trial-scene.mjs | true | `gmIds` stays in utils.mjs |
| audit/harness/scenarios/61-gmstore-case.mjs:2206 | audit/harness/scenarios/61-gmstore-case.mjs | true | `noteCleaningTool` stays in cleanup.mjs |
| audit/harness/scenarios/63-class-trial.mjs:163 | audit/harness/scenarios/63-class-trial.mjs | true | `primaryGmId` stays in utils.mjs |
| audit/harness/scenarios/65-season.mjs:1261 | audit/harness/scenarios/65-season.mjs | true | `sessionFailures` stays in utils.mjs |
| audit/harness/scenarios/66-rooms.mjs:747 | audit/harness/scenarios/66-rooms.mjs | true | the file, which stays as the family's facade |
| audit/harness/scenarios/72-canary.mjs:64 | audit/harness/scenarios/72-canary.mjs | true | the file, which stays as the family's facade |
| audit/harness/scenarios/83-roll-integrity.mjs:491 | audit/harness/scenarios/83-roll-integrity.mjs | true | the file, which stays as the family's facade |
| audit/harness/scenarios/88-flow-length.mjs:140 | audit/harness/scenarios/88-flow-length.mjs | true | the file, which stays as the family's facade |
| scripts/a11y.mjs:42 | scripts/a11y.mjs | true | the file, which stays as the family's facade |
| scripts/a11y.mjs:60 | scripts/a11y.mjs | true | names `role`, which stay |
| scripts/action-analyze.mjs:101 | scripts/action-analyze.mjs | true | the file, which stays as the family's facade |
| scripts/action-briefing.mjs:18 | scripts/action-briefing.mjs | true | the file, which stays as the family's facade |
| scripts/action-briefing.mjs:20 | scripts/action-briefing.mjs | true | names `import`, which stay |
| scripts/action-briefing.mjs:218 | scripts/action-briefing.mjs | true | the file, which stays as the family's facade |
| scripts/action-dynamic.mjs:39 | scripts/action-dynamic.mjs | true | the file, which stays as the family's facade |
| scripts/action-menus.mjs:100 | scripts/action-menus.mjs | true | the file, which stays as the family's facade |
| scripts/action-murder.mjs:129 | scripts/action-murder.mjs | true | `GM_ROUTE_CLASS` stays in utils.mjs |
| scripts/action-project.mjs:283 | scripts/action-project.mjs | true | `GM_ROUTE_CLASS` stays in utils.mjs |
| scripts/action-report.mjs:242 | scripts/action-report.mjs | true | the file, which stays as the family's facade |
| scripts/action-tamper.mjs:6 | scripts/action-tamper.mjs | true | names `runTamperChoice`, `performTamper`, which stay |
| scripts/action-tamper.mjs:20 | scripts/action-tamper.mjs | true | names `import`, which stay |
| scripts/action-tamper.mjs:38 | scripts/action-tamper.mjs | true | the file, which stays as the family's facade |
| scripts/action-tamper.mjs:182 | scripts/action-tamper.mjs | true | the file, which stays as the family's facade |
| scripts/action-tamper.mjs:253 | scripts/action-tamper.mjs | true | the file, which stays as the family's facade |
| scripts/anonymity.mjs:493 | scripts/anonymity.mjs | true | the file, which stays as the family's facade |
| scripts/anonymity.mjs:582 | scripts/anonymity.mjs | true | the file, which stays as the family's facade |
| scripts/api.mjs:861 | scripts/api.mjs | true | the file, which stays as the family's facade |
| scripts/api.mjs:1601 | scripts/api.mjs | true | the file, which stays as the family's facade |
| scripts/body-tile.mjs:12 | scripts/body-tile.mjs | true | the file, which stays as the family's facade |
| scripts/body-tile.mjs:304 | scripts/body-tile.mjs | true | `applyMoveBody` stays in cleanup.mjs |
| scripts/boundary.mjs:208 | scripts/boundary.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/boundary.mjs:231 | scripts/boundary.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/bridge-asks.mjs:100 | scripts/bridge-asks.mjs | true | the file, which stays as the family's facade |
| scripts/bridge-asks.mjs:114 | scripts/bridge-asks.mjs | true | the file, which stays as the family's facade |
| scripts/bridge-asks.mjs:739 | scripts/bridge-asks.mjs | true | the file, which stays as the family's facade |
| scripts/bridge-asks.mjs:911 | scripts/bridge-asks.mjs | true | the file, which stays as the family's facade |
| scripts/bridge-guards.mjs:14 | scripts/bridge-guards.mjs | true | names `gmOnline`, which stay |
| scripts/bridge-guards.mjs:17 | scripts/bridge-guards.mjs | true | the file, which stays as the family's facade |
| scripts/bridge-runs-acts.mjs:64 | scripts/bridge-runs-acts.mjs | true | the file, which stays as the family's facade |
| scripts/bridge-runs-acts.mjs:682 | scripts/bridge-runs-acts.mjs | true | the file, which stays as the family's facade |
| scripts/bridge-runs-acts.mjs:682 | scripts/bridge-runs-acts.mjs | true | the file, which stays as the family's facade |
| scripts/bridge-runs-acts.mjs:704 | scripts/bridge-runs-acts.mjs | true | `paidBack` stays in cleanup.mjs |
| scripts/bridge-runs-acts.mjs:706 | scripts/bridge-runs-acts.mjs | true | `authorsCopy` stays in cleanup.mjs |
| scripts/bridge-runs-acts.mjs:710 | scripts/bridge-runs-acts.mjs | true | the file, which stays as the family's facade |
| scripts/bridge-runs-records.mjs:336 | scripts/bridge-runs-records.mjs | true | the file, which stays as the family's facade |
| scripts/bridge-table.mjs:398 | scripts/bridge-table.mjs | true | the file, which stays as the family's facade |
| scripts/call-effects.mjs:423 | scripts/call-effects.mjs | true | the file, which stays as the family's facade |
| scripts/call-effects.mjs:1242 | scripts/call-effects.mjs | true | the file, which stays as the family's facade |
| scripts/call-gm.mjs:807 | scripts/call-gm.mjs | true | `localeFormat` stays in utils.mjs |
| scripts/call-pickers.mjs:19 | scripts/call-pickers.mjs | true | the file, which stays as the family's facade |
| scripts/call-pickers.mjs:22 | scripts/call-pickers.mjs | true | the file, which stays as the family's facade |
| scripts/call-pickers.mjs:23 | scripts/call-pickers.mjs | true | the file, which stays as the family's facade |
| scripts/call-pickers.mjs:27 | scripts/call-pickers.mjs | true | names `callWindow`, which stay |
| scripts/call-world.mjs:24 | scripts/call-world.mjs | true | the file, which stays as the family's facade |
| scripts/call-world.mjs:465 | scripts/call-world.mjs | true | the file, which stays as the family's facade |
| scripts/call-world.mjs:531 | scripts/call-world.mjs | true | the file, which stays as the family's facade |
| scripts/call-world.mjs:662 | scripts/call-world.mjs | true | `forcedDeletion` stays in utils.mjs |
| scripts/calls.mjs:614 | scripts/calls.mjs | true | the file, which stays as the family's facade |
| scripts/case-hints.mjs:27 | scripts/case-hints.mjs | true | `caseReach` stays in investigation.mjs |
| scripts/case-map.mjs:16 | scripts/case-map.mjs | true | the file, which stays as the family's facade |
| scripts/case-map.mjs:42 | scripts/case-map.mjs | true | the file, which stays as the family's facade |
| scripts/case-map.mjs:229 | scripts/case-map.mjs | true | the file, which stays as the family's facade |
| scripts/case-realize.mjs:7 | scripts/case-realize.mjs | true | the file, which stays as the family's facade |
| scripts/case-realize.mjs:15 | scripts/case-realize.mjs | true | `findersByAnyRemnant` stays in investigation.mjs |
| scripts/case-trial.mjs:63 | scripts/case-trial.mjs | true | `caseCulprit` stays in investigation.mjs |
| scripts/chapter.mjs:48 | scripts/chapter.mjs | true | the file, which stays as the family's facade |
| scripts/chapter.mjs:87 | scripts/death.mjs | true | inside one declaration, which moves whole; still so in death.mjs |
| scripts/chapter.mjs:88 | scripts/death.mjs | true | inside one declaration, which moves whole; still so in death.mjs |
| scripts/chapter.mjs:92 | scripts/death.mjs | true | inside one declaration, which moves whole; still so in death.mjs |
| scripts/chapter.mjs:131 | scripts/death.mjs | true | inside one declaration, which moves whole; still so in death.mjs |
| scripts/chapter.mjs:169 | scripts/death.mjs | true | the module, not the file |
| scripts/chapter.mjs:342 | scripts/death.mjs | true | inside one declaration, which moves whole; still so in death.mjs |
| scripts/chapter.mjs:550 | scripts/death.mjs | true | inside one declaration, which moves whole; still so in death.mjs |
| scripts/chapter.mjs:744 | scripts/death.mjs | true | inside one declaration, which moves whole; still so in death.mjs |
| scripts/chapter.mjs:979 | scripts/body.mjs | true | body.mjs imports sheet-audit.mjs by `import()` only, as chapter.mjs did |
| scripts/chapter.mjs:1037 | scripts/body.mjs | true | inside one declaration, which moves whole; still so in body.mjs |
| scripts/chapter.mjs:1039 | scripts/body.mjs | true | sheet-audit.mjs imports none of chapter.mjs, body.mjs or death.mjs |
| scripts/chapter.mjs:1055 | scripts/body.mjs | true | inside one declaration, which moves whole; still so in body.mjs |
| scripts/chapter.mjs:1068 | scripts/body.mjs | true | inside one declaration, which moves whole; still so in body.mjs |
| scripts/chapter.mjs:1081 | scripts/body.mjs | true | inside one declaration, which moves whole; still so in body.mjs |
| scripts/chapter.mjs:1141 | scripts/body.mjs | true | inside one declaration, which moves whole; still so in body.mjs |
| scripts/chapter.mjs:1167 | scripts/body.mjs | true | `destroyCleaningTools` stays in cleanup.mjs |
| scripts/chapter.mjs:1186 | scripts/body.mjs | true | inside one declaration, which moves whole; still so in body.mjs |
| scripts/chapter.mjs:1193 | scripts/body.mjs | true | inside one declaration, which moves whole; still so in body.mjs |
| scripts/chapter.mjs:1195 | scripts/body.mjs | true | inside one declaration, which moves whole; still so in body.mjs |
| scripts/chapter.mjs:1274 | scripts/body.mjs | true | inside one declaration, which moves whole; still so in body.mjs |
| scripts/chapter.mjs:1288 | scripts/body.mjs | true | `serverNow` stays in utils.mjs |
| scripts/chapter.mjs:1508 | scripts/body.mjs | true | inside one declaration, which moves whole; still so in body.mjs |
| scripts/chapter.mjs:1840 | scripts/chapter.mjs | true | `confirmSweepBullets` stays in investigation.mjs |
| scripts/chapter.mjs:2318 | scripts/chapter.mjs | true | the file, which stays as the family's facade |
| scripts/character.mjs:381 | scripts/character.mjs | true | `listOf` stays in utils.mjs |
| scripts/chat-card.mjs:8 | scripts/chat-card.mjs | true | the file, which stays as the family's facade |
| scripts/cleanup.mjs:804 | scripts/cleanup-reshape.mjs | true | the file, which stays as the family's facade |
| scripts/cleanup.mjs:825 | scripts/cleanup-reshape.mjs | true | the module, not the file |
| scripts/cleanup.mjs:830 | scripts/cleanup-reshape.mjs | true | the module, not the file |
| scripts/cleanup.mjs:846 | scripts/cleanup-reshape.mjs | true | inside one declaration, which moves whole; still so in cleanup-reshape.mjs |
| scripts/cleanup.mjs:915 | scripts/cleanup-reshape.mjs | true | inside one declaration, which moves whole; still so in cleanup-reshape.mjs |
| scripts/cleanup.mjs:925 | scripts/cleanup-reshape.mjs | true | inside one declaration, which moves whole; still so in cleanup-reshape.mjs |
| scripts/cleanup.mjs:1060 | scripts/cleanup-reshape.mjs | true | inside one declaration, which moves whole; still so in cleanup-reshape.mjs |
| scripts/cleanup.mjs:1159 | scripts/cleanup-reshape.mjs | true | inside one declaration, which moves whole; still so in cleanup-reshape.mjs |
| scripts/cleanup.mjs:1197 | scripts/cleanup-reshape.mjs | true | inside one declaration, which moves whole; still so in cleanup-reshape.mjs |
| scripts/cleanup.mjs:1233 | scripts/cleanup-reshape.mjs | true | inside one declaration, which moves whole; still so in cleanup-reshape.mjs |
| scripts/cleanup.mjs:3563 | scripts/cleanup.mjs | true | `applyChapterEnd` stays in chapter.mjs |
| scripts/clock.mjs:112 | scripts/clock.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/clock.mjs:145 | scripts/clock.mjs | true | `serverNow` stays in utils.mjs |
| scripts/config.mjs:1080 | scripts/config.mjs | true | `sparedBySweep` stays in chapter.mjs |
| scripts/config.mjs:1349 | scripts/config.mjs | true | the file, which stays as the family's facade |
| scripts/config.mjs:1417 | scripts/config.mjs | true | the file, which stays as the family's facade |
| scripts/config.mjs:1549 | scripts/config.mjs | true | the file, which stays as the family's facade |
| scripts/config.mjs:1609 | scripts/config.mjs | true | the file, which stays as the family's facade |
| scripts/config.mjs:1792 | scripts/config.mjs | true | the file, which stays as the family's facade |
| scripts/config.mjs:2707 | scripts/config.mjs | true | `proseOf` stays in utils.mjs |
| scripts/config.mjs:2708 | scripts/config.mjs | true | names `fillProse`, `proseOf`, which stay |
| scripts/config.mjs:2721 | scripts/config.mjs | true | `proseOf` stays in utils.mjs |
| scripts/config.mjs:3734 | scripts/config.mjs | true | `consumeFreeCleanup` stays in cleanup.mjs |
| scripts/config.mjs:4360 | scripts/config.mjs | true | `bodyDestinations` stays in cleanup.mjs |
| scripts/despair.mjs:275 | scripts/despair.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/dh-settings.mjs:25 | scripts/dh-settings.mjs | true | the file, which stays as the family's facade |
| scripts/diagnostics.mjs:1408 | scripts/diagnostics.mjs | true | the file, which stays as the family's facade |
| scripts/dice-sync.mjs:33 | scripts/dice-sync.mjs | true | `isPrimaryGm` stays in utils.mjs |
| scripts/dice-sync.mjs:1096 | scripts/dice-sync.mjs | true | `replaceFlag` stays in utils.mjs |
| scripts/enforced.mjs:957 | scripts/enforced.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/enforced.mjs:999 | scripts/enforced.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/explain.mjs:100 | scripts/explain.mjs | true | `proseOf` stays in utils.mjs |
| scripts/fog-doorways.mjs:26 | scripts/fog-doorways.mjs | true | names `debug`, which stay |
| scripts/fog-reveal.mjs:39 | scripts/fog-reveal.mjs | true | the file, which stays as the family's facade |
| scripts/fog.mjs:753 | scripts/fog.mjs | unchanged | `recordBodyFound` is no top-level declaration of chapter.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/forced-roll.mjs:145 | scripts/forced-roll.mjs | true | names `render`, which stay |
| scripts/foundry-windows.mjs:115 | scripts/foundry-windows.mjs | true | the file, which stays as the family's facade |
| scripts/foundry-windows.mjs:115 | scripts/foundry-windows.mjs | true | the file, which stays as the family's facade |
| scripts/frisk.mjs:252 | scripts/frisk.mjs | true | `whisperToOwner` stays in utils.mjs |
| scripts/frisk.mjs:440 | scripts/frisk.mjs | true | `whisperToOwner` stays in utils.mjs |
| scripts/frisk.mjs:451 | scripts/frisk.mjs | true | `whisperToGms` stays in utils.mjs |
| scripts/gm-campaign.mjs:100 | scripts/gm-campaign.mjs | true | `openChapterEndDialog` stays in chapter.mjs |
| scripts/gm-campaign.mjs:112 | scripts/gm-campaign.mjs | true | `openChapterEndDialog` stays in chapter.mjs |
| scripts/gm-campaign.mjs:198 | scripts/gm-campaign.mjs | true | `openChapterEndDialog` stays in chapter.mjs |
| scripts/gm-items.mjs:1222 | scripts/gm-items.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/gm-panel.mjs:301 | scripts/gm-panel.mjs | true | the file, which stays as the family's facade |
| scripts/gm-panel.mjs:842 | scripts/gm-panel.mjs | true | `applyChapterEnd` stays in chapter.mjs |
| scripts/gm-store.mjs:71 | scripts/gm-store.mjs | true | the file, which stays as the family's facade |
| scripts/gm-store.mjs:1616 | scripts/gm-store.mjs | true | the file, which stays as the family's facade |
| scripts/gm-stores.mjs:12 | scripts/gm-stores.mjs | true | the file, which stays as the family's facade |
| scripts/gm-stores.mjs:333 | scripts/gm-stores.mjs | true | the file, which stays as the family's facade |
| scripts/gm-stores.mjs:369 | scripts/gm-stores.mjs | true | `consumeFreeCleanup` stays in cleanup.mjs |
| scripts/gm-stores.mjs:371 | scripts/gm-stores.mjs | true | `tamperQuote` stays in cleanup.mjs |
| scripts/gm-stores.mjs:866 | scripts/gm-stores.mjs | true | `noteCleaningTool` stays in cleanup.mjs |
| scripts/gm-stores.mjs:884 | scripts/gm-stores.mjs | true | `serverNow` stays in utils.mjs |
| scripts/gm-stores.mjs:1154 | scripts/gm-stores.mjs | true | `undoLastCleanup` stays in cleanup.mjs |
| scripts/gm-stores.mjs:1820 | scripts/gm-stores.mjs | true | `receiptTie` stays in cleanup.mjs |
| scripts/gm-stores.mjs:2234 | scripts/gm-stores.mjs | true | `localeFormat` stays in utils.mjs |
| scripts/gm-students.mjs:507 | scripts/gm-students.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/gm-team-dialog.mjs:295 | scripts/gm-team-dialog.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/handover.mjs:40 | scripts/handover.mjs | true | the file, which stays as the family's facade |
| scripts/handover.mjs:294 | scripts/handover.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/i18n.mjs:31 | scripts/i18n.mjs | true | names `Intl`, which stay |
| scripts/i18n.mjs:38 | scripts/i18n.mjs | true | `plural` stays in utils.mjs |
| scripts/incident-store.mjs:37 | scripts/incident-store.mjs | true | the file, which stays as the family's facade |
| scripts/incident-store.mjs:433 | scripts/incident-store.mjs | true | names `killerIds`, which stay |
| scripts/incident-store.mjs:544 | scripts/incident-store.mjs | true | `consumeFreeCleanup` stays in cleanup.mjs |
| scripts/inventory.mjs:963 | scripts/inventory.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/investigation.mjs:179 | scripts/key-remnants.mjs | true | "here" is this GM's browser, not the file |
| scripts/investigation.mjs:249 | scripts/key-remnants.mjs | true | inside one declaration, which moves whole; still so in key-remnants.mjs |
| scripts/investigation.mjs:474 | scripts/key-remnants.mjs | true | inside one declaration, which moves whole; still so in key-remnants.mjs |
| scripts/investigation.mjs:659 | scripts/key-remnants.mjs | true | inside one declaration, which moves whole; still so in key-remnants.mjs |
| scripts/investigation.mjs:660 | scripts/key-remnants.mjs | true | inside one declaration, which moves whole; still so in key-remnants.mjs |
| scripts/investigation.mjs:681 | scripts/key-remnants.mjs | true | inside one declaration, which moves whole; still so in key-remnants.mjs |
| scripts/investigation.mjs:715 | scripts/key-remnants.mjs | true | inside one declaration, which moves whole; still so in key-remnants.mjs |
| scripts/investigation.mjs:718 | scripts/key-remnants.mjs | true | inside one declaration, which moves whole; still so in key-remnants.mjs |
| scripts/investigation.mjs:960 | scripts/key-remnants.mjs | true | inside one declaration, which moves whole; still so in key-remnants.mjs |
| scripts/investigation.mjs:1580 | scripts/investigation.mjs | true | `sweepPlan` stays in chapter.mjs |
| scripts/investigation.mjs:2272 | scripts/investigation.mjs | true | `placeRoomOptions` stays in utils.mjs |
| scripts/investigation.mjs:2855 | scripts/investigation.mjs | true | `sweepTruthBullets` stays in chapter.mjs |
| scripts/live.mjs:534 | scripts/live.mjs | true | `applyDashboardSave` stays in investigation.mjs |
| scripts/mastermind.mjs:494 | scripts/mastermind.mjs | true | the file, which stays as the family's facade |
| scripts/mastermind.mjs:776 | scripts/mastermind.mjs | true | the file, which stays as the family's facade |
| scripts/messenger-app.mjs:635 | scripts/messenger-app.mjs | true | `localeFormat` stays in utils.mjs |
| scripts/migrate.mjs:1045 | scripts/migrate.mjs | true | the file, which stays as the family's facade |
| scripts/migrate.mjs:1062 | scripts/migrate.mjs | unchanged | `isDeceased` is no top-level declaration of chapter.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/module.mjs:184 | scripts/module.mjs | true | `markModuleWindow` stays in utils.mjs |
| scripts/module.mjs:230 | scripts/module.mjs | true | the file, which stays as the family's facade |
| scripts/monocub.mjs:220 | scripts/monocub.mjs | true | the file, which stays as the family's facade |
| scripts/monocub.mjs:242 | scripts/monocub.mjs | unchanged | `meddleButton` is no top-level declaration of sheet.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/monocub.mjs:794 | scripts/monocub.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/movement-audit.mjs:56 | scripts/movement-audit.mjs | true | `record` stays in utils.mjs |
| scripts/movement.mjs:806 | scripts/movement.mjs | true | the file, which stays as the family's facade |
| scripts/movement.mjs:847 | scripts/movement.mjs | true | the file, which stays as the family's facade |
| scripts/movement.mjs:2213 | scripts/movement.mjs | true | names `region`, `teleport`, which stay |
| scripts/murder-rules.mjs:55 | scripts/murder-rules.mjs | true | the file, which stays as the family's facade |
| scripts/murder-rules.mjs:1902 | scripts/murder-rules.mjs | true | the file, which stays as the family's facade |
| scripts/murder-rules.mjs:2034 | scripts/murder-rules.mjs | true | the file, which stays as the family's facade |
| scripts/murder-rules.mjs:2783 | scripts/murder-rules.mjs | true | `consumeFreeCleanup` stays in cleanup.mjs |
| scripts/murder-rules.mjs:2847 | scripts/murder-rules.mjs | true | the file, which stays as the family's facade |
| scripts/murder-rules.mjs:2887 | scripts/murder-rules.mjs | true | `markResolutionStress` stays in cleanup.mjs |
| scripts/murder-rules.mjs:3312 | scripts/murder-rules.mjs | true | the file, which stays as the family's facade |
| scripts/murder-rules.mjs:3361 | scripts/murder-rules.mjs | true | the file, which stays as the family's facade |
| scripts/murder-rules.mjs:3402 | scripts/murder-rules.mjs | true | the file, which stays as the family's facade |
| scripts/murder-rules.mjs:3409 | scripts/murder-rules.mjs | true | the file, which stays as the family's facade |
| scripts/murder-ui.mjs:23 | scripts/murder-ui.mjs | true | the file, which stays as the family's facade |
| scripts/murder-ui.mjs:700 | scripts/murder-ui.mjs | true | the file, which stays as the family's facade |
| scripts/murder-ui.mjs:810 | scripts/murder-ui.mjs | true | the file, which stays as the family's facade |
| scripts/notice-history.mjs:1277 | scripts/notice-history.mjs | true | the file, which stays as the family's facade |
| scripts/observe.mjs:1082 | scripts/observe.mjs | true | `authorsCopy` stays in cleanup.mjs |
| scripts/overflow.mjs:279 | scripts/overflow.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/own-ring.mjs:150 | scripts/own-ring.mjs | true | `cssColour` stays in utils.mjs |
| scripts/palm.mjs:542 | scripts/palm.mjs | true | `whisperToOwner` stays in utils.mjs |
| scripts/passages-gm.mjs:2026 | scripts/passages-gm.mjs | true | names `passage`, which stay |
| scripts/passages-gm.mjs:2158 | scripts/passages-gm.mjs | true | the file, which stays as the family's facade |
| scripts/passages.mjs:14 | scripts/passages.mjs | true | the file, which stays as the family's facade |
| scripts/patches.mjs:30 | scripts/patches.mjs | true | `markFired` stays in utils.mjs |
| scripts/patches.mjs:121 | scripts/patches.mjs | true | the file, which stays as the family's facade |
| scripts/patches.mjs:221 | scripts/patches.mjs | true | the file, which stays as the family's facade |
| scripts/patches.mjs:222 | scripts/patches.mjs | true | the file, which stays as the family's facade |
| scripts/patches.mjs:223 | scripts/patches.mjs | true | the file, which stays as the family's facade |
| scripts/patches.mjs:725 | scripts/patches.mjs | true | the file, which stays as the family's facade |
| scripts/patches.mjs:1420 | scripts/patches.mjs | true | the file, which stays as the family's facade |
| scripts/patches.mjs:1428 | scripts/patches.mjs | true | names `SHEET_ANCHORS`, which stay |
| scripts/player-status.mjs:587 | scripts/player-status.mjs | true | history: what the count was until E37, in the file it was in then |
| scripts/popup.mjs:28 | scripts/popup.mjs | true | the file, which stays as the family's facade |
| scripts/popup.mjs:1196 | scripts/popup.mjs | true | the file, which stays as the family's facade |
| scripts/popup.mjs:1242 | scripts/popup.mjs | true | the file, which stays as the family's facade |
| scripts/price.mjs:21 | scripts/price.mjs | true | the file, which stays as the family's facade |
| scripts/price.mjs:22 | scripts/price.mjs | true | the file, which stays as the family's facade |
| scripts/price.mjs:162 | scripts/price.mjs | true | `tamperPriceSkip` stays in cleanup.mjs |
| scripts/price.mjs:252 | scripts/price.mjs | true | `paidBack` stays in cleanup.mjs |
| scripts/projects-map.mjs:40 | scripts/projects-map.mjs | true | the file, which stays as the family's facade |
| scripts/projects-secrecy.mjs:24 | scripts/projects-secrecy.mjs | true | the file, which stays as the family's facade |
| scripts/projects-secrecy.mjs:63 | scripts/projects-secrecy.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/projects-tray.mjs:23 | scripts/projects-tray.mjs | true | the file, which stays as the family's facade |
| scripts/projects-ui.mjs:622 | scripts/projects-ui.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/projects.mjs:668 | scripts/projects.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/relay-guard.mjs:1021 | scripts/relay-guard.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/remnant-ring.mjs:41 | scripts/remnant-ring.mjs | true | the file, which stays as the family's facade |
| scripts/remnant-ring.mjs:118 | scripts/remnant-ring.mjs | true | `cssColour` stays in utils.mjs |
| scripts/remnants.mjs:40 | scripts/remnants.mjs | true | the file, which stays as the family's facade |
| scripts/remnants.mjs:180 | scripts/remnants.mjs | true | the file, which stays as the family's facade |
| scripts/remnants.mjs:326 | scripts/remnants.mjs | true | `undoLastCleanup` stays in cleanup.mjs |
| scripts/remnants.mjs:923 | scripts/remnants.mjs | true | `undoLastCleanup` stays in cleanup.mjs |
| scripts/remnants.mjs:1257 | scripts/remnants.mjs | true | names `label`, which stay |
| scripts/remnants.mjs:1737 | scripts/remnants.mjs | true | the file, which stays as the family's facade |
| scripts/remnants.mjs:1990 | scripts/remnants.mjs | true | `undoLastCleanup` stays in cleanup.mjs |
| scripts/remnants.mjs:2049 | scripts/remnants.mjs | true | the file, which stays as the family's facade |
| scripts/remnants.mjs:2203 | scripts/remnants.mjs | true | the file, which stays as the family's facade |
| scripts/remnants.mjs:2263 | scripts/remnants.mjs | true | the file, which stays as the family's facade |
| scripts/remnants.mjs:2314 | scripts/remnants.mjs | true | the file, which stays as the family's facade |
| scripts/remnants.mjs:2325 | scripts/remnants.mjs | true | the file, which stays as the family's facade |
| scripts/remnants.mjs:2574 | scripts/remnants.mjs | true | `undoLastCleanup` stays in cleanup.mjs |
| scripts/remnants.mjs:2873 | scripts/remnants.mjs | true | the file, which stays as the family's facade |
| scripts/requirements.mjs:333 | scripts/requirements.mjs | true | the file, which stays as the family's facade |
| scripts/reroll.mjs:372 | scripts/reroll.mjs | true | `undoLastCleanup` stays in cleanup.mjs |
| scripts/reroll.mjs:837 | scripts/reroll.mjs | true | the file, which stays as the family's facade |
| scripts/reroll.mjs:1062 | scripts/reroll.mjs | true | names `cleanup`, which stay |
| scripts/reroll.mjs:1638 | scripts/reroll.mjs | true | `authorsCopy` stays in cleanup.mjs |
| scripts/resource-guard.mjs:230 | scripts/resource-guard.mjs | true | `markResolutionStress` stays in cleanup.mjs |
| scripts/resource-guard.mjs:246 | scripts/resource-guard.mjs | true | the file, which stays as the family's facade |
| scripts/resource-guard.mjs:302 | scripts/resource-guard.mjs | true | the file, which stays as the family's facade |
| scripts/resources.mjs:13 | scripts/resources.mjs | true | the file, which stays as the family's facade |
| scripts/rest.mjs:109 | scripts/rest.mjs | true | the file, which stays as the family's facade |
| scripts/roll-draw.mjs:697 | scripts/roll-draw.mjs | true | the file, which stays as the family's facade |
| scripts/roll-draw.mjs:871 | scripts/roll-draw.mjs | true | `chargeTamper` stays in cleanup.mjs |
| scripts/roll-draw.mjs:1526 | scripts/roll-draw.mjs | true | `listOf` stays in utils.mjs |
| scripts/roll-draw.mjs:1796 | scripts/roll-draw.mjs | true | `cleanupTrait` stays in cleanup.mjs |
| scripts/roll-draw.mjs:1807 | scripts/roll-draw.mjs | true | `isCleaner` stays in cleanup.mjs |
| scripts/roll-draw.mjs:1842 | scripts/roll-draw.mjs | unchanged | `cleanupKey` is no top-level declaration of cleanup.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/roll-draw.mjs:1868 | scripts/roll-draw.mjs | true | the file, which stays as the family's facade |
| scripts/roll-draw.mjs:2061 | scripts/roll-draw.mjs | true | `attemptCleanup` stays in cleanup.mjs |
| scripts/roll-draw.mjs:2256 | scripts/roll-draw.mjs | true | `listOf` stays in utils.mjs |
| scripts/roll-draw.mjs:2643 | scripts/roll-draw.mjs | true | `listOf` stays in utils.mjs |
| scripts/rooms.mjs:559 | scripts/rooms.mjs | true | `workingScene` stays in utils.mjs |
| scripts/rules.mjs:493 | scripts/rules.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/search-tokens.mjs:39 | scripts/search-tokens.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/season-reset.mjs:34 | scripts/season-reset.mjs | true | the file, which stays as the family's facade |
| scripts/season-setup.mjs:847 | scripts/season-setup.mjs | unchanged | `pinFooterAcrossScroll` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/season-setup.mjs:1564 | scripts/season-setup.mjs | true | `localeFormat` stays in utils.mjs |
| scripts/season-wipe.mjs:45 | scripts/season-wipe.mjs | true | the file, which stays as the family's facade |
| scripts/season-wipe.mjs:653 | scripts/season-wipe.mjs | true | `clearChapterEndRecord` stays in chapter.mjs |
| scripts/secret.mjs:1016 | scripts/secret.mjs | true | the file, which stays as the family's facade |
| scripts/secret.mjs:1181 | scripts/secret.mjs | true | `privately` stays in utils.mjs |
| scripts/settings-window.mjs:315 | scripts/settings-window.mjs | true | `wholeNumber` stays in utils.mjs |
| scripts/settings.mjs:853 | scripts/settings.mjs | true | `chapterEndRecord` stays in chapter.mjs |
| scripts/settings.mjs:856 | scripts/settings.mjs | true | `applyChapterEnd` stays in chapter.mjs |
| scripts/settings.mjs:1509 | scripts/settings.mjs | true | the file, which stays as the family's facade |
| scripts/settings.mjs:2132 | scripts/settings.mjs | true | `undoLastCleanup` stays in cleanup.mjs |
| scripts/settings.mjs:3321 | scripts/settings.mjs | true | the file, which stays as the family's facade |
| scripts/settings.mjs:3324 | scripts/settings.mjs | true | the file, which stays as the family's facade |
| scripts/settings.mjs:3327 | scripts/settings.mjs | true | the file, which stays as the family's facade |
| scripts/settings.mjs:3545 | scripts/settings.mjs | true | the file, which stays as the family's facade |
| scripts/settings.mjs:3545 | scripts/settings.mjs | true | the file, which stays as the family's facade |
| scripts/settings.mjs:3711 | scripts/settings.mjs | true | the file, which stays as the family's facade |
| scripts/settings.mjs:3712 | scripts/settings.mjs | true | `log` stays in utils.mjs |
| scripts/settings.mjs:3742 | scripts/settings.mjs | true | `plural` stays in utils.mjs |
| scripts/settings.mjs:3743 | scripts/settings.mjs | true | the file, which stays as the family's facade |
| scripts/settings.mjs:3797 | scripts/settings.mjs | true | the file, which stays as the family's facade |
| scripts/settings.mjs:4305 | scripts/settings.mjs | true | the file, which stays as the family's facade |
| scripts/sheet-audit.mjs:240 | scripts/sheet-audit.mjs | unchanged | `dead` is no top-level declaration of chapter.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/sheet-audit.mjs:583 | scripts/sheet-audit.mjs | true | `forcedDeletion` stays in utils.mjs |
| scripts/sheet-audit.mjs:859 | scripts/sheet-audit.mjs | true | the file, which stays as the family's facade |
| scripts/sheet-audit.mjs:940 | scripts/sheet-audit.mjs | true | `undoLastCleanup` stays in cleanup.mjs |
| scripts/sheet-audit.mjs:988 | scripts/sheet-audit.mjs | true | the file, which stays as the family's facade |
| scripts/sheet-audit.mjs:1026 | scripts/sheet-audit.mjs | true | `markResolutionStress` stays in cleanup.mjs |
| scripts/sheet-audit.mjs:1036 | scripts/sheet-audit.mjs | true | `undoLastCleanup` stays in cleanup.mjs |
| scripts/sheet-audit.mjs:1052 | scripts/sheet-audit.mjs | true | `refundRefused` stays in cleanup.mjs |
| scripts/sheet.mjs:107 | scripts/sheet-mode.mjs | true | inside one declaration, which moves whole; still so in sheet-mode.mjs |
| scripts/sheet.mjs:348 | scripts/sheet-item.mjs | true | the module, not the file |
| scripts/sheet.mjs:377 | scripts/sheet-item.mjs | true | inside one declaration, which moves whole; still so in sheet-item.mjs |
| scripts/sheet.mjs:392 | scripts/sheet-item.mjs | true | ITEM_TABS_CUT moves with it into sheet-item.mjs |
| scripts/sheet.mjs:401 | scripts/sheet-item.mjs | true | inside one declaration, which moves whole; still so in sheet-item.mjs |
| scripts/sheet.mjs:419 | scripts/sheet-item.mjs | true | inside one declaration, which moves whole; still so in sheet-item.mjs |
| scripts/sheet.mjs:436 | scripts/sheet-item.mjs | true | inside one declaration, which moves whole; still so in sheet-item.mjs |
| scripts/sheet.mjs:464 | scripts/sheet-item.mjs | true | the module, not the file |
| scripts/sheet.mjs:724 | scripts/sheet-repaint.mjs | true | the repaint (`repaintInPlace`) is sheet-repaint.mjs's |
| scripts/sheet.mjs:726 | scripts/sheet-repaint.mjs | true | inside one declaration, which moves whole; still so in sheet-repaint.mjs |
| scripts/sheet.mjs:736 | scripts/sheet-repaint.mjs | true | the same |
| scripts/sheet.mjs:1083 | scripts/sheet-fit.mjs | true | the module, not the file |
| scripts/sheet.mjs:1110 | scripts/sheet-fit.mjs | true | `tabScrolls` moves with it into sheet-fit.mjs |
| scripts/sheet.mjs:1204 | scripts/sheet-fit.mjs | true | inside one declaration, which moves whole; still so in sheet-fit.mjs |
| scripts/sheet.mjs:1236 | scripts/sheet-fit.mjs | true | inside one declaration, which moves whole; still so in sheet-fit.mjs |
| scripts/sheet.mjs:1317 | scripts/sheet-fit.mjs | true | inside one declaration, which moves whole; still so in sheet-fit.mjs |
| scripts/sheet.mjs:1336 | scripts/sheet-fit.mjs | true | inside one declaration, which moves whole; still so in sheet-fit.mjs |
| scripts/sheet.mjs:1344 | scripts/sheet-fit.mjs | true | the module, not the file |
| scripts/sheet.mjs:1448 | scripts/sheet-header.mjs | true | the class is put there by sheet-header.mjs's own functions |
| scripts/sheet.mjs:1449 | scripts/sheet-header.mjs | true | inside one declaration, which moves whole; still so in sheet-header.mjs |
| scripts/sheet.mjs:1514 | scripts/sheet-header.mjs | true | the module, not the file |
| scripts/sheet.mjs:1712 | scripts/sheet-header.mjs | true | inside one declaration, which moves whole; still so in sheet-header.mjs |
| scripts/sheet.mjs:1885 | scripts/sheet-header.mjs | true | inside one declaration, which moves whole; still so in sheet-header.mjs |
| scripts/sheet.mjs:1948 | scripts/sheet-header.mjs | true | inside one declaration, which moves whole; still so in sheet-header.mjs |
| scripts/sheet.mjs:2302 | scripts/sheet-sidebar.mjs | true | inside one declaration, which moves whole; still so in sheet-sidebar.mjs |
| scripts/sheet.mjs:2348 | scripts/sheet-sidebar.mjs | true | inside one declaration, which moves whole; still so in sheet-sidebar.mjs |
| scripts/sheet.mjs:2562 | scripts/sheet-sidebar.mjs | true | inside one declaration, which moves whole; still so in sheet-sidebar.mjs |
| scripts/sheet.mjs:2607 | scripts/sheet-sidebar.mjs | true | the module, not the file |
| scripts/sheet.mjs:2823 | scripts/sheet-sidebar.mjs | true | the module, not the file |
| scripts/sheet.mjs:3034 | scripts/sheet-sidebar.mjs | true | inside one declaration, which moves whole; still so in sheet-sidebar.mjs |
| scripts/sheet.mjs:3084 | scripts/sheet-sidebar.mjs | true | the module, not the file |
| scripts/sheet.mjs:3186 | scripts/sheet-sidebar.mjs | true | inside one declaration, which moves whole; still so in sheet-sidebar.mjs |
| scripts/sheet.mjs:3243 | scripts/sheet-sidebar.mjs | true | inside one declaration, which moves whole; still so in sheet-sidebar.mjs |
| scripts/sheet.mjs:3328 | scripts/sheet-sidebar.mjs | true | inside one declaration, which moves whole; still so in sheet-sidebar.mjs |
| scripts/sheet.mjs:3360 | scripts/sheet-inventory.mjs | true | inside one declaration, which moves whole; still so in sheet-inventory.mjs |
| scripts/sheet.mjs:3544 | scripts/sheet-inventory.mjs | true | the module, not the file |
| scripts/sheet.mjs:3548 | scripts/sheet-inventory.mjs | true | the module, not the file |
| scripts/sheet.mjs:3769 | scripts/sheet-inventory.mjs | true | inside one declaration, which moves whole; still so in sheet-inventory.mjs |
| scripts/sheet.mjs:3971 | scripts/sheet-item.mjs | true | the module, not the file |
| scripts/sheet.mjs:4414 | scripts/sheet-inventory.mjs | true | inside one declaration, which moves whole; still so in sheet-inventory.mjs |
| scripts/sheet.mjs:4612 | scripts/sheet-actions.mjs | true | inside one declaration, which moves whole; still so in sheet-actions.mjs |
| scripts/sheet.mjs:4956 | scripts/sheet-actions.mjs | true | inside one declaration, which moves whole; still so in sheet-actions.mjs |
| scripts/sheet.mjs:4972 | scripts/sheet-actions.mjs | true | the module, not the file |
| scripts/sheet.mjs:4973 | scripts/sheet-actions.mjs | true | inside one declaration, which moves whole; still so in sheet-actions.mjs |
| scripts/sheet.mjs:5087 | scripts/sheet-actions.mjs | true | inside one declaration, which moves whole; still so in sheet-actions.mjs |
| scripts/sheet.mjs:5113 | scripts/sheet-actions.mjs | true | inside one declaration, which moves whole; still so in sheet-actions.mjs |
| scripts/sheet.mjs:5135 | scripts/sheet-actions.mjs | true | inside one declaration, which moves whole; still so in sheet-actions.mjs |
| scripts/sheet.mjs:5153 | scripts/sheet-actions.mjs | true | inside one declaration, which moves whole; still so in sheet-actions.mjs |
| scripts/sheet.mjs:5335 | scripts/sheet-actions.mjs | true | inside one declaration, which moves whole; still so in sheet-actions.mjs |
| scripts/sheet.mjs:5367 | scripts/sheet-actions.mjs | true | inside one declaration, which moves whole; still so in sheet-actions.mjs |
| scripts/sheet.mjs:5380 | scripts/sheet-actions.mjs | true | inside one declaration, which moves whole; still so in sheet-actions.mjs |
| scripts/sheet.mjs:5649 | scripts/sheet-actions.mjs | true | inside one declaration, which moves whole; still so in sheet-actions.mjs |
| scripts/sheet.mjs:5682 | scripts/sheet-actions.mjs | true | inside one declaration, which moves whole; still so in sheet-actions.mjs |
| scripts/sheet.mjs:5770 | scripts/sheet-actions.mjs | true | the file, which stays as the family's facade |
| scripts/sheet.mjs:5886 | scripts/sheet-fit.mjs | true | inside one declaration, which moves whole; still so in sheet-fit.mjs |
| scripts/states.mjs:443 | scripts/states.mjs | true | the file, which stays as the family's facade |
| scripts/steps.mjs:7 | scripts/steps.mjs | true | `endChapterNow` stays in chapter.mjs |
| scripts/steps.mjs:34 | scripts/steps.mjs | true | the file, which stays as the family's facade |
| scripts/sync.mjs:477 | scripts/sync.mjs | true | the file, which stays as the family's facade |
| scripts/tables-editor.mjs:1390 | scripts/tables-editor.mjs | true | the file, which stays as the family's facade |
| scripts/tests-flows.mjs:223 | scripts/tests-flows.mjs | unchanged | `meddleButton` is no top-level declaration of sheet.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/tests-grid.mjs:752 | scripts/tests-grid.mjs | true | the file, which stays as the family's facade |
| scripts/tests-grid.mjs:1436 | scripts/tests-grid.mjs | true | names `DRPG`, which stay |
| scripts/tests-kit.mjs:2413 | scripts/tests-kit.mjs | true | the file, which stays as the family's facade |
| scripts/tests-text.mjs:90 | scripts/tests-text.mjs | true | `listOf` stays in utils.mjs |
| scripts/tests-text.mjs:357 | scripts/tests-text.mjs | true | `plural` stays in utils.mjs |
| scripts/tests-text.mjs:709 | scripts/tests-text.mjs | true | the file, which stays as the family's facade |
| scripts/tests-text.mjs:1029 | scripts/tests-text.mjs | true | the file, which stays as the family's facade |
| scripts/tests-text.mjs:1673 | scripts/tests-text.mjs | true | `listOf` stays in utils.mjs |
| scripts/tests-text.mjs:1966 | scripts/tests-text.mjs | true | the file, which stays as the family's facade |
| scripts/tests-text.mjs:2066 | scripts/tests-text.mjs | true | the file, which stays as the family's facade |
| scripts/tests-text.mjs:2097 | scripts/tests-text.mjs | true | `listOf` stays in utils.mjs |
| scripts/tests-text.mjs:2261 | scripts/tests-text.mjs | true | `plural` stays in utils.mjs |
| scripts/tests-tier0.mjs:919 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:972 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:1745 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:2023 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:5845 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:6168 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:7189 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:8402 | scripts/tests-tier0.mjs | true | `sweepPlan` stays in chapter.mjs |
| scripts/tests-tier0.mjs:8409 | scripts/tests-tier0.mjs | true | `revealPlan` stays in chapter.mjs |
| scripts/tests-tier0.mjs:8773 | scripts/tests-tier0.mjs | true | a history note: the census row as E45 C1 struck it, keyed by the file it stood in then |
| scripts/tests-tier0.mjs:10695 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:12444 | scripts/tests-tier0.mjs | true | `serverNow` stays in utils.mjs |
| scripts/tests-tier0.mjs:12674 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:12687 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:12816 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:13368 | scripts/tests-tier0.mjs | true | `placeRoomOptions` stays in utils.mjs |
| scripts/tests-tier0.mjs:14769 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:15993 | scripts/tests-tier0.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/tests-tier0.mjs:16669 | scripts/tests-tier0.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/tests-tier0.mjs:17426 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:17428 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:17435 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:17645 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:18172 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:18296 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:18963 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:19106 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:19515 | scripts/tests-tier0.mjs | true | history: what `trackedStudents` was before, in the file it was in then |
| scripts/tests-tier0.mjs:19613 | scripts/tests-tier0.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/tests-tier0.mjs:19733 | scripts/tests-tier0.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/tests-tier0.mjs:20351 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:20355 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:20852 | scripts/tests-tier0.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/tests-tier0.mjs:21076 | scripts/tests-tier0.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/tests-tier0.mjs:21083 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:21260 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:21262 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:21411 | scripts/tests-tier0.mjs | unchanged | `mayEditReserve` is no top-level declaration of sheet.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/tests-tier0.mjs:21465 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:21894 | scripts/tests-tier0.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier0.mjs:22194 | scripts/tests-tier0.mjs | true | `chapterEndForm` stays in chapter.mjs |
| scripts/tests-tier1.mjs:89 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:5854 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:8175 | scripts/tests-tier1.mjs | true | `openNewTrace` stays in investigation.mjs |
| scripts/tests-tier1.mjs:9971 | scripts/tests-tier1.mjs | true | `chapterEndForm` stays in chapter.mjs |
| scripts/tests-tier1.mjs:10003 | scripts/tests-tier1.mjs | true | `caseFinalPanel` stays in investigation.mjs |
| scripts/tests-tier1.mjs:10244 | scripts/tests-tier1.mjs | true | `applyMoveBody` stays in cleanup.mjs |
| scripts/tests-tier1.mjs:10812 | scripts/tests-tier1.mjs | true | `attemptCleanup` stays in cleanup.mjs |
| scripts/tests-tier1.mjs:11880 | scripts/tests-tier1.mjs | true | `GM_ROUTE_CLASS` stays in utils.mjs |
| scripts/tests-tier1.mjs:20662 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:21009 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:25354 | scripts/tests-tier1.mjs | true | `cssColour` stays in utils.mjs |
| scripts/tests-tier1.mjs:26787 | scripts/tests-tier1.mjs | true | `localeFormat` stays in utils.mjs |
| scripts/tests-tier1.mjs:27575 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:28925 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:32365 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:32369 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:32532 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:32541 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:33706 | scripts/tests-tier1.mjs | true | `wholeNumber` stays in utils.mjs |
| scripts/tests-tier1.mjs:34213 | scripts/tests-tier1.mjs | true | names `localeFormat`, which stay |
| scripts/tests-tier1.mjs:34415 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:34540 | scripts/tests-tier1.mjs | true | `listOf` stays in utils.mjs |
| scripts/tests-tier1.mjs:35506 | scripts/tests-tier1.mjs | true | `endChapterNow` stays in chapter.mjs |
| scripts/tests-tier1.mjs:38305 | scripts/tests-tier1.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/tests-tier1.mjs:38474 | scripts/tests-tier1.mjs | true | `dialogContent` stays in utils.mjs |
| scripts/tests-tier1.mjs:38567 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:41750 | scripts/tests-tier1.mjs | unchanged | `paintResourceBars` is no top-level declaration of sheet.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/tests-tier1.mjs:42205 | scripts/tests-tier1.mjs | unchanged | `viewerOf` is no top-level declaration of sheet.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/tests-tier1.mjs:43177 | scripts/tests-tier1.mjs | true | `cssColour` stays in utils.mjs |
| scripts/tests-tier1.mjs:45872 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:47269 | scripts/tests-tier1.mjs | true | `caseHtml` stays in investigation.mjs |
| scripts/tests-tier1.mjs:48797 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier1.mjs:51524 | scripts/tests-tier1.mjs | true | names `DRPG`, which stay |
| scripts/tests-tier1.mjs:51526 | scripts/tests-tier1.mjs | true | names `DRPG`, `CHAPTER_END_STEPS`, which stay |
| scripts/tests-tier1.mjs:52027 | scripts/tests-tier1.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:454 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:468 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:855 | scripts/tests-tier2.mjs | true | `confirmSweepBullets` stays in investigation.mjs |
| scripts/tests-tier2.mjs:856 | scripts/tests-tier2.mjs | true | `openChapterEndDialog` stays in chapter.mjs |
| scripts/tests-tier2.mjs:2400 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:2931 | scripts/tests-tier2.mjs | true | `authorsCopy` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:4269 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:4556 | scripts/tests-tier2.mjs | true | `attemptCleanup` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:6076 | scripts/tests-tier2.mjs | true | `endResolution` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:6271 | scripts/tests-tier2.mjs | true | `noteCleaningTool` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:6330 | scripts/tests-tier2.mjs | true | `cleanupDc` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:6399 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:6465 | scripts/tests-tier2.mjs | true | `noteCleaningTool` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:6766 | scripts/tests-tier2.mjs | true | `consumeFreeCleanup` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:6869 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:9015 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:9021 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:9203 | scripts/tests-tier2.mjs | true | `record` stays in utils.mjs |
| scripts/tests-tier2.mjs:9204 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:9207 | scripts/tests-tier2.mjs | true | `warn` stays in utils.mjs |
| scripts/tests-tier2.mjs:14141 | scripts/tests-tier2.mjs | true | `whisperToOwner` stays in utils.mjs |
| scripts/tests-tier2.mjs:15227 | scripts/tests-tier2.mjs | true | `cleanupTrait` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:17482 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:18530 | scripts/tests-tier2.mjs | true | `undoLastCleanup` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:18567 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:18678 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:19297 | scripts/tests-tier2.mjs | true | `chargeTamper` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:19403 | scripts/tests-tier2.mjs | true | `refundRefused` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:19457 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:19553 | scripts/tests-tier2.mjs | true | `handBack` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:19650 | scripts/tests-tier2.mjs | true | `paidBack` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:19740 | scripts/tests-tier2.mjs | true | `applyMoveBody` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:22525 | scripts/tests-tier2.mjs | true | `confirmSweepBullets` stays in investigation.mjs |
| scripts/tests-tier2.mjs:22526 | scripts/tests-tier2.mjs | true | `openChapterEndDialog` stays in chapter.mjs |
| scripts/tests-tier2.mjs:24622 | scripts/tests-tier2.mjs | true | `dialogContent` stays in utils.mjs |
| scripts/tests-tier2.mjs:24840 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:25641 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:25961 | scripts/tests-tier2.mjs | true | `applyChapterEnd` stays in chapter.mjs |
| scripts/tests-tier2.mjs:26392 | scripts/tests-tier2.mjs | true | `cleanupRefusal` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:26671 | scripts/tests-tier2.mjs | true | `applyMisleadingTrail` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:27080 | scripts/tests-tier2.mjs | true | `openInvestigationDashboard` stays in investigation.mjs |
| scripts/tests-tier2.mjs:27125 | scripts/tests-tier2.mjs | true | `mapEditors` stays in investigation.mjs |
| scripts/tests-tier2.mjs:27681 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:27864 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:27866 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:28420 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:29766 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:29905 | scripts/tests-tier2.mjs | true | `sparedBySweep` stays in chapter.mjs |
| scripts/tests-tier2.mjs:31104 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:39345 | scripts/tests-tier2.mjs | true | `paidBack` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:42700 | scripts/tests-tier2.mjs | true | `resolveStageSix` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:43359 | scripts/tests-tier2.mjs | true | `proseOf` stays in utils.mjs |
| scripts/tests-tier2.mjs:44534 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:44558 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:44844 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:45965 | scripts/tests-tier2.mjs | true | `privately` stays in utils.mjs |
| scripts/tests-tier2.mjs:47303 | scripts/tests-tier2.mjs | true | `resolveStageSix` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:47345 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:52159 | scripts/tests-tier2.mjs | true | `spendStress` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:52192 | scripts/tests-tier2.mjs | true | `handBack` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:52252 | scripts/tests-tier2.mjs | true | `undoLastCleanup` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:52321 | scripts/tests-tier2.mjs | true | `waivePrice` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:52390 | scripts/tests-tier2.mjs | true | `undoLastCleanup` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:52960 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:53944 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:54953 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:56661 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:57857 | scripts/tests-tier2.mjs | true | `privately` stays in utils.mjs |
| scripts/tests-tier2.mjs:61201 | scripts/tests-tier2.mjs | true | `bodyIsHere` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:61842 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:63915 | scripts/tests-tier2.mjs | true | `ownerOf` stays in utils.mjs |
| scripts/tests-tier2.mjs:69337 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:71864 | scripts/tests-tier2.mjs | true | `dialogContent` stays in utils.mjs |
| scripts/tests-tier2.mjs:71957 | scripts/tests-tier2.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/tests-tier2.mjs:72167 | scripts/tests-tier2.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/tests-tier2.mjs:72365 | scripts/tests-tier2.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/tests-tier2.mjs:72606 | scripts/tests-tier2.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/tests-tier2.mjs:72855 | scripts/tests-tier2.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/tests-tier2.mjs:72923 | scripts/tests-tier2.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/tests-tier2.mjs:79118 | scripts/tests-tier2.mjs | true | names `takeCrisisAction`, which stay |
| scripts/tests-tier2.mjs:79684 | scripts/tests-tier2.mjs | true | `runDashboardButton` stays in investigation.mjs |
| scripts/tests-tier2.mjs:79694 | scripts/tests-tier2.mjs | true | `sweepTruthBullets` stays in chapter.mjs |
| scripts/tests-tier2.mjs:82228 | scripts/tests-tier2.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/tests-tier2.mjs:85925 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:87372 | scripts/tests-tier2.mjs | true | `applyMoveBody` stays in cleanup.mjs |
| scripts/tests-tier2.mjs:87668 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/tests-tier2.mjs:87886 | scripts/tests-tier2.mjs | true | the file, which stays as the family's facade |
| scripts/traps.mjs:68 | scripts/traps.mjs | true | the file, which stays as the family's facade |
| scripts/trial-floor.mjs:48 | scripts/trial-floor.mjs | true | `serverNow` stays in utils.mjs |
| scripts/trial-progress.mjs:476 | scripts/trial-progress.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/trial-progress.mjs:553 | scripts/trial-progress.mjs | true | `CHAPTER_END_STEPS` stays in chapter.mjs |
| scripts/trial-scene.mjs:1498 | scripts/trial-scene.mjs | true | `wirePortraitPickers` stays in utils.mjs |
| scripts/trial.mjs:449 | scripts/trial.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/trial.mjs:477 | scripts/trial.mjs | true | the file, which stays as the family's facade |
| scripts/trial.mjs:749 | scripts/trial.mjs | true | `serialWrite` stays in utils.mjs |
| scripts/trial.mjs:1666 | scripts/trial.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/truth-bullets.mjs:353 | scripts/truth-bullets.mjs | true | the file, which stays as the family's facade |
| scripts/truth-bullets.mjs:423 | scripts/truth-bullets.mjs | true | the file, which stays as the family's facade |
| scripts/truth-bullets.mjs:616 | scripts/truth-bullets.mjs | true | the file, which stays as the family's facade |
| scripts/truth-bullets.mjs:969 | scripts/truth-bullets.mjs | true | `sparedBySweep` stays in chapter.mjs |
| scripts/ui-columns.mjs:48 | scripts/ui-columns.mjs | true | `GM_ROUTE_CLASS` stays in utils.mjs |
| scripts/ui-kit.mjs:55 | scripts/ui-kit.mjs | true | the file, which stays as the family's facade |
| scripts/ui-kit.mjs:55 | scripts/ui-kit.mjs | true | the file, which stays as the family's facade |
| scripts/ui-kit.mjs:351 | scripts/ui-kit.mjs | unchanged | `wirePanelTabs` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/ui-kit.mjs:457 | scripts/ui-kit.mjs | true | the file, which stays as the family's facade |
| scripts/ui-kit.mjs:1346 | scripts/ui-kit.mjs | unchanged | `tableDialog` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/ui-kit.mjs:1377 | scripts/ui-kit.mjs | unchanged | `fitWindowToTable` is no top-level declaration of utils.mjs at the base (gone before E54, an import, a field or a local): not this cut's |
| scripts/use-items.mjs:109 | scripts/use-items.mjs | true | the file, which stays as the family's facade |
| scripts/user-match.mjs:65 | scripts/user-match.mjs | true | `isPrimaryGm` stays in utils.mjs |
| scripts/utils.mjs:11 | scripts/utils.mjs | true | the file, which stays as the family's facade |
| scripts/utils.mjs:41 | scripts/utils.mjs | true | the file, which stays as the family's facade |
| scripts/utils.mjs:118 | scripts/utils.mjs | true | the file, which stays as the family's facade |
| scripts/utils.mjs:717 | scripts/utils.mjs | true | the file, which stays as the family's facade |
| scripts/utils.mjs:1161 | scripts/windows.mjs | true | inside one declaration, which moves whole; still so in windows.mjs |
| scripts/utils.mjs:1163 | scripts/windows.mjs | true | the module, not the file |
| scripts/utils.mjs:1185 | scripts/windows.mjs | true | "written here" is the code, not the file |
| scripts/utils.mjs:1262 | scripts/utils.mjs | true | the file, which stays as the family's facade |
| scripts/utils.mjs:1288 | scripts/utils.mjs | true | the file, which stays as the family's facade |
| scripts/utils.mjs:1340 | scripts/utils.mjs | true | the file, which stays as the family's facade |
| scripts/vault-store.mjs:607 | scripts/vault-store.mjs | true | the file, which stays as the family's facade |
| scripts/voice-tile.mjs:99 | scripts/voice-tile.mjs | true | the file, which stays as the family's facade |
| scripts/voice.mjs:2237 | scripts/voice.mjs | true | `privately` stays in utils.mjs |
| styles/components.css:1397 | styles/components.css | true | `tickerRuns` stays in utils.mjs |
| styles/components.css:3140 | styles/components.css | true | the file, which stays as the family's facade |
| styles/components.css:3220 | styles/components.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:243 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:398 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:666 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:853 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:863 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:1350 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:1556 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:1613 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:1674 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:1839 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:4237 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:4246 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:4315 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:4618 | styles/danganronpa.css | true | names `data`, which stay |
| styles/danganronpa.css:4723 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:4928 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:5615 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:5887 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:8344 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:8734 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:8847 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:8849 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:9357 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:10174 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:11211 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:11759 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:12459 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:12537 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/danganronpa.css:12544 | styles/danganronpa.css | true | the file, which stays as the family's facade |
| styles/stained-glass.css:3691 | styles/stained-glass.css | true | the file, which stays as the family's facade |
| styles/stained-glass.css:4175 | styles/stained-glass.css | true | names `drpg`, which stay |
| tools/moved-only.mjs:1036 | tools/moved-only.mjs | true | the file, which stays as the family's facade |
| tools/text-audience.mjs:8 | tools/text-audience.mjs | true | `announce` stays in utils.mjs |
| tools/text-audience.mjs:13 | tools/text-audience.mjs | true | `gmReport` stays in utils.mjs |
| tools/text-audience.mjs:15 | tools/text-audience.mjs | true | names `privately`, which stay |
| tools/text-audience.mjs:39 | tools/text-audience.mjs | true | `privately` stays in utils.mjs |
| tools/text-audience.mjs:240 | tools/text-audience.mjs | true | `privately` stays in utils.mjs |
| tools/text-audience.mjs:307 | tools/text-audience.mjs | true | names `privately`, which stay |
| tools/text-map.mjs:23 | tools/text-map.mjs | true | `announce` stays in utils.mjs |
| tools/text-render.mjs:24 | tools/text-render.mjs | true | the file, which stays as the family's facade |
| tools/text-render.mjs:24 | tools/text-render.mjs | true | the file, which stays as the family's facade |
| tools/text-render.mjs:28 | tools/text-render.mjs | true | the file, which stays as the family's facade |
| tools/text-render.mjs:29 | tools/text-render.mjs | true | the file, which stays as the family's facade |
| tools/text-render.mjs:29 | tools/text-render.mjs | true | the file, which stays as the family's facade |

Test texts that stay true or are unchanged: 101 (tests-tier0.mjs:914, tests-tier0.mjs:941, tests-tier0.mjs:6199, tests-tier0.mjs:6202, tests-tier0.mjs:6209, tests-tier0.mjs:7186, tests-tier0.mjs:7250, tests-tier0.mjs:11926, tests-tier0.mjs:11966, tests-tier0.mjs:12457, tests-tier0.mjs:12712, tests-tier0.mjs:12712, tests-tier0.mjs:14799, tests-tier0.mjs:15832, tests-tier0.mjs:16275, tests-tier0.mjs:17424, tests-tier0.mjs:17444, tests-tier0.mjs:17447, tests-tier0.mjs:18158, tests-tier0.mjs:18374, tests-tier0.mjs:18690, tests-tier0.mjs:18934, tests-tier0.mjs:19096, tests-tier0.mjs:19113, tests-tier0.mjs:19259, tests-tier0.mjs:20070, tests-tier0.mjs:20086, tests-tier0.mjs:20165, tests-tier0.mjs:20344, tests-tier0.mjs:20388, tests-tier0.mjs:20405, tests-tier0.mjs:20496, tests-tier0.mjs:21145, tests-tier0.mjs:21254, tests-tier0.mjs:21284, tests-tier0.mjs:21302, tests-tier0.mjs:21406, tests-tier0.mjs:21461, tests-tier0.mjs:21480, tests-tier0.mjs:22250, tests-tier0.mjs:22654, tests-tier0.mjs:22720, tests-tier0.mjs:22785, tests-tier0.mjs:22796, tests-tier0.mjs:22849, tests-tier1.mjs:415, tests-tier1.mjs:9685, tests-tier1.mjs:9878, tests-tier1.mjs:9980, tests-tier1.mjs:10009, tests-tier1.mjs:10822, tests-tier1.mjs:19531, tests-tier1.mjs:21028, tests-tier1.mjs:22037, tests-tier1.mjs:28167, tests-tier1.mjs:32377, tests-tier1.mjs:32530, tests-tier1.mjs:32572, tests-tier1.mjs:33232, tests-tier1.mjs:33749, tests-tier1.mjs:34266, tests-tier1.mjs:34281, tests-tier1.mjs:34468, tests-tier1.mjs:34483, tests-tier1.mjs:35503, tests-tier1.mjs:35583, tests-tier1.mjs:35639, tests-tier1.mjs:35856, tests-tier1.mjs:37662, tests-tier1.mjs:37672, tests-tier1.mjs:37708, tests-tier1.mjs:37833, tests-tier1.mjs:38641, tests-tier1.mjs:39253, tests-tier1.mjs:41889, tests-tier1.mjs:41933, tests-tier1.mjs:42172, tests-tier1.mjs:42283, tests-tier1.mjs:42339, tests-tier1.mjs:42473, tests-tier1.mjs:42523, tests-tier1.mjs:42860, tests-tier1.mjs:42944, tests-tier1.mjs:43528, tests-tier1.mjs:43893, tests-tier1.mjs:43968, tests-tier1.mjs:44056, tests-tier1.mjs:44096, tests-tier1.mjs:44131, tests-tier1.mjs:44580, tests-tier1.mjs:45793, tests-tier1.mjs:47266, tests-tier1.mjs:48112, tests-tier1.mjs:50365, tests-tier1.mjs:51225, tests-tier1.mjs:51354, tests-tier2.mjs:55701, tests-tier2.mjs:84766, tests-tier2.mjs:86124, tests-tier2.mjs:87817, tests-tier2.mjs:88173).
| tools/text-render.mjs:29 | tools/text-render.mjs | true | the file, which stays as the family's facade |

Test texts that stay true or are unchanged: 90 (tests-tier0.mjs:914, tests-tier0.mjs:941, tests-tier0.mjs:6199, tests-tier0.mjs:6202, tests-tier0.mjs:6209, tests-tier0.mjs:7186, tests-tier0.mjs:7250, tests-tier0.mjs:11926, tests-tier0.mjs:11966, tests-tier0.mjs:12457, tests-tier0.mjs:12712, tests-tier0.mjs:12712, tests-tier0.mjs:14799, tests-tier0.mjs:15832, tests-tier0.mjs:16275, tests-tier0.mjs:17424, tests-tier0.mjs:17444, tests-tier0.mjs:17447, tests-tier0.mjs:18158, tests-tier0.mjs:18374, tests-tier0.mjs:18690, tests-tier0.mjs:18934, tests-tier0.mjs:19096, tests-tier0.mjs:19113, tests-tier0.mjs:19259, tests-tier0.mjs:20070, tests-tier0.mjs:20086, tests-tier0.mjs:20165, tests-tier0.mjs:20344, tests-tier0.mjs:20388, tests-tier0.mjs:20405, tests-tier0.mjs:20496, tests-tier0.mjs:21145, tests-tier0.mjs:21254, tests-tier0.mjs:21284, tests-tier0.mjs:21302, tests-tier0.mjs:21406, tests-tier0.mjs:21461, tests-tier0.mjs:21480, tests-tier0.mjs:22250, tests-tier0.mjs:22654, tests-tier0.mjs:22720, tests-tier0.mjs:22785, tests-tier0.mjs:22796, tests-tier0.mjs:22849, tests-tier1.mjs:415, tests-tier1.mjs:9685, tests-tier1.mjs:9878, tests-tier1.mjs:9980, tests-tier1.mjs:10009, tests-tier1.mjs:19531, tests-tier1.mjs:21028, tests-tier1.mjs:22037, tests-tier1.mjs:28167, tests-tier1.mjs:32377, tests-tier1.mjs:32530, tests-tier1.mjs:32572, tests-tier1.mjs:33232, tests-tier1.mjs:33749, tests-tier1.mjs:34266, tests-tier1.mjs:34281, tests-tier1.mjs:34468, tests-tier1.mjs:34483, tests-tier1.mjs:35503, tests-tier1.mjs:35583, tests-tier1.mjs:35639, tests-tier1.mjs:35856, tests-tier1.mjs:37662, tests-tier1.mjs:37672, tests-tier1.mjs:37708, tests-tier1.mjs:37833, tests-tier1.mjs:38641, tests-tier1.mjs:39253, tests-tier1.mjs:41889, tests-tier1.mjs:41933, tests-tier1.mjs:42172, tests-tier1.mjs:43893, tests-tier1.mjs:43968, tests-tier1.mjs:44056, tests-tier1.mjs:44096, tests-tier1.mjs:44580, tests-tier1.mjs:45793, tests-tier1.mjs:47266, tests-tier1.mjs:48112, tests-tier1.mjs:50365, tests-tier1.mjs:51354, tests-tier2.mjs:84766, tests-tier2.mjs:86124, tests-tier2.mjs:87817, tests-tier2.mjs:88173).
## Appendix - how it was read

Four throwaway scripts, run 13.11.2026 on 421f2395 and on the five cut trees of SPLIT-STATUS.md (the scripts as
committed, 84816bc0); not in the repository, by the brief (a document only), and kept to be committed if the sweep
wants to run them again:

- `find.mjs` - every comment of scripts/, styles/, tools/ and audit/ (espree's comments for .mjs, `/* */` for .css;
  tools/e54/ and the copied Daggerheart files left out), line by line: a cut's file named (with the function after it
  in backticks, or a `:<n>`), and in a cut's source the location words ("here and not in", "lives here", "reads it
  here", "this file", "this module", "below", "above" ...), each with the declaration that owns the line and its file
  after the cut.
- `rel.mjs` - for each location word in moved code, the functions the line names and where each stands after the cut,
  so that "below `x`" can be checked against the new file.
- `classify.mjs` - the rules of "How each was judged", with the hand-read verdicts of every "this file" and "here".
- `tests.mjs` - the string tokens of the tier files that name a cut's file and are a test's name or an argument of
  `ok`, `equal`, `must` or `needs`.

What it does not read: documents, the handbooks, and a comment that describes moved code without naming its file
(prose such as "the sheet's action panel"), which no pattern finds.
