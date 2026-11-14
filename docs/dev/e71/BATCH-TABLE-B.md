# E71 group B: the batch table (C0, group B's part)

Written 14.11.2026 on claude/e71-b. Every key of group B's namespaces - the plan's B06-B09 and the coordinator's map of
14.11.2026 (Sequence, Movement, Room, FoundryTools, Facility, Look, Kit, Character, States, Sheet, SheetNotes, Summary,
Passage, Ready) - by batch and by screen (tools/text-map.mjs; `file:` a file's own screen), with its budget surface
(docs/text-budgets.json's rules; `-` where none places it), its readers (the screen map's), its mode (`full`: written
before 01.11.2026, edited in full; `check`: written to the guide after it, or only checked, O12) and what the batch did
(`en`, `pl`, `en+pl`: the language whose text changed, its row in docs/dev/text-batch-<batch>.json; `read, kept`: read
against its code and left). A plural family is one row. One key's row and its text sit in different batches:
`DRPG.Passage.engineOff` is read on B07's passages-gm screen, and its text, edited once the freeze was released, is
in B08's file with the other Passage texts of that round.

## B06 (200 keys, 80 changed)

### action-tiles

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Calls.freeCritTitle` | window-title | both | check | read, kept |
| `DRPG.Calls.freeCritUsed` | player-card | both/unknown | check | en |
| `DRPG.Rolls.waitsForGm` | toast | both/unknown | check | en+pl |
| `DRPG.Roll.project` | - | both | full | read, kept |
| `DRPG.Roll.murderProject` | - | both | full | read, kept |
| `DRPG.Roll.hideTraces` | - | both | check | read, kept |

### calls

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Calls.resolveNext` | - | both | full | en+pl |
| `DRPG.Calls.waitingGm` | - | both | full | en+pl |
| `DRPG.Calls.costsHope` | toast | both/unknown | full | read, kept |
| `DRPG.Calls.costsDespair` | toast | both/unknown | full | read, kept |
| `DRPG.Calls.costsHopeShort` | - | both/unknown | full | read, kept |
| `DRPG.Calls.costsDespairShort` | - | both/unknown | full | read, kept |
| `DRPG.Calls.spend` | - | both | full | read, kept |
| `DRPG.Calls.send` | - | both | full | en+pl |
| `DRPG.Calls.next` | - | both | full | read, kept |
| `DRPG.Calls.aimedAt` | - | both | full | read, kept |
| `DRPG.Calls.tellGm` | - | both | full | read, kept |
| `DRPG.Calls.tellGmPlaceholder.experience` | - | both | full | read, kept |
| `DRPG.Calls.tellGmPlaceholder.ultimate` | - | both | full | en+pl |
| `DRPG.Calls.waitsForGm` | - | both | full | en+pl |
| `DRPG.Calls.needNote` | toast | both | full | en |
| `DRPG.Calls.approveTitle` | window-title | both/unknown | full | en+pl |
| `DRPG.Calls.approveHint` | - | both/unknown | full | en+pl |
| `DRPG.Calls.approveYes` | - | both/unknown | full | en+pl |
| `DRPG.Calls.approveNo` | - | both/unknown | full | en+pl |
| `DRPG.Calls.refused` | toast | both | full | en+pl |
| `DRPG.Calls.notEnoughHope` | toast | both | full | read, kept |
| `DRPG.Calls.sprinted` | - | both | full | pl |
| `DRPG.Calls.burst` | - | both | full | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Calls.hopeSpent` | player-card | both | check | read, kept |
| `DRPG.Calls.noPool` | toast | both | full | read, kept |
| `DRPG.Calls.whichPlayer` | - | both | full | read, kept |
| `DRPG.Calls.whichProject` | - | both | full | read, kept |
| `DRPG.Calls.whichRoom` | - | both | full | read, kept |
| `DRPG.Calls.whichItem` | - | both | full | read, kept |
| `DRPG.Calls.nobodyHere` | toast | both | full | en+pl |
| `DRPG.Calls.noPlayers` | toast | both | full | en+pl |
| `DRPG.Calls.noItems` | toast | both | full | en+pl |
| `DRPG.Calls.onTheBody` | - | both | full | en+pl |
| `DRPG.Calls.armed` | - | both | full | en+pl |
| `DRPG.Calls.alreadyArmed` | toast | both | full | en+pl |
| `DRPG.Calls.damaged` | - | both | full | en+pl |
| `DRPG.Calls.nothingToMark` | toast | both | full | en+pl |
| `DRPG.Calls.sealed` | - | both | full | read, kept |
| `DRPG.Calls.alreadySealed` | toast | both | full | read, kept |
| `DRPG.Calls.alreadySilenced` | toast | both | full | pl |
| `DRPG.Calls.alreadyChained` | toast | both | full | pl |
| `DRPG.Calls.gathered` | world-voice | both | full | en+pl |
| `DRPG.Calls.destroyed` | - | both | full | pl |
| `DRPG.Calls.effectFailed` | toast | both | full | en+pl |
| `DRPG.Calls.refunded` | toast | both | full | en |
| `DRPG.Calls.silenced` | - | both | full | read, kept |
| `DRPG.Calls.silencedNotice` | - | both | full | en+pl |
| `DRPG.Calls.chained` | - | both | check | pl |
| `DRPG.Calls.chainedNotice` | - | both | full | read, kept |
| `DRPG.Calls.chainedNoticeIn` | - | both | check | pl |
| `DRPG.Calls.loadedDieBack` | player-card | both | check | read, kept |
| `DRPG.Calls.grants.advantage` | - | both/unknown | check | read, kept |
| `DRPG.Calls.grants.disadvantage` | - | both/unknown | check | read, kept |
| `DRPG.Calls.grants.experience` | - | both/unknown | full | read, kept |
| `DRPG.Calls.grants.trait` | - | both/unknown | full | read, kept |
| `DRPG.Calls.grants.critical` | - | both/unknown | full | en+pl |
| `DRPG.Calls.grants.bonus` | - | both/unknown | full | read, kept |
| `DRPG.Calls.grantsGen.advantage` | - | both | check | read, kept |
| `DRPG.Calls.grantsGen.disadvantage` | - | both | check | read, kept |
| `DRPG.Calls.grantsGen.experience` | - | both | check | read, kept |
| `DRPG.Calls.grantsGen.trait` | - | both | check | read, kept |
| `DRPG.Calls.grantsGen.critical` | - | both | check | en+pl |
| `DRPG.Calls.grantsGen.bonus` | - | both | check | read, kept |
| `DRPG.Calls.armedTitle` | window-title | both/unknown | full | en+pl |
| `DRPG.Calls.armedForYou` | player-card | both/unknown | full | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Calls.armedForYouBy` | player-card | both/unknown | check | read, kept |
| `DRPG.Calls.armedByMonokuma` | player-card | both/unknown | full | en+pl |
| `DRPG.Calls.armedByNobody` | player-card | both/unknown | full | en+pl |
| `DRPG.Calls.newRulePrompt` | - | both | full | read, kept |
| `DRPG.Calls.newRuleNote` | - | both | full | read, kept |
| `DRPG.Calls.newRuleAnnounced` | - | both | full | read, kept |
| `DRPG.Calls.gatherNoRoom` | - | both | full | read, kept |
| `DRPG.Calls.progressedTo` | - | both | full | read, kept |
| `DRPG.Calls.progressSent` | - | both | full | read, kept |
| `DRPG.Calls.overflowFed` | - | both | full | en+pl |
| `DRPG.Calls.progressRefused` | - | both | full | en+pl |
| `DRPG.Calls.progressSecret` | - | both | check | read, kept |
| `DRPG.Calls.hopeGranted` | - | both | full | read, kept |
| `DRPG.Calls.motiveSet` | - | both | full | en |
| `DRPG.Calls.gatherRoomGone` | toast | both | check | en+pl |
| `DRPG.Calls.gatherTitle` | window-title | both | full | read, kept |
| `DRPG.Calls.gatherBanner` | world-voice | both | full | read, kept |
| `DRPG.Calls.gatherBody` | world-voice | both/unknown | full | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Calls.gatherNote` | world-voice | both | full | read, kept |
| `DRPG.Calls.gatherCalled` | - | both | full | read, kept |
| `DRPG.Calls.gatherCancelled` | world-voice | both | full | read, kept |
| `DRPG.Calls.notArmedNotCharged` | toast | both | check | en+pl |
| `DRPG.Calls.despairGmOnly` | toast | both/unknown | check | read, kept |
| `DRPG.Calls.choiceAsk` | - | both | check | read, kept |
| `DRPG.Calls.talentAsk` | - | both/unknown | check | read, kept |

### cleanup

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Roll.concealIntent` | - | both | full | read, kept |

### file:scripts/api.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Rolls.flagsTitle` | window-title | unknown | full | en+pl |

### file:scripts/call-gm.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Calls.approveCost` | - | unknown | full | en+pl |

### file:scripts/despair.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Look.stepUp` | - | unknown | full | read, kept |
| `DRPG.Look.stepDown` | - | unknown | full | read, kept |

### file:scripts/events.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Calls.gatherShort` | - | unknown | full | read, kept |

### file:scripts/movement.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Calls.chainedBlocked` | - | unknown | full | pl |
| `DRPG.Calls.sealedBlocked` | - | unknown | check | en+pl |

### file:scripts/reroll-receipts.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Rolls.rewritePutBack` | - | unknown | full | en+pl |
| `DRPG.Rolls.rewriteNotPutBack` | - | unknown | full | en+pl |

### file:scripts/roll-draw.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Rolls.notDrawnHere` | gm-card | unknown | full | en |
| `DRPG.Rolls.unexpected` | gm-card | unknown | full | en+pl |
| `DRPG.Rolls.flagLine` | - | unknown | full | read, kept |
| `DRPG.Rolls.flagKind.trait` | - | unknown | full | read, kept |
| `DRPG.Rolls.flagKind.pick` | - | unknown | full | read, kept |
| `DRPG.Rolls.flagKind.modifier` | - | unknown | full | read, kept |
| `DRPG.Rolls.flagKind.dice` | - | unknown | full | read, kept |
| `DRPG.Rolls.flagKind.advantage` | - | unknown | check | read, kept |
| `DRPG.Rolls.flagFrom` | - | unknown | full | read, kept |
| `DRPG.Rolls.counted` | - | unknown | full | read, kept |
| `DRPG.Rolls.notCounted` | - | unknown | full | read, kept |
| `DRPG.Rolls.legal.hopeDie` | - | unknown | full | read, kept |
| `DRPG.Rolls.legal.fearDie` | - | unknown | full | read, kept |
| `DRPG.Rolls.legal.advantageDie` | - | unknown | full | read, kept |
| `DRPG.Rolls.legal.trait` | - | unknown | full | read, kept |
| `DRPG.Rolls.legal.experience` | - | unknown | full | en+pl |
| `DRPG.Rolls.legal.callBonus` | - | unknown | full | read, kept |
| `DRPG.Rolls.legal.effects` | - | unknown | full | read, kept |
| `DRPG.Rolls.legal.calls` | - | unknown | full | read, kept |
| `DRPG.Rolls.legal.hostile` | - | unknown | full | read, kept |
| `DRPG.Rolls.legal.breakdown` | - | unknown | full | read, kept |
| `DRPG.Rolls.legal.situation` | - | unknown | full | read, kept |
| `DRPG.Rolls.legal.loadedDie` | - | unknown | full | read, kept |
| `DRPG.Rolls.legal.kind` | - | unknown | check | read, kept |
| `DRPG.Rolls.gmThrowing` | - | unknown | check | read, kept |
| `DRPG.Rolls.unwitnessed` | - | unknown | check | en+pl |
| `DRPG.Rolls.awayTitle` | window-title | unknown | check | en+pl |
| `DRPG.Rolls.awayLine` | - | unknown | check | en+pl |
| `DRPG.Rolls.awayHope` | - | unknown | full | read, kept |
| `DRPG.Rolls.awayDespair` | - | unknown | full | read, kept |
| `DRPG.Rolls.awayNothing` | - | unknown | full | read, kept |
| `DRPG.Rolls.awayClaimed` | - | unknown | full | read, kept |
| `DRPG.Rolls.grantAll` | - | unknown | full | read, kept |
| `DRPG.Rolls.grantNone` | - | unknown | full | read, kept |

### murder-cards

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Roll.opening.killer` | - | both | full | read, kept |
| `DRPG.Roll.opening.victim` | - | both | full | read, kept |
| `DRPG.Roll.opening.selfInflicted` | - | both | full | read, kept |
| `DRPG.Roll.crisis` | - | both/unknown | full | read, kept |

### roll-window

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Calls.grantsNom.advantage` | - | both | check | read, kept |
| `DRPG.Calls.grantsNom.disadvantage` | - | both | check | read, kept |
| `DRPG.Calls.grantsNom.experience` | - | both | check | read, kept |
| `DRPG.Calls.grantsNom.trait` | - | both | check | read, kept |
| `DRPG.Calls.grantsNom.critical` | - | both | check | en+pl |
| `DRPG.Calls.grantsNom.bonus` | - | both | check | read, kept |
| `DRPG.Calls.waitsNextRoll` | - | both | full | en+pl |
| `DRPG.RollDialog.locked` | toast | both | full | en+pl |
| `DRPG.RollDialog.diceFixed` | - | both | full | en+pl |
| `DRPG.RollDialog.traitFixed` | - | both | full | read, kept |
| `DRPG.RollDialog.traitByGm` | - | both | full | read, kept |
| `DRPG.RollDialog.traitApproved` | - | both | check | read, kept |
| `DRPG.RollDialog.traitChanged` | - | both | check | read, kept |
| `DRPG.RollDialog.advantageLocked` | - | both | full | en+pl |
| `DRPG.RollDialog.pickOneExperience` | - | both | full | read, kept |
| `DRPG.RollDialog.experienceLocked` | - | both | full | en+pl |
| `DRPG.RollDialog.bonusLocked` | - | both | full | en+pl |
| `DRPG.RollDialog.modeLocked` | - | both | full | en |
| `DRPG.RollDialog.modePublic` | - | both | full | read, kept |
| `DRPG.RollDialog.modeGms` | - | both | full | read, kept |
| `DRPG.RollDialog.modeRoom` | - | both | full | en+pl |
| `DRPG.RollDialog.actionLocked` | - | both | full | read, kept |
| `DRPG.RollDialog.reactionLocked` | - | both | full | pl |
| `DRPG.RollDialog.unlockedByCall` | - | both | check | read, kept |
| `DRPG.RollDialog.freeCritArmed` | - | both | check | en+pl |
| `DRPG.RollDialog.forcedByCall` | - | both | check | en |
| `DRPG.RollDialog.forcedByHindrance` | - | both | check | en |
| `DRPG.RollDialog.forcedBySituation` | - | both | check | en+pl |
| `DRPG.RollDialog.forcedByState` | - | both | check | en+pl |
| `DRPG.RollDialog.lockedByCall` | - | both | check | en+pl |
| `DRPG.RollDialog.stackedAdvantage` | - | both | full | en+pl |
| `DRPG.RollDialog.stackedDisadvantage` | - | both | full | en+pl |
| `DRPG.RollDialog.mixedAdvantage` | - | both | full | en+pl |
| `DRPG.RollDialog.mixedDisadvantage` | - | both | full | en+pl |
| `DRPG.RollDialog.advantageCapped` | - | both | check | en+pl |
| `DRPG.RollDialog.source.call` | - | both | check | read, kept |
| `DRPG.RollDialog.source.hindrance` | - | both | check | read, kept |
| `DRPG.RollDialog.source.situation` | - | both | check | en+pl |
| `DRPG.RollDialog.source.state` | - | both | check | read, kept |

### sheet

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Calls.hopeTitle` | window-title | both | full | read, kept |
| `DRPG.Calls.despairTitle` | window-title | both | full | read, kept |
| `DRPG.Calls.gatherCallOff` | - | both | full | read, kept |
| `DRPG.Calls.pendingTooltip` | tooltip | both | full | en+pl |
| `DRPG.Calls.noExperiences` | toast | both | full | read, kept |
| `DRPG.Calls.cannotAfford` | - | both | full | read, kept |
| `DRPG.Calls.silencedBadge` | - | both | full | pl |
| `DRPG.Calls.chainedBadge` | - | both | full | pl |
| `DRPG.Calls.freeShort` | - | both | full | read, kept |
| `DRPG.Calls.gatherCancel` | - | both | full | read, kept |
| `DRPG.Calls.gatherCancelAsk` | - | both | full | read, kept |
| `DRPG.Calls.gatherNoRefund` | - | both | check | en+pl |
| `DRPG.Calls.rowNoExperiences` | - | both | check | pl |
| `DRPG.Calls.rowArmed` | - | both | check | read, kept |

### trial-console

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Calls.noSuchRoom` | toast | both/gm | full | read, kept |

### vote

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Calls.newRuleTitle` | window-title | both | full | read, kept |
| `DRPG.Calls.newRulePlaceholder` | - | both/unknown | full | read, kept |

## B07 (249 keys, 81 changed)

### (no screen)

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Remnant.digestTitle` | gm-card | unknown | check | read, kept |
| `DRPG.Remnant.foundTitle` | window-title | unknown | full | en+pl |
| `DRPG.Remnant.reinforcedShort` | - | unknown | full | en |
| `DRPG.Remnant.deathTied` | gm-card | unknown | full | en+pl |

### action-tiles

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Analyze.analyseBullet` | - | both | full | read, kept |
| `DRPG.Analyze.askHint` | - | both | full | read, kept |
| `DRPG.Analyze.whichBullet` | - | both | full | read, kept |
| `DRPG.Analyze.onBullet` | - | both | full | read, kept |
| `DRPG.Analyze.noBullets` | - | both | full | pl |
| `DRPG.Analyze.sent` | player-card | both | full | en+pl |
| `DRPG.Analyze.analyseBulletHint` | - | both | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Analyze.askHintHint` | - | both | full | en |
| `DRPG.Analyze.findStash` | - | both | check | read, kept |
| `DRPG.Analyze.findStashHint` | - | both | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Analyze.findPassageHint` | - | both | check | en+pl |
| `DRPG.Analyze.stashSent` | player-card | both | full | read, kept |
| `DRPG.Observe.projectFoundDone` | - | both/unknown | full | read, kept |
| `DRPG.Observe.declarePrompt` | - | both | full | read, kept |
| `DRPG.Observe.general` | - | both | full | pl |
| `DRPG.Observe.specific` | - | both | full | read, kept |
| `DRPG.Observe.nonObvious` | - | both | full | read, kept |
| `DRPG.Observe.followTraces` | - | both | check | read, kept |
| `DRPG.Observe.anything` | - | both | full | en+pl |
| `DRPG.Observe.anythingTitle` | window-title | both | full | read, kept |
| `DRPG.Observe.requestPlaceholder` | - | both | full | read, kept |
| `DRPG.Observe.requestPrompt` | - | both | full | en |
| `DRPG.Observe.requestSkipped` | toast | both | full | en+pl |
| `DRPG.Observe.sent` | player-card | both | full | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Observe.cardTitle` | window-title | both/unknown | full | read, kept |
| `DRPG.Observe.cardHint` | - | both/unknown | full | en+pl |
| `DRPG.Observe.cardPick` | - | both/unknown | check | read, kept |
| `DRPG.Observe.pickNotThere` | - | both/unknown | full | en+pl |
| `DRPG.Observe.pickGone` | - | both/unknown | full | en+pl |
| `DRPG.Observe.generalHint` | - | both | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Observe.nonObviousHint` | - | both | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Observe.followTracesHint` | - | both | check | read, kept |
| `DRPG.Observe.specificHint` | - | both | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Observe.anythingHint` | - | both | full | read, kept |
| `DRPG.Remnant.dynamicNote` | - | both/unknown | full | pl |
| `DRPG.Remnant.searchNote` | - | both | full | en+pl |
| `DRPG.Remnant.sabotageNote` | - | both | full | read, kept |
| `DRPG.Remnant.sabotageWorked` | - | both | full | read, kept |
| `DRPG.Remnant.sabotageFailed` | - | both | full | en+pl |
| `DRPG.Remnant.projectNote` | - | both | full | read, kept |
| `DRPG.Remnant.projectNoteUncovered` | - | both | full | read, kept |

### cleanup

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Observe.defaultName` | - | both | check | read, kept |

### file:scripts/api.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Remnant.leftBy` | gm-card | unknown | full | pl |
| `DRPG.Remnant.cardWhat` | gm-card | unknown | check | read, kept |
| `DRPG.Remnant.cardWhere` | gm-card | unknown | full | read, kept |
| `DRPG.Remnant.report.heading` | - | unknown | full | read, kept |
| `DRPG.Remnant.report.scene` | gm-card | unknown | full | read, kept |
| `DRPG.Remnant.report.when` | gm-card | unknown | full | read, kept |
| `DRPG.Remnant.report.faintTag` | - | unknown | full | read, kept |
| `DRPG.Remnant.report.hidden` | - | unknown | full | read, kept |
| `DRPG.Remnant.report.revealed` | - | unknown | full | read, kept |
| `DRPG.Remnant.report.reinforcedNote` | gm-card | unknown | full | en+pl |
| `DRPG.Remnant.report.noneScene` | gm-card | unknown | full | pl |
| `DRPG.Remnant.report.noneAnywhere` | gm-card | unknown | full | pl |

### file:scripts/remnant-ring.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Remnant.cardFacts` | - | unknown | check | read, kept |
| `DRPG.Remnant.cardPlayerHalf` | - | unknown | check | read, kept |
| `DRPG.Remnant.cardAction` | - | unknown | full | read, kept |
| `DRPG.Remnant.authorReplaceTitle` | window-title | unknown | full | read, kept |
| `DRPG.Remnant.authorReplace` | - | unknown | full | en+pl |
| `DRPG.Remnant.authorReplaceYes` | - | unknown | check | read, kept |
| `DRPG.Remnant.cardWhen` | - | unknown | full | read, kept |
| `DRPG.Remnant.dayShort` | - | unknown | full | read, kept |
| `DRPG.Remnant.cardWho` | - | unknown | full | read, kept |
| `DRPG.Remnant.cardSubject` | - | unknown | full | read, kept |
| `DRPG.Remnant.cardPlayer` | - | unknown | full | en+pl |
| `DRPG.Remnant.cardUnanalyzed` | - | unknown | full | read, kept |
| `DRPG.Remnant.cardUnread` | - | unknown | check | en+pl |
| `DRPG.Remnant.cardEditNote` | - | unknown | full | en+pl |
| `DRPG.Remnant.cardSaveFailed` | toast | unknown | full | read, kept |

### file:scripts/remnants.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Remnant.reinforced` | toast | unknown | full | en+pl |
| `DRPG.Remnant.faintKept` | toast | unknown | full | en+pl |
| `DRPG.Remnant.noToken` | toast | unknown | full | en+pl |
| `DRPG.Remnant.noTokenGm` | gm-card | unknown | full | pl |
| `DRPG.Remnant.revealWarning` | toast | unknown | full | pl |
| `DRPG.Remnant.action.search` | - | unknown | full | read, kept |
| `DRPG.Remnant.action.sabotage` | - | unknown | full | read, kept |
| `DRPG.Remnant.action.project` | - | unknown | full | read, kept |
| `DRPG.Remnant.action.dynamic` | - | unknown | check | read, kept |
| `DRPG.Remnant.action.incident` | - | unknown | full | read, kept |
| `DRPG.Remnant.action.resolution` | - | unknown | full | read, kept |
| `DRPG.Remnant.action.discard` | - | unknown | full | read, kept |
| `DRPG.Remnant.action.manual` | - | unknown | full | read, kept |
| `DRPG.Remnant.action.loot` | - | unknown | check | read, kept |
| `DRPG.Remnant.action.facility` | - | unknown | check | read, kept |
| `DRPG.Remnant.action.infiltrate` | - | unknown | check | read, kept |
| `DRPG.Remnant.keptOnTokens` | toast | unknown | full | en+pl |

### file:scripts/truth-bullets.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.TruthBullet.migratedTitle` | window-title | unknown | full | en+pl |
| `DRPG.TruthBullet.migrated` | gm-card | unknown | full | en+pl |
| `DRPG.TruthBullet.editReverted` | gm-card | unknown | full | en+pl |
| `DRPG.TruthBullet.editUnrestored` | gm-card | unknown | full | en+pl |

### file:scripts/use-items.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Remnant.discardNote` | - | unknown | check | en+pl |

### find-passage

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Analyze.findPassage` | - | both | full | read, kept |
| `DRPG.Analyze.passageSent` | player-card | both | full | read, kept |
| `DRPG.Passage.engineOff` | - | both | check | en+pl |

### gm-items

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.TruthBullet.takeAway` | - | gm | full | read, kept |
| `DRPG.TruthBullet.noneToTake` | - | gm | full | pl |
| `DRPG.TruthBullet.tabFromRemnant` | tab | gm | full | read, kept |
| `DRPG.TruthBullet.onScene` | - | gm | full | read, kept |
| `DRPG.TruthBullet.tabWriteNew` | tab | gm | full | read, kept |
| `DRPG.TruthBullet.pickRemnant` | - | gm | check | read, kept |
| `DRPG.TruthBullet.remnantNote` | - | gm | full | en+pl |
| `DRPG.TruthBullet.remnantEmpty` | - | gm | full | en+pl |
| `DRPG.TruthBullet.remnantGone` | toast | gm | full | read, kept |
| `DRPG.TruthBullet.alreadyHeld` | - | gm | full | read, kept |
| `DRPG.TruthBullet.alreadyGiven` | toast | gm | check | read, kept |
| `DRPG.TruthBullet.needsName` | toast | gm | full | read, kept |
| `DRPG.TruthBullet.everyoneMissed` | toast | gm | check | read, kept |
| `DRPG.TruthBullet.gave` | toast | gm | full | pl |
| `DRPG.TruthBullet.secretNote` | - | gm | full | en+pl |
| `DRPG.TruthBullet.autopsyHint` | - | gm | full | en+pl |
| `DRPG.TruthBullet.autopsyWho` | - | gm | full | read, kept |
| `DRPG.TruthBullet.autopsyIssue` | - | gm | full | en+pl |
| `DRPG.TruthBullet.autopsyNobody` | toast | gm | full | read, kept |
| `DRPG.TruthBullet.autopsyIssued` | toast | gm | full | en+pl |

### investigation

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.TruthBullet.give` | - | gm | full | read, kept |
| `DRPG.TruthBullet.name` | - | both/gm/unknown | full | en+pl |
| `DRPG.TruthBullet.namePlaceholder` | - | gm | full | read, kept |
| `DRPG.TruthBullet.realType` | - | gm | full | read, kept |
| `DRPG.TruthBullet.shown` | - | gm | full | read, kept |
| `DRPG.TruthBullet.shownAuto` | - | gm | full | pl |
| `DRPG.TruthBullet.shownNeutral` | - | gm | full | en+pl |
| `DRPG.TruthBullet.shownReal` | - | gm | full | en+pl |
| `DRPG.TruthBullet.visibility` | - | gm | full | read, kept |
| `DRPG.TruthBullet.faintField` | - | gm | full | en+pl |
| `DRPG.TruthBullet.tiedField` | - | gm | full | read, kept |
| `DRPG.TruthBullet.playerText` | - | both/gm/unknown | full | read, kept |
| `DRPG.TruthBullet.playerTextPlaceholder` | - | both/gm/unknown | check | en |
| `DRPG.TruthBullet.analyzedText` | - | both/gm/unknown | check | read, kept |
| `DRPG.TruthBullet.analyzedTextPlaceholder` | - | both/gm/unknown | check | read, kept |
| `DRPG.TruthBullet.gmNote` | - | gm | full | read, kept |
| `DRPG.TruthBullet.gmNotePlaceholder` | - | gm | full | read, kept |
| `DRPG.TruthBullet.autopsyTitle` | window-title | gm | full | read, kept |
| `DRPG.TruthBullet.autopsyNamePlaceholder` | - | gm | full | read, kept |
| `DRPG.TruthBullet.autopsyTextPlaceholder` | - | gm | full | read, kept |
| `DRPG.Remnant.faintColumn` | - | gm | full | read, kept |
| `DRPG.Remnant.crimeColumn` | - | gm/unknown | full | read, kept |
| `DRPG.Remnant.tieOpen` | - | gm | check | read, kept |
| `DRPG.Remnant.tieTied` | - | gm | check | read, kept |
| `DRPG.Remnant.tieUntied` | - | gm | check | read, kept |
| `DRPG.Remnant.tieShortOpen` | - | gm | check | read, kept |
| `DRPG.Remnant.tieShortTied` | - | gm | check | read, kept |
| `DRPG.Remnant.tieShortUntied` | - | gm | check | read, kept |
| `DRPG.Remnant.reinforcedColumn` | - | gm/unknown | check | read, kept |
| `DRPG.Remnant.authorLabel` | - | gm/unknown | check | pl |
| `DRPG.Remnant.authorUnknown` | - | gm/unknown | check | read, kept |
| `DRPG.Remnant.cardTitle` | window-title | gm/unknown | check | read, kept |
| `DRPG.Remnant.tokenName` | - | gm/unknown | check | read, kept |
| `DRPG.Remnant.finalSubject` | - | both/gm | full | read, kept |

### observe

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Analyze.identifiedTitle` | window-title | both | full | read, kept |
| `DRPG.Analyze.identified` | player-card | both | full | read, kept |
| `DRPG.Analyze.failedTitle` | window-title | both | full | read, kept |
| `DRPG.Analyze.failed` | player-card | both | full | read, kept |
| `DRPG.Analyze.failedShown` | player-card | both | full | read, kept |
| `DRPG.Analyze.critTitle` | window-title | both | full | read, kept |
| `DRPG.Analyze.critPrompt` | gm-card | both | full | en+pl |
| `DRPG.Analyze.critNothingMore` | - | both | full | read, kept |
| `DRPG.Observe.failedTitle` | window-title | both | full | read, kept |
| `DRPG.Observe.failed` | player-card | both | full | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Observe.failedStress` | - | both | full | en |
| `DRPG.Observe.projectFoundTitle` | window-title | both | full | pl |
| `DRPG.Observe.projectFound` | player-card | both | check | read, kept |
| `DRPG.Observe.critIdentified` | player-card | both | full | pl |
| `DRPG.Observe.pickTitle` | window-title | both | check | read, kept |
| `DRPG.Observe.pickIntro` | - | both | full | read, kept |
| `DRPG.Observe.noRequest` | - | both | full | read, kept |
| `DRPG.Observe.whichRemnant` | - | both | full | read, kept |
| `DRPG.Observe.pickNote` | - | both | full | en+pl |
| `DRPG.Observe.pickConfirm` | - | both | full | en+pl |
| `DRPG.Observe.pickRefuse` | - | both/unknown | full | en+pl |
| `DRPG.Observe.pickNothing` | toast | both | full | read, kept |
| `DRPG.Observe.tiedFlag` | - | both | full | read, kept |
| `DRPG.Observe.describeTitle` | window-title | both | check | en+pl |
| `DRPG.Observe.describeIntro` | - | both | check | pl |
| `DRPG.Observe.critPrompt` | - | both | check | en+pl |
| `DRPG.Observe.critHint` | - | both | check | read, kept |
| `DRPG.Observe.critHintPlaceholder` | - | both | check | read, kept |
| `DRPG.Observe.critHintNote` | - | both | check | en+pl |
| `DRPG.Observe.describeConfirm` | - | both | check | en+pl |
| `DRPG.Observe.resolveLost` | gm-card | both | check | en+pl |
| `DRPG.Observe.resolveLostOwner` | player-card | both | check | en+pl |
| `DRPG.Observe.rerollLost` | gm-card | both | check | en+pl |
| `DRPG.Observe.alreadyHeld` | player-card | both | check | en+pl |
| `DRPG.Observe.alreadyDescribed` | - | both | full | en+pl |
| `DRPG.TruthBullet.analyzedTextNote` | - | both/unknown | check | en+pl |
| `DRPG.TruthBullet.received` | player-card | both/gm/unknown | full | read, kept |
| `DRPG.TruthBullet.whereToFind` | player-card | both/gm/unknown | full | read, kept |

### passages-gm

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Analyze.passageNothing` | - | gm | full | read, kept |
| `DRPG.Analyze.passageFound` | - | gm | full | en+pl |
| `DRPG.Passage.card.breachDoneHere` | - | gm | full | read, kept |
| `DRPG.Passage.card.breachDoneHereNamed` | - | gm | full | read, kept |
| `DRPG.Passage.card.breachDoneThere` | - | gm | full | read, kept |
| `DRPG.Passage.card.breachDoneThereNamed` | - | gm | full | read, kept |
| `DRPG.Passage.card.breachHeard` | - | gm | full | pl |
| `DRPG.Passage.card.breachForced` | gm-card | gm | full | en+pl |
| `DRPG.Passage.card.breachUnsealed` | - | gm | full | read, kept |
| `DRPG.Passage.card.passageBuiltShared` | player-card | gm | full | en+pl |
| `DRPG.Passage.card.passageBuilt` | player-card | gm | full | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Passage.gm.found` | - | gm | full | en+pl |
| `DRPG.Passage.gm.searched` | - | gm | full | read, kept |
| `DRPG.Passage.pick.new` | - | gm | full | read, kept |
| `DRPG.Passage.pick.newHint` | - | gm | full | read, kept |
| `DRPG.Passage.pick.title` | window-title | gm | full | read, kept |
| `DRPG.Passage.pick.retitle` | - | gm | full | read, kept |
| `DRPG.Passage.pick.step` | - | gm | full | read, kept |
| `DRPG.Passage.pick.first` | - | gm | full | read, kept |
| `DRPG.Passage.pick.second` | - | gm | full | read, kept |
| `DRPG.Passage.pick.cancel` | - | gm | full | read, kept |
| `DRPG.Passage.pick.made` | - | gm | full | read, kept |
| `DRPG.Passage.pick.moved` | - | gm | full | read, kept |
| `DRPG.Passage.pick.tunnel` | - | gm | full | read, kept |
| `DRPG.Passage.pick.tunnelHint` | - | gm | full | en+pl |
| `DRPG.Passage.pick.tunnelTitle` | window-title | gm | full | read, kept |
| `DRPG.Passage.pick.tunnelFirst` | - | gm | full | read, kept |
| `DRPG.Passage.pick.tunnelSecond` | - | gm | full | read, kept |
| `DRPG.Passage.pick.tunnelMade` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.notThese` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.noWall` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.door` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.noMove` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.notBetween` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.levels` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.taken` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.otherWall` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.otherRooms` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.short` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.trial` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.board` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.offRoom` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.oneRoom` | - | gm | full | read, kept |
| `DRPG.Passage.pick.why.endTaken` | - | gm | full | read, kept |

### sheet

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.TruthBullet.title` | window-title | both | full | read, kept |
| `DRPG.TruthBullet.visibilityTooltip` | tooltip | both | full | read, kept |
| `DRPG.TruthBullet.faintTooltip` | tooltip | both | full | en+pl |
| `DRPG.TruthBullet.roomTooltip` | tooltip | both | full | read, kept |
| `DRPG.TruthBullet.locked` | - | both | full | pl |
| `DRPG.TruthBullet.lockedTooltip` | tooltip | both | full | en+pl |
| `DRPG.TruthBullet.really` | - | both | full | read, kept |
| `DRPG.TruthBullet.reallyTooltip` | tooltip | both | full | en+pl |
| `DRPG.TruthBullet.analyzeTooltip` | tooltip | both | full | read, kept |

### stash

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Analyze.stashNothing` | player-card | both | full | read, kept |
| `DRPG.Analyze.stashFound` | player-card | both | full | en+pl |
| `DRPG.Analyze.stashFoundGm` | gm-card | both | full | read, kept |

### trial-evidence

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.TruthBullet.faint` | - | both/unknown | full | read, kept |
| `DRPG.TruthBullet.analysisHeading` | player-card | both/unknown | check | read, kept |
| `DRPG.TruthBullet.chapterShort` | - | both/unknown | full | read, kept |

## B08 (653 keys, 206 changed)

### (no screen)

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Vault.fogNote` | - | unknown | check | en+pl |
| `DRPG.Facility.badge.traitBonus` | - | unknown | full | read, kept |
| `DRPG.Facility.badge.experience` | - | unknown | full | read, kept |
| `DRPG.Facility.badge.despairShield` | - | unknown | full | read, kept |
| `DRPG.Facility.badge.eclipseCrossing` | - | unknown | full | read, kept |
| `DRPG.Facility.badge.ultimateBoost` | - | unknown | full | read, kept |
| `DRPG.Facility.timed.traitBonus` | - | unknown | check | read, kept |
| `DRPG.Facility.timed.experience` | - | unknown | check | read, kept |
| `DRPG.Facility.timed.despairShield` | - | unknown | check | en+pl |
| `DRPG.Facility.timed.eclipseCrossing` | - | unknown | check | read, kept |
| `DRPG.Facility.timed.ultimateBoost` | - | unknown | check | read, kept |
| `DRPG.Facility.shieldTook` | gm-card | unknown | check | read, kept |
| `DRPG.Facility.closed` | - | unknown | check | read, kept |
| `DRPG.Facility.shut.lockdown` | - | unknown | check | read, kept |
| `DRPG.Facility.shut.powercut` | - | unknown | check | read, kept |
| `DRPG.Facility.gmHint` | - | unknown | check | read, kept |
| `DRPG.Facility.projectHint` | - | unknown | check | read, kept |
| `DRPG.Passage.card.breachBedroom` | - | unknown | full | en+pl |
| `DRPG.Passage.card.shown` | - | unknown | full | en+pl |
| `DRPG.Passage.card.done` | - | unknown | check | read, kept |
| `DRPG.Passage.gm.shown` | - | unknown | full | en+pl |
| `DRPG.Passage.mark.to` | - | unknown | full | read, kept |
| `DRPG.Passage.mark.from` | - | unknown | full | read, kept |

### action-tiles

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Inventory.notCarried` | - | both | full | en+pl |
| `DRPG.Steal.nobodyHere` | toast | both | full | read, kept |
| `DRPG.Steal.whichWay` | - | both | full | read, kept |
| `DRPG.Steal.takeLabel` | - | both | full | read, kept |
| `DRPG.Steal.takeHint` | - | both | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Steal.plantLabel` | - | both | full | read, kept |
| `DRPG.Steal.plantHint` | - | both | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Steal.nothingToPlant` | - | both | full | read, kept |
| `DRPG.Steal.whatToPlant` | - | both | full | read, kept |
| `DRPG.Steal.whoPrompt` | - | both | full | read, kept |
| `DRPG.Steal.plantSent` | - | both | full | en+pl |
| `DRPG.Steal.emptyPockets` | toast | both | full | read, kept |
| `DRPG.Steal.chooseTitle` | window-title | both | full | read, kept |
| `DRPG.Steal.chooseIntro` | - | both | full | en+pl |
| `DRPG.Steal.sent` | - | both | full | en |
| `DRPG.Facility.forGood` | - | both | check | read, kept |
| `DRPG.Facility.projectLine` | - | both | check | read, kept |
| `DRPG.Facility.timesLeft` | - | both | check | read, kept |

### advancement

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Character.notACharacter` | toast | both/unknown | full | read, kept |

### file:scripts/action-facilities.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Facility.noActions` | toast | unknown | check | read, kept |

### file:scripts/bridge-runs-acts.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Facility.traceNote` | - | unknown | check | read, kept |

### file:scripts/character.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Character.startingItemNote` | - | unknown | full | pl |
| `DRPG.Character.startingItemMissing` | toast | unknown | full | read, kept |

### file:scripts/facilities-gm.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Facility.usedOk` | - | unknown | check | read, kept |
| `DRPG.Facility.usedFailed` | - | unknown | check | read, kept |
| `DRPG.Facility.applied.timed` | - | unknown | check | read, kept |
| `DRPG.Facility.applied.advantage` | - | unknown | check | read, kept |
| `DRPG.Facility.applied.health` | - | unknown | full | read, kept |
| `DRPG.Facility.applied.sanity` | - | unknown | full | read, kept |
| `DRPG.Facility.applied.hope` | - | unknown | full | read, kept |
| `DRPG.Facility.applied.hopeBlocked` | - | unknown | check | read, kept |
| `DRPG.Facility.applied.freeMove` | - | unknown | check | read, kept |
| `DRPG.Facility.applied.text` | - | unknown | check | read, kept |
| `DRPG.Facility.applied.searchToken` | - | unknown | check | en+pl |
| `DRPG.Facility.applied.overflowDown` | - | unknown | check | read, kept |
| `DRPG.Facility.applied.durability` | - | unknown | full | en+pl |
| `DRPG.Facility.applied.durabilityNone` | - | unknown | check | read, kept |
| `DRPG.Facility.applied.stateEnded` | - | unknown | check | read, kept |
| `DRPG.Facility.applied.stateNotHeld` | - | unknown | check | read, kept |
| `DRPG.Facility.applied.projectProgress` | - | unknown | full | read, kept |
| `DRPG.Facility.applied.projectFull` | - | unknown | check | read, kept |
| `DRPG.Facility.applied.projectNone` | - | unknown | check | read, kept |
| `DRPG.Facility.state.wounded` | - | unknown | full | read, kept |
| `DRPG.Facility.state.breakdown` | - | unknown | full | read, kept |

### file:scripts/facility-editor.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Facility.editor.until` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.trait` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.roomTitle` | window-title | unknown | check | read, kept |
| `DRPG.Facility.editor.saveProject` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.actionN` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.tabNote` | tab | unknown | check | en+pl |
| `DRPG.Facility.editor.roomIntro` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.roomNote` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.projectTitle` | window-title | unknown | check | read, kept |
| `DRPG.Facility.editor.projectIntro` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.projectNote` | - | unknown | check | en+pl |
| `DRPG.Facility.editor.label` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.labelPlaceholder` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.dc` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.effects` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.effect` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.amount` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.scope` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.text` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.textPlaceholder` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.noEffect` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.costsAction` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.lifetime` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.lifetimeN` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.life.forever` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.life.timesOfDay` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.life.days` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.save` | - | unknown | check | read, kept |
| `DRPG.Facility.editor.remove` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.traitBonus` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.experience` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.advantage` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.despairShield` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.eclipseCrossing` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.durability` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.endWounded` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.endBreakdown` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.projectProgress` | - | unknown | check | en+pl |
| `DRPG.Facility.effect.ultimateBoost` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.health` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.sanity` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.hope` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.freeMove` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.searchToken` | - | unknown | check | en+pl |
| `DRPG.Facility.effect.overflowDown` | - | unknown | check | read, kept |
| `DRPG.Facility.effect.text` | - | unknown | check | read, kept |
| `DRPG.Facility.scope.self` | - | unknown | check | read, kept |
| `DRPG.Facility.scope.present` | - | unknown | check | read, kept |
| `DRPG.Facility.scope.others` | - | unknown | check | read, kept |

### file:scripts/handover.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Handover.alreadyHasKey` | player-card | unknown | full | read, kept |
| `DRPG.Handover.stashed` | player-card | unknown | full | en+pl |
| `DRPG.Handover.share` | - | unknown | full | read, kept |
| `DRPG.Handover.give` | - | unknown | full | read, kept |
| `DRPG.Handover.shareTitle` | window-title | unknown | full | en+pl |
| `DRPG.Handover.giveTitle` | window-title | unknown | full | en+pl |
| `DRPG.Handover.shareIntro` | - | unknown | full | en+pl |
| `DRPG.Handover.giveIntro` | - | unknown | full | en+pl |
| `DRPG.Handover.who` | - | unknown | full | read, kept |
| `DRPG.Handover.shareNote` | - | unknown | full | en+pl |
| `DRPG.Handover.giveNote` | - | unknown | full | en+pl |
| `DRPG.Handover.nobodyHere` | toast | unknown | full | en |
| `DRPG.Handover.notInRoom` | toast | unknown | full | en+pl |
| `DRPG.Handover.theirHandsFull` | player-card | unknown | full | en+pl |
| `DRPG.Handover.failed` | player-card | unknown | full | read, kept |
| `DRPG.Handover.alreadyHasIt` | player-card | unknown | full | en+pl |
| `DRPG.Handover.shared` | player-card | unknown | full | en+pl |
| `DRPG.Handover.gave` | player-card | unknown | full | en |
| `DRPG.Handover.gaveOne` | player-card | unknown | full | en |
| `DRPG.Handover.receivedBullet` | player-card | unknown | full | read, kept |
| `DRPG.Handover.receivedBulletFrom` | player-card | unknown | full | en+pl |
| `DRPG.Handover.receivedItem` | player-card | unknown | full | read, kept |
| `DRPG.Handover.receivedItemFrom` | player-card | unknown | full | en+pl |
| `DRPG.Loot.bulletName` | - | unknown | full | pl |
| `DRPG.Loot.bulletText` | - | unknown | full | pl |
| `DRPG.Loot.traceNote` | - | unknown | full | read, kept |
| `DRPG.Loot.coverHeld` | player-card | unknown | check | read, kept |
| `DRPG.Loot.coverMissed` | player-card | unknown | check | read, kept |
| `DRPG.Loot.seenAtBody` | - | unknown | check | pl |
| `DRPG.Loot.seenTaking` | - | unknown | check | pl |
| `DRPG.Loot.handsFull` | player-card | unknown | check | read, kept |
| `DRPG.Vault.keyShared` | player-card | unknown | full | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Vault.keyGave` | player-card | unknown | full | read, kept |

### file:scripts/inventory.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Items.autoReadied` | player-card | unknown | full | en+pl |
| `DRPG.Items.iconsPinned` | toast | unknown | full | en+pl |
| `DRPG.Inventory.overCap` | toast | unknown | full | en+pl |
| `DRPG.Handover.stuckFor.give` | - | unknown | full | en+pl |
| `DRPG.Handover.stuckFor.loot` | - | unknown | full | en+pl |
| `DRPG.Handover.stuckFor.rifle` | - | unknown | full | en+pl |
| `DRPG.Handover.stuckFor.steal` | - | unknown | full | en+pl |
| `DRPG.Handover.stuckFor.plant` | - | unknown | full | en+pl |
| `DRPG.Handover.keyAlreadyHeld` | player-card | unknown | full | read, kept |
| `DRPG.Handover.changedMidway` | gm-card | unknown | full | en+pl |
| `DRPG.Handover.changedMidwayKept` | gm-card | unknown | full | en+pl |
| `DRPG.Vault.overflowed` | player-card | unknown | full | en+pl |

### file:scripts/movement-audit.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Vault.keyMissing` | - | unknown | full | read, kept |

### file:scripts/requirements.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.SheetNotes.failedSteps` | toast | unknown | check | en+pl |

### file:scripts/use-items.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Items.useGone` | toast | unknown | full | en+pl |
| `DRPG.Items.itemNoEffect` | - | unknown | full | en+pl |
| `DRPG.Items.itemRefuse` | - | unknown | full | en |
| `DRPG.Items.used` | player-card | unknown | full | en+pl |
| `DRPG.Items.usedNothing` | player-card | unknown | full | en+pl |
| `DRPG.Items.useStashed` | toast | unknown | full | read, kept |
| `DRPG.Items.stowShape` | toast | unknown | full | en+pl |
| `DRPG.Items.equipStashed` | toast | unknown | full | read, kept |
| `DRPG.Items.creativePrompt` | - | unknown | full | read, kept |
| `DRPG.Items.creativePlaceholder` | - | unknown | full | read, kept |
| `DRPG.Items.creativeSent` | player-card | unknown | full | read, kept |
| `DRPG.Items.confirmUse` | - | unknown | full | pl |
| `DRPG.Items.wouldRestore` | - | unknown | full | read, kept |
| `DRPG.Items.wouldRestoreNothing` | - | unknown | full | en |
| `DRPG.Items.woreOnDespair` | player-card | unknown | check | read, kept |
| `DRPG.Items.brokeOnDespair` | player-card | unknown | full | en+pl |
| `DRPG.Items.singleUseSpent` | player-card | unknown | full | en+pl |
| `DRPG.Items.brokenUseless` | toast | unknown | full | pl |
| `DRPG.Items.discardTitle` | window-title | unknown | full | pl |
| `DRPG.Items.discardPrompt` | - | unknown | full | read, kept |
| `DRPG.Items.discardNote` | - | unknown | full | en+pl |
| `DRPG.Items.discarded` | player-card | unknown | full | en+pl |
| `DRPG.Items.discardTrace` | player-card | unknown | full | en |
| `DRPG.Items.discardOnlyBroken` | toast | unknown | full | read, kept |
| `DRPG.Items.discardStashed` | toast | unknown | full | read, kept |
| `DRPG.Items.discardNoTrace` | player-card | unknown | full | en+pl |
| `DRPG.Items.discardKept` | player-card | unknown | full | read, kept |

### frisk

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Items.broken` | - | both/gm | full | read, kept |
| `DRPG.Frisk.rowLabel` | - | both | full | read, kept |
| `DRPG.Frisk.rowHint` | - | both | full | read, kept |
| `DRPG.Frisk.noticeTitle` | window-title | both | full | read, kept |
| `DRPG.Frisk.unseenLabel` | - | both | full | read, kept |
| `DRPG.Frisk.unseenHint` | - | both | full | read, kept |
| `DRPG.Frisk.sent` | - | both | full | en+pl |
| `DRPG.Frisk.listHeading` | - | both | full | read, kept |
| `DRPG.Frisk.empty` | - | both | full | read, kept |
| `DRPG.Frisk.missed` | - | both | full | read, kept |
| `DRPG.Frisk.caught` | - | both | full | pl |
| `DRPG.Frisk.caughtTrying` | - | both | full | pl |
| `DRPG.Frisk.openLabel` | - | both | full | read, kept |
| `DRPG.Frisk.openHint` | - | both | full | en+pl |
| `DRPG.Frisk.openHintAskOnly` | - | both | full | pl |
| `DRPG.Frisk.forceSent` | - | both | full | en+pl |
| `DRPG.Frisk.waiting` | - | both | full | en+pl |
| `DRPG.Frisk.refused` | - | both | full | read, kept |
| `DRPG.Frisk.noAnswer` | - | both | full | read, kept |
| `DRPG.Frisk.gone` | - | both | full | read, kept |
| `DRPG.Frisk.goneAfterNo` | - | both | full | read, kept |
| `DRPG.Frisk.interrupted` | - | both | full | en+pl |
| `DRPG.Frisk.actionBack` | toast | both | full | read, kept |
| `DRPG.Frisk.isBody` | - | both | full | en+pl |
| `DRPG.Frisk.askedAlready` | - | both | full | pl |
| `DRPG.Frisk.targetBusy` | - | both | full | read, kept |
| `DRPG.Frisk.youBusy` | - | both | full | read, kept |
| `DRPG.Frisk.forceTitle` | window-title | both | full | en+pl |
| `DRPG.Frisk.forceText` | - | both | full | read, kept |
| `DRPG.Frisk.force` | - | both | full | read, kept |
| `DRPG.Frisk.leave` | - | both | full | read, kept |
| `DRPG.Frisk.shownHeading` | - | both | full | read, kept |
| `DRPG.Frisk.asAsked` | - | both | full | pl |
| `DRPG.Frisk.askTitle` | window-title | both | full | en |
| `DRPG.Frisk.askText` | - | both | full | read, kept |
| `DRPG.Frisk.askTextAskOnly` | - | both | full | read, kept |
| `DRPG.Frisk.askClock` | - | both | full | read, kept |
| `DRPG.Frisk.allow` | - | both | full | read, kept |
| `DRPG.Frisk.refuse` | - | both | full | read, kept |
| `DRPG.Frisk.withdrawn` | - | both | full | read, kept |
| `DRPG.Frisk.shown` | - | both | full | pl |
| `DRPG.Frisk.forced` | - | both | full | read, kept |
| `DRPG.Frisk.forcedFailed` | - | both | full | read, kept |
| `DRPG.Frisk.letGo` | - | both | full | read, kept |
| `DRPG.Frisk.wShown` | - | both | full | pl |
| `DRPG.Frisk.wForced` | - | both | full | pl |
| `DRPG.Frisk.wForcedFailed` | - | both | full | pl |
| `DRPG.Frisk.wLetGo` | - | both | full | pl |
| `DRPG.Frisk.wWalkedAway` | - | both | full | pl |
| `DRPG.Frisk.gmFor` | - | both | full | pl |
| `DRPG.Frisk.gmKept` | - | both | full | en+pl |
| `DRPG.Frisk.gmIncident` | - | both | full | pl |
| `DRPG.Frisk.gmKeptNow` | - | both | full | en+pl |
| `DRPG.Frisk.gmIncidentNow` | - | both | check | pl |
| `DRPG.Frisk.noReceipt` | - | both | full | en+pl |

### give-items

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Items.give` | - | gm | full | read, kept |
| `DRPG.Items.category` | - | gm | full | read, kept |
| `DRPG.Items.tier` | - | gm | full | read, kept |
| `DRPG.Items.tierN` | player-card | gm | full | read, kept |
| `DRPG.Items.name` | - | gm | full | read, kept |
| `DRPG.Items.namePlaceholder` | - | gm | full | read, kept |
| `DRPG.Items.description` | - | gm | full | read, kept |
| `DRPG.Items.descriptionPlaceholder` | - | gm | full | read, kept |
| `DRPG.Items.alsoServesAs` | - | gm | full | read, kept |
| `DRPG.Items.tabGiveExisting` | tab | gm | full | read, kept |
| `DRPG.Items.tabCreateNew` | tab | gm | full | read, kept |
| `DRPG.Items.pickTable` | - | gm | full | read, kept |
| `DRPG.Items.pickExisting` | - | gm | full | read, kept |
| `DRPG.Items.existingNote` | - | gm | check | read, kept |
| `DRPG.Items.existingEmpty` | - | gm | full | read, kept |
| `DRPG.Items.overCapNote` | - | gm | full | en+pl |
| `DRPG.Items.chooseOne` | - | gm | check | read, kept |
| `DRPG.Items.setCategoryTier` | toast | gm | check | read, kept |
| `DRPG.Vault.giveKey` | - | gm | full | read, kept |
| `DRPG.Vault.whichKey` | - | gm | full | read, kept |
| `DRPG.Vault.giveKeyNote` | - | gm | full | en+pl |
| `DRPG.Vault.noKeysToGive` | toast | gm | check | en+pl |
| `DRPG.Vault.hasEveryKey` | - | gm | check | read, kept |
| `DRPG.Vault.onlyOwnBedroom` | - | gm | full | read, kept |

### gm-items

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Items.kindFromTables` | - | gm | full | pl |
| `DRPG.Items.manage` | - | gm | full | read, kept |
| `DRPG.Items.take` | - | gm | full | read, kept |
| `DRPG.Items.takeFrom` | - | gm | full | read, kept |
| `DRPG.Items.takeFromWhom` | - | gm | full | read, kept |
| `DRPG.Items.needsName` | toast | gm | full | read, kept |
| `DRPG.Items.needsRecipient` | toast | gm | full | read, kept |
| `DRPG.Items.received` | player-card | gm | full | read, kept |
| `DRPG.Items.lostTitle` | window-title | gm | full | read, kept |
| `DRPG.Items.lost` | player-card | gm | full | read, kept |
| `DRPG.Items.gave` | toast | gm | full | pl |
| `DRPG.Items.took` | toast | gm | full | en+pl |
| `DRPG.Items.nothingToTake` | toast | gm | full | read, kept |
| `DRPG.Items.failed` | toast | gm | full | read, kept |
| `DRPG.Items.tabGive` | tab | gm | full | read, kept |
| `DRPG.Items.tabTake` | tab | gm | check | read, kept |
| `DRPG.Items.takeNote` | - | gm | check | en+pl |
| `DRPG.Items.giveWhat` | - | gm | check | read, kept |
| `DRPG.Items.whatItem` | - | gm | check | read, kept |
| `DRPG.Items.whatBullet` | - | gm | check | read, kept |
| `DRPG.Items.whatKey` | - | gm | check | read, kept |
| `DRPG.Items.giveFrom` | - | gm | check | read, kept |
| `DRPG.Items.fromTables` | - | gm | check | read, kept |
| `DRPG.Items.giveButton` | button | gm | check | read, kept |
| `DRPG.Items.inStash` | - | gm | check | read, kept |
| `DRPG.Items.carriesNothing` | - | gm | check | read, kept |
| `DRPG.Items.whichCharacterHub` | - | gm | check | read, kept |
| `DRPG.Vault.keyGivenGm` | toast | gm | full | read, kept |
| `DRPG.Vault.takeKey` | - | gm | check | read, kept |
| `DRPG.Vault.noKeysToTake` | - | gm | check | read, kept |

### gm-panel

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Items.hubButton` | button | gm | full | read, kept |
| `DRPG.Vault.manageTitle` | window-title | gm | full | read, kept |

### investigation

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Items.recipient` | - | gm | full | read, kept |
| `DRPG.Items.everyone` | - | gm | check | read, kept |
| `DRPG.Items.tellPlayer` | - | gm | full | read, kept |

### item-effect

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Items.itemWorks` | - | gm/unknown | full | en+pl |
| `DRPG.Items.effectTitle` | window-title | gm | full | read, kept |
| `DRPG.Items.effectHealth` | - | gm | full | read, kept |
| `DRPG.Items.effectSanity` | - | gm | full | read, kept |
| `DRPG.Items.effectHope` | - | gm | full | pl |
| `DRPG.Items.effectConsume` | - | gm | full | read, kept |

### messenger

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Items.rulingOpen` | toast | both | full | pl |
| `DRPG.Items.rulingGone` | - | both | full | en+pl |
| `DRPG.Items.creativeRefused` | - | both | full | read, kept |
| `DRPG.Passage.card.repickDone` | - | both | check | read, kept |

### projects

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Facility.editor.projectButton` | button | both/unknown | check | en+pl |
| `DRPG.Passage.card.notBuilt` | - | both | full | read, kept |
| `DRPG.Passage.card.notBreached` | - | both | full | read, kept |
| `DRPG.Passage.card.notSealed` | gm-card | both | full | read, kept |
| `DRPG.Passage.card.notClosed` | gm-card | both | full | read, kept |
| `DRPG.Passage.card.notReopened` | gm-card | both | full | read, kept |
| `DRPG.Passage.card.repick` | - | both | check | read, kept |
| `DRPG.Passage.card.repickTitle` | window-title | both | check | read, kept |
| `DRPG.Passage.card.repickIntro` | - | both | check | en+pl |
| `DRPG.Passage.card.repickGone` | toast | both | check | en+pl |

### room-setup

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Vault.tabStashes` | tab | both/gm | full | read, kept |
| `DRPG.Vault.stashCycle` | - | gm | full | read, kept |
| `DRPG.Vault.manageTitleOn` | - | gm | full | read, kept |
| `DRPG.Vault.favours` | - | both/gm | full | read, kept |
| `DRPG.Vault.hinders` | - | both/gm | full | read, kept |
| `DRPG.Vault.placeNeither` | - | both/gm | full | read, kept |
| `DRPG.Vault.noRooms` | toast | both/gm | full | read, kept |
| `DRPG.Vault.appliedOn` | toast | gm | full | read, kept |
| `DRPG.Vault.tabRooms` | tab | both/gm | check | read, kept |
| `DRPG.Vault.tabDoors` | tab | both/gm | check | read, kept |
| `DRPG.Vault.tabPassages` | tab | both/gm | check | read, kept |
| `DRPG.Vault.tabSearching` | tab | both/gm | check | read, kept |
| `DRPG.Vault.tabFacilities` | tab | both/gm | check | read, kept |
| `DRPG.Vault.tabDescription` | tab | both/gm | check | read, kept |
| `DRPG.Vault.tabFog` | tab | both/gm | full | read, kept |
| `DRPG.Vault.fogMastermind` | - | gm | check | read, kept |
| `DRPG.Passage.why.noScene` | - | gm | full | en+pl |
| `DRPG.Passage.why.twoRooms` | - | gm | full | read, kept |
| `DRPG.Passage.why.gmOnly` | - | gm | full | en+pl |
| `DRPG.Passage.why.noStore` | - | gm | full | read, kept |
| `DRPG.Passage.why.noBuilder` | - | gm | full | pl |
| `DRPG.Passage.why.idTaken` | - | gm | full | pl |
| `DRPG.Passage.why.breached` | - | gm | full | read, kept |
| `DRPG.Passage.why.wholeWall` | - | gm | full | read, kept |
| `DRPG.Passage.why.noBreach` | - | gm | full | pl |
| `DRPG.Passage.why.wallGone` | - | gm | full | en+pl |
| `DRPG.Passage.why.cannotClose` | - | gm | full | read, kept |
| `DRPG.Passage.why.notKnown` | - | gm | check | read, kept |
| `DRPG.Passage.why.isBreach` | - | gm | check | en+pl |
| `DRPG.Passage.why.noSide` | - | gm | check | pl |
| `DRPG.Passage.why.lockWhole` | - | gm | check | en+pl |
| `DRPG.Passage.why.lockTaken` | - | gm | check | pl |
| `DRPG.Passage.why.lockFar` | - | gm | check | pl |
| `DRPG.Passage.why.noWall` | - | gm | check | read, kept |
| `DRPG.Passage.why.taken` | - | gm | check | read, kept |
| `DRPG.Passage.why.levels` | - | gm | check | read, kept |
| `DRPG.Passage.why.notBetween` | - | gm | full | read, kept |
| `DRPG.Passage.why.otherRooms` | - | gm | full | read, kept |
| `DRPG.Passage.why.short` | - | gm | full | read, kept |
| `DRPG.Passage.why.door` | - | gm | full | read, kept |
| `DRPG.Passage.why.noMove` | - | gm | full | read, kept |
| `DRPG.Passage.why.sameEnds` | - | gm | full | pl |
| `DRPG.Passage.why.offWall` | - | gm | full | read, kept |
| `DRPG.Passage.why.floor` | - | gm | full | read, kept |
| `DRPG.Passage.why.notOwn` | - | gm | full | en+pl |
| `DRPG.Passage.why.notRepairable` | - | gm | full | en+pl |
| `DRPG.Passage.why.nothingBack` | - | gm | check | pl |
| `DRPG.Passage.why.itemBack` | - | gm | check | en+pl |
| `DRPG.Passage.why.brokenSince` | - | gm | check | read, kept |
| `DRPG.Passage.why.repairTooSmall` | - | gm | check | read, kept |
| `DRPG.Passage.why.unknown` | - | gm | check | read, kept |
| `DRPG.Passage.tab.originProject` | - | gm | full | read, kept |
| `DRPG.Passage.tab.howShared` | - | gm | full | read, kept |
| `DRPG.Passage.tab.howBuilt` | - | gm | full | read, kept |
| `DRPG.Passage.tab.intro` | - | gm | full | read, kept |
| `DRPG.Passage.tab.rooms` | - | gm | full | read, kept |
| `DRPG.Passage.tab.kind` | - | gm | check | read, kept |
| `DRPG.Passage.tab.shape` | - | gm | check | read, kept |
| `DRPG.Passage.tab.origin` | - | gm | check | read, kept |
| `DRPG.Passage.tab.knows` | - | gm | check | read, kept |
| `DRPG.Passage.tab.start` | - | gm | check | read, kept |
| `DRPG.Passage.tab.startHint` | - | gm | full | read, kept |
| `DRPG.Passage.tab.state` | - | gm | full | read, kept |
| `DRPG.Passage.tab.kindSecret` | - | gm | full | read, kept |
| `DRPG.Passage.tab.kindPublic` | - | gm | full | read, kept |
| `DRPG.Passage.tab.kindBreach` | - | gm | full | read, kept |
| `DRPG.Passage.tab.closeBreach` | - | gm | full | read, kept |
| `DRPG.Passage.tab.closeBreachRefused` | toast | gm | full | read, kept |
| `DRPG.Passage.tab.shapeWall` | - | gm | full | read, kept |
| `DRPG.Passage.tab.shapeTunnel` | - | gm | full | read, kept |
| `DRPG.Passage.tab.way` | - | gm | full | read, kept |
| `DRPG.Passage.tab.wayBoth` | - | gm | full | read, kept |
| `DRPG.Passage.tab.wayOnly` | - | gm | full | read, kept |
| `DRPG.Passage.tab.wayHint` | - | gm | full | read, kept |
| `DRPG.Passage.tab.originGm` | - | gm | full | read, kept |
| `DRPG.Passage.tab.originDoor` | - | gm | full | read, kept |
| `DRPG.Passage.tab.noRooms` | - | gm | full | read, kept |
| `DRPG.Passage.tab.unknown` | - | gm | full | read, kept |
| `DRPG.Passage.tab.none` | - | gm | full | read, kept |
| `DRPG.Passage.tab.empty` | - | gm | full | read, kept |
| `DRPG.Passage.tab.howGm` | - | gm | full | read, kept |
| `DRPG.Passage.tab.howStart` | - | gm | full | read, kept |
| `DRPG.Passage.tab.howShown` | - | gm | full | read, kept |
| `DRPG.Passage.tab.howFound` | - | gm | full | read, kept |
| `DRPG.Passage.tab.leaving` | - | gm | full | en |
| `DRPG.Passage.tab.revoke` | - | gm | full | read, kept |
| `DRPG.Passage.tab.grant` | - | gm | full | read, kept |
| `DRPG.Passage.tab.startAdd` | - | gm | full | en+pl |
| `DRPG.Passage.tab.startRemove` | - | gm | full | en+pl |
| `DRPG.Passage.tab.stateSecret` | - | gm | full | read, kept |
| `DRPG.Passage.tab.stateClosed` | - | gm | full | read, kept |
| `DRPG.Passage.tab.stateBroken` | - | gm | full | en+pl |
| `DRPG.Passage.tab.repickHeld` | - | gm | check | read, kept |
| `DRPG.Passage.tab.toggleHeld` | - | gm | check | read, kept |
| `DRPG.Passage.tab.pending` | - | gm | full | en+pl |
| `DRPG.Passage.tab.shared` | - | gm | full | pl |
| `DRPG.Passage.tab.show` | - | gm | full | read, kept |
| `DRPG.Passage.tab.close` | - | gm | full | read, kept |
| `DRPG.Passage.tab.open` | - | gm | full | read, kept |
| `DRPG.Passage.tab.makePublic` | - | gm | full | read, kept |
| `DRPG.Passage.tab.makeSecret` | - | gm | full | read, kept |
| `DRPG.Passage.tab.delete` | - | gm | full | read, kept |
| `DRPG.Passage.tab.footnote` | - | gm | full | en+pl |
| `DRPG.Passage.tab.revokeTitle` | window-title | gm | full | en+pl |
| `DRPG.Passage.tab.revokeAsk` | - | gm | full | en+pl |
| `DRPG.Passage.tab.revokeNote` | - | gm | full | en+pl |
| `DRPG.Passage.tab.revokeNow` | - | gm | full | read, kept |
| `DRPG.Passage.tab.revokeLeave` | - | gm | check | read, kept |
| `DRPG.Passage.tab.revokePublicAsk` | - | gm | check | read, kept |
| `DRPG.Passage.tab.revokePublicNote` | - | gm | check | read, kept |
| `DRPG.Passage.tab.introLine` | - | gm | check | read, kept |
| `DRPG.Passage.tab.deleteTitle` | window-title | gm | check | read, kept |
| `DRPG.Passage.tab.deleteAsk` | - | gm | check | en+pl |
| `DRPG.Passage.pick.repick` | - | gm | full | read, kept |

### season-setup

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Vault.tabScenes` | tab | gm | full | read, kept |

### sheet

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Items.buttonTooltip` | tooltip | both | full | read, kept |
| `DRPG.Items.caption` | - | both | check | read, kept |
| `DRPG.Items.useTooltip` | tooltip | both | full | read, kept |
| `DRPG.Items.useTier0Tooltip` | tooltip | both | check | read, kept |
| `DRPG.Items.equipTooltip` | tooltip | both | full | read, kept |
| `DRPG.Items.unequipTooltip` | tooltip | both | full | read, kept |
| `DRPG.Items.readyTooltip` | tooltip | both | full | read, kept |
| `DRPG.Items.noneReadied` | - | both | full | en+pl |
| `DRPG.Items.rowGone` | toast | both | full | read, kept |
| `DRPG.Items.brokenTooltip` | tooltip | both | full | en+pl |
| `DRPG.Items.durabilityTooltip` | tooltip | both | full | pl |
| `DRPG.Items.restores` | - | both | full | read, kept |
| `DRPG.Items.isA` | - | both | full | en+pl |
| `DRPG.Items.alsoServes` | - | both | full | read, kept |
| `DRPG.Items.singleUse` | - | both | full | read, kept |
| `DRPG.Items.singleUseTooltip` | tooltip | both | full | read, kept |
| `DRPG.Items.discardTooltip` | tooltip | both | check | read, kept |
| `DRPG.Items.noDiscardInTrial` | - | both/unknown | full | read, kept |
| `DRPG.Handover.shareTooltip` | tooltip | both | full | read, kept |
| `DRPG.Handover.giveTooltip` | tooltip | both | full | read, kept |
| `DRPG.Loot.take` | - | both | full | read, kept |
| `DRPG.Loot.takeTooltip` | tooltip | both | check | en+pl |
| `DRPG.Loot.heading` | - | both | full | read, kept |
| `DRPG.Loot.empty` | - | both | full | read, kept |
| `DRPG.Loot.noCharacter` | toast | both | full | read, kept |
| `DRPG.Loot.took` | toast | both | full | en+pl |
| `DRPG.Loot.tookUnfound` | toast | both | check | read, kept |
| `DRPG.Loot.pickNone` | toast | both | check | read, kept |
| `DRPG.Loot.windowTitle` | window-title | both | check | read, kept |
| `DRPG.Loot.open` | - | both | check | read, kept |
| `DRPG.Loot.openTooltip` | tooltip | both | check | read, kept |
| `DRPG.Loot.prompt` | - | both | check | read, kept |
| `DRPG.Loot.brief` | - | both | check | en+pl |
| `DRPG.Loot.noAction` | - | both | check | read, kept |
| `DRPG.Loot.coverFact` | - | both | check | read, kept |
| `DRPG.Loot.toStash` | - | both | check | pl |
| `DRPG.Loot.rowHandsFull` | - | both | check | read, kept |
| `DRPG.Loot.rollTitle` | window-title | both | check | en+pl |
| `DRPG.Loot.coverTitle` | window-title | both | check | en+pl |
| `DRPG.Vault.section` | - | both | full | en+pl |
| `DRPG.Vault.stowTooltip` | tooltip | both | full | pl |
| `DRPG.Vault.takeTooltip` | tooltip | both | full | pl |
| `DRPG.Vault.rifle` | - | both | full | read, kept |
| `DRPG.Vault.openStashSection` | - | both | full | en+pl |
| `DRPG.Vault.openStashNote` | - | both | full | read, kept |
| `DRPG.Facility.timedBadge` | - | both | check | read, kept |
| `DRPG.Facility.until.timeOfDay` | - | both/unknown | check | read, kept |
| `DRPG.Facility.until.day` | - | both/unknown | check | read, kept |
| `DRPG.Facility.until.nextRoll` | - | both/unknown | check | pl |
| `DRPG.Facility.until.eclipse` | - | both/unknown | check | read, kept |
| `DRPG.Sheet.ultimateLabel` | - | both | full | read, kept |
| `DRPG.Sheet.ultimatePlaceholder` | - | both | full | read, kept |
| `DRPG.Sheet.equipped` | - | both | full | read, kept |
| `DRPG.Sheet.groupUsables` | - | both | full | read, kept |
| `DRPG.Sheet.groupGear` | - | both | full | read, kept |
| `DRPG.Sheet.sharedSlots` | - | both | full | pl |
| `DRPG.Sheet.groupTruthBullets` | - | both | full | read, kept |
| `DRPG.Sheet.bulletSortLabel` | - | both | full | read, kept |
| `DRPG.Sheet.bulletsByChapter` | - | both | full | read, kept |
| `DRPG.Sheet.bulletsByRoom` | - | both | full | read, kept |
| `DRPG.Sheet.bulletsNoChapter` | - | both | full | read, kept |
| `DRPG.Sheet.bulletsNoRoom` | - | both | full | read, kept |
| `DRPG.Sheet.bulletsHereChapter` | - | both | full | en+pl |
| `DRPG.Sheet.bulletsHereRoom` | - | both | full | en+pl |
| `DRPG.Sheet.groupKeys` | - | both | full | read, kept |
| `DRPG.Sheet.biographyLabel` | - | both | check | read, kept |
| `DRPG.Sheet.biographyPlaceholder` | - | both | check | read, kept |
| `DRPG.Sheet.biographyChanged` | toast | both | full | en+pl |
| `DRPG.Passage.list.title` | window-title | both | full | read, kept |
| `DRPG.Passage.list.where` | - | both | full | read, kept |
| `DRPG.Passage.list.shut` | - | both | full | read, kept |
| `DRPG.Passage.list.cross` | - | both | full | read, kept |
| `DRPG.Passage.list.oneWay` | - | both | full | pl |
| `DRPG.Passage.list.walk` | - | both | check | read, kept |
| `DRPG.Passage.list.seal` | - | both | check | read, kept |
| `DRPG.Passage.list.sealTip` | - | both | check | read, kept |
| `DRPG.Passage.show.button` | button | both | full | read, kept |
| `DRPG.Passage.show.title` | window-title | both | full | en+pl |
| `DRPG.Passage.show.intro` | - | both | full | en+pl |
| `DRPG.Passage.show.note` | - | both | full | en+pl |
| `DRPG.SheetNotes.fogFreeMove` | - | both | check | read, kept |
| `DRPG.SheetNotes.fogBudget` | - | both | check | read, kept |
| `DRPG.SheetNotes.noExperiences` | - | both | check | read, kept |
| `DRPG.Character.initTitle` | window-title | both | full | read, kept |
| `DRPG.Character.initTooltip` | tooltip | both | full | en+pl |
| `DRPG.Character.initConfirm` | - | both | full | pl |
| `DRPG.Character.initNote` | - | both | full | en+pl |
| `DRPG.States.drpgBreakdown.name` | - | both/unknown | full | read, kept |
| `DRPG.States.drpgBreakdown.description` | - | both/unknown | check | read, kept |
| `DRPG.States.drpgWounded.name` | - | both/unknown | full | read, kept |
| `DRPG.States.drpgWounded.description` | - | both/unknown | check | en+pl |

### sheet-other

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Sheet.groupOther` | - | both | full | read, kept |
| `DRPG.Sheet.otherHintGm` | - | both | full | pl |
| `DRPG.Sheet.otherRemove` | - | both | full | read, kept |
| `DRPG.Sheet.otherRemoveAsk` | - | both | full | pl |
| `DRPG.Sheet.otherHint` | - | both | full | pl |

### stash

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Items.whichItem` | - | both/gm | full | read, kept |
| `DRPG.Items.deadHands` | toast | both/unknown | full | read, kept |
| `DRPG.Inventory.full` | toast | both/unknown | full | pl |
| `DRPG.Steal.cardPlanted` | player-card | both | full | read, kept |
| `DRPG.Steal.cardPlantMissed` | player-card | both | full | en+pl |
| `DRPG.Steal.cardTheirHandsFull` | player-card | both | full | read, kept |
| `DRPG.Steal.caughtPlanting` | - | both | full | read, kept |
| `DRPG.Steal.caughtTryingPlant` | - | both | full | read, kept |
| `DRPG.Steal.cardTook` | player-card | both | full | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Steal.cardMissed` | player-card | both | full | read, kept |
| `DRPG.Steal.cardEmpty` | player-card | both | full | read, kept |
| `DRPG.Steal.cardHandsFull` | player-card | both | full | en+pl |
| `DRPG.Steal.cardSeen` | player-card | both | full | pl |
| `DRPG.Steal.cardUnseen` | player-card | both | full | read, kept |
| `DRPG.Steal.cardUnfelt` | player-card | both | full | pl |
| `DRPG.Steal.caughtTaking` | - | both | full | read, kept |
| `DRPG.Steal.caughtTrying` | - | both | check | read, kept |
| `DRPG.Steal.wHand` | - | both | check | en+pl |
| `DRPG.Steal.wTaking` | - | both | check | en+pl |
| `DRPG.Steal.wPlanting` | - | both | check | en+pl |
| `DRPG.Vault.noOwner` | - | both | check | read, kept |
| `DRPG.Vault.handsFull` | player-card | both | full | en+pl |
| `DRPG.Vault.notHere` | toast | both | full | en |
| `DRPG.Vault.noStashOnScene` | toast | both | full | read, kept |
| `DRPG.Vault.handFirst` | toast | both | full | en+pl |
| `DRPG.Vault.noBullets` | toast | both | full | en |
| `DRPG.Vault.full` | toast | both | full | en |
| `DRPG.Vault.stole` | player-card | both | full | pl |
| `DRPG.Vault.rifledAgain` | player-card | both | full | pl |
| `DRPG.Vault.noticed` | player-card | both | check | read, kept |
| `DRPG.Vault.gmPending` | gm-card | both | check | en+pl |
| `DRPG.Vault.gmWatched` | gm-card | both | check | en+pl |
| `DRPG.Vault.gmTold` | gm-card | both | check | en+pl |
| `DRPG.Vault.stashesIntro` | - | both | full | read, kept |
| `DRPG.Vault.stashesNote` | - | both | check | en+pl |
| `DRPG.Vault.stashNone` | - | both | full | read, kept |
| `DRPG.Vault.stashOpen` | - | both | full | read, kept |
| `DRPG.Vault.stashHidden` | - | both | full | read, kept |
| `DRPG.Vault.stashOwnBedroom` | - | both | full | read, kept |
| `DRPG.Vault.stashNotEmpty` | toast | both | full | en+pl |
| `DRPG.Vault.manageNote` | - | both | full | read, kept |
| `DRPG.Vault.roomRatio` | - | both/gm | full | read, kept |
| `DRPG.Vault.roomCensus` | - | both/gm/unknown | full | read, kept |
| `DRPG.Vault.roomCensusLocked` | - | both/gm | full | pl |
| `DRPG.Vault.roomCensusUndecided` | - | both | full | en+pl |
| `DRPG.Vault.searchIntro` | - | both | full | read, kept |
| `DRPG.Vault.room` | - | both | full | read, kept |
| `DRPG.Vault.owner` | - | both | full | read, kept |
| `DRPG.Vault.table` | - | both | full | read, kept |
| `DRPG.Vault.placeColumn` | - | both | full | read, kept |
| `DRPG.Vault.placeCycle` | - | both | full | read, kept |
| `DRPG.Vault.lockedColumn` | - | both | full | read, kept |
| `DRPG.Vault.globalPool` | - | both | full | read, kept |
| `DRPG.Vault.twoRooms` | toast | both | full | read, kept |
| `DRPG.Vault.applyLine` | - | both | check | en+pl |
| `DRPG.Vault.roomsIntro` | - | both | check | read, kept |
| `DRPG.Vault.notSharedLine` | - | both | check | en+pl |
| `DRPG.Vault.doorsLine` | - | both | check | read, kept |
| `DRPG.Vault.neighboursLine` | - | both | check | en+pl |
| `DRPG.Vault.descriptionColumn` | - | both | check | read, kept |
| `DRPG.Vault.descriptionPlaceholder` | - | both | check | read, kept |
| `DRPG.Vault.descriptionIntro` | - | both | full | read, kept |
| `DRPG.Vault.descriptionNote` | - | both | full | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Vault.imageColumn` | - | both | check | read, kept |
| `DRPG.Vault.imagePick` | - | both/unknown | check | read, kept |
| `DRPG.Vault.imageClear` | - | both | check | read, kept |
| `DRPG.Vault.imageRefused` | toast | both/unknown | check | read, kept |
| `DRPG.Vault.fogIntro` | - | both | full | en+pl |
| `DRPG.Vault.fogUncovered` | - | both | check | en+pl |
| `DRPG.Vault.discoverAll` | - | both | check | read, kept |
| `DRPG.Vault.hideAll` | - | both | check | read, kept |
| `DRPG.Vault.unlockedAnnounce` | world-voice | both | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Vault.rifleTitle` | window-title | both | full | read, kept |
| `DRPG.Vault.rifleIntro` | - | both | full | en+pl |
| `DRPG.Vault.rifleNote` | - | both | check | en+pl |
| `DRPG.Vault.noOpenStashHere` | toast | both | full | read, kept |
| `DRPG.Vault.stashEmpty` | toast | both | full | en+pl |
| `DRPG.Vault.take` | - | both | full | read, kept |
| `DRPG.Vault.keyName` | - | both | full | read, kept |
| `DRPG.Vault.keyDescription` | - | both | full | read, kept |
| `DRPG.Vault.keyGranted` | player-card | both | full | read, kept |
| `DRPG.Vault.keyDuplicatesTaken` | toast | both | full | pl |
| `DRPG.Vault.keyTakenGm` | toast | both | check | pl |
| `DRPG.Vault.keyTakenBack` | player-card | both | check | pl |
| `DRPG.Vault.keyCopiesTakenGm` | toast | both | check | en+pl |
| `DRPG.Vault.keyCopyTakenBack` | player-card | both | check | pl |
| `DRPG.Vault.lockedAtStartColumn` | - | both | check | read, kept |
| `DRPG.Vault.brokenColumn` | - | both | check | read, kept |
| `DRPG.Vault.brokenHint` | - | both | check | read, kept |
| `DRPG.Vault.lockedAtStartHint` | - | both | check | en+pl |
| `DRPG.Vault.isRoomColumn` | - | both | check | read, kept |
| `DRPG.Vault.isRoomHint` | - | both | check | en |
| `DRPG.Vault.notSharedColumn` | - | both | full | read, kept |
| `DRPG.Vault.notSharedHint` | - | both | full | en+pl |
| `DRPG.Vault.neighboursColumn` | - | both | full | en |
| `DRPG.Vault.neighboursHint` | - | both | full | en+pl |
| `DRPG.Vault.neighboursNote` | - | both | full | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Vault.neighboursUnknown` | toast | both | check | en+pl |
| `DRPG.Vault.imageLarge` | - | both | check | read, kept |
| `DRPG.Vault.imageBroken` | - | both | check | read, kept |
| `DRPG.Facility.editor.tabLine` | tab | both/unknown | check | pl |
| `DRPG.Facility.editor.edit` | - | both/unknown | check | read, kept |
| `DRPG.Facility.roomColumn` | - | both | check | read, kept |

### stash-inspector

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Vault.concealedShort` | - | gm | full | read, kept |
| `DRPG.Vault.noneSet` | toast | gm | full | en+pl |
| `DRPG.Vault.noStashesOnScene` | - | gm | full | read, kept |
| `DRPG.Vault.inspectTitle` | window-title | gm | check | read, kept |
| `DRPG.Vault.inspectNote` | - | gm | full | en+pl |
| `DRPG.Sheet.groupEmpty` | - | both/gm | full | read, kept |

### trial-evidence

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Handover.answerKeyMissing` | player-card | both/unknown | full | en+pl |

### which-resource

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Items.useTitle` | window-title | both/unknown | full | pl |
| `DRPG.Items.usePrompt` | - | both | full | read, kept |
| `DRPG.Items.useConfirm` | - | both | full | read, kept |
| `DRPG.Items.choiceBonus` | - | both | full | read, kept |
| `DRPG.Items.restoreN` | - | both | full | read, kept |
| `DRPG.Items.restore.hitPoints` | - | both/unknown | full | read, kept |
| `DRPG.Items.restore.stress` | - | both/unknown | full | read, kept |
| `DRPG.Items.restore.hope` | - | both/unknown | full | read, kept |

## B09 (327 keys, 101 changed)

### (no screen)

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Hud.assignHint` | - | unknown | full | en+pl |
| `DRPG.Hud.roomNoProject` | - | unknown | full | read, kept |
| `DRPG.Explain.phase.eclipse` | - | unknown | check | en+pl |
| `DRPG.Explain.phase.eclipseReach` | - | unknown | full | read, kept |
| `DRPG.Explain.phase.dailyLife` | - | unknown | full | en+pl |
| `DRPG.Explain.phase.investigation` | - | unknown | full | read, kept |
| `DRPG.Explain.phase.classTrial` | - | unknown | full | read, kept |
| `DRPG.Explain.time.position` | - | unknown | full | en+pl |
| `DRPG.Explain.time.what` | - | unknown | full | read, kept |
| `DRPG.Explain.room.title` | window-title | unknown | full | read, kept |
| `DRPG.Explain.room.tokens` | - | unknown | full | read, kept |
| `DRPG.Explain.despair.title` | window-title | unknown | full | read, kept |
| `DRPG.Explain.despair.what` | - | unknown | full | en+pl |
| `DRPG.Explain.despair.spent` | - | unknown | full | en+pl |
| `DRPG.Explain.despair.masked` | - | unknown | full | en+pl |
| `DRPG.Explain.despair.noPools` | - | unknown | full | read, kept |
| `DRPG.Explain.status.actionsWhat` | - | unknown | check | en+pl |
| `DRPG.Explain.status.actionsWounded` | - | unknown | check | read, kept |
| `DRPG.Look.uiScaleAuto` | - | unknown | full | pl |
| `DRPG.Look.uiScaleSlider` | - | unknown | full | pl |
| `DRPG.Look.messengerSound` | - | unknown | full | read, kept |
| `DRPG.Look.stepUpBy` | - | unknown | full | read, kept |
| `DRPG.Look.stepDownBy` | - | unknown | full | read, kept |

### action-tiles

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Listen.prompt` | - | both | full | read, kept |
| `DRPG.Listen.which` | - | both | full | read, kept |
| `DRPG.Listen.noNeighbours` | toast | both/unknown | full | read, kept |
| `DRPG.Listen.eavesdrop.started` | player-card | both | check | pl |
| `DRPG.Listen.anonymous` | - | both | full | en |
| `DRPG.Listen.emptyRoom` | - | both | full | pl |
| `DRPG.Listen.named` | - | both | full | pl |
| `DRPG.Listen.critical` | - | both | full | read, kept |
| `DRPG.Listen.empty` | - | both | full | read, kept |
| `DRPG.Eclipse.actionsLocked` | toast | both/unknown | full | en+pl |
| `DRPG.Eclipse.murderOnlyInEclipse` | toast | both | full | en+pl |
| `DRPG.Move.freeAvailable` | - | both | check | en+pl |
| `DRPG.Move.freeSpent` | - | both | check | en+pl |
| `DRPG.Move.nextSprint` | - | both | check | read, kept |
| `DRPG.Move.nextBurst` | - | both | check | read, kept |
| `DRPG.Move.noBudget` | toast | both/unknown | full | pl |
| `DRPG.Kit.details` | - | both | check | read, kept |
| `DRPG.Kit.thresholds` | - | both/unknown | check | read, kept |

### body-discovery

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Eclipse.bodyLocked` | toast | both/gm | full | en+pl |

### eclipse-hud

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Hud.eclipseAsk` | - | gm | full | en+pl |
| `DRPG.Hud.eclipseAskRefilled` | - | gm | full | en+pl |
| `DRPG.Hud.eclipseAskYes` | - | gm | full | read, kept |
| `DRPG.Eclipse.endPrompt` | - | gm | check | read, kept |
| `DRPG.Eclipse.endAndAdvance` | - | gm | full | read, kept |
| `DRPG.Eclipse.endOnly` | - | gm | full | read, kept |
| `DRPG.Eclipse.movesColumn` | - | gm | full | en+pl |
| `DRPG.Eclipse.named` | - | both/gm/unknown | full | read, kept |
| `DRPG.Ready.titleNext` | - | gm | check | read, kept |
| `DRPG.Ready.askStart` | - | gm | check | read, kept |
| `DRPG.Ready.askEnd` | - | gm | check | read, kept |
| `DRPG.Ready.askNext` | - | gm | check | read, kept |
| `DRPG.Ready.done` | - | gm | check | read, kept |
| `DRPG.Ready.wait` | - | gm | check | read, kept |
| `DRPG.Ready.waiting` | - | gm | check | read, kept |
| `DRPG.Ready.cancelled` | toast | gm | check | read, kept |
| `DRPG.Ready.notDone` | - | gm | check | read, kept |
| `DRPG.Ready.allDone` | - | gm | check | read, kept |
| `DRPG.Ready.status.done` | - | gm | check | read, kept |
| `DRPG.Ready.status.wait` | - | gm | check | read, kept |
| `DRPG.Ready.status.none` | - | gm | check | read, kept |
| `DRPG.Ready.status.away` | - | gm | check | en+pl |
| `DRPG.Ready.goNext` | - | gm | check | read, kept |
| `DRPG.Ready.confirmGo` | - | gm | check | read, kept |
| `DRPG.Ready.goAnyway` | - | gm | check | read, kept |
| `DRPG.Ready.answerAgain` | - | gm | check | read, kept |
| `DRPG.Ready.goneEnded` | toast | gm | check | read, kept |
| `DRPG.Ready.barred` | toast | gm | check | read, kept |

### file:scripts/api.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Explain.state.window` | - | unknown | full | read, kept |
| `DRPG.Explain.state.title` | window-title | unknown | full | read, kept |
| `DRPG.Explain.time.title` | window-title | unknown | full | read, kept |
| `DRPG.Explain.despair.window` | - | unknown | full | read, kept |
| `DRPG.Explain.status.window` | - | unknown | full | read, kept |
| `DRPG.Explain.status.actionsTitle` | window-title | unknown | check | read, kept |
| `DRPG.Explain.status.actionsNow` | - | unknown | check | en+pl |
| `DRPG.Explain.status.moveTitle` | window-title | unknown | check | read, kept |
| `DRPG.Explain.status.moveWhat` | - | unknown | full | en+pl |
| `DRPG.Explain.status.moveSpent` | - | unknown | full | en+pl |
| `DRPG.Explain.status.hopeTitle` | window-title | unknown | full | read, kept |
| `DRPG.Explain.status.hopeWhat` | - | unknown | full | en+pl |
| `DRPG.Explain.status.hopeNow` | - | unknown | full | read, kept |
| `DRPG.Explain.status.standing` | - | unknown | full | read, kept |
| `DRPG.Explain.status.monokumaActions` | - | unknown | full | en+pl |
| `DRPG.Explain.status.monokumaMove` | - | unknown | full | en+pl |
| `DRPG.Explain.status.monokumaDespair` | - | unknown | full | read, kept |
| `DRPG.Explain.status.monokumaWalls` | - | unknown | full | read, kept |
| `DRPG.Explain.projects.window` | - | unknown | full | read, kept |
| `DRPG.Explain.projects.title` | window-title | unknown | full | read, kept |
| `DRPG.Explain.projects.what` | - | unknown | full | en+pl |
| `DRPG.Explain.projects.progress` | - | unknown | full | en+pl |
| `DRPG.Explain.projects.secret` | - | unknown | full | en+pl |
| `DRPG.Explain.projects.yours` | - | unknown | full | read, kept |
| `DRPG.Explain.projects.none` | - | unknown | full | en+pl |

### file:scripts/clock.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Clock.rewindDuringEclipse` | toast | unknown | full | pl |
| `DRPG.Clock.takenBack` | toast | unknown | full | en+pl |
| `DRPG.Clock.unknownTime` | toast | unknown | full | read, kept |
| `DRPG.Clock.unknownPhase` | toast | unknown | full | read, kept |
| `DRPG.Clock.actionsRefilled` | - | unknown | full | read, kept |
| `DRPG.Clock.searchTokensRestocked` | - | unknown | full | pl |
| `DRPG.Clock.woundedNote` | gm-card | unknown | check | en+pl |

### file:scripts/day-summary.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Summary.title` | window-title | unknown | full | en |
| `DRPG.Summary.lede` | - | unknown | full | pl |
| `DRPG.Summary.ledeGm` | - | unknown | check | pl |
| `DRPG.Summary.found` | - | unknown | full | en |
| `DRPG.Summary.left` | - | unknown | check | read, kept |
| `DRPG.Summary.totals` | - | unknown | full | read, kept |
| `DRPG.Summary.totalsTraces` | - | unknown | full | read, kept |
| `DRPG.Summary.totalsFound` | - | unknown | full | read, kept |

### file:scripts/eavesdrop-gm.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Listen.eavesdrop.noVoiceGm` | gm-card | unknown | check | read, kept |

### file:scripts/eclipse.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Eclipse.already` | toast | unknown | full | read, kept |
| `DRPG.Eclipse.announce` | world-voice | unknown | full | en+pl |
| `DRPG.Eclipse.yourMoves` | player-card | unknown | full | en+pl |
| `DRPG.Eclipse.moved` | player-card | unknown | full | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Eclipse.noMovesLeft` | - | unknown | full | en+pl |
| `DRPG.Eclipse.ended` | world-voice | unknown | full | read, kept |
| `DRPG.Eclipse.announceFree` | world-voice | unknown | full | read, kept |
| `DRPG.Eclipse.yourMovesFree` | player-card | unknown | full | en+pl |
| `DRPG.Eclipse.movedFree` | player-card | unknown | full | en |
| `DRPG.Move.noStairs` | - | unknown | full | read, kept |

### file:scripts/events.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Hud.trialClockTooltip` | tooltip | unknown | full | read, kept |
| `DRPG.Events.redeemTitle` | window-title | unknown | check | read, kept |
| `DRPG.Events.redeemMeta` | - | unknown | check | read, kept |
| `DRPG.Events.bribeWaitTitle` | window-title | unknown | check | read, kept |
| `DRPG.Events.bribeWaitMeta` | - | unknown | check | read, kept |
| `DRPG.Events.betTitle` | window-title | unknown | check | read, kept |
| `DRPG.Events.betMeta` | - | unknown | check | read, kept |
| `DRPG.Events.redeemLine` | - | unknown | check | read, kept |
| `DRPG.Events.bribeWaitLine` | - | unknown | check | en+pl |
| `DRPG.Events.betLine` | - | unknown | check | read, kept |
| `DRPG.Events.overflowMetaGm` | - | unknown | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Events.bodyTitle` | window-title | unknown | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Events.bodySubRoom` | - | unknown | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Events.bodyMeta` | - | unknown | full | en+pl |
| `DRPG.Events.bodyMetaGm` | - | unknown | full | pl |
| `DRPG.Events.bodyHoldMeta` | - | unknown | full | en+pl |
| `DRPG.Events.bodyHoldMetaGm` | - | unknown | full | read, kept |
| `DRPG.Events.ticker.safeword` | - | unknown | full | read, kept |
| `DRPG.Events.ticker.overflow` | - | unknown | full | read, kept |
| `DRPG.Events.ticker.incident` | - | unknown | full | read, kept |
| `DRPG.Events.ticker.body` | - | unknown | full | pl |
| `DRPG.Events.ticker.trial` | - | unknown | check | read, kept |
| `DRPG.Events.ticker.assembly` | - | unknown | check | read, kept |
| `DRPG.Events.ticker.motive` | - | unknown | check | read, kept |
| `DRPG.Events.ticker.redeemHope` | - | unknown | check | read, kept |
| `DRPG.Events.ticker.bribeHope` | - | unknown | check | read, kept |
| `DRPG.Events.ticker.betHope` | - | unknown | check | read, kept |
| `DRPG.Events.incidentTitle` | window-title | unknown | check | read, kept |
| `DRPG.Events.incidentTitleDirect` | - | unknown | full | read, kept |
| `DRPG.Events.openingTitle` | window-title | unknown | full | read, kept |
| `DRPG.Events.openingMeta` | - | unknown | full | pl |
| `DRPG.Events.safewordTitle` | window-title | unknown | full | read, kept |
| `DRPG.Events.safewordSub` | - | unknown | full | read, kept |
| `DRPG.Events.safewordMeta` | - | unknown | full | pl |
| `DRPG.Events.safewordMetaGm` | - | unknown | full | pl |
| `DRPG.Events.voteTitle` | window-title | unknown | full | read, kept |
| `DRPG.Events.voteSub` | - | unknown | full | en+pl |
| `DRPG.Events.voteMeta` | - | unknown | full | pl |
| `DRPG.Events.voteMetaGm` | - | unknown | full | read, kept |
| `DRPG.Events.voteMetaGmBallots` | - | unknown | full | read, kept |
| `DRPG.Events.voteCast` | - | unknown | full | pl |
| `DRPG.Events.trialDebateMeta` | - | unknown | full | read, kept |
| `DRPG.Events.trialDiscussionMeta` | - | unknown | full | en+pl |
| `DRPG.Events.trialObjectionFloor` | - | unknown | full | read, kept |
| `DRPG.Events.afterVerdict` | - | unknown | full | read, kept |
| `DRPG.Events.trialNext` | - | unknown | full | pl |
| `DRPG.Events.trialLastTurn` | - | unknown | check | read, kept |
| `DRPG.Events.trialZone.straw.vote` | - | unknown | check | read, kept |
| `DRPG.Events.trialZone.dive.vote` | - | unknown | check | en+pl |
| `DRPG.Events.trialZone.dive.pause` | - | unknown | check | read, kept |
| `DRPG.Events.trialZone.scrum.setup` | - | unknown | check | read, kept |
| `DRPG.Events.trialZone.scrum.speak` | - | unknown | check | read, kept |

### file:scripts/foundry-windows.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.FoundryTools.title` | window-title | unknown | check | read, kept |
| `DRPG.FoundryTools.mapTitle` | window-title | unknown | check | read, kept |
| `DRPG.FoundryTools.close` | - | unknown | check | read, kept |
| `DRPG.FoundryTools.toggle` | - | unknown | check | read, kept |

### file:scripts/gm-campaign.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Clock.eclipseStillOn` | toast | unknown | full | en+pl |
| `DRPG.Clock.chapterCorrectTitle` | window-title | unknown | full | read, kept |
| `DRPG.Clock.chapterCorrect` | - | unknown | check | en+pl |
| `DRPG.Clock.trialFromEditTitle` | window-title | unknown | full | read, kept |
| `DRPG.Clock.trialFromEdit` | - | unknown | full | read, kept |

### file:scripts/movement-audit.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Move.cannotReach` | toast | unknown | check | read, kept |

### file:scripts/movement.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Move.notConnectedShort` | - | unknown | check | pl |
| `DRPG.Move.title` | window-title | unknown | check | read, kept |
| `DRPG.Move.entered` | - | unknown | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Move.leftRooms` | - | unknown | full | en+pl |
| `DRPG.Move.wasSprint` | - | unknown | check | read, kept |
| `DRPG.Move.wasFree` | - | unknown | full | read, kept |
| `DRPG.Move.wasBurst` | - | unknown | check | read, kept |
| `DRPG.Move.costAction` | - | unknown | full | en+pl |
| `DRPG.Move.notConnected` | - | unknown | full | pl |
| `DRPG.Move.noBudgetLong` | player-card | unknown | full | en+pl |
| `DRPG.Move.refundedBack` | player-card | unknown | full | en+pl |
| `DRPG.Move.refundedStays` | player-card | unknown | full | en+pl |
| `DRPG.Move.refundedPrice` | player-card | unknown | full | read, kept |
| `DRPG.Move.refundedNoPrice` | player-card | unknown | full | en+pl |
| `DRPG.Move.locked` | - | unknown | full | read, kept |
| `DRPG.Movement.unlawfulArrival` | gm-card | unknown | full | en+pl |
| `DRPG.Movement.wallCrossed` | - | unknown | full | pl |
| `DRPG.Movement.floorJumped` | - | unknown | full | pl |
| `DRPG.Movement.ruleSentBack` | - | unknown | full | pl |
| `DRPG.Movement.dropRemoved` | gm-card | unknown | full | pl |
| `DRPG.Movement.droppedFromNowhere` | gm-card | unknown | full | en+pl |

### file:scripts/player-status.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Hud.stillToAct` | - | unknown | full | read, kept |
| `DRPG.Hud.stillToActTooltip` | tooltip | unknown | full | read, kept |
| `DRPG.Hud.stillPlacing` | - | unknown | full | read, kept |
| `DRPG.Hud.stillPlacingTooltip` | tooltip | unknown | full | read, kept |
| `DRPG.Hud.stillPlacingFreeTooltip` | tooltip | unknown | full | read, kept |
| `DRPG.Eclipse.actionsMurderOnly` | - | unknown | full | en+pl |
| `DRPG.Eclipse.placementOnly` | - | unknown | full | en+pl |
| `DRPG.Move.drag` | - | unknown | check | read, kept |

### file:scripts/sequence.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Sequence.trialTitle` | window-title | unknown | check | read, kept |
| `DRPG.Sequence.trialSubtitle` | - | unknown | check | read, kept |
| `DRPG.Sequence.trialSubtitleNoChapter` | - | unknown | check | read, kept |
| `DRPG.Sequence.exitTitle` | window-title | unknown | check | read, kept |
| `DRPG.Sequence.exitSubtitle` | - | unknown | check | read, kept |
| `DRPG.Sequence.exitSubtitleNoChapter` | - | unknown | check | read, kept |
| `DRPG.Sequence.stampGuilty` | - | unknown | check | read, kept |
| `DRPG.Sequence.stampInnocent` | - | unknown | check | read, kept |
| `DRPG.Sequence.votesCounted` | - | unknown | check | read, kept |
| `DRPG.Sequence.dayTitle` | window-title | unknown | check | read, kept |
| `DRPG.Sequence.daySub` | - | unknown | check | pl |
| `DRPG.Sequence.daySubNoChapter` | - | unknown | check | pl |
| `DRPG.Sequence.weRemember` | - | unknown | check | read, kept |
| `DRPG.Sequence.morningLine` | - | unknown | check | read, kept |
| `DRPG.Sequence.dayEndTitle` | window-title | unknown | check | read, kept |
| `DRPG.Sequence.dayEndSub` | - | unknown | check | read, kept |
| `DRPG.Sequence.yourDay` | - | unknown | check | read, kept |
| `DRPG.Sequence.tableDay` | - | unknown | check | read, kept |
| `DRPG.Sequence.foundSomething` | - | unknown | check | read, kept |
| `DRPG.Sequence.dayTally` | - | unknown | check | read, kept |
| `DRPG.Sequence.quietDay` | - | unknown | check | read, kept |
| `DRPG.Sequence.publicEvents` | - | unknown | check | read, kept |
| `DRPG.Sequence.moodLabel` | - | unknown | check | read, kept |
| `DRPG.Sequence.mood.calm` | - | unknown | check | read, kept |
| `DRPG.Sequence.mood.uneasy` | - | unknown | check | read, kept |
| `DRPG.Sequence.mood.spilling` | - | unknown | check | read, kept |

### file:scripts/settings-window.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Look.contrastAuto` | - | unknown | full | en+pl |
| `DRPG.Look.note` | - | unknown | check | read, kept |

### file:scripts/sfx.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Look.launcherTooltip` | tooltip | unknown | full | read, kept |

### file:scripts/ui-kit.mjs

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Kit.close` | - | unknown | check | read, kept |
| `DRPG.Kit.cancel` | - | unknown | check | read, kept |
| `DRPG.Kit.tableEmpty` | - | unknown | check | read, kept |
| `DRPG.Look.atMost` | - | unknown | full | read, kept |
| `DRPG.Look.atLeast` | - | unknown | full | read, kept |

### gm-panel

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Eclipse.panelLocked` | - | gm | full | en+pl |
| `DRPG.Clock.summary` | - | both/gm/unknown | full | read, kept |
| `DRPG.Clock.summaryUnder` | - | both/gm/unknown | full | read, kept |
| `DRPG.Clock.summaryEclipse` | - | both/gm/unknown | full | read, kept |
| `DRPG.Movement.outsideRooms` | - | gm/unknown | full | en |

### hud

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Hud.chapter` | - | both/unknown | full | read, kept |
| `DRPG.Hud.day` | - | both/unknown | full | read, kept |
| `DRPG.Hud.sessionTooltip` | tooltip | both | full | read, kept |
| `DRPG.Hud.endEclipse` | - | both | full | read, kept |
| `DRPG.Hud.rewind` | - | both | full | en+pl |
| `DRPG.Hud.controlFailed` | toast | both | full | read, kept |
| `DRPG.Hud.nowPlaying` | - | both | full | read, kept |
| `DRPG.Hud.rewindEclipse` | - | both | full | pl |
| `DRPG.Hud.elapsed` | - | both | full | read, kept |
| `DRPG.Hud.elapsedUnknown` | - | both | full | read, kept |
| `DRPG.Hud.elapsedTooltip` | - | both | full | read, kept |
| `DRPG.Hud.startEclipseNamed` | - | both | full | read, kept |
| `DRPG.Hud.startEclipseFree` | - | both | full | en+pl |
| `DRPG.Hud.startEclipseNewSession` | - | both | full | en+pl |
| `DRPG.Hud.eclipseRunningTooltip` | tooltip | both | full | en+pl |
| `DRPG.Hud.trial.discussion` | - | both/unknown | full | read, kept |
| `DRPG.Hud.trial.debate` | - | both/unknown | full | en+pl |
| `DRPG.Hud.trial.objection` | - | both/unknown | full | read, kept |
| `DRPG.Hud.trial.rebuttal` | - | both/unknown | full | read, kept |
| `DRPG.Hud.trial.testimony` | - | both/unknown | full | read, kept |
| `DRPG.Hud.trial.panic` | - | both/unknown | full | read, kept |
| `DRPG.Hud.trial.closing` | - | both/unknown | check | read, kept |
| `DRPG.Hud.trial.straw` | - | both/unknown | check | read, kept |
| `DRPG.Hud.trial.dive` | - | both/unknown | check | read, kept |
| `DRPG.Hud.trial.scrum` | - | both/unknown | check | read, kept |
| `DRPG.Hud.trialTooltip` | tooltip | both | full | read, kept |
| `DRPG.Hud.trialEveryone` | - | both | full | read, kept |
| `DRPG.Hud.trialVersus` | - | both/unknown | full | read, kept |
| `DRPG.Hud.trialSpeaks` | - | both/unknown | full | read, kept |
| `DRPG.Explain.phase.eclipseTitle` | window-title | both/unknown | full | read, kept |
| `DRPG.Eclipse.bodyFirst` | - | both/unknown | full | en+pl |
| `DRPG.Eclipse.incidentFirst` | - | both/unknown | full | en+pl |
| `DRPG.Eclipse.trialFirst` | toast | both/unknown | full | en+pl |

### incident-tracker

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Events.incidentSub` | - | gm/unknown | full | read, kept |
| `DRPG.Events.incidentSubRoom` | - | gm/unknown | full | read, kept |
| `DRPG.Events.reserveYou` | - | gm/unknown | check | read, kept |
| `DRPG.Events.reserveOf` | - | gm/unknown | check | read, kept |
| `DRPG.Events.reserveVictim` | - | gm/unknown | check | read, kept |

### murder-cards

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Eclipse.murderLocked` | toast | both | full | en+pl |

### murder-window

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Eclipse.murderWindowLocked` | toast | gm | full | en+pl |

### notice-history

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Kit.scrollMore` | - | both/unknown | check | read, kept |

### passages-gm

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Listen.unknownRoom` | - | both/gm/unknown | full | read, kept |

### room-tile

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Hud.roomNowhere` | - | both | full | read, kept |
| `DRPG.Hud.roomProject` | - | both | full | read, kept |
| `DRPG.Hud.roomTokens` | - | both | full | read, kept |
| `DRPG.Hud.roomTokensTooltip` | - | both | full | read, kept |
| `DRPG.Explain.room.noActor` | - | both/unknown | full | en+pl |
| `DRPG.Room.tileLabel` | - | both/unknown | check | read, kept |
| `DRPG.Room.readMore` | - | both | check | read, kept |
| `DRPG.Room.readLess` | - | both | check | read, kept |
| `DRPG.Room.imageOpen` | - | both | check | read, kept |
| `DRPG.Room.imageMissing` | toast | both | check | held (owner-approved, handbook-quoted or gaps-a) |
| `DRPG.Room.describe` | - | both | check | read, kept |

### season-setup

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Clock.campaignName` | - | gm | full | read, kept |
| `DRPG.Clock.chapter` | - | gm | full | read, kept |
| `DRPG.Clock.day` | - | gm | full | read, kept |
| `DRPG.Clock.phase` | - | gm | full | read, kept |
| `DRPG.Clock.session` | - | gm | full | read, kept |
| `DRPG.Clock.timeOfDay` | - | gm | full | read, kept |
| `DRPG.Clock.morningLine` | - | gm | check | read, kept |
| `DRPG.Clock.morningLineHint` | - | gm | check | read, kept |
| `DRPG.Clock.endChapterNote` | - | gm | check | en+pl |
| `DRPG.Clock.endChapterAsk` | - | gm | check | en |
| `DRPG.Kit.check.done` | - | gm | check | read, kept |
| `DRPG.Kit.check.blocking` | - | gm | check | read, kept |
| `DRPG.Kit.check.advisory` | - | gm | check | read, kept |
| `DRPG.Kit.check.warning` | - | gm | check | read, kept |
| `DRPG.Kit.check.waiting` | - | gm | check | read, kept |

### sheet

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Events.waitingFor` | - | both/unknown | check | en+pl |
| `DRPG.Eclipse.callsLocked` | - | both | full | en+pl |
| `DRPG.Move.dragShort` | - | both | check | read, kept |
| `DRPG.Move.free` | - | both | check | read, kept |
| `DRPG.Move.dead` | toast | both/unknown | full | read, kept |

### voice-tile

| Key | Surface | Readers | Mode | Done |
| --- | --- | --- | --- | --- |
| `DRPG.Listen.eavesdrop.stop` | - | both | check | read, kept |
| `DRPG.Listen.eavesdrop.gmTitle` | window-title | both | check | read, kept |
| `DRPG.Listen.eavesdrop.gmLine` | - | both | check | en+pl |
