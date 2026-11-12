# Frozen texts for the E25/E71 early pass

Written by the texts line (branch `texts-e71` under the agents prefix). Before each commit the line runs `git fetch origin` and, for each
open branch below, `git diff -U0 <merge-base with origin/main> the open branch <b> -- lang/ docs/handbooks/ scripts/config.mjs`.
Every line a hunk touches, widened by 2 lines on each side (so an edit next to a branch's insertion cannot conflict either),
is mapped to its key path (lang files) or to the nearest heading above it (handbooks). Those keys and sections are frozen:
this line does not edit them. A handbook "section" here is the text from its heading to the next heading of any level.

Also not edited in this pass, whatever the diff says: `scripts/config.mjs` (its English prose is read by position, not by
key, and four branches change it), and therefore the Polish `DRPG.Config.*` prose twins in `lang/pl.json`, so the English
and Polish of one config entry never drift apart across branches.

Read at origin/main 235c3210 on 12.11.2026.

| Branch | Head | Merge base |
| --- | --- | --- |
| e61-62 | 62309451 | fa73b601 |
| e76-106 | 1d62225e | 14619ce2 |
| e97-98 | 9ca7fcc1 | 7fa07aee |
| e73 | 6a914d02 | fa73b601 |
| e92 | ce1ffadb | fa73b601 |
| e93 | 176eaa50 | f22a7e87 |
| e72 | 478a8e71 | f22a7e87 |
| e64 | 7aa02555 | fa73b601 |
| gaps-a | 2338c823 | fa73b601 |

## Handbook sections

| File | Section | Branches |
| --- | --- | --- |
| gm-handbook.en.md | ## 10. Items | e64 |
| gm-handbook.en.md | ## 11. Projects and traps | e64, e93 |
| gm-handbook.en.md | ## 14. Investigation | e64 |
| gm-handbook.en.md | ## 15. The Class Trial | e64, e72, e73, e97-98 |
| gm-handbook.en.md | ## 16. End of chapter and season reset | e61-62, e73, e97-98, gaps-a |
| gm-handbook.en.md | ## 20. Troubleshooting | gaps-a |
| gm-handbook.en.md | ## 3. The GM panel | e72 |
| gm-handbook.en.md | ## 4. The clock | e61-62 |
| gm-handbook.en.md | ## 5. Actions and budgets | e61-62, e64 |
| gm-handbook.en.md | ## 7. Despair pools, assignments and overflow | e93 |
| gm-handbook.en.md | ## 8. Monokuma, Monocubs and the Mastermind | e72, e92 |
| gm-handbook.en.md | ### 13.1 Opening | e64 |
| gm-handbook.en.md | ### 13.2 The incident (Stage 5) | e64 |
| gm-handbook.en.md | ### 13.3 Cleaning up (Stage 6) and Tamper | e64 |
| gm-handbook.en.md | ### 13.4 After the incident, and body discovery | e72 |
| gm-handbook.en.md | ### 15.1 The trial hall | e61-62, e73, e97-98 |
| gm-handbook.en.md | ### 6.1 Hope Calls (`HOPE_CALLS`) | e64, e72 |
| gm-handbook.en.md | ### 6.2 Despair Calls (`DESPAIR_CALLS`) | e72 |
| gm-handbook.en.md | ### 9.1 Rooms and Room Setup | e93 |
| gm-handbook.en.md | ### 9.3 Movement and charging | e64 |
| gm-handbook.en.md | ### 9.5 Voice | e72 |
| gm-handbook.pl.md | ## 10. Przedmioty | e64 |
| gm-handbook.pl.md | ## 11. Projekty i pułapki | e64, e93 |
| gm-handbook.pl.md | ## 14. Investigation | e64 |
| gm-handbook.pl.md | ## 15. Class Trial | e64, e72, e73, e97-98 |
| gm-handbook.pl.md | ## 16. Koniec rozdziału i reset sezonu | e61-62, e73, e97-98, gaps-a |
| gm-handbook.pl.md | ## 20. Rozwiązywanie problemów | gaps-a |
| gm-handbook.pl.md | ## 3. Panel GMa | e72 |
| gm-handbook.pl.md | ## 4. Zegar | e61-62 |
| gm-handbook.pl.md | ## 5. Akcje i budżety | e61-62, e64 |
| gm-handbook.pl.md | ## 7. Pule Despair, przydziały i overflow | e93 |
| gm-handbook.pl.md | ## 8. Monokuma, Monocuby i Mastermind | e72, e92 |
| gm-handbook.pl.md | ### 13.1 Otwarcie | e64 |
| gm-handbook.pl.md | ### 13.2 Incydent (Stage 5) | e64 |
| gm-handbook.pl.md | ### 13.3 Sprzątanie (Stage 6) i Tamper | e64 |
| gm-handbook.pl.md | ### 13.4 Po incydencie i odkrycie ciała | e72 |
| gm-handbook.pl.md | ### 15.1 Sala rozpraw | e61-62, e73, e97-98 |
| gm-handbook.pl.md | ### 6.1 Hope Calls (`HOPE_CALLS`) | e64, e72 |
| gm-handbook.pl.md | ### 6.2 Despair Calls (`DESPAIR_CALLS`) | e72 |
| gm-handbook.pl.md | ### 9.1 Pokoje i Ustawienia pokoi | e93 |
| gm-handbook.pl.md | ### 9.3 Ruch i naliczanie | e64 |
| gm-handbook.pl.md | ### 9.5 Głos | e72 |
| player-brochure.en.md | ## The actions (1 action each) | e64 |
| player-brochure.en.md | ## When it goes wrong | e72 |
| player-brochure.pl.md | ## Akcje (każda za 1 akcję) | e64 |
| player-brochure.pl.md | ## Gdy idzie źle | e72 |
| player-handbook.en.md | ## 12. The Class Trial | e72 |
| player-handbook.en.md | ## 13. Death, and after | e72 |
| player-handbook.en.md | ## 2. Time | e92 |
| player-handbook.en.md | ## 3. Moving and seeing | e61-62 |
| player-handbook.en.md | ## 4. Actions | e64 |
| player-handbook.en.md | ## 5. Hope and the Hope Calls | e64, e72 |
| player-handbook.en.md | ### Bedrooms, keys, stashes | e64 |
| player-handbook.en.md | ### Despair Calls - what Monokuma can do to you | e72 |
| player-handbook.en.md | ### If you are the killer | e64 |
| player-handbook.en.md | ### If you are the victim | e64 |
| player-handbook.en.md | ### Level Up | e64, e73, e97-98 |
| player-handbook.en.md | ### Listen - Shadow, 1 action | e93 |
| player-handbook.en.md | ### Observe - Eye, 1 action | e64 |
| player-handbook.en.md | ### Palm - Hand, 1 action | e64, e93 |
| player-handbook.en.md | ### Playing a Monocub | e64, e72 |
| player-handbook.en.md | ### Projects - the project's statistic, 1 action | e64 |
| player-handbook.en.md | ### Rest - no roll, 1 or 2 actions | e93 |
| player-handbook.en.md | ### Rolling | e92 |
| player-handbook.en.md | ### Tamper - Shadow, 1 action | e64 |
| player-handbook.en.md | ### The Eclipse | e61-62 |
| player-handbook.en.md | ### The Final Trial | e64, e73, e97-98 |
| player-handbook.en.md | ### The morning after | e72 |
| player-handbook.en.md | ### The opening roll | e64 |
| player-handbook.en.md | ### The overflow | e72 |
| player-handbook.en.md | ### The vote | e72 |
| player-handbook.en.md | ### Two states you do not want | e64 |
| player-handbook.pl.md | ## 12. Class Trial | e72 |
| player-handbook.pl.md | ## 13. Śmierć i to, co po niej | e72 |
| player-handbook.pl.md | ## 2. Czas | e92 |
| player-handbook.pl.md | ## 3. Ruch i widzenie | e61-62 |
| player-handbook.pl.md | ## 4. Akcje | e64 |
| player-handbook.pl.md | ## 5. Hope i Hope Calls | e64, e72 |
| player-handbook.pl.md | ### Despair Calls - co Monokuma może ci zrobić | e72 |
| player-handbook.pl.md | ### Dwa stany, których nie chcesz | e64 |
| player-handbook.pl.md | ### Eclipse | e61-62 |
| player-handbook.pl.md | ### Final Trial | e64, e73, e97-98 |
| player-handbook.pl.md | ### Gra Monocubem | e64, e72 |
| player-handbook.pl.md | ### Głosowanie | e72 |
| player-handbook.pl.md | ### Jeśli jesteś ofiarą | e64 |
| player-handbook.pl.md | ### Jeśli jesteś zabójcą | e64 |
| player-handbook.pl.md | ### Level Up | e64, e73, e97-98 |
| player-handbook.pl.md | ### Listen - Shadow, 1 akcja | e93 |
| player-handbook.pl.md | ### Następny poranek | e72 |
| player-handbook.pl.md | ### Observe - Eye, 1 akcja | e64 |
| player-handbook.pl.md | ### Overflow | e72 |
| player-handbook.pl.md | ### Palm - Hand, 1 akcja | e64, e93 |
| player-handbook.pl.md | ### Projects - statystyka projektu, 1 akcja | e64 |
| player-handbook.pl.md | ### Rest - bez rzutu, 1 albo 2 akcje | e93 |
| player-handbook.pl.md | ### Rzut otwarcia | e64 |
| player-handbook.pl.md | ### Rzuty | e92 |
| player-handbook.pl.md | ### Sypialnie, klucze, skrytki | e64 |
| player-handbook.pl.md | ### Tamper - Shadow, 1 akcja | e64 |

## Lang keys (374 paths; a path that is an object freezes its opening line only, its leaves are listed one by one)

| Key | Branches |
| --- | --- |
| `DRPG` | e61-62, e92 |
| `DRPG.Advance.forWhom` | e64 |
| `DRPG.Advance.newExperienceName` | e64 |
| `DRPG.Advance.newExperiencePlaceholder` | e64 |
| `DRPG.Advance.whichExperience` | e64 |
| `DRPG.Advance.whichImprovement` | e64 |
| `DRPG.Advance.whichTrait` | e64 |
| `DRPG.Bridge.what.advancement` | e72 |
| `DRPG.Bridge.what.advancement.apply` | e72 |
| `DRPG.Bridge.what.analyze.resolve` | e93 |
| `DRPG.Bridge.what.body.loot` | e72 |
| `DRPG.Bridge.what.bridge.ack` | e73, e97-98 |
| `DRPG.Bridge.what.call.arm` | e72 |
| `DRPG.Bridge.what.handover.bullet` | e93 |
| `DRPG.Bridge.what.handover.item` | e93 |
| `DRPG.Bridge.what.monocub.ability` | e72 |
| `DRPG.Bridge.what.murder.betrayal` | e72 |
| `DRPG.Bridge.what.murder.park` | e72 |
| `DRPG.Bridge.what.observe.resolve` | e93 |
| `DRPG.Bridge.what.overflow.check` | e93 |
| `DRPG.Bridge.what.passage.share` | e93 |
| `DRPG.Bridge.what.ready.answer` | e73, e97-98 |
| `DRPG.Bridge.what.ready.open` | e73, e97-98 |
| `DRPG.Bridge.what.trial.claim` | e73, e97-98 |
| `DRPG.Bridge.what.trial.present` | e73, e97-98 |
| `DRPG.Bridge.what.trial.turn` | e73, e97-98 |
| `DRPG.Bridge.why.answerKeyMissing` | e72, e92 |
| `DRPG.Bridge.why.cannotLeave` | e93 |
| `DRPG.Bridge.why.chained` | e93 |
| `DRPG.Bridge.why.doorLocked` | e93 |
| `DRPG.Bridge.why.keysNotOpen` | e72, e92 |
| `DRPG.Bridge.why.noAnswer` | e72, e92 |
| `DRPG.Bridge.why.noGm` | e72, e92 |
| `DRPG.Bridge.why.oneWay` | e93 |
| `DRPG.Bridge.why.refused` | e72, e92 |
| `DRPG.Bridge.why.rollUnknown` | e72, e92 |
| `DRPG.Bridge.why.roomSealed` | e93 |
| `DRPG.Bridge.why.trialLocked` | e93 |
| `DRPG.Calls` | e93 |
| `DRPG.Calls.despairGmOnly` | e72 |
| `DRPG.Calls.freeCritTitle` | e64 |
| `DRPG.Calls.freeCritUsed` | e64 |
| `DRPG.Calls.gatherNoRefund` | e72 |
| `DRPG.Calls.gatherRoomGone` | e72 |
| `DRPG.Calls.grants` | e64 |
| `DRPG.Calls.grants.advantage` | e64 |
| `DRPG.Calls.grants.disadvantage` | e64 |
| `DRPG.Calls.notArmedNotCharged` | e72 |
| `DRPG.Calls.sealedBlocked` | e64 |
| `DRPG.Case.row` | e73, e97-98 |
| `DRPG.Case.store.cleanupAttempts` | e72 |
| `DRPG.Case.store.clockBeat` | e93 |
| `DRPG.Case.store.closingClaim` | e73, e97-98 |
| `DRPG.Case.store.confusions` | e72 |
| `DRPG.Case.store.crossings` | e72, e93 |
| `DRPG.Case.store.lootRolls` | e93 |
| `DRPG.Case.store.lootTraces` | e93 |
| `DRPG.Case.store.rerollBookmarks` | e72 |
| `DRPG.Case.store.rerollJournal` | e72 |
| `DRPG.Case.store.rifles` | e93 |
| `DRPG.Case.store.ruledCards` | e73, e97-98 |
| `DRPG.Case.store.takeBack` | e93 |
| `DRPG.Case.store.traceDigest` | e72 |
| `DRPG.Case.store.trialMute` | e73, e97-98 |
| `DRPG.CaseRealize.notNow` | e73, e97-98 |
| `DRPG.CaseRealize.showPreview` | e73, e97-98 |
| `DRPG.Chapter.lastChapter` | gaps-a |
| `DRPG.Chapter.optNextChapter` | gaps-a |
| `DRPG.Chapter.optNextMorning` | gaps-a |
| `DRPG.Chapter.optNextSession` | gaps-a |
| `DRPG.Class` | e92 |
| `DRPG.Class.notInClass` | e92 |
| `DRPG.Class.outTooltip` | e92 |
| `DRPG.Cleanup.bodyNowhere` | e64 |
| `DRPG.Cleanup.moveAlwaysTrace` | e64 |
| `DRPG.Cleanup.moveConfirm` | e64 |
| `DRPG.Cleanup.moveIntro` | e64 |
| `DRPG.Cleanup.moveWhere` | e64 |
| `DRPG.Cleanup.toolsBroken` | e64 |
| `DRPG.Clock.chapterCorrectTitle` | e61-62 |
| `DRPG.Clock.endChapterAsk` | e61-62 |
| `DRPG.Clock.endChapterNote` | e61-62 |
| `DRPG.Clock.phase` | e61-62 |
| `DRPG.Clock.session` | e61-62 |
| `DRPG.Clock.timeOfDay` | e61-62 |
| `DRPG.Config.ACTIONS.listen` | e93 |
| `DRPG.Config.ACTIONS.listen.description` | e93 |
| `DRPG.Config.ACTIONS.listen.hint` | e93 |
| `DRPG.Config.ACTIONS.listen.label` | e93 |
| `DRPG.Config.ACTIONS.listen.thresholds` | e93 |
| `DRPG.Config.ACTIONS.rest` | e93 |
| `DRPG.Config.ACTIONS.rest.description` | e93 |
| `DRPG.Config.ACTIONS.rest.hint` | e93 |
| `DRPG.Config.ACTIONS.rest.label` | e93 |
| `DRPG.Config.ACTIONS.tamper` | e64 |
| `DRPG.Config.ACTIONS.tamper.description` | e64 |
| `DRPG.Config.ACTIONS.tamper.hint` | e64 |
| `DRPG.Config.ACTIONS.tamper.label` | e64 |
| `DRPG.Config.DESPAIR_CALLS` | e72 |
| `DRPG.Config.DESPAIR_CALLS.newRule` | e72 |
| `DRPG.Config.DESPAIR_CALLS.newRule.effect` | e72 |
| `DRPG.Config.DESPAIR_CALLS.newRule.label` | e72 |
| `DRPG.Config.HOPE_CALLS` | e72 |
| `DRPG.Config.HOPE_CALLS.freeCrit` | e72 |
| `DRPG.Config.HOPE_CALLS.freeCrit.effect` | e72 |
| `DRPG.Config.HOPE_CALLS.freeCrit.label` | e72 |
| `DRPG.Config.HOPE_CALLS.support` | e72 |
| `DRPG.Config.HOPE_CALLS.support.effect` | e72 |
| `DRPG.Config.HOPE_CALLS.support.label` | e72 |
| `DRPG.Config.LEVEL_UP_OPTIONS` | e64 |
| `DRPG.Config.LEVEL_UP_OPTIONS.hp` | e64 |
| `DRPG.Config.LEVEL_UP_OPTIONS.hp.label` | e64 |
| `DRPG.Config.LEVEL_UP_OPTIONS.stress` | e64 |
| `DRPG.Config.LEVEL_UP_OPTIONS.stress.label` | e64 |
| `DRPG.Config.LEVEL_UP_OPTIONS.trait` | e64 |
| `DRPG.Config.LEVEL_UP_OPTIONS.trait.label` | e64 |
| `DRPG.Config.MONOCUB` | e72 |
| `DRPG.Config.MONOCUB.abilities` | e72 |
| `DRPG.Config.MONOCUB.abilities.meddle` | e72 |
| `DRPG.Config.MONOCUB.abilities.meddle.label` | e72 |
| `DRPG.Config.MONOCUB.abilities.meddle.thresholds` | e72 |
| `DRPG.Config.PROJECT_SCALE` | e72 |
| `DRPG.Config.SFX_EVENTS.analyzeMiss.hint` | e61-62, e92 |
| `DRPG.Config.SFX_EVENTS.analyzeMiss.label` | e61-62, e92 |
| `DRPG.Config.SFX_EVENTS.debateOpen` | e61-62, e92 |
| `DRPG.Config.SFX_EVENTS.debateOpen.hint` | e61-62, e92 |
| `DRPG.Config.SFX_EVENTS.debateOpen.label` | e61-62, e92 |
| `DRPG.Config.SFX_EVENTS.execution` | e61-62, e92 |
| `DRPG.Config.SFX_EVENTS.execution.hint` | e97-98 |
| `DRPG.Config.SFX_EVENTS.execution.label` | e97-98 |
| `DRPG.Config.SFX_EVENTS.keyReveal` | e73, e97-98 |
| `DRPG.Config.SFX_EVENTS.keyReveal.hint` | e73, e97-98 |
| `DRPG.Config.SFX_EVENTS.keyReveal.label` | e73, e97-98 |
| `DRPG.Config.SFX_EVENTS.trialClose` | e97-98 |
| `DRPG.Config.SFX_EVENTS.trialClose.hint` | e97-98 |
| `DRPG.Config.SFX_EVENTS.trialClose.label` | e97-98 |
| `DRPG.Config.SFX_EVENTS.verdict` | e61-62, e92 |
| `DRPG.Config.SFX_EVENTS.verdict.hint` | e61-62, e92 |
| `DRPG.Config.SFX_EVENTS.verdict.label` | e61-62, e92 |
| `DRPG.DhSettings` | e61-62, e92 |
| `DRPG.DhSettings.details` | e61-62, e92 |
| `DRPG.DhSettings.title` | e61-62, e92 |
| `DRPG.Events` | e72, e73, e97-98, gaps-a |
| `DRPG.Events.bodySubRoom` | e72, gaps-a |
| `DRPG.Events.bodyTitle` | e72, gaps-a |
| `DRPG.Events.incidentTitle` | e72 |
| `DRPG.Events.overflowMetaGm` | e72, gaps-a |
| `DRPG.Events.ticker.assembly` | e72 |
| `DRPG.Events.ticker.motive` | e72 |
| `DRPG.Events.ticker.trial` | e72 |
| `DRPG.Explain.status.actionsNow` | e64 |
| `DRPG.Explain.status.actionsTitle` | e64 |
| `DRPG.Explain.status.actionsWhat` | e64 |
| `DRPG.Explain.status.actionsWounded` | e64 |
| `DRPG.Explain.status.moveTitle` | e64 |
| `DRPG.Floor` | e73, e97-98 |
| `DRPG.Floor.bar.inClosing` | e73, e97-98 |
| `DRPG.Floor.bar.minusSeconds` | e73, e97-98 |
| `DRPG.Floor.bar.plusSeconds` | e73, e97-98 |
| `DRPG.Floor.discussionNote` | e73, e97-98 |
| `DRPG.Floor.endClosing` | e72, e73, e97-98, gaps-a |
| `DRPG.Floor.gmStepTitle` | e73, e97-98 |
| `DRPG.Floor.lead.closing` | e73, e97-98 |
| `DRPG.Floor.lead.round` | e73, e97-98 |
| `DRPG.Floor.lead.sentenceWaits` | e73, e97-98 |
| `DRPG.Floor.mode.closing` | e73, e97-98 |
| `DRPG.Floor.mode.panic` | e73, e97-98 |
| `DRPG.Floor.mode.testimony` | e73, e97-98 |
| `DRPG.Floor.next` | e73, e97-98 |
| `DRPG.Floor.next.chapterEnd` | e73, e97-98 |
| `DRPG.Floor.next.finishElsewhere` | e73, e97-98 |
| `DRPG.Floor.next.start` | e73, e97-98 |
| `DRPG.Floor.next.verdictElsewhere` | e73, e97-98 |
| `DRPG.Floor.nobodyForTrial` | e73, e97-98 |
| `DRPG.Floor.objectionNote` | e73, e97-98 |
| `DRPG.Floor.startClosing` | e73, e97-98 |
| `DRPG.Mastermind.finalAddNote` | e73, e97-98 |
| `DRPG.Mastermind.finalPlacedIn` | e73, e97-98 |
| `DRPG.Monocub` | e72 |
| `DRPG.Monocub.cannotMeddle` | e72 |
| `DRPG.Monocub.critHelpNothing` | e72 |
| `DRPG.Monocub.critHelpNothingTarget` | e72 |
| `DRPG.Monocub.critHinderNothing` | e72 |
| `DRPG.Monocub.critHinderNothingTarget` | e72 |
| `DRPG.Monocub.give` | e72 |
| `DRPG.Monocub.giveAtLeast` | e72 |
| `DRPG.Monocub.giveHopeColumn` | e72 |
| `DRPG.Monocub.hopeShort` | e72 |
| `DRPG.Monocub.invite` | e72 |
| `DRPG.Monocub.meddleCostShort` | e72 |
| `DRPG.Monocub.meddleCostShort.other` | e72 |
| `DRPG.Monocub.meddleFailed` | e72 |
| `DRPG.Monocub.meddleRefused` | e72 |
| `DRPG.Monocub.meddledOn` | e72 |
| `DRPG.Monocub.mustBeDead` | e72 |
| `DRPG.Monocub.needHope` | e72 |
| `DRPG.Monocub.noneYet` | e72 |
| `DRPG.Monocub.notCub` | e72 |
| `DRPG.Monocub.onlyTwoActions` | e72 |
| `DRPG.Monocub.opted` | e72 |
| `DRPG.Monocub.silenceOff` | e72 |
| `DRPG.Monocub.silenceOn` | e72 |
| `DRPG.Monocub.silenceTitle` | e72 |
| `DRPG.Monocub.silenced` | e72 |
| `DRPG.Monocub.silencedBadge` | e72 |
| `DRPG.Monocub.silencedNote` | e72 |
| `DRPG.Monocub.silencedNoteShort` | e72 |
| `DRPG.Monocub.silencedTooltip` | e72 |
| `DRPG.Monocub.student` | e72 |
| `DRPG.Monocub.tickFirst` | e72 |
| `DRPG.Monocub.tierBeaten` | e72 |
| `DRPG.Monocub.tierMissed` | e72 |
| `DRPG.Monocub.unopted` | e72 |
| `DRPG.Monokuma` | e72 |
| `DRPG.Murder.actionBlocked` | e64 |
| `DRPG.Murder.actionDenied` | e64 |
| `DRPG.Murder.actionHindered` | e64 |
| `DRPG.Murder.drainStopped` | e64 |
| `DRPG.Murder.failedNothing` | e64 |
| `DRPG.Murder.noRollNeeded` | e64 |
| `DRPG.Murder.notYourTurn` | e64 |
| `DRPG.Murder.thresholdShort` | e64 |
| `DRPG.Murder.unlockedActions` | e64 |
| `DRPG.Murder.useItemFumbled` | e64 |
| `DRPG.Murder.useItemGone` | e64 |
| `DRPG.Murder.useItemWorked` | e64 |
| `DRPG.Observe.alreadyHeld` | e64 |
| `DRPG.Observe.critPrompt` | e64 |
| `DRPG.Observe.describeConfirm` | e64 |
| `DRPG.Observe.describeIntro` | e64 |
| `DRPG.Observe.describeTitle` | e64 |
| `DRPG.Observe.rerollLost` | e64 |
| `DRPG.Observe.resolveLost` | e64 |
| `DRPG.Observe.resolveLostOwner` | e64 |
| `DRPG.Overflow.name.earthquake` | e93 |
| `DRPG.Overflow.name.fog` | e93 |
| `DRPG.Overflow.name.rot` | e93 |
| `DRPG.Overflow.rulesChanged` | e93 |
| `DRPG.Overflow.what` | e93 |
| `DRPG.Overflow.what.earthquake` | e93 |
| `DRPG.Overflow.what.fog` | e93 |
| `DRPG.Overflow.what.rot` | e93 |
| `DRPG.Panel.doColumn` | e72 |
| `DRPG.Panel.group` | e92 |
| `DRPG.Panel.group.monokumas` | e92 |
| `DRPG.Panel.group.notInClass` | e92 |
| `DRPG.Panel.group.students` | e92 |
| `DRPG.Panel.nextReady` | e92 |
| `DRPG.Panel.openSheet` | e92 |
| `DRPG.Panel.refundCrossing` | e72 |
| `DRPG.Panel.role` | e92 |
| `DRPG.Panel.role.student` | e92 |
| `DRPG.Panel.roleColumn` | e92 |
| `DRPG.Panel.seasonChecks` | e72 |
| `DRPG.Panel.whoIsAlive` | e72 |
| `DRPG.Panel.whoIsAliveNote` | e72 |
| `DRPG.Passage.engineOff` | e64 |
| `DRPG.Passage.why.brokenSince` | e64 |
| `DRPG.Passage.why.isBreach` | e93 |
| `DRPG.Passage.why.itemBack` | e64 |
| `DRPG.Passage.why.levels` | e93 |
| `DRPG.Passage.why.noSide` | e93 |
| `DRPG.Passage.why.noWall` | e93 |
| `DRPG.Passage.why.notKnown` | e93 |
| `DRPG.Passage.why.nothingBack` | e64 |
| `DRPG.Passage.why.taken` | e93 |
| `DRPG.Passage.why.unknown` | e64 |
| `DRPG.Price.nothingLeft.analyze` | e64 |
| `DRPG.Price.nothingLeft.analyzeOneStep` | e64 |
| `DRPG.Price.nothingLeft.tamper` | e64 |
| `DRPG.Price.nothingLeft.tamperSkippedAction` | e64 |
| `DRPG.Project.closeBreachSummary` | e93 |
| `DRPG.Project.descriptionTold` | e93 |
| `DRPG.Project.kindOwn` | e93 |
| `DRPG.Project.preset.closeBreach` | e93 |
| `DRPG.Project.preset.repairItem` | e93 |
| `DRPG.Project.preset.sealPassage` | e93 |
| `DRPG.Project.proposalNotSent` | e93 |
| `DRPG.Project.proposalPlaceholder` | e93 |
| `DRPG.Project.proposalPrompt` | e93 |
| `DRPG.Project.proposalSent` | e93 |
| `DRPG.Project.proposerKnows` | e93 |
| `DRPG.Project.repairBroken` | e93 |
| `DRPG.Project.repairItemSummary` | e93 |
| `DRPG.Project.repairLabel` | e93 |
| `DRPG.Project.repairWorn` | e93 |
| `DRPG.Project.sealPassageSummary` | e93 |
| `DRPG.Remnant.cardUnread` | e93 |
| `DRPG.Remnant.discardNote` | e93 |
| `DRPG.Reroll.critHopeGained` | e93 |
| `DRPG.Reroll.critHopeReturned` | e93 |
| `DRPG.Reroll.noReplay` | e93 |
| `DRPG.Reroll.observeReplayed` | e93 |
| `DRPG.Reroll.progressAdjusted` | e93 |
| `DRPG.Reroll.replayFailed` | e93 |
| `DRPG.Rest` | e93 |
| `DRPG.Rest.long` | e93 |
| `DRPG.Rest.longColumn` | e93 |
| `DRPG.Rest.noRegions` | e93 |
| `DRPG.Rest.short` | e93 |
| `DRPG.Rest.shortColumn` | e93 |
| `DRPG.Reveal` | e73, e97-98 |
| `DRPG.Reveal.left` | e73, e97-98 |
| `DRPG.Reveal.section` | e73, e97-98 |
| `DRPG.RollDialog.advantageCapped` | e93 |
| `DRPG.RollDialog.forcedByCall` | e93 |
| `DRPG.RollDialog.forcedBySituation` | e93 |
| `DRPG.RollDialog.forcedByState` | e93 |
| `DRPG.RollDialog.freeCritArmed` | e93 |
| `DRPG.RollDialog.lockedByCall` | e93 |
| `DRPG.RollDialog.source` | e93 |
| `DRPG.RollDialog.source.call` | e93 |
| `DRPG.RollDialog.source.situation` | e93 |
| `DRPG.RollDialog.source.state` | e93 |
| `DRPG.RollDialog.unlockedByCall` | e93 |
| `DRPG.Settings.glassPulse.hint` | e61-62, e92 |
| `DRPG.Settings.glassPulse.name` | e61-62, e92 |
| `DRPG.Settings.highContrast.hint` | e61-62, e92 |
| `DRPG.Settings.highContrast.name` | e61-62, e92 |
| `DRPG.Settings.reducedMotion` | e61-62, e92 |
| `DRPG.Settings.reducedMotion.hint` | e61-62, e92 |
| `DRPG.Settings.reducedMotion.name` | e61-62, e92 |
| `DRPG.SheetNotes.fogBudget` | e92 |
| `DRPG.SheetNotes.noExperiences` | e92 |
| `DRPG.Trial.presentByButton` | e72 |
| `DRPG.Trial.presentNobody` | e72 |
| `DRPG.Trial.presentOnly` | e72 |
| `DRPG.Trial.presentWithAnalysis` | e72 |
| `DRPG.Trial.presentWithoutNote` | e72 |
| `DRPG.Trial.presented` | e72 |
| `DRPG.TrialScene.castHeading` | e73, e97-98 |
| `DRPG.TrialScene.hallRoom.words` | e73, e97-98 |
| `DRPG.TrialScene.noCast` | e73, e97-98 |
| `DRPG.TrialScene.noScene` | e73, e97-98 |
| `DRPG.TrialScene.reveal` | e73, e97-98 |
| `DRPG.Vault.descriptionColumn` | e93 |
| `DRPG.Vault.descriptionPlaceholder` | e93 |
| `DRPG.Vault.discoverAll` | e72 |
| `DRPG.Vault.fogNote` | e72 |
| `DRPG.Vault.fogUncovered` | e72 |
| `DRPG.Vault.hasEveryKey` | e64 |
| `DRPG.Vault.hideAll` | e72 |
| `DRPG.Vault.inspectTitle` | e72 |
| `DRPG.Vault.isRoomColumn` | e93 |
| `DRPG.Vault.isRoomHint` | e93 |
| `DRPG.Vault.keyCopiesGm` | e64 |
| `DRPG.Vault.keyTakenBack` | e64 |
| `DRPG.Vault.keyTakenGm` | e64 |
| `DRPG.Vault.lockedAtStartColumn` | e93 |
| `DRPG.Vault.lockedAtStartHint` | e93 |
| `DRPG.Vault.noKeysToGive` | e64 |
| `DRPG.Vault.noKeysToTake` | e93 |
| `DRPG.Vault.tabDescription` | e93 |
| `DRPG.Vault.tabPassages` | e93 |
| `DRPG.Vault.tabRest` | e93 |
| `DRPG.Vault.tabSearching` | e93 |
| `DRPG.Vault.takeKey` | e93 |
| `DRPG.Vault.unlockedAnnounce` | e72 |
| `DRPG.Voice.held.deadAlone` | e92 |
| `DRPG.Voice.held.eclipse` | e92 |
| `DRPG.Voice.held.eclipseHeard` | e92 |
| `DRPG.Voice.held.external` | e92 |
| `DRPG.Voice.held.gmBlock` | e92 |
| `DRPG.Voice.held.offline` | e92 |
| `DRPG.Vote.verdictSteps.despair` | e72 |
| `DRPG.Vote.verdictSteps.finalCard` | e72 |
| `DRPG.Vote.verdictSteps.finalClose` | e72 |
| `DRPG.Vote.verdictSteps.finalExecution` | e72 |
| `DRPG.Vote.verdictSteps.finalLevelUps` | e72 |
| `DRPG.Vote.verdictSteps.finalSentence` | e72 |
| `DRPG.Vote.verdictSteps.mastermind` | e72 |
| `DRPG.Vote.verdictSteps.offers` | e72 |
| `DRPG.Vote.verdictSteps.overflow` | e72 |
| `DRPG.Vote.verdictSteps.rule` | e72 |

## config.mjs hunks (base lines, for the record)

- e61-62: 2040-2045; 4885-4890; 4925-4930; 4927-4932; 5026-5031
- e97-98: 3942-3946; 4910-4915; 4935-4940
- e73: 3942-3946; 4910-4915
- e92: 243-247; 4885-4890; 4925-4930; 4927-4932
- e93: 1653-1658; 1656-1660; 1672-1677; 1675-1679; 1679-1683; 2081-2086; 2409-2414; 5028-5033
- e72: 2103-2108; 2106-2111; 2142-2147; 2299-2304; 2502-2507; 2647-2652; 3194-3198; 3195-3200; 3199-3204; 3225-3230
- e64: 170-175; 1744-1749; 1746-1750; 1792-1797; 1859-1864; 3094-3098; 3118-3123; 3129-3134; 3207-3212; 3209-3213; 3331-3336; 3383-3388; 3509-3514; 3565-3570; 3583-3588; 3623-3628; 3646-3651; 3657-3662; 3668-3673; 3750-3755; 4031-4036; 4048-4053; 4050-4054; 4324-4331; 5043-5048

## Sections frozen after this line edited them

Re-read at the fourth commit (12.11.2026): e61-62 (head b07dec9e) now inserts lines into three sections this line had
already edited in 11133b75. The edits do not touch the same lines, so the merge has no overlapping hunk:

| File | Section | This line's edit | e61-62's hunk (its merge base) |
| --- | --- | --- | --- |
| player-handbook.en.md, .pl.md | The Eclipse / Eclipse | lines 101-102 (T29 cuts) | insertion after line 110 |
| gm-handbook.pl.md | 4. Zegar | line 214 (GM-a) | insertion after line 231 |

No further edit goes into these sections.
