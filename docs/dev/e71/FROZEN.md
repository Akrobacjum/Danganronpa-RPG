# Frozen texts for the E25/E71 early pass

Written by the texts line (branch `texts-e71` under the agents prefix). Before each commit the line runs `git fetch origin` and, for each
open branch below, `git diff -U0 <merge-base with origin/main> the open branch <b> -- lang/ docs/handbooks/ scripts/config.mjs`.
Every line a hunk touches, widened by 2 lines on each side (so an edit next to a branch's insertion cannot conflict either),
is mapped to its key path (lang files) or to the nearest heading above it (handbooks). Those keys and sections are frozen:
this line does not edit them. A handbook "section" here is the text from its heading to the next heading of any level.

Also not edited in this pass, whatever the diff says: `scripts/config.mjs` (its English prose is read by position, not by
key, and four branches change it), and therefore the Polish `DRPG.Config.*` prose twins in `lang/pl.json`, so the English
and Polish of one config entry never drift apart across branches.

Read at origin/main 4dfac3a9 on 12.11.2026.

| Branch | Head | Merge base |
| --- | --- | --- |
| e61-62 | 057786aa | fa73b601 |
| e76-106 | 1d62225e | 14619ce2 |
| e97-98 | cebe4c69 | 4dfac3a9 |
| e73 | 6a914d02 | 6a914d02 |
| e92 | ce1ffadb | fa73b601 |
| e93 | 4eef965a | 4dfac3a9 |
| e72 | 92559c7d | 4dfac3a9 |
| e64 | 7ceb4f5c | 4dfac3a9 |
| gaps-a | 2338c823 | fa73b601 |

## Handbook sections

| File | Section | Branches |
| --- | --- | --- |
| gm-handbook.en.md | # Danganronpa RPG - GM Handbook | fervent-sagan-gme4vt |
| gm-handbook.en.md | ## 10. Items | e64 |
| gm-handbook.en.md | ## 11. Projects and traps | e64, e93 |
| gm-handbook.en.md | ## 14. Investigation | e64, e64-inv, e97-98 |
| gm-handbook.en.md | ## 15. The Class Trial | e64, e72, e97-98 |
| gm-handbook.en.md | ## 16. End of chapter and season reset | e61-62, fervent-sagan-gme4vt, gaps-a |
| gm-handbook.en.md | ## 17. Sound and SFX | e101, fervent-sagan-gme4vt |
| gm-handbook.en.md | ## 18. The settings window, themes and the Language setting | e100, e101 |
| gm-handbook.en.md | ## 2. The season setup checklist | e101 |
| gm-handbook.en.md | ## 20. Troubleshooting | e100, e101, gaps-a |
| gm-handbook.en.md | ## 3. The GM panel | e101, e72 |
| gm-handbook.en.md | ## 4. The clock | e100, e61-62, fervent-sagan-gme4vt |
| gm-handbook.en.md | ## 5. Actions and budgets | e61-62, e64, fervent-sagan-gme4vt |
| gm-handbook.en.md | ## 7. Despair pools, assignments and overflow | e101, e93 |
| gm-handbook.en.md | ## 8. Monokuma, Monocubs and the Mastermind | e101, e72, e92, fervent-sagan-gme4vt |
| gm-handbook.en.md | ### 13.1 Opening | e64 |
| gm-handbook.en.md | ### 13.2 The incident (Stage 5) | e100, e64 |
| gm-handbook.en.md | ### 13.3 Cleaning up (Stage 6) and Tamper | e100, e64 |
| gm-handbook.en.md | ### 13.4 After the incident, and body discovery | e72 |
| gm-handbook.en.md | ### 15.1 The trial hall | e61-62, e97-98 |
| gm-handbook.en.md | ### 15.2 The hall's zones: Straw Poll, Logic Dive and Scrum Debate | fervent-sagan-gme4vt |
| gm-handbook.en.md | ### 6.1 Hope Calls (`HOPE_CALLS`) | e64, e72 |
| gm-handbook.en.md | ### 6.2 Despair Calls (`DESPAIR_CALLS`) | e72 |
| gm-handbook.en.md | ### 9.1 Rooms and Room Setup | e93 |
| gm-handbook.en.md | ### 9.2 Fog and discovery | e101 |
| gm-handbook.en.md | ### 9.3 Movement and charging | e64 |
| gm-handbook.en.md | ### 9.5 Voice | e72 |
| gm-handbook.pl.md | # Danganronpa RPG - Podręcznik GM | fervent-sagan-gme4vt |
| gm-handbook.pl.md | ## 10. Przedmioty | e64 |
| gm-handbook.pl.md | ## 11. Projekty i pułapki | e64, e93 |
| gm-handbook.pl.md | ## 14. Investigation | e64, e64-inv, e97-98 |
| gm-handbook.pl.md | ## 15. Class Trial | e64, e72, e97-98 |
| gm-handbook.pl.md | ## 16. Koniec rozdziału i reset sezonu | e61-62, fervent-sagan-gme4vt, gaps-a |
| gm-handbook.pl.md | ## 17. Dźwięk i efekty | e101, fervent-sagan-gme4vt |
| gm-handbook.pl.md | ## 18. Okno Ustawień, motywy i ustawienie Język | e100, e101 |
| gm-handbook.pl.md | ## 2. Lista kontrolna sezonu | e101 |
| gm-handbook.pl.md | ## 20. Rozwiązywanie problemów | e100, e101, gaps-a |
| gm-handbook.pl.md | ## 3. Panel GMa | e101, e72 |
| gm-handbook.pl.md | ## 4. Zegar | e100, e61-62, fervent-sagan-gme4vt |
| gm-handbook.pl.md | ## 5. Akcje i budżety | e61-62, e64, fervent-sagan-gme4vt |
| gm-handbook.pl.md | ## 7. Pule Despair, przydziały i overflow | e101, e93 |
| gm-handbook.pl.md | ## 8. Monokuma, Monocuby i Mastermind | e101, e72, e92, fervent-sagan-gme4vt |
| gm-handbook.pl.md | ### 13.1 Otwarcie | e64 |
| gm-handbook.pl.md | ### 13.2 Incydent (Stage 5) | e64 |
| gm-handbook.pl.md | ### 13.3 Sprzątanie (Stage 6) i Tamper | e64 |
| gm-handbook.pl.md | ### 13.4 Po incydencie i odkrycie ciała | e72 |
| gm-handbook.pl.md | ### 15.1 Sala rozpraw | e61-62, e97-98 |
| gm-handbook.pl.md | ### 15.2 Strefy sali: Straw Poll, Logic Dive i Scrum Debate | fervent-sagan-gme4vt |
| gm-handbook.pl.md | ### 6.1 Hope Calls (`HOPE_CALLS`) | e64, e72 |
| gm-handbook.pl.md | ### 6.2 Despair Calls (`DESPAIR_CALLS`) | e72 |
| gm-handbook.pl.md | ### 9.1 Pokoje i Ustawienia pokoi | e93 |
| gm-handbook.pl.md | ### 9.2 Mgła i odkrywanie | e101 |
| gm-handbook.pl.md | ### 9.3 Ruch i naliczanie | e64 |
| gm-handbook.pl.md | ### 9.5 Głos | e72 |
| player-brochure.en.md | # Danganronpa RPG - Student Brochure | fervent-sagan-gme4vt |
| player-brochure.en.md | ## The actions (1 action each) | e64 |
| player-brochure.en.md | ## When it goes wrong | e72 |
| player-brochure.pl.md | # Danganronpa RPG - Ulotka ucznia | fervent-sagan-gme4vt |
| player-brochure.pl.md | ## Akcje (każda za 1 akcję) | e64 |
| player-brochure.pl.md | ## Gdy idzie źle | e72 |
| player-handbook.en.md | # Danganronpa RPG - Player Handbook | fervent-sagan-gme4vt |
| player-handbook.en.md | ## 12. The Class Trial | e72 |
| player-handbook.en.md | ## 13. Death, and after | e72 |
| player-handbook.en.md | ## 2. Time | e92, fervent-sagan-gme4vt |
| player-handbook.en.md | ## 3. Moving and seeing | e61-62, fervent-sagan-gme4vt |
| player-handbook.en.md | ## 4. Actions | e64 |
| player-handbook.en.md | ## 5. Hope and the Hope Calls | e64, e72 |
| player-handbook.en.md | ### Bedrooms, keys, stashes | e64 |
| player-handbook.en.md | ### Despair Calls - what Monokuma can do to you | e72 |
| player-handbook.en.md | ### If you are the killer | e64 |
| player-handbook.en.md | ### If you are the victim | e100, e64 |
| player-handbook.en.md | ### Level Up | e64 |
| player-handbook.en.md | ### Listen - Shadow, 1 action | e93 |
| player-handbook.en.md | ### Observe - Eye, 1 action | e64 |
| player-handbook.en.md | ### Palm - Hand, 1 action | e64, e93 |
| player-handbook.en.md | ### Playing a Monocub | e64, e72 |
| player-handbook.en.md | ### Projects - the project's statistic, 1 action | e64 |
| player-handbook.en.md | ### Rest - no roll, 1 or 2 actions | e93 |
| player-handbook.en.md | ### Rolling | e92, fervent-sagan-gme4vt |
| player-handbook.en.md | ### Tamper - Shadow, 1 action | e64 |
| player-handbook.en.md | ### The Eclipse | e61-62, fervent-sagan-gme4vt |
| player-handbook.en.md | ### The hall's zones | e64 |
| player-handbook.en.md | ### The morning after | e72 |
| player-handbook.en.md | ### The opening roll | e64 |
| player-handbook.en.md | ### The overflow | e72 |
| player-handbook.en.md | ### The vote | e72 |
| player-handbook.en.md | ### Two states you do not want | e64 |
| player-handbook.pl.md | # Danganronpa RPG - Podręcznik gracza | fervent-sagan-gme4vt |
| player-handbook.pl.md | ## 12. Class Trial | e72 |
| player-handbook.pl.md | ## 13. Śmierć i to, co po niej | e72 |
| player-handbook.pl.md | ## 2. Czas | e92, fervent-sagan-gme4vt |
| player-handbook.pl.md | ## 3. Ruch i widzenie | e61-62, fervent-sagan-gme4vt |
| player-handbook.pl.md | ## 4. Akcje | e64 |
| player-handbook.pl.md | ## 5. Hope i Hope Calls | e64, e72 |
| player-handbook.pl.md | ### Despair Calls - co Monokuma może ci zrobić | e72 |
| player-handbook.pl.md | ### Dwa stany, których nie chcesz | e64 |
| player-handbook.pl.md | ### Eclipse | e61-62, fervent-sagan-gme4vt |
| player-handbook.pl.md | ### Gra Monocubem | e64, e72 |
| player-handbook.pl.md | ### Głosowanie | e72 |
| player-handbook.pl.md | ### Jeśli jesteś ofiarą | e64 |
| player-handbook.pl.md | ### Jeśli jesteś zabójcą | e64 |
| player-handbook.pl.md | ### Level Up | e64 |
| player-handbook.pl.md | ### Listen - Shadow, 1 akcja | e93 |
| player-handbook.pl.md | ### Następny poranek | e72 |
| player-handbook.pl.md | ### Observe - Eye, 1 akcja | e64 |
| player-handbook.pl.md | ### Overflow | e72 |
| player-handbook.pl.md | ### Palm - Hand, 1 akcja | e64, e93 |
| player-handbook.pl.md | ### Projects - statystyka projektu, 1 akcja | e64 |
| player-handbook.pl.md | ### Rest - bez rzutu, 1 albo 2 akcje | e93 |
| player-handbook.pl.md | ### Rzut otwarcia | e64 |
| player-handbook.pl.md | ### Rzuty | e92, fervent-sagan-gme4vt |
| player-handbook.pl.md | ### Strefy sali | e64 |
| player-handbook.pl.md | ### Sypialnie, klucze, skrytki | e64 |
| player-handbook.pl.md | ### Tamper - Shadow, 1 akcja | e64 |

## Lang keys (498 paths; a path that is an object freezes its opening line only, its leaves are listed one by one)

| Key | Branches |
| --- | --- |
| `DRPG` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Action.critical` | e100 |
| `DRPG.Action.difficulty` | e100 |
| `DRPG.Action.duality` | e100 |
| `DRPG.Action.failed` | e100 |
| `DRPG.Action.gotIt` | e100 |
| `DRPG.Action.nothing` | e100 |
| `DRPG.Action.proceed` | e100 |
| `DRPG.Action.roll` | e100 |
| `DRPG.Action.usesTrait` | e100 |
| `DRPG.Action.willCost` | e100 |
| `DRPG.Action.willCost.one` | e100 |
| `DRPG.Advance.buttonTooltip` | e101 |
| `DRPG.Advance.caption` | e101 |
| `DRPG.Advance.failed` | e101 |
| `DRPG.Advance.forWhom` | e64 |
| `DRPG.Advance.newExperienceName` | e64 |
| `DRPG.Advance.newExperiencePlaceholder` | e64 |
| `DRPG.Advance.unknownKind` | e101 |
| `DRPG.Advance.whichExperience` | e64 |
| `DRPG.Advance.whichImprovement` | e64 |
| `DRPG.Advance.whichTrait` | e64 |
| `DRPG.Advance.who` | e101 |
| `DRPG.Advance.who.gm` | e101 |
| `DRPG.Advance.who.gmHint` | e101 |
| `DRPG.Advance.whoPicks` | e101 |
| `DRPG.Bridge.awaitingRuling` | e100 |
| `DRPG.Bridge.criticalHint` | e100 |
| `DRPG.Bridge.openUntil` | e100 |
| `DRPG.Bridge.send` | e100 |
| `DRPG.Bridge.what.action.steal` | e72 |
| `DRPG.Bridge.what.advancement` | e72 |
| `DRPG.Bridge.what.advancement.apply` | e72 |
| `DRPG.Bridge.what.analyze.resolve` | e93 |
| `DRPG.Bridge.what.body.loot` | e72 |
| `DRPG.Bridge.what.call.arm` | e72 |
| `DRPG.Bridge.what.handover.bullet` | e93 |
| `DRPG.Bridge.what.handover.item` | e72, e93 |
| `DRPG.Bridge.what.monocub.ability` | e72 |
| `DRPG.Bridge.what.murder.betrayal` | e72 |
| `DRPG.Bridge.what.murder.park` | e72 |
| `DRPG.Bridge.what.observe.resolve` | e93 |
| `DRPG.Bridge.what.overflow.check` | e93 |
| `DRPG.Bridge.what.passage.cross` | e72 |
| `DRPG.Bridge.what.passage.share` | e72, e93 |
| `DRPG.Bridge.what.vault.findStash` | e72 |
| `DRPG.Bridge.what.vault.steal` | e72 |
| `DRPG.Bridge.why.answerKeyMissing` | e72, e92, fervent-sagan-gme4vt |
| `DRPG.Bridge.why.cannotLeave` | e93 |
| `DRPG.Bridge.why.chained` | e93 |
| `DRPG.Bridge.why.doorLocked` | e93 |
| `DRPG.Bridge.why.keysNotOpen` | e72, e92, fervent-sagan-gme4vt |
| `DRPG.Bridge.why.noAnswer` | e72, e92, fervent-sagan-gme4vt |
| `DRPG.Bridge.why.noGm` | e72, e92, fervent-sagan-gme4vt |
| `DRPG.Bridge.why.oneWay` | e93 |
| `DRPG.Bridge.why.refused` | e72, e92, fervent-sagan-gme4vt |
| `DRPG.Bridge.why.rollUnknown` | e72, e92, fervent-sagan-gme4vt |
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
| `DRPG.Case.store.cleanupAttempts` | e72 |
| `DRPG.Case.store.clockBeat` | e93 |
| `DRPG.Case.store.confusions` | e72 |
| `DRPG.Case.store.crossings` | e72, e93 |
| `DRPG.Case.store.lootRolls` | e93 |
| `DRPG.Case.store.lootTraces` | e93 |
| `DRPG.Case.store.rerollBookmarks` | e72 |
| `DRPG.Case.store.rerollJournal` | e72 |
| `DRPG.Case.store.rifles` | e93 |
| `DRPG.Case.store.takeBack` | e93 |
| `DRPG.Case.store.traceDigest` | e72 |
| `DRPG.CaseSummary` | e97-98 |
| `DRPG.CaseSummary.intro` | e97-98 |
| `DRPG.CaseSummary.previewTitle` | e97-98 |
| `DRPG.CaseSummary.send` | e97-98 |
| `DRPG.CaseSummary.show` | e97-98 |
| `DRPG.Chapter.doneReveal` | e64, e64-inv |
| `DRPG.Chapter.endButton` | e64, e64-inv |
| `DRPG.Chapter.endIntro` | e64, e64-inv |
| `DRPG.Chapter.endNote` | e64, e64-inv |
| `DRPG.Chapter.lastChapter` | gaps-a |
| `DRPG.Chapter.optNextChapter` | gaps-a |
| `DRPG.Chapter.optNextMorning` | gaps-a |
| `DRPG.Chapter.optNextSession` | gaps-a |
| `DRPG.Chapter.optReveal` | e64, e64-inv |
| `DRPG.Chapter.revealKeeps` | e64, e64-inv |
| `DRPG.Class` | e92, fervent-sagan-gme4vt |
| `DRPG.Class.notInClass` | e92, fervent-sagan-gme4vt |
| `DRPG.Class.outTooltip` | e92, fervent-sagan-gme4vt |
| `DRPG.Cleanup.bodyNowhere` | e64 |
| `DRPG.Cleanup.moveAlwaysTrace` | e64 |
| `DRPG.Cleanup.moveConfirm` | e64 |
| `DRPG.Cleanup.moveIntro` | e64 |
| `DRPG.Cleanup.moveWhere` | e64 |
| `DRPG.Cleanup.toolsBroken` | e64 |
| `DRPG.Clock.chapterCorrectTitle` | e61-62, fervent-sagan-gme4vt |
| `DRPG.Clock.endChapterAsk` | e61-62, fervent-sagan-gme4vt |
| `DRPG.Clock.endChapterNote` | e61-62, fervent-sagan-gme4vt |
| `DRPG.Clock.phase` | e61-62, fervent-sagan-gme4vt |
| `DRPG.Clock.session` | e61-62, fervent-sagan-gme4vt |
| `DRPG.Clock.timeOfDay` | e61-62, fervent-sagan-gme4vt |
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
| `DRPG.Config.SFX_EVENTS.analyzeMiss.hint` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Config.SFX_EVENTS.analyzeMiss.label` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Config.SFX_EVENTS.debateOpen` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Config.SFX_EVENTS.debateOpen.hint` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Config.SFX_EVENTS.debateOpen.label` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Config.SFX_EVENTS.execution` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Config.SFX_EVENTS.verdict` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Config.SFX_EVENTS.verdict.hint` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Config.SFX_EVENTS.verdict.label` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Despair.poolAdded` | e101 |
| `DRPG.Despair.poolGone` | e101 |
| `DRPG.Despair.poolRemoved` | e101 |
| `DRPG.Despair.removePoolAsk` | e101 |
| `DRPG.Despair.revokeFrom` | e101 |
| `DRPG.Despair.widgetTitle` | e101 |
| `DRPG.DhSettings` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.DhSettings.details` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.DhSettings.title` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Events` | e72, gaps-a |
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
| `DRPG.Floor.endClosing` | gaps-a |
| `DRPG.Floor.lead.chapterEnd` | e97-98 |
| `DRPG.Floor.lead.closing` | e97-98 |
| `DRPG.Floor.lead.finishElsewhere` | e97-98 |
| `DRPG.Floor.lead.round` | e97-98 |
| `DRPG.Floor.lead.sentenceWaits` | e97-98 |
| `DRPG.Floor.lead.verdictElsewhere` | e97-98 |
| `DRPG.Floor.next.chapterEnd` | e97-98 |
| `DRPG.Floor.next.endZone` | e97-98 |
| `DRPG.Floor.next.finishElsewhere` | e97-98 |
| `DRPG.Floor.next.scrum` | e97-98 |
| `DRPG.Floor.next.verdictElsewhere` | e97-98 |
| `DRPG.Floor.pickerLabel` | e72 |
| `DRPG.Hud` | e101 |
| `DRPG.Investigation.analysisPlaceholder` | e64, e64-inv |
| `DRPG.Investigation.breakdown` | e64, e64-inv |
| `DRPG.Investigation.breakdownTooltip` | e64, e64-inv |
| `DRPG.Investigation.chapterN` | e64, e64-inv |
| `DRPG.Investigation.createHere` | e64, e64-inv |
| `DRPG.Investigation.createNote` | e64, e64-inv |
| `DRPG.Investigation.difficulty` | e64, e64-inv |
| `DRPG.Investigation.filterCount` | e64, e64-inv |
| `DRPG.Investigation.filterEveryChapter` | e64, e64-inv |
| `DRPG.Investigation.neverOnePerson` | e64, e64-inv |
| `DRPG.Investigation.newTraceIntro` | e64, e64-inv |
| `DRPG.Investigation.newTraceReinforced` | e64, e64-inv |
| `DRPG.Investigation.newTraceTied` | e64, e64-inv |
| `DRPG.Investigation.newTraceTitle` | e64, e64-inv |
| `DRPG.Investigation.noneMatch` | e64, e64-inv |
| `DRPG.Investigation.notePlaceholder` | e64, e64-inv |
| `DRPG.Investigation.plannerIntro` | e64, e64-inv |
| `DRPG.Investigation.plannerIntro.other` | e64, e64-inv |
| `DRPG.Investigation.unidentified` | e64, e64-inv |
| `DRPG.Items.carriesNothing` | e101 |
| `DRPG.Items.giveNote` | e101 |
| `DRPG.Items.inStash` | e101 |
| `DRPG.Items.tabTake` | e101 |
| `DRPG.Items.takeNote` | e101 |
| `DRPG.Items.whichCharacterHub` | e101 |
| `DRPG.Mastermind` | e72 |
| `DRPG.Mastermind.alreadyDeadNote` | e72 |
| `DRPG.Mastermind.dialogTitle` | e72 |
| `DRPG.Mastermind.finalTruthReminder` | e72 |
| `DRPG.Mastermind.lairLabel` | e72 |
| `DRPG.Mastermind.noLair` | e72 |
| `DRPG.Mastermind.verdictBodyNote` | e72 |
| `DRPG.Mastermind.verdictIntro` | e72 |
| `DRPG.Mastermind.verdictNobody` | e72 |
| `DRPG.Mastermind.verdictOpen` | e72 |
| `DRPG.Mastermind.verdictTitle` | e72 |
| `DRPG.Messenger.tabChat` | e72 |
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
| `DRPG.Monokuma.isMonokuma` | e101 |
| `DRPG.Monokuma.marked` | e101 |
| `DRPG.Monokuma.noPool` | e101 |
| `DRPG.Monokuma.panelIntro` | e101 |
| `DRPG.Monokuma.panelNote` | e101 |
| `DRPG.Monokuma.pool` | e101 |
| `DRPG.Monokuma.saved` | e101 |
| `DRPG.Monokuma.sharedPool` | e101 |
| `DRPG.Monokuma.unmarked` | e101 |
| `DRPG.Move.cannotReach` | e100 |
| `DRPG.Move.freeAvailable` | e100 |
| `DRPG.Move.freeSpent` | e100 |
| `DRPG.Move.nextSprint` | e100 |
| `DRPG.Move.notConnectedShort` | e100 |
| `DRPG.Move.title` | e100 |
| `DRPG.Murder.actionBlocked` | e64 |
| `DRPG.Murder.actionDenied` | e64 |
| `DRPG.Murder.actionHindered` | e64 |
| `DRPG.Murder.briefCostStress` | e100 |
| `DRPG.Murder.briefRoll` | e100 |
| `DRPG.Murder.briefTake` | e100 |
| `DRPG.Murder.drainStopped` | e64 |
| `DRPG.Murder.failedNothing` | e64 |
| `DRPG.Murder.noRollNeeded` | e64 |
| `DRPG.Murder.notYourTurn` | e64 |
| `DRPG.Murder.offTurn` | e100 |
| `DRPG.Murder.onAMiss` | e100 |
| `DRPG.Murder.thresholdShort` | e64 |
| `DRPG.Murder.unlockedActions` | e64 |
| `DRPG.Murder.useItemFumbled` | e64 |
| `DRPG.Murder.useItemGone` | e64 |
| `DRPG.Murder.useItemWorked` | e64 |
| `DRPG.Notices.filter.evidence` | e100 |
| `DRPG.Notices.filter.messenger` | e100 |
| `DRPG.Notices.filter.notDone` | e100 |
| `DRPG.Notices.search` | e100 |
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
| `DRPG.Panel.checksImagesBytes` | e101 |
| `DRPG.Panel.checksImagesPixels` | e101 |
| `DRPG.Panel.doColumn` | e101, e72 |
| `DRPG.Panel.group` | e92, fervent-sagan-gme4vt |
| `DRPG.Panel.group.monokumas` | e92, fervent-sagan-gme4vt |
| `DRPG.Panel.group.notInClass` | e92, fervent-sagan-gme4vt |
| `DRPG.Panel.group.students` | e92, fervent-sagan-gme4vt |
| `DRPG.Panel.nextReady` | e92, fervent-sagan-gme4vt |
| `DRPG.Panel.openSheet` | e92, fervent-sagan-gme4vt |
| `DRPG.Panel.refundCrossing` | e72 |
| `DRPG.Panel.role` | e92, fervent-sagan-gme4vt |
| `DRPG.Panel.role.student` | e92, fervent-sagan-gme4vt |
| `DRPG.Panel.roleColumn` | e92, fervent-sagan-gme4vt |
| `DRPG.Panel.seasonChecks` | e101, e72 |
| `DRPG.Panel.whoIsAlive` | e101, e72 |
| `DRPG.Panel.whoIsAliveNote` | e101, e72 |
| `DRPG.Passage.engineOff` | e64 |
| `DRPG.Passage.list.cross` | e72 |
| `DRPG.Passage.list.oneWay` | e72 |
| `DRPG.Passage.list.walk` | e72 |
| `DRPG.Passage.show` | e72 |
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
| `DRPG.Project.collapseTray` | e100 |
| `DRPG.Project.declinedGm` | e100 |
| `DRPG.Project.declinedPlayer` | e100 |
| `DRPG.Project.descriptionTold` | e93 |
| `DRPG.Project.expandTray` | e100 |
| `DRPG.Project.kindOwn` | e93 |
| `DRPG.Project.preset.closeBreach` | e93 |
| `DRPG.Project.preset.repairItem` | e93 |
| `DRPG.Project.preset.sealPassage` | e93 |
| `DRPG.Project.proposalNotSent` | e93 |
| `DRPG.Project.proposalPlaceholder` | e93 |
| `DRPG.Project.proposalPrompt` | e93 |
| `DRPG.Project.proposalSent` | e93 |
| `DRPG.Project.proposeButton` | e100 |
| `DRPG.Project.proposerKnows` | e93 |
| `DRPG.Project.repairBroken` | e93 |
| `DRPG.Project.repairItemSummary` | e93 |
| `DRPG.Project.repairLabel` | e93 |
| `DRPG.Project.repairWorn` | e93 |
| `DRPG.Project.sealPassageSummary` | e93 |
| `DRPG.Remnant.cardFacts` | e64 |
| `DRPG.Remnant.cardPlayerHalf` | e64 |
| `DRPG.Remnant.cardUnread` | e93 |
| `DRPG.Remnant.discardNote` | e93 |
| `DRPG.Remnant.reinforcedColumn` | e64 |
| `DRPG.Remnant.tieOpen` | e64 |
| `DRPG.Remnant.tieTied` | e64 |
| `DRPG.Remnant.tieUntied` | e64 |
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
| `DRPG.Season.checkClean` | e101 |
| `DRPG.Season.checkRooms` | e101 |
| `DRPG.Season.fallsBackTo` | e101 |
| `DRPG.Season.hint.cast` | e101 |
| `DRPG.Season.hint.name` | e101 |
| `DRPG.Season.overflowNow` | e101 |
| `DRPG.Season.splitUneven` | e101 |
| `DRPG.Season.step` | e101 |
| `DRPG.Season.step.cast` | e101 |
| `DRPG.Season.step.monokumas` | e101 |
| `DRPG.Season.step.name` | e101 |
| `DRPG.Season.step.resources` | e101 |
| `DRPG.Season.step.ultimate` | e101 |
| `DRPG.Season.waitingForCast` | e101 |
| `DRPG.Settings.glassPulse.hint` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Settings.glassPulse.name` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Settings.highContrast.hint` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Settings.highContrast.name` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Settings.reducedMotion` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Settings.reducedMotion.hint` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.Settings.reducedMotion.name` | e61-62, e92, fervent-sagan-gme4vt |
| `DRPG.SettingsWindow.gameTitle` | e101 |
| `DRPG.SettingsWindow.glassOnly` | e101 |
| `DRPG.SettingsWindow.legacyOnly` | e101 |
| `DRPG.SettingsWindow.liveNote` | e101 |
| `DRPG.SettingsWindow.save` | e101 |
| `DRPG.SettingsWindow.scopeClient` | e101 |
| `DRPG.SettingsWindow.scopeWorld` | e101 |
| `DRPG.SettingsWindow.sections` | e101 |
| `DRPG.SettingsWindow.sections.audio` | e101 |
| `DRPG.SettingsWindow.sections.foundry` | e101 |
| `DRPG.SettingsWindow.sections.gm` | e101 |
| `DRPG.SettingsWindow.sections.look` | e101 |
| `DRPG.SettingsWindow.sections.privacy` | e101 |
| `DRPG.SettingsWindow.sections.rules` | e101 |
| `DRPG.SettingsWindow.sections.tech` | e101 |
| `DRPG.SheetNotes` | e101 |
| `DRPG.SheetNotes.fogBudget` | e92, fervent-sagan-gme4vt |
| `DRPG.SheetNotes.noExperiences` | e92, fervent-sagan-gme4vt |
| `DRPG.Trial.presentByButton` | e72 |
| `DRPG.Trial.presentNobody` | e72 |
| `DRPG.Trial.presentOnly` | e72 |
| `DRPG.Trial.presentWithAnalysis` | e72 |
| `DRPG.Trial.presentWithoutNote` | e72 |
| `DRPG.Trial.presented` | e72 |
| `DRPG.TruthBullet.analysisHeading` | e64, e64-inv |
| `DRPG.TruthBullet.analyzedText` | e64, e64-inv |
| `DRPG.TruthBullet.analyzedTextNote` | e64, e64-inv |
| `DRPG.TruthBullet.analyzedTextPlaceholder` | e64, e64-inv |
| `DRPG.TruthBullet.playerTextPlaceholder` | e64, e64-inv |
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
| `DRPG.Voice` | e72 |
| `DRPG.Voice.contested` | e72 |
| `DRPG.Voice.deadRoom` | e72 |
| `DRPG.Voice.held.deadAlone` | e92, fervent-sagan-gme4vt |
| `DRPG.Voice.held.eclipse` | e92, fervent-sagan-gme4vt |
| `DRPG.Voice.held.eclipseHeard` | e92, fervent-sagan-gme4vt |
| `DRPG.Voice.held.external` | e92, fervent-sagan-gme4vt |
| `DRPG.Voice.held.gmBlock` | e92, fervent-sagan-gme4vt |
| `DRPG.Voice.held.offline` | e92, fervent-sagan-gme4vt |
| `DRPG.Voice.mainRoom` | e72 |
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
- e64: 170-175; 1744-1749; 1746-1750; 1792-1797; 1859-1864; 3094-3098; 3118-3123; 3129-3134; 3207-3212; 3209-3213; 3331-3336; 3383-3388; 3509-3514; 3565-3570; 3583-3588; 3623-3628; 3646-3651; 3657-3662; 3668-3673; 3750-3755; 4047-4052; 4064-4069; 4066-4070; 4340-4347; 5087-5092
- e72: 2103-2108; 2106-2111; 2142-2147; 2299-2304; 2502-2507; 2647-2652; 3194-3198; 3195-3200; 3199-3204; 3225-3230
- e92: 243-247; 4885-4890; 4925-4930; 4927-4932
- e93: 1653-1658; 1656-1660; 1672-1677; 1675-1679; 1679-1683; 2081-2086; 2409-2414; 5072-5077
- fervent-sagan-gme4vt: 243-247; 2040-2045; 4901-4906; 4963-4968; 4965-4970; 5070-5075

## Sections frozen after this line edited them

Re-read at the fourth commit (12.11.2026): e61-62 (head b07dec9e) now inserts lines into three sections this line had
already edited in 11133b75. The edits do not touch the same lines, so the merge has no overlapping hunk:

| File | Section | This line's edit | e61-62's hunk (its merge base) |
| --- | --- | --- | --- |
| player-handbook.en.md, .pl.md | The Eclipse / Eclipse | lines 101-102 (T29 cuts) | insertion after line 110 |
| gm-handbook.pl.md | 4. Zegar | line 214 (GM-a) | insertion after line 231 |

No further edit goes into these sections.
