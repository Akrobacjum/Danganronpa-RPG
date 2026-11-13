# E57 coverage: UI names in the handbooks, and help on the controls

Commit 421f2395a43e62bbe5308ae83bd7d5376eacf280 (origin/main), module 1.2.109. Measured 12.11.2026, read-only: nothing in the repository was written; the scripts and their JSON output are in this directory (a.mjs, match.mjs, runA.mjs, scanB.mjs, report.mjs; surface-keys.json, a-results.json, b-controls.json, b-windows.json).

## A. UI names with no handbook mention

### A.1 Method

**Which keys.** The repository's own classification, rebuilt in memory exactly as `node tools/check.mjs text` builds it (check.mjs `text()`, lines 813-915): `tools/text-map.mjs` `buildScreenMap` over git's scripts/ (the suite's tests*.mjs out) with espree from audit/harness/node_modules, and `scripts/tests-text.mjs` `surfacesOf` over docs/text-budgets.json's rules; then `readerSplit`'s reader rule applied per key (gm when every screen saying the key is a GM's; player when one is a player's or "both"; unknown when only a file's own screen, reader unknown, says it; unassigned when no screen does). No file was written: text-map.mjs's CLI writes audit/harness/results/text/screens.json, so it was not run; its exported functions were called from a.mjs. The per-surface totals reproduce check.mjs's line exactly: button 17/11/0/0, window-title 36/103/65/10, tab 15/11/3/0, tooltip 3/44/6/1 (gm/player/unknown/unassigned) - 325 keys, of which the 54 tooltips are left out of A (they are sentences, not names; they are B's).

What the classification is: by the key's name alone (text-budgets.json rules): button = `(Button|\.button)$`, tab = `\.tab[A-Z]...$`, window-title = `(\.title|[a-z]Title)$`. So "window-title" includes chat-card headings (the budgets file says so itself) and a key such as `DRPG.Trial.objectionByButton` (a sentence about a button). And most real buttons are not "button" keys: a footer button labelled `DRPG.Dialog.save` or `DRPG.Vault.apply` has no surface (8942 of 11840 strings are unclassified, check.mjs T4). So the 28 button and 29 tab keys are a lower bound of the module's buttons and tabs, not the set.

**Settings.** Every `game.settings.register(MODULE_ID, SETTINGS.x, {...})` in scripts/settings.mjs with a `name:` (39: the 38 `DRPG.Settings.*.name` keys of en.json, all registered, and sfxVary's `DRPG.Sound.varyLabel`). Reader: scope "world" = gm (drawn in the GM's Game settings window), scope "client" = both (drawn in this browser's window), read off settings-window.mjs CLIENT_SECTIONS / GAME_SECTIONS (37 keys drawn: 12 client, 25 game; documentLanguage and bulletSort are registered and not drawn; the file's header says "the 35 settings").

**Which book.** gm -> docs/handbooks/gm-handbook.<lang>.md; player and both -> player-handbook.<lang>.md or player-brochure.<lang>.md; unknown and unassigned -> any of the three. English value against the .en book, Polish value against the .pl book.

**Matching rule (strict, the one the counts use).** Book text: markdown links reduced to their text, the characters * _ ` and \ removed (so bold, italics and code marks do not split a phrase), curly quotes to straight, U+2026 to "...", lower case, whitespace collapsed. Value: HTML tags removed, curly quotes straight, lower case, split at every `{placeholder}`; each piece trimmed of leading/trailing spaces, quotes, brackets and `: ; , . ! ? -`; pieces with fewer than 3 letters dropped. A key is **named** when every remaining piece occurs in its reader's book as a whole phrase (no letter or digit directly before or after it). A value with no piece left is "not measurable" (none occurred).

**Lenient rule (a second column only).** The same, or each word of 5+ letters cut to a stem (up to 3 letters off, at least 4 kept) with any ending, the words in order with only spaces or punctuation between. It is there for Polish inflection ("Sypialnie" in a heading vs "sypialni" in a sentence) and English plurals.

**Known false positives.** (1) One-word values ("Theme", "Language", "Fog", "Give", "Items", "Reveal") match any use of the word, not a mention of the control: every one-word strict match is counted as named but is weak - the counts table shows how many keys are one word. (2) A phrase that occurs in another sense ("End the chapter" as a sentence about the rules, not the button). (3) The reader rule: a key that one player screen says is "player" even when it is a GM's control in practice (Room Setup's `DRPG.Vault.tab*` tabs and Projects' `createButton` read as player because a shared screen also says them), so it is looked for in the player books. **Known false negatives.** (1) A handbook that names the control in other words ("the reset" for "Reset the season", "the GM panel" for "Danganronpa - GM Panel"). (2) Polish inflection under the strict rule (the lenient column catches some). (3) Long values (> 6 words, "sentence" in the table) that no handbook would quote verbatim. (4) Values with markup or a placeholder in the middle are split, and each piece must occur. (5) A key whose reader is player but which a GM's handbook names is counted unnamed (marked "in GM book" in the list).

### A.2 Counts

Named = strict rule, in the reader's own book. "1-word" and ">6 words" say how many of the row's keys are one word or a sentence (see the false positives and negatives).

| surface | reader | keys | EN named | EN not named | PL named | PL not named | both named | EN lenient | PL lenient | 1-word | >6 words |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| setting-name | gm | 26 | 23 | 3 | 18 | 8 | 18 | 23 | 21 | 0 | 10 |
| setting-name | both | 13 | 11 | 2 | 10 | 3 | 10 | 11 | 11 | 2 | 0 |
| window-title | gm | 36 | 20 | 16 | 22 | 14 | 19 | 20 | 23 | 2 | 0 |
| window-title | player | 103 | 48 | 55 | 47 | 56 | 45 | 50 | 55 | 19 | 6 |
| window-title | unknown | 65 | 37 | 28 | 38 | 27 | 33 | 39 | 41 | 8 | 5 |
| window-title | unassigned | 10 | 4 | 6 | 4 | 6 | 4 | 5 | 4 | 2 | 2 |
| button | gm | 17 | 16 | 1 | 16 | 1 | 16 | 16 | 16 | 2 | 0 |
| button | player | 11 | 2 | 9 | 2 | 9 | 2 | 3 | 4 | 1 | 2 |
| tab | gm | 15 | 11 | 4 | 12 | 3 | 11 | 11 | 12 | 6 | 0 |
| tab | player | 11 | 8 | 3 | 6 | 5 | 6 | 10 | 8 | 10 | 1 |
| tab | unknown | 3 | 3 | 0 | 3 | 0 | 3 | 3 | 3 | 3 | 0 |
| **all** | | **310** | **183** | **127** | **178** | **132** | **167** | 191 | 198 | 55 | 26 |

143 of 310 keys are not named in at least one language (strict). Settings alone: 39 registered names, 28 named in both languages; the 2 one-word names (Language, Theme) are weak matches.

### A.3 The keys not named (strict), by surface

EN / PL: "-" not named in the reader's book, "yes" named; "len" = the lenient rule finds it; "other book" = found (strict, EN) in the book of the other reader. Window titles include card headings (the classification's own caveat).

| surface | reader | key | English | Polish | EN | PL | other book |
| --- | --- | --- | --- | --- | --- | --- | --- |
| setting-name | gm | `DRPG.Settings.documentLanguage.name` | Document language | Język dokumentów | - | - |  |
| setting-name | gm | `DRPG.Settings.enforceAnonymity.name` | Keep character sheets anonymous | Anonimowe karty postaci | yes | - (len) |  |
| setting-name | gm | `DRPG.Settings.enforceIsoWelcome.name` | Keep Isometric Perspective's welcome window closed for everyone | Trzymaj okno powitalne Isometric Perspective za... | - | - |  |
| setting-name | gm | `DRPG.Settings.forcePrivateRolls.name` | Force private player rolls | Wymuszaj prywatne rzuty graczy | yes | - (len) |  |
| setting-name | gm | `DRPG.Settings.hideSystemFear.name` | Replace the Daggerheart Fear tracker | Zastąp licznik Fear z Daggerheart | yes | - (len) |  |
| setting-name | gm | `DRPG.Settings.lockRollDialog.name` | Lock the roll window for players | Zablokuj graczom okno rzutu | yes | - |  |
| setting-name | gm | `DRPG.Settings.roomVisibility.name` | Players only see who is in their room | Gracze widzą tylko osoby w swoim pokoju | yes | - |  |
| setting-name | gm | `DRPG.Settings.voiceEnabled.name` | Regional voice (needs LiveKit AVClient) | Głos per pokój (wymaga LiveKit AVClient) | - | - |  |
| setting-name | both | `DRPG.Settings.bulletSort.name` | How Truth Bullets are grouped | Jak grupowane są Truth Bullets | - | - |  |
| setting-name | both | `DRPG.Settings.debug.name` | Verbose console logging | Szczegółowe logi w konsoli | - | - | GM |
| setting-name | both | `DRPG.Settings.pixelFont.name` | Pixel font | Czcionka pikselowa | yes | - (len) | GM |
| window-title | gm | `DRPG.Case.backupTitle` | Back up the case | Kopia sprawy | yes | - (len) |  |
| window-title | gm | `DRPG.Case.castTitle` | The incident's cast | Obsada incydentu | - | yes |  |
| window-title | gm | `DRPG.Case.healthTitle` | The case on this browser | Sprawa w tej przeglądarce | - | - |  |
| window-title | gm | `DRPG.Case.restoreTitle` | Restore the case | Przywróć sprawę | - | - |  |
| window-title | gm | `DRPG.Chapter.promoteTitle` | Body found in {room} | Ciało znalezione: {room} | - | yes |  |
| window-title | gm | `DRPG.Floor.debateClosedTitle` | The debate is closed | Debata jest zamknięta | - | - |  |
| window-title | gm | `DRPG.Floor.incidentTitle` | An incident is still open | Incydent jest wciąż otwarty | - | - |  |
| window-title | gm | `DRPG.Investigation.deleteTraceTitle` | Delete the Remnant | Usuń Remnant | - | - |  |
| window-title | gm | `DRPG.Investigation.placeTitle` | Place this Key Remnant | Postaw ten Key Remnant | - | - |  |
| window-title | gm | `DRPG.Panel.title` | Danganronpa - GM Panel | Danganronpa - panel GM-a | - | - |  |
| window-title | gm | `DRPG.Passage.pick.title` | New secret passage | Nowe tajne przejście | - | yes |  |
| window-title | gm | `DRPG.Passage.pick.tunnelTitle` | New tunnel or stairs | Nowy tunel lub schody | - | - |  |
| window-title | gm | `DRPG.Passage.tab.deleteTitle` | Delete the secret passage | Usuń tajne przejście | - | - |  |
| window-title | gm | `DRPG.Season.reportCard.title` | The season reset did not finish | Reset sezonu się nie dokończył | - | - |  |
| window-title | gm | `DRPG.Season.resetGroupsTitle` | What goes, and what stays | Co znika, a co zostaje | - | - |  |
| window-title | gm | `DRPG.Tables.placeTitle` | Where does {name} live? | Gdzie mieszka {name}? | - | - |  |
| window-title | gm | `DRPG.Vault.inspectTitle` | Look inside the stashes | Zajrzyj do skrytek | - | - |  |
| window-title | player | `DAGGERHEART.APPLICATIONS.Countdown.removeCountdownTitle` | Remove Project | Usuń projekt | - | - |  |
| window-title | player | `DAGGERHEART.APPLICATIONS.CountdownEdit.editTitle` | Edit Projects | Edytuj projekty | - | - |  |
| window-title | player | `DAGGERHEART.APPLICATIONS.CountdownEdit.removeCountdownTitle` | Remove Project | Usuń projekt | - | - |  |
| window-title | player | `DAGGERHEART.APPLICATIONS.CountdownEdit.title` | Project Edit | Edycja projektu | - | - |  |
| window-title | player | `DRPG.Advance.chatTitle` | Level Up #{n} | Level Up nr {n} | - (len) | - |  |
| window-title | player | `DRPG.Advance.offerTitle` | A Level Up is yours to spend | Masz Level Up do wykorzystania | - | - |  |
| window-title | player | `DRPG.Advance.queueTitle` | The class's Level Ups | Level Upy klasy | - | - | GM |
| window-title | player | `DRPG.Analyze.critTitle` | Critical Analyze | Krytyczne Analyze | - | - |  |
| window-title | player | `DRPG.Analyze.failedTitle` | You get nowhere | Donikąd | - | - |  |
| window-title | player | `DRPG.Analyze.identifiedTitle` | Identified | Zidentyfikowano | yes | - | GM |
| window-title | player | `DRPG.Anonymity.audit.title` | Sheet Anonymity Audit | Kontrola anonimowości arkuszy | - | - |  |
| window-title | player | `DRPG.Audit.awayTitle` | Sheet changes made while no GM was watching | Zmiany na kartach postaci zrobione, gdy żaden G... | - | - | GM |
| window-title | player | `DRPG.Bridge.replyTitle` | Reply to {name} | Odpowiedz: {name} | - | - (len) |  |
| window-title | player | `DRPG.Calls.approveTitle` | {call} - does it apply? | {call} - czy się stosuje? | - | - |  |
| window-title | player | `DRPG.Calls.armedTitle` | A Call was made for you | Ktoś użył Calla dla ciebie | - | - |  |
| window-title | player | `DRPG.Chapter.deadPanelTitle` | You are dead | Nie żyjesz | - | - (len) |  |
| window-title | player | `DRPG.Chapter.deathTitle` | A character dies | Postać umiera | - | - | GM |
| window-title | player | `DRPG.Chapter.endTitle` | End the chapter | Zakończ rozdział | - | - (len) | GM |
| window-title | player | `DRPG.Chapter.stageSixTitle` | That was the victim of the incident | To była ofiara incydentu | - | - |  |
| window-title | player | `DRPG.Cleanup.reshapeRulingTitle` | A Remnant made to read differently | Remnant, który ma czytać się inaczej | - | - |  |
| window-title | player | `DRPG.Cleanup.transformTitle` | A clean job | Czysta robota | - | - |  |
| window-title | player | `DRPG.Frisk.askTitle` | Turn out your pockets? | Pokażesz kieszenie? | - | - |  |
| window-title | player | `DRPG.Loot.coverTitle` | Take from the body - Shadow | Zabranie z ciała - Shadow | - | - |  |
| window-title | player | `DRPG.Loot.rollTitle` | Take from the body - Hand | Zabranie z ciała - Hand | - | - |  |
| window-title | player | `DRPG.Mastermind.verdictTitle` | Final Trial verdict | Werdykt Final Trial | - | - (len) | GM |
| window-title | player | `DRPG.Messenger.gmActionTitle` | Waiting on your ruling | Czeka na twoją decyzję | - | - |  |
| window-title | player | `DRPG.Murder.afterTitle` | The incident is over - what now | Incydent zakończony - co teraz | - | - | GM |
| window-title | player | `DRPG.Murder.criticalChoiceTitle` | A clean hit | Czyste trafienie | - | - |  |
| window-title | player | `DRPG.Murder.crowdedTitle` | Too many people | Za dużo osób | - | - |  |
| window-title | player | `DRPG.Murder.escapeTitle` | They got away | Uciekli | - | - (len) |  |
| window-title | player | `DRPG.Murder.openedTitle` | Murder opened | Morderstwo otwarte | - | - |  |
| window-title | player | `DRPG.Murder.ranOutTitle` | They ran out | Skończyły się siły | - | - |  |
| window-title | player | `DRPG.Murder.thirdTitle` | You walk in on it | Wchodzisz na to | yes | - |  |
| window-title | player | `DRPG.Murder.tierZeroTitle` | Tier 0 weapon - your ruling | Broń Tier 0 - twoja decyzja | - | - |  |
| window-title | player | `DRPG.Murder.trackerTitle` | Incident tracker | Śledzenie incydentu | - | - | GM |
| window-title | player | `DRPG.Notices.clearTitle` | Clear the notice history? | Wyczyścić historię powiadomień? | - | - |  |
| window-title | player | `DRPG.Observe.anythingTitle` | Observe - a question for the GM | Observe - pytanie do GM-a | - | - |  |
| window-title | player | `DRPG.Observe.cardTitle` | Observe - focus your gaze | Observe - skupione spojrzenie | - | - |  |
| window-title | player | `DRPG.Observe.describeTitle` | Observe - what do they see? | Observe - co widać? | - | - |  |
| window-title | player | `DRPG.Observe.failedTitle` | You find nothing | Nic nie znajdujesz | - | - |  |
| window-title | player | `DRPG.Observe.pickTitle` | Observe - which Remnant? | Observe - który Remnant? | - | - |  |
| window-title | player | `DRPG.Observe.projectFoundTitle` | Something here is not what it looks like | Coś tu nie jest tym, na co wygląda | - | - |  |
| window-title | player | `DRPG.Passage.card.repickTitle` | {name}: choose the target again | {name}: wybierz cel ponownie | - | - | GM |
| window-title | player | `DRPG.Project.createTitle` | Create a project | Utwórz projekt | - | - | GM |
| window-title | player | `DRPG.Project.editTitle` | Edit project | Edytuj projekt | - | - | GM |
| window-title | player | `DRPG.Project.shareTitle` | Share a secret project | Udostępnij tajny projekt | - | - |  |
| window-title | player | `DRPG.Project.trapReadyTitle` | The trap is ready | Pułapka gotowa | - | - |  |
| window-title | player | `DRPG.Rules.sheetTitle` | Monokuma's rules | Zasady Monokumy | - | yes |  |
| window-title | player | `DRPG.Safeword.gmTitle` | Safeword - GM only | Safeword - tylko GM | - | - |  |
| window-title | player | `DRPG.Steal.chooseTitle` | Take your pick | Wybieraj | - | - (len) |  |
| window-title | player | `DRPG.TraitRuling.title` | Which statistic? | Która statystyka? | yes | - (len) | GM |
| window-title | player | `DRPG.Trap.armedTitle` | The trap is watching | Pułapka czuwa | - | - |  |
| window-title | player | `DRPG.Trial.logTitle` | Trial evidence log | Dziennik dowodów Class Trial | - | - | GM |
| window-title | player | `DRPG.Trial.objectionPickTitle` | OBJECTION! - choose your Truth Bullet | OBJECTION! - wybierz swój Truth Bullet | - | - |  |
| window-title | player | `DRPG.Vault.rifleTitle` | The stash in {room} | Skrytka w: {room} | - | yes |  |
| window-title | player | `DRPG.Vote.ballotTitle` | Who did it? | Kto to zrobił? | - | - | GM |
| window-title | player | `DRPG.Vote.blackenedRuleTitle` | The Blackened's new rule | Nowa zasada Blackened | - | - |  |
| window-title | player | `DRPG.Zones.findings.title` | Findings | Findings | - (len) | - (len) | GM |
| window-title | unknown | `DRPG.Action.murderOpensTitle` | A killing in the dark | Zabójstwo w ciemności | - | - |  |
| window-title | unknown | `DRPG.Audit.listTitle` | Writes on a student's sheet the GMs put back, flagged or listed: {n} | Zapisy na kartach postaci cofnięte, zgłoszone l... | - | - |  |
| window-title | unknown | `DRPG.CaseRealize.askTitle` | The case's realization | Realizacja sprawy | - | - |  |
| window-title | unknown | `DRPG.CaseRealize.title` | Realization of the case, chapter {chapter} | Realizacja sprawy, rozdział {chapter} | - | - |  |
| window-title | unknown | `DRPG.CaseSummary.previewTitle` | The case's summary | Podsumowanie sprawy | - | - |  |
| window-title | unknown | `DRPG.CaseSummary.title` | Chapter {chapter}: how the case was solved | Rozdział {chapter}: jak rozwiązano sprawę | - | - |  |
| window-title | unknown | `DRPG.Clock.chapterCorrectTitle` | Correct the chapter number | Popraw numer rozdziału | - | - |  |
| window-title | unknown | `DRPG.Clock.trialFromEditTitle` | Open the Class Trial | Otwórz Class Trial | - | - |  |
| window-title | unknown | `DRPG.DhSettings.title` | Character settings | Ustawienia postaci | - | - |  |
| window-title | unknown | `DRPG.Events.incidentTitle` | A killing in the dark | Zabójstwo w ciemności | - | - |  |
| window-title | unknown | `DRPG.Events.openingTitle` | A murder is under way | Trwa morderstwo | - | yes |  |
| window-title | unknown | `DRPG.Events.voteTitle` | The vote is open | Głosowanie otwarte | yes | - (len) |  |
| window-title | unknown | `DRPG.Explain.projects.title` | What a project is | Czym jest projekt | - | yes |  |
| window-title | unknown | `DRPG.Floor.gmStepTitle` | The GM steps in | GM wkracza | - | - |  |
| window-title | unknown | `DRPG.Handover.giveTitle` | Hand over - {name} | Przekaż - {name} | - | yes |  |
| window-title | unknown | `DRPG.Overflow.cardTitle` | The Despair overflows | Despair się przelewa | - (len) | - |  |
| window-title | unknown | `DRPG.Remnant.authorReplaceTitle` | Who left this trace | Kto zostawił ten ślad | - | - |  |
| window-title | unknown | `DRPG.Requirements.newerSystemTitle` | {system} is newer than this module has been measured on | {system} jest nowszy niż wersja, na której ten ... | - | - |  |
| window-title | unknown | `DRPG.Requirements.title` | Danganronpa RPG is not running | Danganronpa RPG nie działa | - | - |  |
| window-title | unknown | `DRPG.Rolls.awayTitle` | Rolls made while no GM was connected | Rzuty wykonane bez połączonego GM-a | yes | - |  |
| window-title | unknown | `DRPG.Rolls.flagsTitle` | Drawn rolls with something the GM did not expect: {n} | Wylosowane rzuty z czymś, czego GM się nie spod... | - | - |  |
| window-title | unknown | `DRPG.Rooms.reportTitle` | Rooms marked | Oznaczone pokoje | yes | - (len) |  |
| window-title | unknown | `DRPG.Sequence.dayEndTitle` | End of day {day} | Koniec dnia {day} | - (len) | yes |  |
| window-title | unknown | `DRPG.SettingsWindow.gameTitle` | Game settings | Ustawienia gry | - | yes |  |
| window-title | unknown | `DRPG.Summary.title` | The time of day is over | Pora dnia dobiegła końca | - | - |  |
| window-title | unknown | `DRPG.TraitRuling.changedTitle` | The GM changed the statistic | GM zmienił statystykę | - | - |  |
| window-title | unknown | `DRPG.Trap.plantTitle` | Leave something behind | Zostaw coś po sobie | - | - |  |
| window-title | unknown | `DRPG.TruthBullet.migratedTitle` | Truth Bullets brought up to date | Truth Bullets zaktualizowane | - | - |  |
| window-title | unknown | `DRPG.Zones.dive.editor.deleteTitle` | Delete a Logic Dive set | Usuwanie zestawu Logic Dive | - | - |  |
| window-title | unknown | `DRPG.Zones.dive.editor.editTitle` | Edit a Logic Dive set | Edycja zestawu Logic Dive | - | - |  |
| window-title | unknown | `DRPG.Zones.dive.editor.listTitle` | Logic Dive sets | Zestawy Logic Dive | yes | - (len) |  |
| window-title | unknown | `DRPG.Zones.dive.editor.newTitle` | New Logic Dive set | Nowy zestaw Logic Dive | - | - |  |
| window-title | unassigned | `DRPG.Fog.check.isolated.title` | No way out: no room beside it | Brak wyjścia: żadnego pokoju obok | - | - |  |
| window-title | unassigned | `DRPG.Fog.check.overlap.title` | Rooms overlap | Pokoje na siebie nachodzą | - (len) | - |  |
| window-title | unassigned | `DRPG.Fog.check.sealed.title` | No way out: walled all round | Brak wyjścia: ściany dookoła | - | - |  |
| window-title | unassigned | `DRPG.Overflow.explainTitle` | What is despair overflow | Czym jest Despair overflow | - | - |  |
| window-title | unassigned | `DRPG.Remnant.foundTitle` | A trace was copied, and nobody has said what it is | Skopiowano ślad, a nikt nie powiedział, czym jest | - | - |  |
| window-title | unassigned | `DRPG.Trap.alertTitle` | {name} - something set it off | {name} - coś ją odpaliło | - | - |  |
| button | gm | `DRPG.Zones.findings.button` | Findings ({n}) | Findings ({n}) | - | - |  |
| button | player | `DRPG.Chapter.endButton` | End chapter {n} | Zakończ rozdział {n} | - | - (len) |  |
| button | player | `DRPG.Murder.betrayalButton` | {third} turns on the killer | {third} zwraca się przeciw zabójcy | - (len) | - |  |
| button | player | `DRPG.Project.approveButton` | Review and approve | Przejrzyj i zatwierdź | - | - |  |
| button | player | `DRPG.Project.createButton` | Create project | Utwórz projekt | - | - | GM |
| button | player | `DRPG.Project.declineButton` | Turn it down | Odrzuć | - | - (len) |  |
| button | player | `DRPG.Project.proposeButton` | Send it to the GM | Wyślij do GM-a | - | - |  |
| button | player | `DRPG.Project.revokeButton` | Revoke access | Cofnij dostęp | - | - |  |
| button | player | `DRPG.Trial.objectionByButton` | An Objection is raised with OBJECTION! on the HUD, not from the she... | Objection wnosi się przyciskiem OBJECTION! na H... | - | - |  |
| button | player | `DRPG.Trial.presentByButton` | Evidence is presented with Present on your sheet, and the GM's brow... | Dowody przedstawia się przyciskiem Present na k... | - | - |  |
| tab | gm | `DRPG.Items.tabCreateNew` | Create new | Utwórz nowy | - | - |  |
| tab | gm | `DRPG.Items.tabGiveExisting` | Give existing | Daj istniejący | - | - |  |
| tab | gm | `DRPG.Items.tabTake` | Take away | Zabierz | - | yes |  |
| tab | gm | `DRPG.TruthBullet.tabWriteNew` | Write a new one | Napisz nowy | - | - |  |
| tab | player | `DRPG.Redacted.tabLocked` | Theirs to tell you, not yours to read. | To oni mają ci powiedzieć, nie ty przeczytać. | - | - |  |
| tab | player | `DRPG.Vault.tabFog` | Fog | Mgła | yes | - | GM |
| tab | player | `DRPG.Vault.tabRest` | Rests | Odpoczynki | - (len) | - (len) | GM |
| tab | player | `DRPG.Vault.tabScenes` | Scenes | Sceny | - (len) | - (len) | GM |
| tab | player | `DRPG.Vault.tabSearching` | Searching | Przeszukiwanie | yes | - | GM |

Weak strict matches (one-word values counted as named in EN, 52): `DRPG.Settings.language.name` "Language", `DRPG.Settings.theme.name` "Theme", `DRPG.Vault.tabBedrooms` "Bedrooms", `DRPG.Vault.tabDoors` "Doors", `DRPG.Vault.tabPassages` "Passages", `DRPG.Vault.tabSearching` "Searching", `DRPG.Vault.tabStashes` "Stashes", `DRPG.Vault.tabDescription` "Description", `DRPG.Vault.tabFog` "Fog", `DRPG.Project.manageTitle` "Projects", `DRPG.Sound.title` "Sound", `DRPG.Murder.openTitle` "Murder", `DRPG.Investigation.dashboardTitle` "Investigation", `DRPG.Items.hubButton` "Items", `DRPG.Reveal.button` "Reveal", `DRPG.Floor.overrule.title` "Overrule", `DRPG.Frisk.noticeTitle` "Frisk", `DRPG.Investigation.tabTraces` "Remnants", `DRPG.Analyze.identifiedTitle` "Identified", `DRPG.Items.tabGive` "Give", `DRPG.Items.lostTitle` "Taken", `DRPG.Project.shareButton` "Share…", `DRPG.Project.title` "Project", `DRPG.Project.doneTitle` "Finished", `DRPG.Murder.betrayalTitle` "Betrayal", `DRPG.Items.useTitle` "Use {item}", `DRPG.Safeword.title` "Safeword", `DRPG.Handbooks.title` "Handbooks", `DRPG.Messenger.tabChat` "Chat", `DRPG.Messenger.rosterTitle` "Messenger", `DRPG.Despair.tabPools` "Pools", `DRPG.Despair.tabMonokumas` "Monokumas", `DRPG.Despair.tabStudents` "Students", `DRPG.Despair.tabOverflow` "Overflow", `DRPG.Action.panelTitle` "Actions", `DRPG.Monocub.panelTitle` "Monocub", `DRPG.Explain.phase.eclipseTitle` "Eclipse", `DAGGERHEART.APPLICATIONS.Countdown.title` "{type} Projects", `DAGGERHEART.APPLICATIONS.CountdownEdit.viewTitle` "Projects", `DAGGERHEART.UI.Countdowns.title` "Projects", `DRPG.Explain.status.actionsTitle` "Actions", `DRPG.Explain.status.hopeTitle` "Hope", `DRPG.Motive.title` "Motive", `DRPG.Monocub.manageTitle` "Monocubs", `DRPG.Move.title` "Move", `DRPG.Reroll.title` "Reroll", `DRPG.Sequence.dayTitle` "Day {day}", `DRPG.Sound.tabPlay` "Play", `DRPG.Sound.tabMusic` "Music", `DRPG.Sound.tabEffects` "Effects", `DRPG.CaseMap.summaryTitle` "Chapter {chapter}", `DRPG.Look.title` "Settings".

## B. Contextual help and tooltips on controls

### B.1 Method

A static scan of every module script (git's scripts/*.mjs, the suite's tests*.mjs out; scanB.mjs), comments blanked first. **A control** is one markup or code site that draws one: a raw `<button`, `<select`, `<textarea`, `<input` (type="hidden" left out; checkbox/radio counted apart), an element with `role="tab"`; a kit builder call (`toggle`, `stepper`, `iconButton`, `chip`, `roleButton`, `launcher`, `kitTabs`/`kitTabBar` - one tab bar); each `{ ... label: ... }` object in a `footer: {...}` (the kit's footer buttons) and in a `buttons: [...]` array (a DialogV2's own); each footer's closing word (`close: "close"|"cancel"`, which the kit draws with no tooltip by design); `document.createElement("button"|"input"|"select"|"textarea")`. **A tooltip** is `data-tooltip`, `data-tooltip-text`, `title=`/`title:`, `tooltip:` (the kit's footer and dataTable column option), `aria-describedby`, `.title =`, `dataset.tooltip` or `setAttribute("title")` in the tag or builder arguments (for a createElement, in its next 14 source lines). `iconButton` and `launcher` always carry one, and it is the control's name repeated, not an explanation ("name only"). "Conditional" = every tooltip attribute in the tag sits inside a `${... ? ... : ""}` (mostly: only when disabled, with the reason). `aria-label` alone is a name, not help, and is counted apart. **A hint line** = within 3 source lines of the control, a `drpg-help` paragraph, `helpText(`, a `*-hint` class, a `...Hint`/`.hint` key or a `class="notes"` second line - a proximity heuristic, not a rendered check.

**What this counts and what it does not.** A site is counted once however many times it is drawn: Room Setup's per-room row is one set of controls for every room, the GM panel's 17 tiles are one `<button` in `tileHtml` (gm-panel.mjs:498; 17 `labelKey` items, 2 with a `disabledReason` drawn as title only when disabled, 1 with a subtitle line). Clickable `<a>`, `<img>`, `<span>`/`<div>` with a data-action or role="button" are not counted; nor are Daggerheart's or Foundry's own controls on the sheets and windows the module dresses. Footer button objects with a nested brace (e.g. trial-floor-ui.mjs:1465's spread with a `tooltip:`) are missed. The label key is the first `DRPG.*` key in the tag/arguments, else in the 160 characters before it; "(variable)" when the label comes from a variable. Precision was checked by hand on room-setup.mjs (18 sites found; the image-picker's title at :363 on an `<img>`-like element was missed) and on gm-panel.mjs; no other file was hand-checked. Treat the numbers as +-10%.

### B.2 Per window file

"windows at" = the lines where the file builds a window (`drpgWindow(`, a class extending DrpgApp/ApplicationV2, a DialogV2 call). Files with controls and no window draw into another surface (the sheet, the HUD, a chat card, a tray).

| file | windows at | controls | closing words | tooltip (always) | of which name only | tooltip (conditional) | hint line near | aria-label only | none |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| action-analyze.mjs | - | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| action-dynamic.mjs | 323 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| action-listen.mjs | - | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 2 |
| action-menus.mjs | - | 6 | 0 | 0 | 0 | 0 | 3 | 0 | 3 |
| action-murder.mjs | - | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| action-project.mjs | 254, 894 | 12 | 3 | 0 | 0 | 0 | 4 | 0 | 8 |
| action-search.mjs | - | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| action-tamper.mjs | - | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| anonymity.mjs | - | 4 | 0 | 2 | 0 | 0 | 0 | 1 | 2 |
| boundary.mjs | 163, 205, 498, 580 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| call-gm.mjs | - | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 2 |
| call-pickers.mjs | 102 | 7 | 0 | 0 | 0 | 0 | 3 | 0 | 4 |
| calls.mjs | - | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| case-map.mjs | - | 12 | 0 | 4 | 0 | 0 | 0 | 1 | 8 |
| case-realize.mjs | 75, 191 | 3 | 2 | 0 | 0 | 0 | 0 | 1 | 3 |
| case-summary.mjs | 85 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| chapter.mjs | 753, 866, 1698, 2126, 2701 | 14 | 5 | 0 | 0 | 0 | 3 | 0 | 11 |
| cleanup.mjs | 744, 1323, 3345, 3438 | 8 | 3 | 0 | 0 | 0 | 2 | 0 | 6 |
| despair.mjs | - | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| diagnostics.mjs | 2191 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| dice-look.mjs | 504 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| eclipse.mjs | 933 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| enforced.mjs | 954, 996 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 1 |
| explain.mjs | 51 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| fog-diagnostics.mjs | - | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| fog.mjs | - | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| foundry-windows.mjs | - | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 0 |
| frisk.mjs | 1077, 1114 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| gm-campaign.mjs | 65, 214 | 10 | 2 | 0 | 0 | 0 | 2 | 0 | 8 |
| gm-items.mjs | 226, 351, 850, 1271, 1355, 1483 | 34 | 5 | 2 | 0 | 0 | 6 | 0 | 26 |
| gm-panel.mjs | 568, 750 | 8 | 2 | 3 | 1 | 0 | 0 | 0 | 5 |
| gm-stores.mjs | 2357, 2455, 2490, 2550 | 11 | 3 | 0 | 0 | 0 | 0 | 0 | 11 |
| gm-students.mjs | 501 | 13 | 1 | 4 | 3 | 0 | 0 | 2 | 9 |
| gm-team-dialog.mjs | 287 | 7 | 0 | 0 | 0 | 1 | 1 | 3 | 5 |
| handbooks.mjs | 222 | 2 | 0 | 1 | 0 | 0 | 0 | 0 | 1 |
| handover.mjs | 70 | 2 | 1 | 0 | 0 | 0 | 1 | 0 | 1 |
| hud.mjs | - | 3 | 0 | 2 | 0 | 0 | 0 | 0 | 1 |
| investigation.mjs | 1047, 1322, 1443, 2999 | 67 | 4 | 0 | 0 | 0 | 8 | 0 | 59 |
| level-up.mjs | 581, 1222 | 8 | 1 | 0 | 0 | 0 | 0 | 1 | 8 |
| mastermind.mjs | 617 | 6 | 1 | 0 | 0 | 0 | 3 | 0 | 3 |
| messenger-app.mjs | 149, 811, 1116 | 10 | 2 | 1 | 0 | 0 | 0 | 1 | 9 |
| monocub.mjs | 791 | 7 | 1 | 1 | 0 | 0 | 1 | 2 | 5 |
| murder-rules.mjs | 835, 1412, 3631, 4041, 4078 | 9 | 3 | 0 | 0 | 0 | 1 | 0 | 8 |
| murder-ui.mjs | 208, 730 | 4 | 1 | 0 | 0 | 0 | 1 | 0 | 3 |
| observe.mjs | 607, 1165 | 7 | 0 | 0 | 0 | 0 | 2 | 0 | 5 |
| overflow.mjs | - | 4 | 0 | 0 | 0 | 0 | 2 | 0 | 2 |
| palm.mjs | 476 | 6 | 1 | 0 | 0 | 0 | 2 | 0 | 4 |
| passages-gm.mjs | 2718 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| passages-tab.mjs | 260 | 6 | 1 | 2 | 0 | 0 | 2 | 0 | 2 |
| popup.mjs | - | 2 | 0 | 0 | 0 | 0 | 0 | 1 | 2 |
| projects-map.mjs | - | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| projects-tray.mjs | - | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| projects-ui.mjs | 619, 1061, 1304, 1611 | 32 | 4 | 4 | 1 | 0 | 6 | 4 | 22 |
| remnant-ring.mjs | - | 5 | 0 | 0 | 0 | 0 | 1 | 2 | 4 |
| requirements.mjs | 118, 391 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| rest.mjs | 338 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 2 |
| roll-draw.mjs | - | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| room-setup.mjs | 1235 | 17 | 1 | 5 | 1 | 0 | 1 | 2 | 11 |
| room-tile.mjs | 387 | 4 | 0 | 2 | 0 | 0 | 0 | 1 | 2 |
| rules.mjs | 490 | 5 | 1 | 0 | 0 | 0 | 4 | 0 | 1 |
| safeword.mjs | 393 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| season-setup.mjs | 1146, 1249, 1328, 1350 | 6 | 4 | 0 | 0 | 0 | 2 | 0 | 4 |
| season-wipe.mjs | 284 | 4 | 1 | 0 | 0 | 0 | 0 | 0 | 4 |
| settings-window.mjs | - | 6 | 2 | 0 | 0 | 0 | 2 | 0 | 4 |
| sfx.mjs | - | 7 | 0 | 5 | 3 | 0 | 2 | 0 | 0 |
| sheet-audit.mjs | - | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| sheet.mjs | - | 20 | 0 | 11 | 0 | 0 | 0 | 0 | 9 |
| sound-panel.mjs | 54, 354 | 6 | 2 | 0 | 0 | 0 | 2 | 1 | 4 |
| stash-reach.mjs | 320, 806 | 2 | 2 | 0 | 0 | 0 | 1 | 0 | 1 |
| tables-editor.mjs | 92, 606, 1638 | 24 | 3 | 3 | 0 | 1 | 2 | 2 | 18 |
| trait-ruling.mjs | 326, 378 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| traps.mjs | 648 | 2 | 1 | 0 | 0 | 0 | 2 | 0 | 0 |
| trial-floor-ui.mjs | 151, 231, 266, 333, 406, 600, 986, 1602, 1950 | 18 | 7 | 0 | 0 | 2 | 5 | 0 | 11 |
| trial-scene.mjs | - | 8 | 0 | 1 | 0 | 0 | 1 | 0 | 6 |
| trial-zones-ui.mjs | 185, 275, 327, 370, 383, 431 | 21 | 6 | 0 | 0 | 0 | 2 | 0 | 19 |
| trial.mjs | 191, 1370, 1420, 1514, 1663 | 9 | 4 | 0 | 0 | 0 | 3 | 0 | 6 |
| ui-columns.mjs | 66 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| use-items.mjs | 635 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 2 |
| verdict.mjs | 179, 317, 1062 | 7 | 3 | 0 | 0 | 0 | 4 | 0 | 3 |
| voice-panel.mjs | - | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| voice-tile.mjs | - | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| vote.mjs | 825 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| **all** | | **542** | 101 | **56** | 10 | 4 | **87** | 25 | **395** |

ui-kit.mjs is left out (its 13 raw tags are the builders' own markup, counted at each call site instead; B.4 says what each builder carries). Known misses of the proximity rule: settings-window.mjs's rows build their control (toggle, stepper, select) in one helper and the hint line in `settingRowHtml` (:159-176) more than 3 lines away, so its "none" of 4 are in fact hinted - every one of the 37 drawn settings has its hint line (B.6). Files with "-" under windows draw into a window built elsewhere (settings-window.mjs through ui-columns.mjs `wideWindow`) or into no window (the sheet, the HUD, cards, trays).

"controls" excludes the closing words; "none" = no tooltip of any kind and no hint line near (aria-label-only sites included in it). By kind (all sites, closing words in): select 5/126, footer:close 0/101, footer 0/98, button 17/80, input:check 1/60, input 3/56, textarea 0/35, dom:button 22/34, kit:stepper 0/14, kit:tabbar 0/10, kit:iconButton 8/8, kit:roleButton 1/5, kit:toggle 0/5, dom:input 1/4, kit:launcher 2/4, dom:textarea 0/2, dom:select 0/1 (with a tooltip / sites).

### B.3 Controls with neither a tooltip nor a hint line near, by file

`line key`; "(variable)" = the label is not a literal key at the site. Closing words left out.

- **scripts/action-analyze.mjs** (1): 477 select DRPG.Analyze.whichBullet
- **scripts/action-dynamic.mjs** (3): 334 select DRPG.Action.difficulty; 336 select DRPG.Advance.whichTrait; 347 footer DRPG.Action.dynamicRefuse
- **scripts/action-listen.mjs** (2): 85 select DRPG.Listen.prompt; 88 footer DRPG.Action.roll
- **scripts/action-menus.mjs** (3): 352 button DRPG.Kit.details; 516 textarea (variable); 528 footer DRPG.Action.murderParkedConfirm
- **scripts/action-murder.mjs** (1): 259 footer DRPG.Dialog.yes
- **scripts/action-project.mjs** (8): 149 select DRPG.Project.whichWork; 154 select DRPG.Project.whichSabotage; 263 input DRPG.Project.namePlaceholder; 265 select DRPG.Project.scale; 266 select DRPG.Project.room; 267 select DRPG.Project.trait; 901 footer DRPG.TraitRuling.propose; 924 select (variable)
- **scripts/action-search.mjs** (1): 933 textarea DRPG.Action.goalSpecificPlaceholder
- **scripts/action-tamper.mjs** (3): 126 select DRPG.Tamper.whichTrace; 131 select DRPG.Tamper.whichTrace; 135 select DRPG.Cleanup.trailWho
- **scripts/anonymity.mjs** (2): 310 dom:input (variable); 821 button DRPG.Anonymity.audit.fix
- **scripts/boundary.mjs** (3): 168 footer (variable); 218 footer DRPG.Eclipse.endAndAdvance; 219 footer DRPG.Eclipse.endOnly
- **scripts/call-gm.mjs** (2): 792 button (variable); 1202 textarea (variable)
- **scripts/call-pickers.mjs** (4): 255 footer DRPG.Calls.next; 281 textarea DRPG.Motive.demandPlaceholder; 489 select (variable); 490 footer DRPG.Calls.next
- **scripts/calls.mjs** (3): 707 textarea DRPG.Calls.tellGmPlaceholder; 796 footer DRPG.Calls.approveYes; 797 footer DRPG.Calls.approveNo
- **scripts/case-map.mjs** (8): 108 button DRPG.CaseMap.hasProblem; 183 button DRPG.CaseMap.unrelated; 236 button (variable); 263 button DRPG.CaseMap.noSchema; 332 button (variable); 353 button DRPG.CaseMap.zoomLevel; 492 button DRPG.CaseMap.showOnMap; 493 button DRPG.CaseMap.showOnMap
- **scripts/case-realize.mjs** (3): 57 select DRPG.CaseRealize.colRoom; 195 footer DRPG.CaseRealize.notNow; 196 footer DRPG.CaseRealize.showPreview
- **scripts/case-summary.mjs** (1): 89 footer DRPG.CaseSummary.send
- **scripts/chapter.mjs** (11): 749 select DRPG.Chapter.whoDied; 759 checkbox (variable); 858 checkbox (variable); 875 footer DRPG.Chapter.promoteConfirm; 1704 select DRPG.Chapter.whereBody; 1706 select DRPG.Chapter.whoseBody; 2002 checkbox (variable); 2023 checkbox DRPG.Chapter.optEndTrial; 2028 checkbox DRPG.Chapter.lastChapter; 2709 footer DRPG.Chapter.finishEnd; 2710 footer DRPG.Chapter.dropRest
- **scripts/cleanup.mjs** (6): 763 footer DRPG.Cleanup.transformErase; 790 input DRPG.Cleanup.reshapeNamePlaceholder; 793 textarea DRPG.Cleanup.reshapeTextPlaceholder; 3356 select DRPG.Cleanup.bareHands; 3359 footer DRPG.Cleanup.confirm; 3453 footer DRPG.Cleanup.moveConfirm
- **scripts/diagnostics.mjs** (1): 2212 footer DRPG.Diagnose.copy
- **scripts/enforced.mjs** (1): 1002 footer DRPG.GiveBack.holdAgain
- **scripts/fog-diagnostics.mjs** (1): 702 button (variable)
- **scripts/fog.mjs** (1): 3436 dom:button DRPG.Fog.floorUnnamed
- **scripts/frisk.mjs** (4): 1085 footer DRPG.Frisk.refuse; 1086 footer DRPG.Frisk.allow; 1122 footer DRPG.Frisk.leave; 1123 footer DRPG.Frisk.force
- **scripts/gm-campaign.mjs** (8): 69 footer (variable); 107 kit:roleButton DRPG.Chapter.endTitle; 166 input DRPG.Clock.campaignName; 170 kit:stepper DRPG.Clock.chapter; 171 select DRPG.Clock.phase; 172 kit:stepper DRPG.Clock.day; 173 kit:stepper DRPG.Clock.session; 174 select DRPG.Clock.timeOfDay
- **scripts/gm-items.mjs** (26): 231 select DRPG.Items.whichCharacterHub; 233 kit:tabbar (variable); 496 select DRPG.Items.pickTable; 498 select DRPG.Items.pickExisting; 525 select DRPG.Items.category; 528 select DRPG.Items.tier; 530 input DRPG.Items.namePlaceholder; 534 textarea DRPG.Items.descriptionPlaceholder; 554 select DRPG.Items.recipient; 858 kit:tabbar (variable); 866 footer DRPG.Items.give; 987 select (variable); 1003 select DRPG.TruthBullet.pickRemnant; 1014 textarea (variable); 1017 checkbox (variable); 1020 input DRPG.TruthBullet.namePlaceholder; 1022 select DRPG.TruthBullet.namePlaceholder; 1024 select DRPG.TruthBullet.shown; 1276 kit:tabbar (variable); 1284 footer DRPG.TruthBullet.give; 1349 checkbox (variable); 1364 textarea DRPG.TruthBullet.autopsyTextPlaceholder; 1367 textarea DRPG.TruthBullet.gmNotePlaceholder; 1494 select DRPG.Items.takeFromWhom; 1496 select DRPG.Items.whichItem; 1498 checkbox DRPG.Items.whichItem
- **scripts/gm-panel.mjs** (5): 760 footer DRPG.Failures.copy; 761 footer DRPG.Failures.clear; 1030 button DRPG.Season.openIt; 1037 button DRPG.Panel.nextLabel; 1156 button DRPG.Panel.studentsLeft
- **scripts/gm-stores.mjs** (11): 2363 footer DRPG.Case.keepMastermind; 2364 footer DRPG.Case.continue; 2366 footer DRPG.Case.restoreFromFile; 2367 footer DRPG.Case.moveTraces; 2369 footer DRPG.Case.enterCast; 2371 footer DRPG.Case.clearMastermind; 2461 footer DRPG.Case.backup; 2462 footer DRPG.Case.restoreFromFile; 2489 select (variable); 2511 dom:input (variable); 2548 checkbox (variable)
- **scripts/gm-students.mjs** (9): 95 select (variable); 96 kit:stepper (variable); 97 button DRPG.Monocub.give; 100 checkbox DRPG.Monocub.give; 125 select DRPG.Panel.stateColumn; 131 button DRPG.Chapter.deadUnfound; 134 button DRPG.Chapter.deathTitle; 173 select DRPG.Panel.roleColumn; 175 kit:roleButton DRPG.Advance.standing
- **scripts/gm-team-dialog.mjs** (5): 430 input DRPG.Despair.poolName; 444 select DRPG.Despair.noCandidates; 471 checkbox DRPG.Monokuma.isMonokuma; 474 select DRPG.Monokuma.pool; 524 kit:tabbar (variable)
- **scripts/handbooks.mjs** (1): 257 kit:tabbar (variable)
- **scripts/handover.mjs** (1): 80 footer (variable)
- **scripts/hud.mjs** (1): 1493 kit:launcher (variable)
- **scripts/investigation.mjs** (59): 1055 select DRPG.Investigation.traceType; 1057 select DRPG.Remnant.authorLabel; 1059 select DRPG.Investigation.difficulty; 1061 input DRPG.Investigation.traceName; 1064 input DRPG.Investigation.notePlaceholder; 1068 input DRPG.TruthBullet.analyzedTextPlaceholder; 1072 input DRPG.Investigation.keyNotePlaceholder; 1076 select DRPG.Investigation.keyNotePlaceholder; 1330 select DRPG.Investigation.visibility; 1332 select DRPG.Remnant.authorLabel; 1334 input DRPG.Investigation.traceName; 1337 input DRPG.Investigation.notePlaceholder; 1341 input DRPG.TruthBullet.analyzedTextPlaceholder; 1345 input DRPG.Investigation.keyNotePlaceholder; 1349 select DRPG.Investigation.keyNotePlaceholder; 1451 select DRPG.Investigation.visibility; 1861 input DRPG.Investigation.traceName; 1863 textarea DRPG.Investigation.traceText; 1870 textarea DRPG.Investigation.traceAnalysis; 1889 select DRPG.Investigation.traceType; 1896 select DRPG.Investigation.visibility; 1898 checkbox DRPG.Remnant.faintColumn; 1899 select DRPG.Remnant.crimeColumn; 1901 checkbox DRPG.Remnant.reinforcedColumn; 1905 button DRPG.Investigation.deleteTrace; 1936 select DRPG.Investigation.filterOrder; 1941 select DRPG.Investigation.filterPlayer; 1947 select DRPG.Investigation.filterRoom; 1953 select DRPG.Investigation.filterChapter; 2070 input DRPG.Investigation.traceName; 2072 textarea DRPG.Investigation.traceText; 2079 textarea DRPG.Investigation.traceAnalysis; 2082 input DRPG.Investigation.keyNoteLabel; 2086 select DRPG.Investigation.onMap; 2090 button DRPG.Investigation.place; 2205 select DRPG.Investigation.visibility; 2207 select DRPG.Remnant.authorLabel; 2209 input DRPG.Remnant.finalSubject; 2212 input DRPG.Investigation.notePlaceholder; 2216 input DRPG.TruthBullet.analyzedTextPlaceholder; 2262 kit:tabbar (variable); 2296 button (variable); 2447 checkbox DRPG.CaseMap.slotNumber; 2453 input DRPG.CaseMap.field.label; 2454 textarea DRPG.CaseMap.field.label; 2455 select DRPG.CaseMap.field.text; 2460 select DRPG.Investigation.room; 2462 button DRPG.CaseRealize.noRoom; 2463 button DRPG.CaseMap.placeOnMap; 2475 button DRPG.CaseMap.removeNode; 3018 footer DRPG.Assign.save; 3026 footer DRPG.Investigation.newTraceTitle; 3035 footer DRPG.TruthBullet.autopsyTitle; 3036 footer DRPG.Trial.logTitle; 3040 footer DRPG.Chapter.bodyTitle; 3043 footer DRPG.CaseRealize.preview; 3046 footer DRPG.Panel.clearFaint; 3047 footer DRPG.Panel.sweepBullets; 3049 footer DRPG.CaseRealize.undo
- **scripts/level-up.mjs** (8): 597 footer DRPG.Advance.apply; 673 select DRPG.Advance.whichImprovement; 719 select DRPG.Advance.whichTrait; 731 select DRPG.Advance.whichExperience; 737 input DRPG.Advance.newExperiencePlaceholder; 1208 checkbox (variable); 1228 footer DRPG.Advance.queueGive; 1229 footer DRPG.Advance.allPlayers
- **scripts/mastermind.mjs** (3): 506 kit:stepper (variable); 507 button DRPG.Monocub.give; 623 select DRPG.Mastermind.privacyWarning
- **scripts/messenger-app.mjs** (9): 256 textarea DRPG.Messenger.placeholder; 258 button DRPG.Messenger.send; 269 kit:tabbar (variable); 302 dom:textarea DRPG.Note.placeholder; 319 dom:button DRPG.Note.useTemplate; 327 dom:button DRPG.Note.save; 807 kit:stepper (variable); 818 checkbox DRPG.Items.effectHealth; 1121 textarea DRPG.Bridge.replyTitle
- **scripts/monocub.mjs** (5): 774 checkbox DRPG.Monocub.isOne; 778 select (variable); 779 kit:stepper (variable); 780 button DRPG.Monocub.give; 783 checkbox DRPG.Monocub.silenced
- **scripts/murder-rules.mjs** (8): 841 footer DRPG.Murder.criticalChoiceHp; 842 footer DRPG.Murder.criticalChoiceStress; 1425 footer DRPG.Panel.apply; 3657 footer DRPG.Chapter.bodyTitle; 3659 footer DRPG.Murder.afterGoInvestigation; 3663 footer DRPG.TruthBullet.autopsyTitle; 4055 footer DRPG.Murder.escapeRemnants; 4086 footer DRPG.Murder.escapeRemnants
- **scripts/murder-ui.mjs** (3): 220 select DRPG.Murder.killer; 222 select DRPG.Murder.victim; 224 checkbox (variable)
- **scripts/observe.mjs** (5): 623 footer DRPG.Observe.pickConfirm; 627 footer DRPG.Observe.pickRefuse; 1198 input DRPG.TruthBullet.name; 1201 input DRPG.TruthBullet.name; 1204 textarea DRPG.TruthBullet.playerTextPlaceholder
- **scripts/overflow.mjs** (2): 1157 kit:toggle DRPG.Overflow.name; 1185 button DRPG.Overflow.setupIntro
- **scripts/palm.mjs** (4): 145 select DRPG.Steal.whoPrompt; 149 select DRPG.Steal.whatToPlant; 482 select DRPG.Steal.chooseIntro; 486 footer DRPG.Vault.take
- **scripts/passages-tab.mjs** (2): 100 button (variable); 189 button (variable)
- **scripts/popup.mjs** (2): 147 dom:button (variable); 924 dom:button DRPG.Panel.close
- **scripts/projects-map.mjs** (1): 839 button DRPG.Project.cardNoCondition
- **scripts/projects-ui.mjs** (22): 327 select DRPG.Project.room; 329 checkbox DRPG.Project.indirect; 331 checkbox DRPG.Project.secret; 629 footer DRPG.Assign.save; 631 footer DRPG.Project.createButton; 632 footer DRPG.Project.shareButton; 684 checkbox (variable); 968 checkbox DRPG.Trap.noProject; 972 checkbox DRPG.Trap.afterDark; 986 input DRPG.Project.namePlaceholder; 992 select DRPG.Project.scale; 993 select DRPG.Project.room; 994 select DRPG.Project.trait; 996 checkbox (variable); 1003 checkbox (variable); 1069 footer DRPG.Project.delete; 1553 checkbox DRPG.Project.everyone; 1571 checkbox (variable); 1617 select DRPG.Project.shareIntro; 1619 select DRPG.Project.player; 1622 footer DRPG.Project.shareButton; 1623 footer DRPG.Project.revokeButton
- **scripts/remnant-ring.mjs** (4): 349 select DRPG.Investigation.visibility; 356 select DRPG.Remnant.authorLabel; 385 input DRPG.Remnant.cardPlayerHalf; 388 textarea DRPG.TruthBullet.playerTextPlaceholder
- **scripts/requirements.mjs** (2): 126 footer (variable); 398 checkbox (variable)
- **scripts/rest.mjs** (2): 330 input DRPG.Overflow.noHopeNow; 369 footer DRPG.Action.proceed
- **scripts/roll-draw.mjs** (1): 252 kit:roleButton (variable)
- **scripts/room-setup.mjs** (11): 111 checkbox (variable); 264 checkbox DRPG.Vault.favours; 266 checkbox DRPG.Vault.hinders; 287 checkbox (variable); 307 select (variable); 340 kit:stepper DRPG.SearchTokens.spendOne; 345 select DRPG.SearchTokens.refillRoom; 353 textarea DRPG.Vault.descriptionPlaceholder; 488 button DRPG.Vault.fogUncovered; 490 button DRPG.Vault.discoverAll; 504 kit:tabbar (variable)
- **scripts/room-tile.mjs** (2): 289 dom:button (variable); 329 dom:button DRPG.Room.imageOpen
- **scripts/rules.mjs** (1): 486 checkbox (variable)
- **scripts/safeword.mjs** (1): 399 footer DRPG.Safeword.stopIt
- **scripts/season-setup.mjs** (4): 236 button DRPG.Season.roomGuide; 1173 footer DRPG.Assign.save; 1177 footer DRPG.Season.resetTitle; 1332 footer DRPG.Season.title
- **scripts/season-wipe.mjs** (4): 180 checkbox (variable); 191 select DRPG.Season.resetCastBedroom; 256 checkbox (variable); 308 input DRPG.Season.resetType
- **scripts/settings-window.mjs** (4): 145 kit:toggle (variable); 151 select (variable); 154 kit:stepper (variable); 238 button DRPG.SettingsWindow.sectionsLabel
- **scripts/sheet-audit.mjs** (1): 2804 kit:roleButton (variable)
- **scripts/sheet.mjs** (9): 2936 button DRPG.Passage.list.shut; 2937 button DRPG.Passage.list.cross; 3175 dom:textarea DRPG.Sheet.biographyPlaceholder; 3661 dom:button DRPG.Vault.rifle; 4222 dom:button (variable); 4347 dom:button (variable); 4943 dom:button (variable); 5132 footer DRPG.Calls.gatherCallOff; 5464 dom:button (variable)
- **scripts/sound-panel.mjs** (4): 100 select DRPG.Music.playlist; 174 button DRPG.Music.makeSituational; 177 button DRPG.Music.play; 370 kit:tabbar (variable)
- **scripts/stash-reach.mjs** (1): 333 footer DRPG.Vault.take
- **scripts/tables-editor.mjs** (18): 98 footer DRPG.Tables.keep; 99 footer DRPG.Tables.recreate; 325 checkbox (variable); 338 input DRPG.Items.name; 343 input DRPG.Items.description; 600 checkbox (variable); 797 checkbox (variable); 908 checkbox (variable); 944 checkbox DRPG.Items.tierN; 955 input DRPG.Items.namePlaceholder; 960 textarea DRPG.Items.descriptionPlaceholder; 963 select DRPG.Items.descriptionPlaceholder; 1052 button DRPG.Tables.renameTable; 1053 button DRPG.Tables.renameTable; 1653 kit:tabbar (variable); 1664 footer DRPG.Tables.addItem; 1668 footer DRPG.Tables.createTable; 1679 footer DRPG.Tables.installAction
- **scripts/trait-ruling.mjs** (1): 333 footer DRPG.TraitRuling.pass
- **scripts/trial-floor-ui.mjs** (11): 236 footer DRPG.Floor.newTrialTitle; 271 footer DRPG.Floor.incidentKeep; 272 footer DRPG.Murder.endMurder; 402 button DRPG.Floor.roundWindow.up; 607 select DRPG.Floor.endTrialScene; 924 button (variable); 990 select DRPG.Floor.closing.pickLabel; 992 footer DRPG.Floor.closing.pick; 1034 textarea DRPG.Reveal.textLabel; 1109 button DRPG.Trial.logTitle; 1110 button DRPG.Trial.logTitle
- **scripts/trial-scene.mjs** (6): 1398 input (variable); 1399 input (variable); 1401 textarea (variable); 1422 select (variable); 1444 select (variable); 1450 kit:toggle DRPG.TrialScene
- **scripts/trial-zones-ui.mjs** (19): 152 input (variable); 153 checkbox (variable); 191 input DRPG.Zones.dive.editor.secret; 192 input DRPG.Zones.dive.editor.conclusion; 210 footer DRPG.Zones.dive.editor.save; 237 checkbox (variable); 249 input DRPG.Zones.picker.b; 251 input DRPG.Zones.picker.thesis; 254 select DRPG.Zones.picker.set; 257 button DRPG.Zones.picker.noSets; 324 button DRPG.Zones.dive.editor.edit; 325 button DRPG.Zones.dive.editor.edit; 345 footer DRPG.Zones.dive.editor.new; 363 button DRPG.Floor.mode; 364 button DRPG.Zones.findings.edit; 365 button DRPG.Zones.findings.edit; 372 input DRPG.Zones.findings.text; 373 footer DRPG.Zones.findings.save; 403 footer DRPG.Zones.findings.add
- **scripts/trial.mjs** (6): 1384 footer DRPG.Trial.objection; 1426 select DRPG.Trial.objectionPickLabel; 1430 textarea DRPG.Trial.commentPlaceholder; 1519 select DRPG.Floor.repoint; 1523 footer DRPG.Floor.repoint; 1638 button DRPG.Trial.logOverruled
- **scripts/ui-columns.mjs** (1): 54 input (variable)
- **scripts/use-items.mjs** (2): 626 checkbox (variable); 648 footer DRPG.Items.useConfirm
- **scripts/verdict.mjs** (3): 221 footer DRPG.Vote.gotItRight; 225 footer DRPG.Vote.gotItWrong; 332 footer DRPG.Rules.addNew
- **scripts/voice-panel.mjs** (2): 79 dom:select (variable); 130 dom:input DRPG.Voice.panel.pttKey
- **scripts/voice-tile.mjs** (1): 425 kit:launcher (variable)
- **scripts/vote.mjs** (1): 796 checkbox (variable)

### B.4 What the kit itself gives (scripts/ui-kit.mjs, read)

- **Footer buttons** (`footerButtons` :121, `footerMarkup` :169, `liveFooter` :204/:289): a `tooltip` option becomes the button's `title`; "the closing word carries none". In the scan, 0 of the footer label objects name a `tooltip` (the one that does, trial-floor-ui.mjs:1465, "Start the Final Trial" disabled with `DRPG.Mastermind.noneSet`, sits behind a spread the scan misses), and none of the closing words.
- **Tabs** (`tabNav` :308, behind `kitTabs` :324 and `kitTabBar` :334): `<button role="tab">label</button>`, no title, no data-tooltip, no description. Every kit tab bar (10 sites) has no tooltip on any tab, by construction.
- **toggle** (:863): a `<label>` with the text; no tooltip unless the caller passes one in `attrs` (0 of 5 sites do).
- **stepper** (:782): the - and + carry `aria-label` and `data-tooltip` "One fewer"/"One more" (or the step size); the field itself has none (14 sites).
- **iconButton** (:894) and **launcher** (:1069): `aria-label` and `data-tooltip` are always the label - a name, not an explanation.
- **formGrid** (:620): a label and a field; no hint slot. **helpText** (:739): one `drpg-help` line of fine print - the kit's only help builder; 14 calls outside the kit, and 28 raw `drpg-help` paragraphs.
- **dataTable** (:664): a column's `tooltip` becomes its head's `data-tooltip` (used by investigation.mjs:1736 and gm-students.mjs:197).

### B.5 The tooltip surface (docs/text-budgets.json, tools/text-map.mjs)

The budgets' rule `"tooltip": "(Tooltip|\\.tooltip)$"` classifies 54 keys: gm 3, player 44, unknown 6, unassigned 1 (check.mjs's "tooltip 3/44/6/1", reproduced), 108 rendered strings in T4 (7 over the target, 1 over the limit). That is a count of keys named ...Tooltip, not of controls with a tooltip: tooltips drawn from other keys (a hint's rest in the settings window, `disabledReason`, `DRPG.Vault.placeCycle`, ...) are not in it, and the 3 GM keys (`DRPG.Panel.advanceTooltip`, `DRPG.Investigation.breakdownTooltip`, `DRPG.Tables.placeTooltip`) are the whole of the GM side by this rule. text-map.mjs says nothing about tooltips itself; it only assigns each key to screens and readers.

### B.6 The specific questions

- **Does a "?" / help button exist today?** No. No `fa-question`, `fa-circle-question`, `fa-info` or a literal "?" button in any module script or stylesheet (`fa-circle-info` appears once, handbooks.mjs:120, as the NOTE callout's icon inside the rendered handbook). The help affordances that exist: (1) the handbook launcher in the corner (handbooks.mjs `renderBookLauncher` :374, tooltip "Handbooks"); (2) the explainers (explain.mjs `registerExplainers` :453, PANELS :397): a click on the HUD clock (`#drpg-hud`), the Despair rows (`#drpg-despair`), the player status strip (`#drpg-player-status`) or the Projects tray (`#countdowns`) opens a window that says what it is and where things stand, for GM and player alike - four panels, no visible affordance that they can be clicked; (3) `drpg-help` lines and `class="notes"` second lines in windows.
- **Does anything open a handbook at a section?** No. `openHandbooks(book = null)` (handbooks.mjs:355) takes a book id only (an open window is switched with `show(book)`, :285, which scrolls to the top: `text.scrollTop = 0`); its one caller is the launcher (:389, with no book). No `api.mjs` export reaches it. The rendered headings carry no ids on purpose (showdown `noHeaderId`, comment at :188: a heading "Chat" would collide with Foundry's `#chat`), and the contents list (`fillContents`, :313-353) scrolls by measuring the heading element, not by an anchor. So a "?" that opens a section needs both an anchor scheme that is not an `id` and an `openHandbooks(book, section)` parameter.
- **Do settings have hints?** Yes, all of them: `DRPG.Settings.*` has 38 `.name` and 38 `.hint` in en.json; of the 39 registrations with a `name:` (the 38 plus sfxVary's `DRPG.Sound.varyLabel`), 39 carry a `hint:`. The settings windows (settings-window.mjs `settingRowHtml` :159-176) draw the hint's first sentence as a line under the control and the rest as that line's `data-tooltip`; a disabled other-theme row gets its reason as `title`; the scope icon has a tooltip (this browser / the whole game). 37 settings are drawn (12 client, 25 game); documentLanguage and bulletSort are registered and not drawn.

### B.7 Not measured

- Rendered tooltips: nothing was drawn. The scan reads source; a tooltip set later by a wiring function far from the markup (more than 14 lines after a createElement, or in another function) is missed, and one set conditionally at run time may be counted as always.
- Controls per rendered window: sites, not instances (B.1). A per-window instance count needs the windows drawn (the harness's GM client could, but that is a run, not a read).
- Whether a tooltip's text explains or only repeats the label: decided only for iconButton/launcher (always a repeat) and the stepper (+/- words). For the other 46 always-on tooltips the text was not judged.
- Daggerheart's and Foundry's own controls inside windows the module dresses (the character sheet's native parts, Foundry's Configure Settings).
