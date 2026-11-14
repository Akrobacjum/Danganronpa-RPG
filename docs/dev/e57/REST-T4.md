# E57 rest, T4 (lengthOver): what stays a report

Read on 14.11.2026 on claude/e57-t4-113 by `node tools/check.mjs text --all`. T4 is FAIL since this line's first commit, at 0:
red is a string over the **limit** of a surface whose `fail` is a stage (docs/text-style.md B1, DB11, the owner's: the target is the
report's number, the limit fails the player's and the settings' texts). What is below is T4's `reported` list, printed in either
mode and never red: a string over its surface's **target**, at or under its limit. None is over a limit.

## How the 325 at 6cd30a92 went

| | Count | What |
| --- | --- | --- |
| Over a limit, red surface | 3 -> 0 | HOPE_CALLS.relief.effect en 51 -> 45 and pl 46 -> 44 words, ACTIONS.move.description en 46 -> 45; each kept to B01a's facts (R5981's Breath in both) |
| Over a limit, surface not red (fail null) | 1 -> 0 | DRPG.Reroll.traceKept, a GM card, en 69 -> 60 words (every reason `removalRefusal` gives kept; scenario 30's split at `{trace}` holds); its Polish's dashes made commas to match |
| Misread by a key rule | 8 -> 0 | presentByButton, objectionByButton (en, pl): no button, now read by their senders (a player's card, a toast), both under the target; Facility.editor.tabNote, tabLine (en, pl): a tab's note, not its name, now unclassified. docs/text-budgets.json's button and tab rules, each with its note |
| Over a target only | 313 -> 317 reported | the 313, plus relief, move and traceKept, still over their targets and at their limits. 68 of the 317 are texts the owner approved (a batch's `owner` verdict) or the pilot's |

Allowed: none (docs/text-budgets.json `allow` holds no T4 row from this line).

## Why the over-target texts were not cut

They are a report by B1, and B2 says the targets themselves are still to be confirmed in E71 (row 1.2.122): the owner's pilot of
01.11.2026 approved texts over them and named no number. Most of these texts were rewritten by the E71 text lines from their batch
facts (docs/dev/text-batch-*.json) and grew because a review asked for a fact back (docs/dev/e71/STATUS-B.md, STATUS-C.md: "each over a
target, none over a limit"). Cutting them to a target the owner has not confirmed would drop facts a review put in, so they stay as they
are until E71 settles the numbers. If E71 lowers a limit under one of these, T4 makes it red then.

## The list

| Surface | target / limit | lang/en | lang/pl | config prose |
| --- | --- | --- | --- | --- |
| toast | 20 / 30 | 52 | 50 | 0 |
| config-description | 30 / 45 | 0 | 32 | 40 |
| tooltip | 15 / 23 | 29 | 23 | 0 |
| gm-card | 40 / 60 | 18 | 19 | 0 |
| settings-hint | 25 / 38 | 12 | 8 | 0 |
| window-title | 5 / 8 | 12 | 7 | 0 |
| tile-hint | 30 / 45 | 0 | 4 | 6 |
| button | 4 / 6 | 1 | 1 | 0 |
| tab | 5 / 8 | 1 | 1 | 0 |
| player-card | 40 / 60 | 1 | 0 | 0 |

### lang/en.json (126)

| Key | Surface | Words / target | Batch | Owner approved |
| --- | --- | --- | --- | --- |
| DRPG.Action.murderParked | player-card | 42 / 40 | B04 | - |
| DRPG.Actions.pipTooltip | tooltip | 18 / 15 | B04 | - |
| DRPG.Actions.woundedTooltip | tooltip | 18 / 15 | B04 | - |
| DRPG.Advance.da39.title | window-title | 6 / 5 | - | - |
| DRPG.Advance.notOfferedHere | gm-card | 57 / 40 | - | - |
| DRPG.Advance.offerStillStands | toast | 23 / 20 | B10b | - |
| DRPG.Advance.takeBackBusy | toast | 28 / 20 | B10b | - |
| DRPG.Advance.takeBackTaking | toast | 28 / 20 | B10b | - |
| DRPG.Anonymity.blocked | toast | 23 / 20 | B18 | - |
| DRPG.Assign.noMonokumas | toast | 21 / 20 | B15 | - |
| DRPG.Audit.awayTitle | window-title | 7 / 5 | B12 | - |
| DRPG.Audit.listTitle | window-title | 6 / 5 | B12 | - |
| DRPG.Body.noToken | toast | 25 / 20 | B03 | - |
| DRPG.Calls.gatherRoomGone | toast | 30 / 20 | B06 | - |
| DRPG.Calls.pendingTooltip | tooltip | 20 / 15 | B06 | - |
| DRPG.Case.chargeHeld.one | gm-card | 47 / 40 | - | - |
| DRPG.Case.chargeHeld.other | gm-card | 47 / 40 | - | - |
| DRPG.Chapter.bodyAnnouncedAlready | toast | 22 / 20 | B10b | - |
| DRPG.Chapter.bodyPrimaryOnly | toast | 21 / 20 | - | - |
| DRPG.Chapter.deathsStillSecret.one | toast | 30 / 20 | - | - |
| DRPG.Chapter.deathsStillSecret.other | toast | 30 / 20 | - | - |
| DRPG.Chapter.endPrimaryOnly | toast | 21 / 20 | - | - |
| DRPG.Chapter.finishPhaseMoved | toast | 29 / 20 | - | - |
| DRPG.Chapter.youFoundBodyWith | toast | 24 / 20 | - | - |
| DRPG.Cleanup.reshapeRulingTitle | window-title | 6 / 5 | - | - |
| DRPG.Cleanup.reshapeUnsent | gm-card | 45 / 40 | B05 | - |
| DRPG.Clock.eclipseStillOn | toast | 21 / 20 | B09 | - |
| DRPG.Clock.takenBack | toast | 23 / 20 | B09 | - |
| DRPG.Despair.pipTooltip | tooltip | 18 / 15 | B01b | - |
| DRPG.DiceLook.settingBackUnheard | toast | 27 / 20 | - | - |
| DRPG.DiceLook.stopped | toast | 26 / 20 | - | - |
| DRPG.Eclipse.actionsLocked | toast | 22 / 20 | B09 | - |
| DRPG.Errors.oldSystem | toast | 21 / 20 | B12 | - |
| DRPG.Floor.newTrialRefused | toast | 23 / 20 | B10a | - |
| DRPG.Frisk.forceTitle | window-title | 6 / 5 | B08 | - |
| DRPG.Hud.eclipseRunningTooltip | tooltip | 22 / 15 | B09 | - |
| DRPG.Investigation.newTraceUnfindable | toast | 26 / 20 | B16 | - |
| DRPG.Investigation.noRooms | toast | 22 / 20 | B16 | - |
| DRPG.Investigation.savedOver.one | toast | 28 / 20 | - | - |
| DRPG.Investigation.savedOver.other | toast | 28 / 20 | - | - |
| DRPG.Investigation.saveStopped | toast | 22 / 20 | B16 | - |
| DRPG.Items.brokenTooltip | tooltip | 22 / 15 | B08 | - |
| DRPG.Loot.takeTooltip | tooltip | 23 / 15 | B08 | - |
| DRPG.Migrate.failed | toast | 22 / 20 | B15 | - |
| DRPG.Migrate.notPrimary | toast | 21 / 20 | B15 | - |
| DRPG.Movement.droppedFromNowhere | gm-card | 45 / 40 | B09 | - |
| DRPG.Movement.unlawfulArrival | gm-card | 54 / 40 | B09 | - |
| DRPG.Murder.betrayalButton | button | 5 / 4 | - | - |
| DRPG.Murder.castMissingHere | toast | 30 / 20 | B03 | - |
| DRPG.Murder.rerollLost | gm-card | 46 / 40 | B03 | - |
| DRPG.Observe.anythingTitle | window-title | 6 / 5 | - | - |
| DRPG.Observe.projectFoundTitle | window-title | 8 / 5 | B07 | - |
| DRPG.Observe.resolveLost | gm-card | 50 / 40 | B07 | - |
| DRPG.Panel.refilled | toast | 23 / 20 | B15 | - |
| DRPG.Project.needsKiller | toast | 24 / 20 | B11 | - |
| DRPG.Project.needsKillerNamed | toast | 23 / 20 | B11 | - |
| DRPG.Project.roomOnNoScene | toast | 26 / 20 | B11 | - |
| DRPG.Redacted.tabLocked | tab | 8 / 5 | B12 | - |
| DRPG.Relay.busyFear.one | toast | 24 / 20 | - | - |
| DRPG.Relay.busyFear.other | toast | 23 / 20 | - | - |
| DRPG.Remnant.deathTied.one | gm-card | 49 / 40 | - | - |
| DRPG.Remnant.deathTied.other | gm-card | 47 / 40 | - | - |
| DRPG.Remnant.foundTitle | window-title | 7 / 5 | B07 | - |
| DRPG.Remnant.keptOnTokens.one | toast | 28 / 20 | - | - |
| DRPG.Remnant.keptOnTokens.other | toast | 28 / 20 | - | - |
| DRPG.Requirements.newerSystemTitle | window-title | 7 / 5 | B15 | - |
| DRPG.Reroll.interruptedGm | gm-card | 60 / 40 | B12 | - |
| DRPG.Reroll.traceKept | gm-card | 60 / 40 | - | - |
| DRPG.RollDialog.locked | toast | 30 / 20 | B06 | - |
| DRPG.Rooms.renamed | gm-card | 52 / 40 | B17 | - |
| DRPG.Rules.announceTitle | window-title | 6 / 5 | - | - |
| DRPG.Rules.emptyKept | toast | 23 / 20 | B13 | - |
| DRPG.Rules.saveFailed | toast | 24 / 20 | B13 | - |
| DRPG.Safeword.tooltip | tooltip | 17 / 15 | B13 | - |
| DRPG.Season.failed | toast | 24 / 20 | B15 | - |
| DRPG.Season.reportCard.title | window-title | 6 / 5 | B15 | - |
| DRPG.Secret.storeFull | toast | 30 / 20 | B12 | - |
| DRPG.Settings.chargeMovement.hint | settings-hint | 31 / 25 | B14 | pilot |
| DRPG.Settings.documentLanguage.hint | settings-hint | 36 / 25 | B14 | - |
| DRPG.Settings.forceDiceLook.hint | settings-hint | 38 / 25 | B14 | - |
| DRPG.Settings.forcePrivateRolls.hint | settings-hint | 27 / 25 | B14 | - |
| DRPG.Settings.foundryToolWindows.hint | settings-hint | 35 / 25 | B14 | - |
| DRPG.Settings.highContrast.hint | settings-hint | 33 / 25 | B14 | - |
| DRPG.Settings.language.hint | settings-hint | 29 / 25 | B14 | pilot |
| DRPG.Settings.lockPlayerResources.hint | settings-hint | 37 / 25 | B14 | - |
| DRPG.Settings.lockRollDialog.hint | settings-hint | 28 / 25 | B14 | - |
| DRPG.Settings.musicEnabled.hint | settings-hint | 26 / 25 | B14 | - |
| DRPG.Settings.sequences.hint | settings-hint | 33 / 25 | B14 | - |
| DRPG.Settings.uiScale.hint | settings-hint | 30 / 25 | B14 | - |
| DRPG.Sheet.biographyChanged | toast | 25 / 20 | B08 | - |
| DRPG.Tips.Actions.maskRevealTooltip | tooltip | 17 / 15 | - | - |
| DRPG.Tips.Actions.maskStayTooltip | tooltip | 16 / 15 | - | - |
| DRPG.Tips.Actions.room2Tooltip | tooltip | 19 / 15 | - | - |
| DRPG.Tips.Gm.stateTooltip | tooltip | 21 / 15 | - | - |
| DRPG.Tips.Gm.tierTooltip | tooltip | 23 / 15 | - | - |
| DRPG.Tips.Gm.whichTableTooltip | tooltip | 17 / 15 | - | - |
| DRPG.Tips.More.volumeTooltip | tooltip | 17 / 15 | - | - |
| DRPG.Tips.Setup.allThePlayersPickTooltip | tooltip | 17 / 15 | - | - |
| DRPG.Tips.Setup.aStudentWhoKnowsTooltip | tooltip | 21 / 15 | - | - |
| DRPG.Tips.Setup.categoryTooltip | tooltip | 19 / 15 | - | - |
| DRPG.Tips.Setup.onALootedItemTooltip | tooltip | 18 / 15 | - | - |
| DRPG.Tips.Setup.playTooltip | tooltip | 20 / 15 | - | - |
| DRPG.Tips.Setup.resetTheSeasonTooltip | tooltip | 17 / 15 | - | - |
| DRPG.Tips.Setup.setThemToObserverTooltip | tooltip | 21 / 15 | - | - |
| DRPG.Tips.Setup.showThePassageTooltip | tooltip | 19 / 15 | - | - |
| DRPG.Tips.Setup.tabsTierPoolsRoomTooltip | tooltip | 21 / 15 | - | - |
| DRPG.Tips.Trial.killerTooltip | tooltip | 17 / 15 | - | - |
| DRPG.Tips.Trial.rightAnswerZoneATooltip | tooltip | 18 / 15 | - | - |
| DRPG.Trap.alertTitle | window-title | 6 / 5 | B11 | - |
| DRPG.Trial.actionsLocked | toast | 26 / 20 | B10a | - |
| DRPG.Trial.presentTooltip | tooltip | 16 / 15 | B10a | - |
| DRPG.TrialScene.noSchool | gm-card | 47 / 40 | B10a | - |
| DRPG.TrialScene.notPlaced.one | gm-card | 41 / 40 | - | - |
| DRPG.TrialScene.notPlaced.other | gm-card | 43 / 40 | - | - |
| DRPG.TrialScene.noWayBackLine | toast | 27 / 20 | - | - |
| DRPG.TruthBullet.faintTooltip | tooltip | 17 / 15 | B07 | - |
| DRPG.TruthBullet.lockedTooltip | tooltip | 22 / 15 | B07 | - |
| DRPG.TruthBullet.migrated.one | gm-card | 44 / 40 | - | - |
| DRPG.TruthBullet.migrated.other | gm-card | 44 / 40 | - | - |
| DRPG.Vault.handFirst | toast | 25 / 20 | B08 | - |
| DRPG.Vault.imageRefused | toast | 25 / 20 | - | - |
| DRPG.Vault.neighboursUnknown | toast | 24 / 20 | B08 | - |
| DRPG.Voice.needsAvclient | toast | 23 / 20 | B18 | - |
| DRPG.Vote.dismissed | toast | 21 / 20 | B10a | - |
| DRPG.Vote.executionFailed | toast | 30 / 20 | B10a | - |
| DRPG.Zones.notStarted | toast | 29 / 20 | B17 | - |

### lang/pl.json (145)

| Key | Surface | Words / target | Batch | Owner approved |
| --- | --- | --- | --- | --- |
| DRPG.Actions.woundedTooltip | tooltip | 16 / 15 | B04 | - |
| DRPG.Advance.notOfferedHere | gm-card | 47 / 40 | - | - |
| DRPG.Advance.offerStillStands | toast | 21 / 20 | B10b | - |
| DRPG.Anonymity.blocked | toast | 21 / 20 | B18 | - |
| DRPG.Assign.noMonokumas | toast | 21 / 20 | B15 | - |
| DRPG.Audit.awayTitle | window-title | 6 / 5 | B12 | - |
| DRPG.Audit.listTitle | window-title | 7 / 5 | B12 | - |
| DRPG.Body.noToken | toast | 24 / 20 | B03 | - |
| DRPG.Calls.gatherRoomGone | toast | 24 / 20 | B06 | - |
| DRPG.Calls.pendingTooltip | tooltip | 18 / 15 | B06 | - |
| DRPG.Chapter.bodyAnnouncedAlready | toast | 25 / 20 | B10b | - |
| DRPG.Chapter.deathsStillSecret.few | toast | 27 / 20 | - | - |
| DRPG.Chapter.deathsStillSecret.many | toast | 27 / 20 | - | - |
| DRPG.Chapter.deathsStillSecret.one | toast | 27 / 20 | - | - |
| DRPG.Chapter.deathsStillSecret.other | toast | 27 / 20 | - | - |
| DRPG.Chapter.finishPhaseMoved | toast | 27 / 20 | - | - |
| DRPG.Character.initTooltip | tooltip | 18 / 15 | B08 | - |
| DRPG.Cleanup.reshapeRulingTitle | window-title | 6 / 5 | - | - |
| DRPG.Clock.eclipseStillOn | toast | 25 / 20 | B09 | - |
| DRPG.Clock.takenBack | toast | 25 / 20 | B09 | - |
| DRPG.Config.ACTIONS.analyze.description | config-description | 40 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.analyze.hint | tile-hint | 39 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.directMurder.description | config-description | 44 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.listen.description | config-description | 43 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.move.description | config-description | 40 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.move.hint | tile-hint | 34 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.observe.description | config-description | 34 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.palm.description | config-description | 44 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.project.description | config-description | 39 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.project.hint | tile-hint | 38 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.rest.description | config-description | 35 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.rest.hint | tile-hint | 31 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.sabotage.description | config-description | 42 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.search.description | config-description | 32 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.tamper.description | config-description | 36 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.doubleRoleReversal.hint | config-description | 43 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.finishingBlow.hint | config-description | 35 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.leaveClue.hint | config-description | 41 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.roleReversal.hint | config-description | 42 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.secureTrace.hint | config-description | 34 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.selfDefence.hint | config-description | 44 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.sharedEscape.hint | config-description | 32 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.strike.hint | config-description | 37 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.survive.hint | config-description | 33 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.weaponAttack.hint | config-description | 41 / 30 | B01a | yes |
| DRPG.Config.DESPAIR_CALLS.bounty.effect | config-description | 34 / 30 | B01b | - |
| DRPG.Config.HOPE_CALLS.contribution.effect | config-description | 37 / 30 | B01a | yes |
| DRPG.Config.HOPE_CALLS.freeCrit.effect | config-description | 40 / 30 | B01a | yes |
| DRPG.Config.HOPE_CALLS.relief.effect | config-description | 44 / 30 | B01a | yes |
| DRPG.Config.HOPE_CALLS.reroll.effect | config-description | 41 / 30 | B01a | yes |
| DRPG.Config.ITEM_CATEGORIES.crimeTool.hint | config-description | 36 / 30 | B01b | - |
| DRPG.Config.ITEM_CATEGORIES.tool.hint | config-description | 41 / 30 | B01b | - |
| DRPG.Config.SFX_EVENTS.bodyFound.hint | config-description | 35 / 30 | B02 | - |
| DRPG.Config.SFX_EVENTS.death.hint | config-description | 31 / 30 | B02 | - |
| DRPG.Config.SFX_EVENTS.roomDiscovered.hint | config-description | 31 / 30 | B02 | - |
| DRPG.Config.SFX_EVENTS.safeword.hint | config-description | 34 / 30 | B02 | - |
| DRPG.Despair.pipTooltip | tooltip | 18 / 15 | B01b | - |
| DRPG.DiceLook.stopped | toast | 26 / 20 | - | - |
| DRPG.Floor.newTrialRefused | toast | 23 / 20 | B10a | - |
| DRPG.Handover.changedMidwayKept | gm-card | 43 / 40 | B08 | - |
| DRPG.Hud.eclipseRunningTooltip | tooltip | 22 / 15 | B09 | - |
| DRPG.Infiltrate.pick.coverTitle | window-title | 7 / 5 | B04 | - |
| DRPG.Infiltrate.tail.unseenTitle | window-title | 6 / 5 | B04 | - |
| DRPG.Investigation.newTraceUnfindable | toast | 29 / 20 | B16 | - |
| DRPG.Investigation.noRooms | toast | 22 / 20 | B16 | - |
| DRPG.Investigation.savedOver.few | toast | 30 / 20 | - | - |
| DRPG.Investigation.savedOver.many | toast | 30 / 20 | - | - |
| DRPG.Investigation.savedOver.one | toast | 30 / 20 | - | - |
| DRPG.Investigation.savedOver.other | toast | 30 / 20 | - | - |
| DRPG.Investigation.saveStopped | toast | 26 / 20 | B16 | - |
| DRPG.Items.brokenTooltip | tooltip | 23 / 15 | B08 | - |
| DRPG.Items.durabilityTooltip | tooltip | 20 / 15 | B08 | - |
| DRPG.Items.stowShape | toast | 30 / 20 | B08 | - |
| DRPG.Loot.takeTooltip | tooltip | 23 / 15 | B08 | - |
| DRPG.Loot.tookUnfound | toast | 21 / 20 | - | - |
| DRPG.Movement.droppedFromNowhere | gm-card | 56 / 40 | B09 | - |
| DRPG.Movement.unlawfulArrival | gm-card | 47 / 40 | B09 | - |
| DRPG.Murder.betrayalButton | button | 5 / 4 | - | - |
| DRPG.Murder.castMissingHere | toast | 27 / 20 | B03 | - |
| DRPG.Observe.resolveLost | gm-card | 47 / 40 | B07 | - |
| DRPG.Project.roomOnNoScene | toast | 22 / 20 | B11 | - |
| DRPG.Redacted.tabLocked | tab | 6 / 5 | B12 | - |
| DRPG.Relay.busyFear.few | toast | 23 / 20 | - | - |
| DRPG.Relay.busyFear.many | toast | 23 / 20 | - | - |
| DRPG.Relay.busyFear.one | toast | 23 / 20 | - | - |
| DRPG.Relay.busyFear.other | toast | 23 / 20 | - | - |
| DRPG.Remnant.deathTied.few | gm-card | 54 / 40 | - | - |
| DRPG.Remnant.deathTied.many | gm-card | 54 / 40 | - | - |
| DRPG.Remnant.deathTied.one | gm-card | 54 / 40 | - | - |
| DRPG.Remnant.deathTied.other | gm-card | 54 / 40 | - | - |
| DRPG.Remnant.keptOnTokens.few | toast | 29 / 20 | - | - |
| DRPG.Remnant.keptOnTokens.many | toast | 29 / 20 | - | - |
| DRPG.Remnant.keptOnTokens.one | toast | 29 / 20 | - | - |
| DRPG.Remnant.keptOnTokens.other | toast | 29 / 20 | - | - |
| DRPG.Remnant.noToken | toast | 21 / 20 | B07 | - |
| DRPG.Requirements.newerSystemTitle | window-title | 6 / 5 | B15 | - |
| DRPG.Reroll.interruptedGm | gm-card | 58 / 40 | B12 | - |
| DRPG.Reroll.traceKept | gm-card | 58 / 40 | - | - |
| DRPG.RollDialog.locked | toast | 26 / 20 | B06 | - |
| DRPG.Rolls.flagsTitle | window-title | 7 / 5 | B06 | - |
| DRPG.Rooms.renamed | gm-card | 53 / 40 | B17 | - |
| DRPG.Rules.emptyKept | toast | 23 / 20 | B13 | - |
| DRPG.Rules.saveFailed | toast | 25 / 20 | B13 | - |
| DRPG.Secret.storeFull | toast | 28 / 20 | B12 | - |
| DRPG.Settings.chargeMovement.hint | settings-hint | 26 / 25 | B14 | pilot |
| DRPG.Settings.documentLanguage.hint | settings-hint | 35 / 25 | B14 | - |
| DRPG.Settings.forceDiceLook.hint | settings-hint | 38 / 25 | B14 | - |
| DRPG.Settings.foundryToolWindows.hint | settings-hint | 28 / 25 | B14 | - |
| DRPG.Settings.highContrast.hint | settings-hint | 32 / 25 | B14 | - |
| DRPG.Settings.language.hint | settings-hint | 26 / 25 | B14 | pilot |
| DRPG.Settings.lockPlayerResources.hint | settings-hint | 31 / 25 | B14 | - |
| DRPG.Settings.sequences.hint | settings-hint | 27 / 25 | B14 | - |
| DRPG.Tips.Actions.room2Tooltip | tooltip | 19 / 15 | - | - |
| DRPG.Tips.Gm.stateTooltip | tooltip | 19 / 15 | - | - |
| DRPG.Tips.Gm.tierTooltip | tooltip | 17 / 15 | - | - |
| DRPG.Tips.More.volumeTooltip | tooltip | 17 / 15 | - | - |
| DRPG.Tips.Setup.allThePlayersPickTooltip | tooltip | 16 / 15 | - | - |
| DRPG.Tips.Setup.aStudentWhoKnowsTooltip | tooltip | 17 / 15 | - | - |
| DRPG.Tips.Setup.categoryTooltip | tooltip | 18 / 15 | - | - |
| DRPG.Tips.Setup.handThemOutTooltip | tooltip | 16 / 15 | - | - |
| DRPG.Tips.Setup.onALootedItemTooltip | tooltip | 17 / 15 | - | - |
| DRPG.Tips.Setup.playTooltip | tooltip | 19 / 15 | - | - |
| DRPG.Tips.Setup.setThemToObserverTooltip | tooltip | 20 / 15 | - | - |
| DRPG.Tips.Setup.showThePassageTooltip | tooltip | 19 / 15 | - | - |
| DRPG.Tips.Setup.tabsTierPoolsRoomTooltip | tooltip | 19 / 15 | - | - |
| DRPG.TrialScene.notPlaced.few | gm-card | 41 / 40 | - | - |
| DRPG.TrialScene.notPlaced.many | gm-card | 41 / 40 | - | - |
| DRPG.TrialScene.notPlaced.other | gm-card | 41 / 40 | - | - |
| DRPG.TrialScene.noWayBackLine | toast | 27 / 20 | - | - |
| DRPG.TruthBullet.faintTooltip | tooltip | 16 / 15 | B07 | - |
| DRPG.TruthBullet.lockedTooltip | tooltip | 21 / 15 | B07 | - |
| DRPG.TruthBullet.migrated.few | gm-card | 46 / 40 | - | - |
| DRPG.TruthBullet.migrated.many | gm-card | 46 / 40 | - | - |
| DRPG.TruthBullet.migrated.one | gm-card | 43 / 40 | - | - |
| DRPG.TruthBullet.migrated.other | gm-card | 46 / 40 | - | - |
| DRPG.Vault.handFirst | toast | 29 / 20 | B08 | - |
| DRPG.Vault.imageRefused | toast | 22 / 20 | - | - |
| DRPG.Vault.neighboursUnknown | toast | 25 / 20 | B08 | - |
| DRPG.Vault.stashNotEmpty.few | toast | 24 / 20 | - | - |
| DRPG.Vault.stashNotEmpty.many | toast | 24 / 20 | - | - |
| DRPG.Vault.stashNotEmpty.one | toast | 24 / 20 | - | - |
| DRPG.Vault.stashNotEmpty.other | toast | 24 / 20 | - | - |
| DRPG.Voice.needsAvclient | toast | 22 / 20 | B18 | - |
| DRPG.Vote.executionFailed | toast | 28 / 20 | B10a | - |
| DRPG.Zones.notStarted | toast | 22 / 20 | B17 | - |

### config.mjs prose (46)

| Key | Surface | Words / target | Batch | Owner approved |
| --- | --- | --- | --- | --- |
| DRPG.Config.ACTIONS.analyze.description | config-description | 43 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.analyze.hint | tile-hint | 45 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.directMurder.description | config-description | 44 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.listen.description | config-description | 45 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.move.description | config-description | 45 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.move.hint | tile-hint | 38 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.observe.description | config-description | 40 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.observe.hint | tile-hint | 38 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.palm.description | config-description | 42 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.project.description | config-description | 42 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.project.hint | tile-hint | 43 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.rest.description | config-description | 41 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.rest.hint | tile-hint | 38 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.sabotage.description | config-description | 42 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.search.description | config-description | 34 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.tamper.description | config-description | 41 / 30 | B01a | yes |
| DRPG.Config.ACTIONS.tamper.hint | tile-hint | 35 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.doubleRoleReversal.hint | config-description | 42 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.finishingBlow.hint | config-description | 42 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.keepDistance.hint | config-description | 35 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.leaveClue.hint | config-description | 44 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.pin.hint | config-description | 34 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.roleReversal.hint | config-description | 43 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.secureTrace.hint | config-description | 38 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.selfDefence.hint | config-description | 44 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.sharedEscape.hint | config-description | 39 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.strike.hint | config-description | 42 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.survive.hint | config-description | 40 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.useItem.hint | config-description | 35 / 30 | B01a | yes |
| DRPG.Config.CRISIS_ACTIONS.weaponAttack.hint | config-description | 44 / 30 | B01a | yes |
| DRPG.Config.DESPAIR_CALLS.bounty.effect | config-description | 44 / 30 | B01b | - |
| DRPG.Config.DESPAIR_CALLS.publicAnnouncement.effect | config-description | 31 / 30 | B01b | - |
| DRPG.Config.HOPE_CALLS.contribution.effect | config-description | 39 / 30 | B01a | yes |
| DRPG.Config.HOPE_CALLS.experience.effect | config-description | 37 / 30 | B01a | yes |
| DRPG.Config.HOPE_CALLS.freeCrit.effect | config-description | 45 / 30 | B01a | yes |
| DRPG.Config.HOPE_CALLS.relief.effect | config-description | 45 / 30 | B01a | yes |
| DRPG.Config.HOPE_CALLS.reroll.effect | config-description | 39 / 30 | B01a | yes |
| DRPG.Config.ITEM_CATEGORIES.cleaningTool.hint | config-description | 38 / 30 | B01b | - |
| DRPG.Config.ITEM_CATEGORIES.crimeTool.hint | config-description | 42 / 30 | B01b | - |
| DRPG.Config.ITEM_CATEGORIES.tool.hint | config-description | 35 / 30 | B01b | - |
| DRPG.Config.SFX_EVENTS.bodyFound.hint | config-description | 37 / 30 | B02 | - |
| DRPG.Config.SFX_EVENTS.death.hint | config-description | 37 / 30 | B02 | - |
| DRPG.Config.SFX_EVENTS.deathFade.hint | config-description | 34 / 30 | B02 | - |
| DRPG.Config.SFX_EVENTS.safeword.hint | config-description | 35 / 30 | B02 | - |
| DRPG.Config.SFX_EVENTS.windowButton.hint | config-description | 34 / 30 | B02 | - |
| DRPG.Config.SFX_EVENTS.zoneEntered.hint | config-description | 33 / 30 | B02 | - |

