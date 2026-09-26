# Audyt Danganronpa RPG v1.2.42 - funkcje, treść, przepływ informacji, UX, higiena kodu

**Data:** 2026-09-12 · **Stan wyjściowy:** `c5435db` (`module.json` 1.2.42) · **Wynik:** wydanie **1.2.43** na gałęzi `claude/module-qa-audit-localization-hg1lhu` (1.3.0 - Stained Update wyjdzie po ręcznej redakcji tekstów).

**Zakres:** 97 skryptów (89 963 linie), 5 arkuszy CSS (20 490 linii), `lang/en.json` (2 859 linii), makra, workflow wydania.

**Metoda:**

| Krok | Co | Jak |
| --- | --- | --- |
| 1 | Audyt statyczny, dziewięć domen równolegle | każdy plik domeny przeczytany od początku do końca, każdy przepływ prześledzony do sąsiadów (bridge, utils, secret, settings); każdy klucz `DRPG.*` użyty w kodzie sprawdzony w `en.json` skryptem |
| 2 | Testy "na localhost" | prawdziwego Foundry nie da się tu uruchomić, więc rozbudowałem headless harness z `audit/harness` (jsdom + atrapa Foundry) do **1 GM + 3 graczy** (`gm`, `p1`, `p2`, `p3`); scenariusze `40-flow` (pora dnia Daily Life: zegar, Search, Ultimate, messenger, safeword, Pain, rail Despair) i `50-lang` (przełączenie na polski na czterech klientach) |
| 3 | Suite modułu | `game.drpg.runTests({ tier: 2 })` na harnessie przed i po poprawkach: **116 zaliczone / 13 nie**, ten sam zestaw 13 przed i po (wszystkie wymagają prawdziwego canvasu, prawdziwego arkusza CSS albo DSN) - zero regresji |
| 4 | Poprawki | zamknięte wszystkie blokery i większość "major" (tabela w sekcji 2), plus GM-ease i lokalizacja |

Pełne surowe znaleziska (z cytatami kodu, numerami linii i "live checks") są w `audit/findings-1.2.42/*.md`. Ten dokument je streszcza i porządkuje w listę zadań.

Poprzedni audyt: `AUDIT-1.2.13.md`. Z tamtej listy LIVE-001 (tożsamości poza danymi świata) jest zrobione **w połowie** - patrz CASE-02, CASE-03, CASE-04 niżej.

---

## 0. Werdykt

Moduł jest w dobrym stanie jak na 90 tysięcy linii pisanych przez jedną osobę: architektura ma jasne zasady (jedna władza nad zapisem, decyzje po `senderId`, ledgery client-scoped, `keepLive`), teksty są lepsze niż w większości komercyjnych modułów, a pętla Daily Life -> Investigation -> Class Trial -> koniec rozdziału **domyka się z interfejsu**. Nie znalazłem niczego, co uniemożliwiałoby prowadzenie kampanii przez rok.

Znalazłem za to trzy rzeczy, które **mogłyby ją zepsuć po drodze**, i wszystkie trzy są w 1.2.43 zamknięte:

1. **Wyciek klucza odpowiedzi** (CASE-01): ledger Remnantów odpowiadał każdemu, kto o niego zapytał socketem, także graczowi. Jedna linijka w konsoli i gracz miał wszystkie ślady, typy, kto je zostawił.
2. **Wyciek obsady incydentu** (CASE-02, MAP-01): paragon Rerolla akcji kryzysowej zapisywał zabójcę i ofiarę do danych świata, a jednocześnie po LIVE-001 klient gracza czytał obsadę z miejsca, w którym już jej nie było - więc zabójca nie widział własnego śladu.
3. **Reset sezonu nie resetował wszystkiego** (CORE-02/03/04): wezwane zgromadzenie, zasady Killing Game i odpoczynki uczniów przechodziły do następnego sezonu.

### Oceny (0-10) - przed audytem i po 1.2.43

| Pytanie z briefu | 1.2.42 | 1.2.43 | Do 10/10 brakuje |
| --- | --- | --- | --- |
| Funkcje działają end-to-end i spójnie | 7 | 8.5 | CASE-03/04 (metadane szeptów), ROLL-02..06 (Reroll), ITEM-02/03/04, DESP-04/05 |
| Teksty zwięzłe, trafne, nic GM-only u gracza | 8 | 9 | COMM-06 (prozа GM w karcie gracza), TEXT-14 (decyzja o DC), dryf terminologii (sekcja 3) |
| Przepływ moduł -> GM -> gracz -> moduł | 6.5 | 8 | COMM-02 (martwe przyciski pułapek), COMM-03 (wątki messengera czytelne dla wszystkich), COMM-04 (Ultimate/Dynamic tylko jako DialogV2) |
| Wygląd, UX, UI | 8 | 8.5 | UI-09/10/11 (skalowanie okien, stos powiadomień, kontrast akcentów), MAP-02 (prześwit tokena) |
| Łatwość i szybkość prowadzenia dla GMa | 6 | 8 | ITEM-07 (przedmioty Tier 0 bez przycisku), ROLL-08/11/12 (podwójne okna), CORE-10/19 |
| Optymalizacja: fps | 8 | 8.5 | MAP-07 (ticker fogu), MAP-13, CORE-12 (4x render HUD na zapis zegara), UI-05/16 |
| Optymalizacja: higiena kodu | 6.5 | 7 | sekcja 6: funkcje po 300-700 linii, pięć kopii "kto jest uczniem", 8 martwych kluczy, 40 martwych selektorów |

Skala jest surowa: 10 znaczy "nie ma nic, co bym zmienił". Realny cel to 9+ w każdym wierszu po wykonaniu listy z sekcji 5.

---

## 1. Jak przebiegały testy na harnessie

### 1.1 Co harness potrafi, a czego nie

Harness (`audit/harness`) ładuje prawdziwe skrypty modułu w jsdom z atrapą Foundry v14: dokumenty, ustawienia (world/client), socket między procesami, DialogV2 z automatycznym odpowiadaniem, hooki `init -> i18nInit -> setup -> ready -> canvasReady`. Nie ma prawdziwego PIXI (fog i ring rysują "na sucho"), nie ma prawdziwego CSS w `getComputedStyle`, nie ma Dice So Nice. Dlatego:

- zegar, akcje, budżety, ustawienia, socket, szepty, karty, HUD (DOM), panel GMa, i18n - **testowalne**;
- kurtyna Stained Glass, fog, rzuty przez system Daggerheart, dźwięk - **tylko statycznie**.

Zmiany w harnessie w tej rundzie: czwarty klient (`p3`, właściciel Chie), globalne `innerWidth`/`innerHeight`, i18n rozwijające klucze z kropką jak Foundry, DialogV2 przyjmujący element zamiast stringa, bezpiecznik przed nieskończonym ponownym otwieraniem okien (głębokość 2, limit 6 automatycznych odpowiedzi na 1,5 s), `package.json`.

### 1.2 Scenariusz 40-flow (Daily Life, 1 GM + 3 graczy)

| Sprawdzenie | Wynik |
| --- | --- |
| Wydanie akcji kosztuje dokładnie jedną | OK |
| GM przesuwa zegar Rano -> Południe, wszyscy trzej gracze widzą nową porę, akcje odnowione, HUD nazywa porę | OK x9 |
| Karta zmiany pory dociera do postronnego | OK |
| Search gracza nie rzuca wyjątkiem | OK |
| Search pobiera jedną akcję | **NIE** - w harnessie GM "nie odpowiedział" (limit atrapy), akcja została zwrócona, ale **token pokoju został wydany (3 -> 2)**. To jest do sprawdzenia na żywo: `performSearch` ma zwracać token razem z akcją, gdy nikt nie odpowie (action-rolls.mjs ~1039-1072) |
| Wniosek o Ultimate otwiera decyzję u GMa; Hope pobrane dopiero po "tak" | OK / limit harnessu (eval timeout na p2 przy oczekiwaniu na orzeczenie) |
| Wiadomość gracza ląduje w wątku GMa | OK |

### 1.3 Scenariusz 50-lang (polski na czterech klientach)

42/42 zaliczone: plik się nakłada, zwykłe stringi po polsku, proza `config.mjs` podmieniona w miejscu, glosariusz zostaje angielski (Search, Daily Life, Eye), pora dnia "Południe", plural wybiera `one/few/many` (1 Key Remnant / 2 Key Remnants / 5 / 22), override systemu Fear -> Despair przeżywa merge, `pl.json` pokrywa każdy klucz `en.json` bez obcych kluczy, HUD po re-renderze pokazuje "Wieczór", panel GMa otwiera się z polskim tytułem i treścią, zero brakujących kluczy, ustawienie jest per przeglądarka (p3 wraca do angielskiego, p1 zostaje przy polskim).

---

## 2. Co zostało naprawione w 1.2.43

Wszystkie zmiany są w skryptach modułu; `node --check` na każdym pliku, suite bez regresji.

### 2.1 Blokery i wycieki

| ID | Plik | Co było | Co jest |
| --- | --- | --- | --- |
| CASE-01 | `remnants.mjs` | socket ledgera odpowiadał każdemu nadawcy pełnym kluczem odpowiedzi i przyjmował `rm.secret`/`rm.full` od graczy | handler bierze `senderId`, odrzuca nie-GM, ignoruje echo własne, odpowiada tylko do `senderId` (kopia zabezpieczenia z `truth-bullets.mjs`) |
| CASE-02 | `murder.mjs` | paragon Rerolla (`lastCrisis`) z pełną obsadą trafiał do ustawienia świata | `lastCrisis` dopisane do `CAST_FIELDS` - paragon żyje w client-scoped `incidentCast`, `restoreState` dostaje pełny kształt |
| MAP-01 | `visibility.mjs` | `myIncidentTrace` czytało `killerId`/`victimId` z ustawienia świata, gdzie po LIVE-001 ich nie ma - zabójca nie widział własnego śladu | czyta `incidentParticipants()` i `thirdSide` z `incidentCast`; trzeci po stronie ofiary nie widzi śladu zabójcy |
| TEXT-03 | `events.mjs` | karta "A murder is under way" pokazywała się ofierze bezpośredniego morderstwa, a po LIVE-001 w ogóle nie znajdowała obsady | obsada z `incidentCast`; ofiara bezpośredniego morderstwa karty nie widzi (przy pośrednim widzi, bo to ona rzuca) |
| COMM-01 | `gm-bridge.mjs` | 24 zapytania gracz -> GM szły broadcastem do wszystkich klientów (parkowanie morderstwa z notatką, kradzieże, sabotaże, akcje kryzysowe) | `emitToGms()` z `recipients: activeGmIds()` w `awaitRuling`, `resendPendingRulings`, wszystkich `request*` i `requestOpeningResult` |
| COMM-12 | `safeword.mjs` | karta GMa brała nazwisko z `payload.who` (nadawca mógł podać cudze) | nazwisko z `senderId` |
| DESP-03 | `despair.mjs`, `call-effects.mjs`, `overflow.mjs`, `en.json` | publiczne karty drukowały dokładny stan puli i licznika overflow, które rail gracza maskuje | karta wydatku bez "left", z `poolLabel(user)`; `overflowFed`/`cardLeft` bez liczb |

### 2.2 Błędy "major"

| ID | Plik | Naprawa |
| --- | --- | --- |
| CORE-02/03/04 | `season-setup.mjs` | reset sezonu czyści `pendingGather`, `killingGameRules` oraz per uczeń `restsTaken` i `betrayalWindow` |
| CORE-05 | `trial-floor-ui.mjs`, `gm-panel.mjs` | przycisk "End of chapter" w konsoli zawsze dostępny (domyślny dopiero po werdykcie); kafelek "End of chapter" w sekcji Between sessions panelu |
| CORE-01 | `gm-panel.mjs`, `css` | linia Next w Daily Life po skończonych akcjach wskazuje Eclipse (`action: "eclipse"`); nowy przycisk "Next time of day" przy zegarze (`advanceTimeOfDay({ resetActions: true })`, odmawia podczas Eclipse z powodem) |
| CORE-08 | `day-summary.mjs` | podsumowanie dnia nazywa porę etykietą, nie kluczem (`timeOfDayLabel`) |
| CORE-11 | `chapter.mjs`, `en.json` | `doneSweep/doneFaint/doneKeys` jako rodziny `plural()` |
| CORE-14 | `gm-panel.mjs` | ostrzeżenie "Eclipse still on" tylko gdy pora dnia faktycznie się zmieniła |
| ROLL-01 | `reroll.mjs` | `case "palm"` wpada w `settleSteal` - Reroll po Palm działa |
| ROLL-07 | `action-rolls.mjs` | Direct Murder sprawdza `gmOnline()` przed wydaniem akcji; gdy parkowanie się nie uda, akcja wraca i nie ma fałszywego "Declared." |
| ROLL-09 | `action-rolls.mjs` | `askForHint` dostaje realny `cost` (darmowa Analyze nie zwraca akcji, której nie pobrano) |
| CASE-05 | `investigation.mjs` | Save w dashboardzie zapisuje tylko wiersze obecne w formularzu (filtr rozdziału nie kasuje reinforced/tied poprzednich rozdziałów) |
| CASE-07 | `vote.mjs`, `trial-floor-ui.mjs` | `Hooks.callAll("drpgBallotsChanged")` przy każdej karcie do głosowania; konsola trialu na `keepLive` z tym hookiem - licznik "N still to vote" żyje |
| CASE-08 | `vote.mjs`, `gm-bridge.mjs`, `utils.mjs` | `game.user` może być null podczas startu/zamykania - guardy w handlerach; `isPrimaryGm()` zwraca false bez usera |
| ITEM-01 | `inventory.mjs` | `preservedFlags` zachowuje `wear` - transfer przedmiotu nie jest już "pralnią" |
| ITEM-05 | `vault.mjs` | `stow()` zdejmuje `equipped` |
| ITEM-11 | `inventory.mjs`, `vault.mjs`, `handover.mjs` | odmowy pojemności mówią "Gear (2)" przez `capacityLabel`, nie kategorią |
| DESP-01 | `calls.mjs` | Hope Call czekający na GMa liczy z wartości po orzeczeniu (`held = now`) |
| DESP-02 | `states.mjs` | dźwięki Breakdown/Wounded kluczowane po `STATES.*.id` - grają |
| DESP-07 | `call-effects.mjs`, `en.json` | szept "uzbrojono" mówi prawdę: "Another student spent Hope" / "Monokuma has ... armed" / neutralnie przy Meddle |
| COMM-08 | `messenger.mjs` | dźwięk `gmAsk` gra też u GMa, który sam jest autorem karty (parkowanie, pułapki) |
| UI-03/04/05 | `glass.mjs` | unmount czyści `maxHeight`/`overflow`; jeden listener resize; `matchMedia` cache'owane; `paneAt` sprawdza bbox przed testem wielokąta |
| UI-08 | `settings.mjs`, `look.mjs` | "Reduced motion" widoczne pod obydwoma motywami |
| MAP-04/05/06/08/09 | `fog.mjs` | ledger odkryć per scena (bez powtórki animacji odkrycia przy zmianie sceny); obrys pokoju gaśnie, gdy Monokuma wyjdzie na korytarz; Mastermind bez fałszywych "odkryć"; jedno `reducedMotion` z `motion.mjs`; `freeOwned` przed `destroy` w `clearLayer` (wyciek tekstury glow) |
| TEXT-01/02/04/05/06/07/08/10/15 | `en.json`, `config.mjs`, `gm-panel.mjs`, `chapter.mjs` | "Needs {n}" z configu (15, nie 18); New Rule "{cost}" (9, nie 12); opis Eclipse zgodny z regułą; createNote "Save ... somewhere inside the room"; `cleanupFailed.hint`; `killerChooses` dwie opcje; `Vote.tied` spójne z notatką GMa; tooltipy Free Move przez i18n; `tidyNote` usunięte |
| CORE-07/09 | `en.json` | `endNote` mówi prawdę o trzech checkboxach; "body found" nie obiecuje, że przesunięcie zegara je zamknie |

### 2.3 Lokalizacja i wydanie (zadania przedostatnie i ostatnie z briefu)

| Element | Gdzie |
| --- | --- |
| Ustawienie `language` (client, `en`/`pl`, domyślnie `en`, `requiresReload`) | `settings.mjs`, `moduleLanguage()` |
| Select "Language" na górze okna Look (zębatka w rogu) + w ustawieniach modułu; zmiana pyta o przeładowanie | `look.mjs`, `i18n.mjs confirmLanguageReload` |
| Ładowanie: `fetch` pliku na `init`, merge w `game.i18n.translations` na `i18nInit`, celowo **nie** przez `module.json languages` (to by szło za językiem core Foundry) | `i18n.mjs`, `module.mjs` |
| Proza `config.mjs` (484 zdania: hinty akcji, efekty Calli, kategorie, instrukcje trialu) podmieniana w miejscu przez `localizeConfig` | `i18n-config.mjs` (lista tabel i pól), `tools/config-prose.mjs` (`--check lang/pl.json`) |
| `plural()` przez `Intl.PluralRules(moduleLanguage())` - pl ma `one/few/many/other` (154 dodatkowe formy) | `utils.mjs` |
| `lang/pl.json`: 2 955 kluczy, pokrywa 2 801 z en.json + 484 config prose, 0 braków; glosariusz po angielsku | `lang/pl.json` |
| Fonty: wszystkie trzy kroje mają plik Latin-Ext z ą ć ę ł ń ś ź ż (sprawdzone w cmap), Ó/ó w plikach bazowych; `unicode-range` pokrywa U+0100-017F | `fonts/`, `styles/` |
| Test suite: "the Polish file covers every English key" (klucze, obce klucze, placeholdery) | `tests.mjs` |
| Wersja 1.2.43: `module.json`, `--drpg-css-version`, notatki `.github/release-notes/v1.2.43.md`, workflow sprawdza stempel CSS i istnienie notatek | patrz sekcja 7 |
| Podręczniki PL/EN | `docs/handbooks/` |

Co świadomie **nie** jest tłumaczone: nazwy własne gry (Hope, Despair, Sanity, Health, Truth Bullet, Remnant i typy, Blackened, Class Trial, Daily Life, Investigation, Eclipse, Monokuma, Monocub, Mastermind, Motive, Ultimate, nazwy Calli, nazwy akcji, Free Move, Level Up, Tier, statystyki, Stage 4/5/6, Nonstop Debate, OBJECTION, Rebuttal, Search Tokens, Safeword, Loaded Die, nazwy efektów Overflow), nazwa playlisty "Situational" (dopasowywana po stringu), raporty konsolowe `diagnostics.mjs` (celowo po angielsku - są dla ciebie i do wklejenia w issue).

Dwie decyzje, które warto obejrzeć na żywo: polskie zdania są ~15-25% dłuższe, więc `fitTileText` na arkuszu może zejść niżej z rozmiarem kafelków; HUD i pasek statusu mają `max-content`. W 50-lang nic nie brakowało, ale szerokości sprawdzi tylko przeglądarka.

---

## 3. Analiza jakości treści

Ogólnie: teksty są mocną stroną modułu. Prawie każde zdanie mówi, co robi kontrolka i po co; liczby są w większości wstrzykiwane z configu (`callEffect()`), więc 13 z 14 zdań Calli nie może się rozjechać z regułą. Zestawienie długości (skrypt `lengths.mjs` na 30 tooltipach, 254 powiadomieniach, 151 etykietach przycisków, 4 tekstach HUD): tylko jeden tooltip przekracza 120 znaków. Martwych kluczy jest 8 z 2 212 (0,36%).

Zanim zaczniesz redakcję pod 1.3.0, trzy tabele, które warto mieć obok.

### 3.1 Zdania, które mówiły co innego niż kod (stan po 1.2.43)

| Klucz | Mówiło | Jest | Status |
| --- | --- | --- | --- |
| `Tamper.frameHint` | "Needs 18 or more" | próg 15 | naprawione (`{n}` z configu) |
| `Calls.newRuleNote` | "Twelve Despair" | koszt 9 | naprawione (`{cost}`) |
| `Explain.phase.eclipse` | "moves once, anywhere" | 2 przejścia, dowolne miejsce tylko w nocy | naprawione |
| `Investigation.createNote` | "Apply ... centre of the region" | przycisk Save, losowy punkt | naprawione |
| `SFX_EVENTS.cleanupFailed.hint` | "adds an Obvious trace" | Faint Tamper Remnant, Subtle/Evident | naprawione |
| `Murder.killerChooses` | trzy opcje | dwie | naprawione |
| `Vote.tied` vs `tiedVerdictNote` | remis = przegrana / "unless settled" | sprzeczne | naprawione (obie mówią "unless the table settles it") |
| `Chapter.endNote` | "Nothing else here deletes anything" pod trzema checkboxami kasującymi | fałsz | naprawione |
| `Hud.bodyFoundTooltip`, `Panel.nextBodyFound`, `Chapter.bodyNote` | "moving the time of day on" zamyka ciało | zamyka je dopiero start Investigation | naprawione |
| `Cleanup.gmAttemptsLeft` | "closing destroys the tools" | tylko Crime Tool przy zamknięciu, Cleaning Tool przy odkryciu ciała | naprawione (13.09) |
| `Investigation.unfoundKeys`, `plannerIntro`, `whichSlot`, `noSlot` | "four", "five" na sztywno | `KEY_REMNANTS.unfoundBar` = 4, `prepared` = 5 | naprawione (`{bar}`/`{n}` z configu, 13.09) |
| `Hud.startEclipseNamed`, `Eclipse.noMovesLeft` | "(2 crossings)", "Both" | Darkness obniża do 1 | naprawione (`{n}` z `overflowCrossings`, zadanie 6 i karty eventów) |
| `Overflow.explainBody` | "holds twelve", "eight in the hat" | liczby z configu | naprawione (`{max}`, `{effects}`, 13.09) |
| `Action.murderConfirm` | "opens a direct murder" | podczas Eclipse tylko parkuje | naprawione (`murderConfirmEclipse`, 13.09) |
| `Settings.uiScale.hint`, `typography.md` | "11px floor never scaled" | floor 21 px i skaluje się z suwakiem | naprawione (zadanie 13) |
| `Vault.rifleNote` | "they will notice it is gone" | właściciel nigdy nie jest informowany na darmowej ścieżce | naprawione (zadanie 5) |
| `Calls.grants.critical` | "an automatic critical" | Loaded Die: jedna kość na 12 | naprawione (zadanie 6) |
| `Overflow.what.rot` | "ruining whatever was on its last point" | kod celowo nie zabiera ostatniego punktu | naprawione (zadanie 6) |

### 3.2 Dryf terminologii (do ujednolicenia przy redakcji)

| Pojęcie | Warianty dziś | Propozycja |
| --- | --- | --- |
| Remnant / trace / clue | "Remnant" 56 kluczy, "trace" 78, "clue" 7 | dla gracza **trace** (co zostawiasz/znajdujesz), termin reguł **Remnant** z typem, "clue" tylko w planerze Key Remnantów |
| stash / hiding place / drawer / Vault | 33 / 5 / 2 / 0 (tylko namespace) | **stash**; "hidden stash" dla ukrytej; namespace `Vault` zostaje jako identyfikator |
| GM / Monokuma / Gamemaster / GM team | 132 / 43 / 3 / 2 | **GM** dla człowieka, **Monokuma** dla aktora i puli; "Gamemaster" tylko gdy chodzi o rolę Foundry |
| time of day / phase / state | 61 / (Daily Life...) / (muzyka) | `Settings.hudTicker.hint` i `Summary.lede` używają "phase" dla pory dnia - poprawić |
| killer / Blackened | 35 / 21 | **killer** w incydencie i Stage 6, **Blackened** od odkrycia ciała; `Vote.verdictNoteKnown` "every Blackened walks away" |
| student / character / player | 24 / 43 / 46 | **student** = żywy członek obsady, **character** = aktor/arkusz, **player** = człowiek; `Panel.whoIsAlive` "Students", `Calls.whichPlayer` "Which student?" |
| Final Truth Remnant / Final Key Remnant | etykieta typu / zakładka i `finalPlacedIn` | **Final Truth Remnant** |
| Free Move / free Move | 5 / 9 | **Free Move** |
| OBJECTION / Objection | 10 / 6 | wielkimi tylko na banerze i przycisku |
| Analyze / Analyse | etykiety / `config.mjs:700, 763, 773` | **Analyze** (nazwa akcji); reszta może zostać brytyjska |
| Role reversal / Role Reversal | etykieta / `config.mjs:2509` | **Role reversal** |
| Level Up / Level up | 15 / `SFX_EVENTS.levelUp` | **Level Up** |
| Public Announcement / Assembly | Call / zdarzenie, ticker, SFX | **Assembly** dla zdarzenia, "Public Announcement" jako nazwa Calla |
| Breakdown / Broken Down | stany / `diagnostics.mjs:1150` | **Breakdown** |

### 3.3 Za długie na swoje miejsce

| Powierzchnia | Klucz | Znaków | Propozycja |
| --- | --- | --- | --- |
| tooltip kafelka | `CRISIS_ACTIONS.finishingBlow.hint` | 212 | "End the incident now. Threshold is five times their remaining Health - free at 0. A critical here also buys a free Stage 6 action." |
| tooltip kafelka | `CRISIS_ACTIONS.useItem.hint` | 156 | "Get something out while this is happening. Works on a critical or a Hope success; a Despair success only leaves a trace." |
| tooltip kafelka | `HOPE_CALLS.freeCrit.effect` | 150 | "One die is set to 12, the other is thrown. A critical only if that one is a 12 too." |
| powiadomienie | `Music.noSituational` | 176 | "No playlist called "{name}". Create it below." |
| powiadomienie | `Eclipse.actionsLocked` | 153 | "Placement only. Actions are already back; nothing spends them but a Direct Murder until the lights come up." |
| powiadomienie | `Anonymity.blocked` | 150 | "Blocked: every player would own "{actor}", and an owner is never redacted. Give Owner to their one player only." |
| przycisk | `Assign.title` (34), `Observe.pickConfirm` (32), `Eclipse.endAndAdvance` (30), `Chapter.endTitle` (28), `Trap.rearm` (28), `Analyze.askHint` (27), `Voice.stopEavesdrop` (27) | | "Despair Flow", "That one", "End and move the clock", "End the chapter", "Keep watching", "Ask for a hint", "Leave" |
| HUD | `Hud.roomTokens` | 47 | "{left}/{max} searches" (zdanie zostaje w tooltipie) |
| kafelek | `behindClosedDoors.label`, `publicAnnouncement.label` | 19 | "Closed Doors", "Announcement" - najdłuższe słowo skaluje **cały** grid kafelków w dół |

Po polsku wszystkie te miejsca są jeszcze ciaśniejsze. Jeśli redagujesz angielski, zrób to przed przeglądem polskiego - `pl.json` tłumaczy zdanie po zdaniu, więc skrócone źródło = krótszy przekład.

### 3.4 Informacje GM-only, które docierały do gracza

| Klucz | Jak docierało | Status |
| --- | --- | --- |
| `Events.openingTitle/openingMeta` | HUD ofiary bezpośredniego morderstwa w Stage 4 | naprawione (TEXT-03) |
| karty Despair Call, Feed the Overflow, overflow | dokładny stan puli i licznika na publicznej karcie | naprawione (DESP-03) |
| proza kart `callGm` (`Bridge.criticalHint`, `Action.observeGm`, tabela progów Think/Listen) | pełne zdania dla GMa w wątku gracza; obcinane są tylko przyciski | naprawione (zadanie 2: `gmBody` w `.drpg-gm-only`, obcinane u gracza) |
| `Handover.alreadyHasIt` | "{who} already found that trace themselves" - fakt o cudzych dowodach | naprawione (zadanie 13) |
| `Tamper.frameHint`, `Analyze.findStashHint`, `Murder.thresholdShort` | DC widoczne dla gracza w trzech miejscach, nigdzie indziej | rozstrzygnięte: D1 A, progi wszędzie (13.09) |
| `Hud.trialTooltip`, `Hud.bodyFoundTooltip` | instrukcje dla GMa na HUD gracza | nieszkodliwe; przy redakcji przepisać neutralnie |

---

## 4. Znaleziska otwarte - skrót per domena

Pełne opisy z cytatami: `audit/findings-1.2.42/<domena>.md`. Tu tylko to, co zostało po 1.2.43, w kolejności wagi.

**Wycieki i bezpieczeństwo**

- CASE-03 - każdy szept incydentu/Stage 6 niesie `speaker.alias` zabójcy i listę `whisper` uczestników; gracz z konsolą czyta metadane, choć słowa są schowane w `secret.mjs`.
- CASE-04 - flagi `betrayalWindow` (zabójca + wspólnik) i `swungWeapon` na aktorach są danymi świata przez cały Stage 6.
- COMM-03 - messenger tworzy wiadomości `ChatMessage.create` z pełną treścią; wątki innych graczy (deklaracja morderstwa, wnioski, orzeczenia) są czytelne z konsoli.
- CASE-13 - `secret.card` przyjmowane od każdego nadawcy (podszycie pod narrację GMa); `remnant.place` pozwala graczowi podłożyć `type: "key"`, `reinforced: true`.
- MAP-02 (do potwierdzenia) - token wchodzący do pokoju pokazuje się na pierwszej klatce animacji, jeszcze w poprzednim pokoju.
- MAP-03 - odmowa przejścia wymienia z nazwy wszystkie sąsiednie pokoje, także te pod pełną mgłą.
- MAP-12 (decyzja) - ledger odkrytych pokoi jest ustawieniem świata: "w jakich pokojach był X" to alibi.
- ROLL-14 (do potwierdzenia) - tryb rzutu "Self Roll" w pasku bocznym omija `onPreCreateChatMessage`, Despair z wyników nie zasila Monokumy.

**Przepływ do GMa**

- COMM-02 - alert pułapki i każde `callGm` bez właściciela lądują jako cichy wiersz w czacie, bez popupu, bez dźwięku, z martwymi przyciskami.
- COMM-04 - Ultimate/Experience i Dynamic to DialogV2 tylko u primary GM: brak karty, popupu, dźwięku, drugi GM nie wie o pytaniu.
- COMM-07, ITEM-07 - karty "critical Analyze hint" i "use creatively" bez przycisków; przedmiot Tier 0 rozstrzyga się tylko z konsoli.
- COMM-16 - `refuse()` w bridge'u jest ciche dla gracza: ack poszedł, świat się nie zmienił.
- ROLL-08 - odmowa Dynamic: gracz nie dostaje nic, karta GMa "Awaiting a ruling" na zawsze.
- DESP-05 - Meddle Monocuba: akcja i Hope wydane u gracza, odmowa GMa tylko w konsoli.
- COMM-05/09/10/15/17 - drobne: podwójny dialog przy dołączeniu drugiego GMa, DSN nie dociera do dołączającego gracza, muzyka z asystenta GM, unread po zegarze nadawcy, sabotaż z 8-sekundowym oknem.

**Reguły i błędy**

- ROLL-02/03/04/05/06 - Reroll: odrzucony Search po rerollu daje przedmiot; replay Search używa starej reguły śladu; Project/Sabotage bez `relief`; anulowanie drugiego rzutu zwraca akcję po pierwszym; Search zapisuje statystykę argumentu, nie wybraną w oknie.
- CASE-06 - Reroll skasowanego śladu odtwarza go z flag tokena, których już nie ma (wraca jako Evident Prep bez źródła).
- CASE-10/11/14 - luźne końce Stage 4, auto-tie każdego śladu w budynku przez cały Stage 6, głosujący, który się rozłączył.
- ITEM-02/03/04/06/08/09/14/15/16 - "Stash hidden" na zakładce Bedrooms nic nie robi; pośrednie morderstwo z propozycji zapieczętowane przed własnym proponującym; reguła "jeden w ręce" egzekwowana w jednym miejscu; stashed item można oddać przez API; plant przeżywa projekt; "znalazłem skrytkę" przeżywa sezon.
- DESP-04/11/12/13/14/15 - darkening "Despair" kasuje Hope kupione przez Monokumę; dwie karty na jeden Despair Call; wyścig zapisu pul przy dwóch GMach; Reroll Despair odrzucony dla asystenta; Contribution poza pokojem; Public Announcement teleportuje ciała.
- CORE-06/10/13/17 - licznik minut zdradza przesunięcie zegara w incydencie; rozdział 7 psuje select; fresh world dostaje "MISIUBOMBO" jako safeword (do potwierdzenia); dwa GMy kończące rozdział.
- CASE-12 - cztery kasowania tokenów omijają tombstone ledgera (ledger rośnie).

**UX i wygląd**

- UI-09 - `scaleWindow` łapie `ActorDirectory` i arkusze NPC regexem `/actor/i`.
- UI-10 - stos powiadomień pod Stained Glass: dwie sticky karty zasłaniają każdą nową.
- UI-11 - kolory akcentu jako tekst przy Night/Eclipse/Trial poniżej 4.5:1 na jasnej mapie; GM red jako tekst 2.9:1.
- UI-12 - jedenaście reguł poniżej 12 px pod Monokuma Legacy.
- ROLL-11/12 - podwójne okna przy Observe fallback i Sabotage z okna Projects.
- ITEM-12/13 - picker "Take away" bez oznaczeń "in the stash"/"broken"; tytuły okien "Give an item to X" kłamią po zmianie odbiorcy.
- DESP-06/17 - cel Meddle dostaje zdanie z perspektywy Monocuba; badge overflow nie mówi, który efekt trwa.
- COMM-11 - safeword tylko na arkuszu postaci (spectator, gracz bez postaci nie ma drzwi).
- CORE-19 - linia Next w Investigation nigdy nie mówi "start the trial".

**Wydajność**

- MAP-07 - ticker fogu co klatkę: `matchMedia`, `getComputedStyle`, `clear/beginFill/drawRect` tła.
- MAP-13 - `regionShapes()` dla każdego regionu przed skrótem "unchanged", na każdym `createToken`/`deleteToken`.
- CORE-12 - jeden zapis zegara = 4 rendery HUD u piszącego, 3 u każdego innego; koniec rozdziału ~14 renderów.
- ROLL-17 - `paintChatCard` czyta `getComputedStyle` i ustawienie motywu per karta przy każdym renderze logu.
- UI-14/16 - `ResizeObserver` per arkusz nigdy nie odłączany; `applyRotations` w observerze z trzema wymuszonymi reflow.

---

## 5. Lista zadań do 10/10

Kolejność jest według ryzyka dla rocznej kampanii, nie według łatwości. Każde zadanie ma metodę i pułapki; numery znalezisk odsyłają do `audit/findings-1.2.42/`. Szacunki są w "wieczorach" (2-3 h skupionej pracy) i są orientacyjne.

### Zadanie 1 - Domknąć LIVE-001: metadane szeptów i flagi na aktorach (CASE-03, CASE-04, MAP-12) · 3-4 wieczory

**Cel:** żaden klient postronnego nie ma na dysku ani w `game.messages` niczego, z czego da się odczytać obsadę incydentu.

**Metoda:**
1. W `utils.mjs` dodać `whisperToOwner(actor, content, { anonymous: true })` (albo siostrzany helper), który nie ustawia `speaker.actor`/`alias` - karta jest "od Monokumy". Użyć go we wszystkich kartach incydentu, Stage 6, otwarcia i śmierci (lista call-sites w CASE-03).
2. Lista odbiorców: stub karty idzie do **wszystkich** użytkowników (`whisper: game.users.map(u => u.id)`), słowa tylko do prawdziwych odbiorców socketem `secret.card` (już istnieje). W `secret.mjs` hook `renderChatMessageHTML` ma **ukryć** (nie wyczyścić) kartę, do której ten klient nie dostał słów.
3. `betrayalWindow`: przenieść ofertę do wpisu obsady po stronie GMa; wspólnikowi wysłać boolean "you may betray" po adresowanym sockecie (`CAST_MINE`), arkusz czyta ustawienie client-scoped; na `ready` klient prosi GMa o kopię (jak `CAST_MINE_REQUEST`).
4. `swungWeapon`: czytane tylko po stronie GMa (`rememberedTool` w cleanup) - przenieść do pakietu `requestCrisisResult({ swungId })` i trzymać w obsadzie/paragonie GMa.
5. `discoveredRooms` (MAP-12): decyzja. Jeśli alibi ma być tajne - GM trzyma unię w store GM-only, gracz dostaje tylko swoje wiersze (wzorzec `incidentCast`). Jeśli nie - dopisać to do hinta ustawienia, żeby decyzja była widoczna.
6. Test w suite: po akcji kryzysowej zserializowane `murderState`, wszystkie flagi aktorów i `game.messages` nie zawierają żadnego id uczestnika poza kartami, których ten klient jest odbiorcą.

**Pułapki:**
- `popup.mjs` podnosi karty modułu po fladze - karta, którą dostaje każdy klient, nie może otwierać popupu u nie-odbiorców (bramka na `secretHtml(message)`).
- `ChatMessage#visible` pokaże kartę każdemu z listy `whisper` - dlatego ukrywanie przy renderze jest obowiązkowe, nie opcjonalne.
- GM, który był offline, i tak nie ma historii (udokumentowany koszt `secret.mjs`); `rosterRow` messengera musi tolerować stuby.
- `sweepBetrayalWindows` i testy D18 (`tests.mjs` ~2542-2590) trzeba przepisać razem z flagą.
- Kolejność socketów: `CAST_MINE` przed `murder.openingAsk` - jeśli ask przyjdzie pierwszy, `openingStillWanted` nie zna `killerId` (live check nr 2 w case.md).

### Zadanie 2 - Jeden kanał do GMa: karty z przyciskami dla wszystkiego (COMM-02, COMM-04, COMM-06, COMM-07, ITEM-07, ROLL-08, COMM-16, DESP-05) · 3 wieczory

**Cel:** każde pytanie do GMa wygląda tak samo (karta w wątku + popup + dźwięk + przyciski), każda odmowa dociera do gracza.

**Metoda:**
1. Fallback `whisperToGms` w `callGm` (`gm-bridge.mjs` ~1866): przekazać `flags: { gmPopup: true, popupTitle, sfx: { key: "gmAsk", gm: true } }`; dodać GM-only hook `renderChatMessageHTML`, który woła `wireCallActions(body, message)` (wyeksportować z `messenger-app.mjs`) dla kart z `.drpg-call-action`.
2. Hope Call (Experience/Ultimate) i Dynamic: zamiast `DialogV2.wait` u primary GM - `callGm` z dwoma przyciskami (`approveCall`/`refuseCall`, `setDifficulty`/`refuseDynamic`); przycisk emituje istniejące `call.approveResult` / `dynamic.difficultyResult` do pytającego i settluje kartę. DialogV2 zostaje jako edytor progu otwierany przyciskiem. Gracz dostaje jeden sticky popup "Waiting on the GM", zdejmowany przy rozstrzygnięciu.
3. `refuse(action, why, asker)` w bridge'u emituje `{ action: "bridge.refused", requestId, reason }` do `[asker]`; klient gracza pokazuje toast `Bridge.refused` z kluczem i18n.
4. Karty bez przycisków (critical Analyze hint, creative use): `actions: gmRulingActions(actor, 0)`; dla Tier 0 "Works - apply an effect" (mały dialog Health/Sanity/Hope + consume), "Works, no effect - consume", "Refuse".
5. `resolveMeddle`: przy odmowie szept do Monocuba z powodem i refund akcji + Hope; `performMeddle` sprawdza `hasGm()` przed wydaniem.
6. Proza GM-only w kartach `callGm`: zawinąć w `<div class="drpg-gm-only">`; `buildBubble`/`cardPreview` usuwają ją u nie-GM tak jak `.drpg-call-actions`.

**Pułapki:**
- `settleCall` przepisuje `message.content` z `contentOf(message)` - na sekretnej karcie wpisałoby prywatny HTML do dokumentu w jawnej postaci. Dla ścieżki fallback settlować przez ponowne `postSecret` albo aktualizację store'ów klientów socketem.
- Przycisk musi znać `requestId` i id pytającego (`data-*`, jak `approveMurder` niesie `killer`); `resendPendingRulings` po reloadzie GMa nie może postować drugiej karty - dedupe po fladze `requestId`.
- Powody odmowy jako klucze i18n, nie prozа z konsoli.
- Refund Meddle uruchamia się u GMa na aktorze Monocuba - przez `automatedUpdate`, żeby resource-guard nie flagował.

### Zadanie 3 - Messenger przez `secret.mjs` (COMM-03, COMM-15) · 1-2 wieczory

**Metoda:** `createThreadMessage` -> `postSecret({ content, whisper, flags })`; `settleCall` -> dokument zostaje stubem, settlowany HTML dostarczany socketem `secret.card` (nowe `updateSecret(message, html)`), potem `message.update({ flags: { settled: true } })`, żeby `drpgMessengerEdited` dalej strzelało. Unread liczone po `message.timestamp` najnowszej widzianej, nie `Date.now()`.

**Pułapki:** `KEEP = 500` w `secret.mjs` - wątki są najdłużej żyjącymi kartami świata i wypadną ze store'u gracza (stare dymki jako "-"); wyłączyć wątki z limitu albo podnieść dla nich. GM dołączający później nie przeczyta historii - `rosterRow` musi to znieść. Po tym zadaniu zadanie 2 pkt 6 może dodatkowo dostarczać połowę GM-only tylko GMom.

### Zadanie 4 - Reroll zgodny z akcją, którą powtarza (ROLL-02, ROLL-03, ROLL-04, ROLL-05, ROLL-06, CASE-06, ROLL-13) · 2-3 wieczory

**Metoda:**
1. Zakładka Search dostaje `claimed: false` (odmówiony token / brak GMa) i `fromVault: true`; `settleSearch` przy którymkolwiek drukuje "the room was never searched" i zwraca `{}`.
2. Reguła "co znaleziono decyduje o śladzie" jako jeden eksportowany helper `leavesTraceFor(category, roles)` używany przez `performSearch` i `settleSearch`; replay przekazuje `room` i `itemIdentity`, `tiedToCrime: null`.
3. `relief` w `context` obu `rollTrait` (Project, Sabotage); `settleProgress`/`settleSabotage` używają `easedBy(def.thresholds, bookmark.relief ?? 0)`; próg naprawy 18 przenieść do `PROJECT_SCALE.complex.repair` w configu.
4. Anulowanie **drugiego** rzutu akcji (Palm, watched Sabotage, watched indirect project) nie zwraca akcji - `return null` bez `abort`, z kartą "the action is spent". Pierwszy dialog dalej można zamknąć za darmo.
5. `throwDice` zapisuje statystykę, którą system faktycznie rzucił (`result.roll?.options?.roll?.trait` - potwierdzić pole na żywym wyniku), mapowaną przez `TRAIT_BY_DH`.
6. `recreationDataFor` budowane z `remnantData(token)` + `remnantPublic` zebranych **przed** `removeRemnant`; po odtworzeniu `setRemnantPublic`.
7. Karta orzeczenia niesie `paid: "grant"|"action"` z `lastSpend` gracza; `refundAction` dostaje to jawnie; `lastSpend` czyszczony po każdym udanym końcu akcji.

**Pułapki:** `tier: null` jest też zapisywane przy zwykłym pudle - klucz na osobnym polu. `breakOnDespair` mógł już zniszczyć narzędzie - `relief` z zakładki, nigdy z ekwipunku. `takeCrisisAction` w murder.mjs też używa `rollTrait` - sprawdzić, czy nie polega na `abort` po wylądowanym rzucie. Determination (`grants: "trait"`) otwiera ten sam select dla każdej akcji - błąd etykiety ROLL-06 dotyczy każdej zmiany statystyki z Calla, nie tylko Search.

### Zadanie 5 - Przedmioty: reguły egzekwowane tam, gdzie są łamane (ITEM-02, ITEM-03, ITEM-04, ITEM-06, ITEM-08, ITEM-09, ITEM-14, ITEM-16, ITEM-10) · 2 wieczory

**Metoda:**
1. Zakładka Bedrooms: usunąć kolumnę "Stash hidden" (zakładka Stashes jest jedyną kontrolką) i przestać pisać `drpgVaultConcealed` w `setVaultRoom`; legacy flaga czytana dalej w fallbacku `stashesOn`.
2. `openProjectDialog` (create): gdy `murder` i brak viewer - `killerId = start?.by`; przy presetach z `by` preselekt "Also visible to" na właściciela proponującego; `createProject` fallback `ownerIdsOf(by)`. GM tworzący pośrednie morderstwo z panelu bez zabójcy dostaje odmowę z ostrzeżeniem, nie ciche zapieczętowanie; tick "Indirect" w managerze otwiera edycję zamiast przyjmować.
3. Reguła Gear "jeden w ręce": zdecydować. Jeśli obowiązuje - po `grantItem`/`retrieve` auto-ready przychodzący przedmiot, gdy drugi jest schowany, z powiadomieniem właściciela (zmienia, co czyta `equippedFor`). Jeśli reguła to tylko "nie odkładaj obu" - powiedzieć to w hincie.
4. `giveItem`/`lootBody`: `if (isStashed(item)) return null` z ostrzeżeniem.
5. `takePlant` ignoruje i usuwa wpis, którego `projectId` nie ma w `projectMeta`; `deleteProject`/`clearAllProjects` czyszczą `trapPlants`/`trapLedger`; sweep na `ready`.
6. Reset sezonu: krok "stashes found" (`unsetFlag(VAULT_FLAGS.found)` per uczeń); `setStash(..., { present: false })` kasuje klucze `::room::actor` z aktorów.
7. `giveKeyDialog` chodzi po `game.scenes` jak `reconcileBedroomKeys`; `shareKey` szuka właściciela pokoju między scenami.
8. `Vault.rifleNote`: albo "Free. A concealed stash needs a Search instead.", albo darmowa ścieżka oznacza szufladę jako naruszoną.

**Pułapki:** nie odmawiać tworzenia w `preCreateItem` - Search straciłby znaleziony przedmiot po wydaniu rzutu i tokenu. `killerId` to id **aktora** wyprowadzone z **użytkownika** przez `testUserPermission` - użytkownik z dwiema postaciami trafia na pierwszą. `takePlant` biegnie w round-tripie tokenu u primary GM - prune ma być tani (jeden filtr).

### Zadanie 6 - Ekonomia Despair przy dwóch GMach i darkeningu (DESP-04, DESP-11, DESP-12, DESP-13, DESP-14, DESP-15, DESP-16 -> zrobione, DESP-08/09/10/18/19/20 teksty) · 1-2 wieczory

**Metoda:** `applyCall`/`convertDespairToHope` sprawdzają `overflowBlocksHope()` **przed** pobraniem Despair i odmawiają z komunikatem (hook kasuje klucz, nie anuluje update'u - po fakcie nie da się wykryć). `spendDespairCall` tylko pobiera (ogłoszenie za opcją `{ announce: false }` z `spendDespairCallFor`), jedna karta po efekcie, przy refundzie krótka publiczna linia "called off". Zapisy pul i overflow przez primary GM (bridge `ACTION_DESPAIR` z poluzowanym guardem dla nadawców GM) albo jedno ustawienie na pulę. Bridge testuje `monokumas().some(u => u.id === target.id)` zamiast roli. `pickProject(kind)`: dla Hope tylko `here`. `gatherEveryone` pomija zmarłych (poza Monocubami). Teksty: `Calls.grants.critical` "a loaded die (one die set to 12)", komentarze cen w `rules.mjs`, `Overflow.what.rot`, `Eclipse.noMovesLeft` "Your Eclipse crossings are used up", zdublowane toasty przy timeout/failed Call, `poolLabel` w tooltipie pipów.

**Pułapki:** klik GMa na własne pipy czekałby na round-trip socketu - widget i tak re-renderuje na `SYNC.despair`. `game.drpg.spendDespairCall` z makr polega na samodzielnej karcie - zostawić jako domyślne tam. Sprawdzić `projectsListedIn`, żeby projekt bez pokoju ("abstract work anywhere") pozostał osiągalny.

### Zadanie 7 - Sprawa i trial: luźne końce (CASE-10, CASE-11, CASE-12, CASE-13, CASE-14, CASE-15, CORE-17, CORE-19) · 2 wieczory

**Metoda:** przycisk trackera "Ask for the opening roll again" po `openingDeclined` (stempel `openingDeclinedAt`); po sukcesie ofiary (pułapka zauważona) szept do GMów z End jako następnym krokiem. Auto-tie tylko gdy `stage === "incident"` **i** źródło jest uczestnikiem lub stoi w pokoju ofiary, albo typ jest `incident`/`resolution`; resztę wiąże `tieChapterTraces` przy śmierci. Jeden GM-side `Hooks.on("deleteToken")` z `dropRemnantSecret` zamiast czterech call-site'ów. `secret.card` przyjmowane tylko od GMa lub autora; `remnant.place` od gracza zawężone (nigdy `key`/`final`/`autopsy`, `reinforced: false`). Lista wydanych kart zamrożona w `openVote` (unia z dołączającymi przez Remind); `castBallot` zamyka otwarte okno przed nowym. Tamper: wydać akcję po rzutach albo refund przy null. `applyChapterEnd({ endingChapter })` odmawia, gdy rozdział już zakończony; `sweepBetrayalWindows` na `isPrimaryGm()`. Linia Next w Investigation: gdy `keyPlanStatus()` mówi "wszystkie znalezione" - "start the trial", `action: "trial"`.

**Pułapki:** `dropRemnant` od gracza idzie przez bridge z `tiedToCrime: null` - decyzja o wiązaniu musi być po stronie GMa; sprawdzić oczekiwania serii D w suite. `undoLastCleanup` odtwarza ślad pod nowym id - tombstone starego jest poprawny. Test `applyChapterEnd({ endTrial: true })` w suite nie podaje rozdziału - guard opcjonalny.

### Zadanie 8 - Mapa: prześwit tokena i nazwy pokoi (MAP-02, MAP-03, MAP-11, MAP-10) · 1 wieczór + live check

**Metoda:** w `applyToToken`, gdy pokój dokumentu jest "mój", a pozycja animowanego mesha jeszcze nie - trzymać ukryty; per-klatkowy `refreshToken` odsłoni po przekroczeniu granicy (wyeksportować `roomAt` z movement.mjs). Lista sąsiadów w `notConnected` filtrowana po zbiorze odkryć gracza (`knownRooms()` z fog.mjs) albo bez listy; `DRPG.Move.notConnected` i `DRPG.Eclipse.notConnected` scalić w jeden klucz. Veto trasy świadome ścieżki (liczyć przejścia z `pathRooms`) albo `sendBack` do ostatniego opłaconego pokoju. `noBudget`/`noMovesLeft` bez "move back"/"Both".

**Pułapki:** koszt: jeden test regionu na animowany cudzy token na klatkę. `neighbouringRooms` służy też tabeli Eclipse i kafelkowi Move - filtrować tylko tekst. `sendBack` zna na pewno tylko `previous`; "środek pokoju" jest ok dla pokoju, nie dla mapy bez korytarzy. MAP-02 najpierw potwierdzić z drugiego miejsca przy stole.

### Zadanie 9 - Wydajność: to, co biegnie co klatkę i co zapis (MAP-07, MAP-13, CORE-12, ROLL-17, UI-14, UI-16) · 1-2 wieczory

**Metoda:** ticker fogu cache'uje `{width, height, ink}` i przerysowuje tło tylko przy zmianie; kolor z `MutationObserver` motywu; jedno `matchMedia` z listenerem `change`; jeden scratch `PIXI.Matrix` w `pinToScreen`. W `repaintFog` sygnatura przed `regionShapes()`; hooki `createToken`/`deleteToken` bramkowane na `type === "character"`. `refreshSheets` renderuje tylko arkusze; jeden `hud` run per rodzaj sync; `setTimeOfDay` z workiem `also`, żeby koniec rozdziału pisał zegar raz; hook `updateSetting` w hud.mjs zawężony do kluczy spoza `SETTING_KINDS`. `paintChatCard` memoizuje trzy tokeny koloru i motyw per przebieg. `ResizeObserver` arkusza na `app` i `disconnect` w `closeCharacterSheet`. `applyRotations` w observerze rails przez `requestAnimationFrame`.

**Pułapki:** `SYNC.searchTokens`/`SYNC.projects` polegają na tym, że `refreshSheets` dociera do HUD (pipsy pokoi, wiersz projektu) - zostawić jawny `hud` run. Ścieżka resize tła fogu musi zostać. `light-dark()` przy `markFrame` zostaje na `var()`.

### Zadanie 10 - UX i wygląd (UI-09, UI-10, UI-11, UI-12, ROLL-11, ROLL-12, ITEM-12, ITEM-13, DESP-06, DESP-17, COMM-11, COMM-13, COMM-14, CORE-06, CORE-10, CORE-18) · 2 wieczory

**Metoda:** `scaleWindow` rozpoznaje arkusz precyzyjnie (`app.document?.type === "character" && app instanceof ActorSheetV2`), bez regexa. `#drpg-popups` pod Stained Glass: `overflow-y: auto` albo osobny pas dla sticky. Tekst z akcentu przez `color-mix(accent 70%, bone)`, GM red nigdy jako tekst. Badge'e Legacy do `var(--drpg-text-xs)`, wartość statusu pod pixel font do 12 px. Observe fallback bez drugiego okna (jak `observeSpecific`); Sabotage z okna Projects z preselekcją (`data-drpg-when="sabotage"`). Picker "Take away" z " - in the stash"/" - broken". Tytuły okien Give generyczne, gdy jest select odbiorcy. Cel Meddle dostaje własne zdanie (`helpTarget`/`hinderTarget`, anonimowe). Badge overflow z `effectName`. Drugie drzwi do safeworda (roster messengera + `game.drpg.safeword()`). Dialog podsłuchu mówi, że kafelek GMa będzie widoczny. `expectAck` z etykietą akcji z configu zamiast literałów. `paintElapsed` dostaje zegar do wyświetlenia (zamrożony w incydencie), `lastPublicClock` seedowany ze stempla incydentu. Select rozdziału `Math.max(CHAPTERS_PER_SEASON, clock.chapter)` i ostrzeżenie o końcu sezonu na ekranie końca rozdziału. `reviveCharacter({ quiet })` z resetu.

**Pułapki:** kafelek powiadomień jest **stałym** panelem kurtyny - rośnięcie ponad 160 px wypycha karty poza pane (kosmetyka), nieczytelne powiadomienie nie jest kosmetyką. `@property --drpg-glass-accent` animuje się także przez `color-mix`. `.drpg-tb-badge` wrażliwe na szerokość przy 850 px arkusza. Gałąź trialu `paintFloorClock` czyta prawdziwy floor - zmienia się tylko gałąź minut.

### Zadanie 11 - Higiena kodu (sekcja 6) · rozłożone w czasie, po 1 wieczorze na plik

**Metoda:** jedna funkcja "kto jest uczniem" (`students({ monocubs })` w `character.mjs`) zamiast pięciu; jedno `hudActor`/`ownCharacter`; `onSocket` w gm-bridge.mjs (770 linii, 24 gałęzie) jako tabela `{ action: { owns: p => p.actorId, run } }` - przy okazji ack **po** guardach; `fog-diagnostics.mjs` wydzielony z fog.mjs (~640 linii konsolowej diagnostyki); podział `playDiscoveryAnimation` (528 linii), `addDoorwayGlow` (379), `flashOutline` (327) wg tabeli w map.md; `openInvestigationDashboard` (625) - `buildCase` osobno; `openRoomSetupDialog` (717) - jedna funkcja na zakładkę; `openItemTables` (749). Usunąć martwe: `performGeneric`, `chooseTrait`, dwie gałęzie `buildGmBody`, 8 martwych kluczy en.json + `betrayTileLabel/Hint`, `#drpg-settings-launcher` (7 reguł), `#drpg-notice` (10), `body.drpg-no-glass-effects` (23), `.drpg-compact` (9), ogon `placeTiles` + `MAX_SHIFT`, `STRIP_SLACK`, `export` na `regionsAt`. Magiczne liczby do configu: `DICE_SETTLE_MS`, `REROLL_WINDOW_MINUTES`, timeouty bridge'a, `COALESCE_MS` x2, `KEEP`, `MAX_ATTEMPTS`. Komentarze sprzeczne z kodem: lista w każdym `findings-1.2.42/*.md` pod "Comments contradicting code" (ok. 30 miejsc). `FOG_BUILD` wyprowadzany z wersji modułu.

**Pułapki:** `tests.mjs` może wołać `performAction` z własnym kluczem - grep przed usunięciem `performGeneric`. Po zmianie selektorów `BLOCKS` w glass.mjs fallback `66x134` był na trzy launchery - przemierzyć. Diagnostyka fogu czyta prywatne zmienne modułu - wydzielając plik, eksportować gettery, nie stan.

### Zadanie 12 - Decyzje reguł (nie kod) · 1 rozmowa

Trzy pytania, na które kod nie odpowie, a każdy z wariantów jest wykonalny w jeden wieczór:

| Pytanie | Wariant A | Wariant B |
| --- | --- | --- |
| Czy gracz widzi DC? (TEXT-14) | nigdzie: usunąć `{n}+` z `findStashHint`, liczbę z `frameHint`, `briefThreshold` z kafelków kryzysu | wszędzie: dopisać progi do briefingów Search/Observe/Analyze/Listen |
| Czy ledger odkrytych pokoi jest alibi? (MAP-12) | tajny per gracz (wzorzec `incidentCast`) | jawny - powiedzieć w hincie |
| Czy pule Despair są publiczne? (DESP-03) | rail maskuje, karty bez liczb (stan po 1.2.43) | wszystko jawne - zdjąć maskę z raila |

### Zadanie 13 (przedostatnie) - Lokalizacja polska i wydanie · zrobione w 1.2.43, do dokończenia przy 1.3.0

Co jest: ustawienie `language` (zębatka w rogu -> Look -> pierwszy select, oraz ustawienia modułu), `lang/pl.json` z pełnym pokryciem, proza `config.mjs` podmieniana w miejscu, cztery formy liczby mnogiej, glosariusz po angielsku, fonty z Latin-Ext, test w suite, scenariusz `50-lang`, narzędzie `tools/config-prose.mjs --check`.

Co zostaje na 1.3.0 (po twojej redakcji angielskiego):

1. **Redakcja pl.json po redakcji en.json.** Workflow: zmieniasz zdanie w `en.json` -> suite "the Polish file covers every English key" wciąż przechodzi (klucz istnieje), ale sens może się rozjechać. Metoda: `git diff` na `en.json` daje listę kluczy; dla każdego poprawić polski odpowiednik. Warto dopisać do `tools/` skrypt `lang-diff.mjs`, który wypisuje klucze zmienione w en.json od danego commita.
2. **Przegląd polskiego przez osobę, która będzie grać.** Odmiany angielskich nazw ("Truth Bulletów", "Remnantów", "w Class Trial") są konsekwentne, ale to decyzja stylu - można wybrać nieodmienianie.
3. **Szerokości.** Kafelki arkusza (`fitTileText`), HUD, pasek statusu, przyciski dialogów - obejrzeć po polsku na 1080p i 900p pod obydwoma motywami. Kandydaci do skrócenia w pl: hinty akcji na kafelkach, `Panel.*` etykiety, `Look.*`.
4. **Teksty systemu Daggerheart.** `DAGGERHEART.*` w pl.json nadpisuje system po angielsku (Despair, Sanity itd.), bo system nie ma polskiego pliku. Jeśli kiedyś Foundryborne wyda pl - sprawdzić kolizje.

**Pułapki:**
- `module.json` **nie** listuje `pl` w `languages` - celowo. Wpis tam ładuje plik według języka core Foundry, a nasze ustawienie ma być niezależne. Nie dodawać.
- `plural()` czyta `moduleLanguage()` w momencie wywołania - pl bez `few`/`many` cicho wpada w `other` (`game.i18n.has` decyduje), więc brak formy nie wywali, tylko da gorszą odmianę.
- `localizeConfig` podmienia proza **w miejscu** w module `config.mjs` - kod, który porównuje etykiety po stringu (np. `SITUATIONAL_PLAYLIST`, nazwy tabel `tableName()`), musi zostać poza `PROSE_KEYS`. Dziś jest; `tools/config-prose.mjs` bez `--check` pokazuje, co dokładnie jest tłumaczone.
- `DRPG.Safeword.word` ("MISIUBOMBO") jest źródłem migracji - w pl.json zostawione identycznie; nie tłumaczyć.
- Zmiana języka wymaga reloadu; `confirmLanguageReload` używa `SettingsConfig.reloadConfirm` - na Forge działa jak reload Foundry.

### Zadanie 14 (ostatnie) - Podręczniki · zrobione, do uzupełnienia

Pliki w `docs/handbooks/`: `player-brochure.{en,pl}.md` (1 strona, sesja 0), `player-handbook.{en,pl}.md`, `gm-handbook.{en,pl}.md`. Pisane z kodu i `en.json`, nie z pamięci, więc liczby zgadzają się ze stanem 1.2.43.

Do zrobienia ręcznie:

1. **Zrzuty ekranu** - broszura powinna mieć jeden zrzut interfejsu z podpisami (HUD, arkusz, kafelki, messenger, zębatka). `docs/img/01-player-view.png` jest dobrym punktem wyjścia.
2. **Forge i Dungeondraft** - kroki są ogólne (link zaproszenia, konto, mikrofon, eksport mapy, regiony jako pokoje). Twoje konkretne ustawienia (rozmiar gridu, jaki asset pack, ustawienia Isometric Perspective per scena) wpisz w GM Handbook sekcja 2 - tego kod nie zna.
3. **Po redakcji 1.3.0** przejrzeć oba handbooki pod nowe brzmienie tekstów (nazwy okien i kafelków są cytowane).
4. Eksport do PDF: `pandoc docs/handbooks/player-brochure.pl.md -o brochure.pl.pdf` z `--variable geometry:margin=1.5cm` mieści się na jednej stronie A4; sprawdzić po dodaniu zrzutu.

**Pułapki:** podręczniki cytują nazwy okien ("GM panel", "Room Setup", "Despair Flow") - dryf terminologii z 3.2 dotknie ich tak samo jak `pl.json`. Broszura celowo nie ma liczb poza akcjami na porę dnia; nie dopisywać reguł, bo przestanie być jedną stroną.

---

## 6. Higiena kodu - pomiary

| Miara | Wartość |
| --- | --- |
| Skrypty / linie | 97 / 89 963 (największy: `fog.mjs` 5 884, `action-rolls.mjs` 4 402, `murder.mjs` 4 008, `config.mjs` 4 025, `sheet.mjs` 3 935) |
| CSS | 20 490 linii; `!important`: danganronpa.css 689, stained-glass.css 260; `:root` zadeklarowany 15 razy w danganronpa.css |
| Funkcje > 300 linii | `onSocket` 770, `openItemTables` 749, `openRoomSetupDialog` 717, `openInvestigationDashboard` 625, `curtainShapes` 608, `playDiscoveryAnimation` 528, `performSearch` 480, `addDoorwayGlow` 379, `gmGiveItemDialog` 380, `flashOutline` 327, `resolveCleanup` 330, `openWhoIsAliveDialog` ~300, `performSabotage` ~300, `applyCall` 295 |
| Funkcje 150-300 linii | ok. 40 (listy per domena w findings) |
| Zduplikowane helpery | "kto jest uczniem" x5, "moja postać" x2, `esc` lokalnie x8, `spendStress/restoreStress` x2, `themeOn` x3, `glassOn` x4, `reducedMotion` x2 (naprawione), tabela seam-glow x4, długość polilinii x4, recipient `<option>` x7, `avclientActive` x2, `ownerIdsOf` vs `ownerOf` |
| Martwy kod | `performGeneric`, `chooseTrait`, 2 gałęzie `buildGmBody`, `settleSteal` (był nieosiągalny - naprawione), ogon `placeTiles`, `MAX_SHIFT`, `STRIP_SLACK`, `export regionsAt`, `ownTokenClearances` w ścieżce rysowania, `CLEANUP.transform.types`, `reportRemnants` bez UI, migracje one-shot uruchamiane co load (`OLD_ICON`, `migrateRemnants`) |
| Martwe klucze i18n | 8 z 2 212 + 2 tylko z testów (lista w findings-1.2.42/text.md §7) |
| Martwe selektory CSS | `#drpg-settings-launcher` 7, `#drpg-notice` 10, `body.drpg-no-glass-effects` 23, `.drpg-compact` 9 |
| Magiczne liczby poza configiem | ~25 (timeouty bridge'a 8 s/180 s/300 s, `DICE_SETTLE_MS`, `REROLL_WINDOW_MINUTES`, `PENDING_TTL_MS`, `KEEP 500`, `MAX_ATTEMPTS 3`, geometria kurtyny x12, `1120x1160`, `SHEET_MIN_HEIGHT 980`, `AUTO_DISMISS_MS`) |
| Komentarze sprzeczne z kodem | ~30 miejsc (lista per domena); najważniejsze: `gm-bridge.mjs:1802` (handler, którego nie ma), `messenger.mjs:7` ("no player-to-player channel"), `config.mjs:88` (`betrayalWindow` "readable on that player's own client"), `cleanup.mjs:1596` (`recreationDataFor`), `api.mjs:320/327/330`, `hud.mjs:14` |

Co działa dobrze i czego nie ruszać: model "jedna władza nad zapisem" i `senderId`; ledgery client-scoped (`remnantSecrets`, `truthBulletSecrets`, `incidentCast`, Mastermind); `keepLive`; `setClock` jako jedyne miejsce zapisu zegara; `migrate.mjs` idempotentne klauzule z read-back; `secret.mjs`; prywatność rzutów po podmiocie, nie autorze; `wipeSeason` jako lista niezależnie chronionych kroków; harness i suite.

---

## 7. Live checks - do zrobienia na prawdziwym Foundry

Rzeczy, których harness nie rozstrzyga; każda to kilka minut na Forge z dwoma kontami.

1. **Search bez odpowiedzi GMa** (40-flow): czy token pokoju wraca razem z akcją. Gracz robi Search, GM nie odpowiada 3 min; sprawdzić `game.drpg.tokensLeft(room)` i akcje.
2. **ROLL-06:** Search, w oknie rzutu zmienić Eye -> Hand; nagłówek karty i chip statystyki. Potwierdzić pole z użytą statystyką na wyniku `rollTrait`.
3. **ROLL-14:** gracz ustawia tryb "Self Roll" w pasku czatu, rzuca z wynikiem Despair; czy pula Monokumy drgnęła.
4. **CASE-03:** z konsoli gracza `game.messages.contents.filter(m => m.flags["danganronpa-rpg"]?.secret).map(m => [m.speaker.alias, m.whisper])` w trakcie incydentu.
5. **COMM-03:** `game.messages.filter(m => m.getFlag("danganronpa-rpg","thread") && m.getFlag("danganronpa-rpg","thread") !== game.user.id).map(m => m.content)` u gracza.
6. **COMM-02:** odpalić pułapkę (E21) i patrzeć na ekran GMa: popup? dźwięk? przyciski w logu?
7. **MAP-02:** z drugiego miejsca obserwować wejście cudzego tokena do swojego pokoju - czy sprite pojawia się w starym pokoju i wjeżdża.
8. **CORE-13:** świeży świat na 1.2.43 z angielskim; safeword na arkuszu i czat po "already had a safeword".
9. **CORE-06:** jako postronny w incydencie patrzeć na licznik minut HUD, gdy GM przesuwa godzinę.
10. **DESP-04:** zaznaczyć tylko "Despair" w kapeluszu overflow, odpalić, potem Fuel a Monocub - Hope bez zmian, pula spadła?
11. **DESP-12:** dwóch GMów, jeden ciągle rzuca uczniami (+1), drugi płaci Calle; porównać pasek z sumą.
12. **UI-09/10:** popout Actors i arkusz NPC pod Stained Glass; trial z dwiema sticky kartami + odmowa u gracza.
13. **Polski:** kafelki arkusza, HUD, pasek statusu, panel, okno Look na 1080p i 900p pod obydwoma motywami; DevTools Network - czy `*-LatinExt.woff2` się ładuje.
14. **Lokalizacja przy dwóch przeglądarkach:** GM po polsku, gracz po angielsku - karty publiczne są pisane w języku **autora** (tekst jest formatowany przy tworzeniu). To nie błąd, ale warto wiedzieć: mieszany stół zobaczy mieszany czat.

---

## 8. Jak wydać 1.2.43

Workflow `.github/workflows/release.yml` buduje paczkę z `git archive` na commicie, na którym go uruchomisz, i sprawdza teraz trzy rzeczy: `module.json` = tag, stempel `--drpg-css-version` = `module.json`, istnienie `.github/release-notes/<tag>.md`. Wszystkie trzy są w gałęzi gotowe.

1. Zmerguj `claude/module-qa-audit-localization-hg1lhu` do `main` (PR albo fast-forward).
2. Na GitHubie: Actions -> Release -> Run workflow -> gałąź `main`, tag `v1.2.43`, cleanup_prereleases zostaw wyłączone.
3. Po zakończeniu: `gh release view` pokaże `v1.2.43` jako latest; manifest `releases/latest/download/module.json` zaktualizuje się sam.
4. Na Forge: Update w Bazaarze albo ponowna instalacja z manifestu; po aktualizacji `game.drpg.runTests({ tier: 1 })` u GMa - test "the stylesheet ships with the version it says it does" musi przejść (przy 1.2.42 nie przechodził, bo CSS mówił 1.2.41).

Nie uruchamiałem workflow z gałęzi - wydanie z niezmergowanej gałęzi zostawiłoby `main` w tyle za `latest`.

---

## 9. Stan po naprawach - gałąź `claude/module-qa-audit-localization-hg1lhu` po 1.2.43

Zadania 1-11 z sekcji 5 są zrobione na gałęzi, po jednym commicie na zadanie. Każdy commit przeszedł suite (`game.drpg.runTests({ tier: 2 })`: 117 przechodzi, 12 pada - te same 12 co przed naprawami, wszystkie wymagają prawdziwego canvasu, CSS albo Dice So Nice) i komplet scenariuszy harnessu (40-flow 35/35, 10-murder 17/17, 11-killer-secrecy 5/5, 12-social 9/9, 20-crit-hope 3/3, 30-security 6/6, 50-lang 43/43).

| Zadanie | Commit | Co weszło |
| --- | --- | --- |
| 1 - LIVE-001 | `90c6988` | Karty "veiled" (neutralny mówca, słowa tylko do adresatów), oferta zdrady i użyta broń w `incidentCast`, migracja starych flag z aktorów |
| 2 - jeden kanał do GMa | `d079a1e` | Karty z przyciskami dla Hope Calli, Dynamic, przedmiotów, Monocuba; każda odmowa GMa dociera do gracza; `Bridge.what.*` po polsku |
| 3 - messenger | `f6e5a5c` | Wątki jako karty prywatne (`secret.mjs`), nieprzeczytane po stemplu wiadomości |
| 4 - Reroll | `3734f91` | Reroll powtarza akcję jej własnymi regułami (ślad Search, ulga narzędzia, statystyka z rzutu, `paid`) |
| 5 - przedmioty | `e38d22a` | Sypialnie z regionów, skrytki blokują handover, pułapki sprzątane z projektem, mord bez zabójcy odmawiany |
| 6 + 7 - Despair, sprawa | `5c66ffa` | Darkening blokuje Hope, jeden GM zapisuje pule, `remnant.place` zawężony, reask otwarcia, `issuedTo` w głosowaniu, guard końca rozdziału |
| 8 - mapa | `8d24e21` | Token ukryty do przekroczenia granicy (MAP-02), "not connected" tylko ze znanymi pokojami (MAP-03), cofnięcie do opłaconego pokoju (MAP-11), fog bez pracy per klatka (MAP-07/13/14) |
| 9 - wydajność | `6e59551` | Jeden `renderHud` na zmianę zamiast czterech (CORE-12), memo kolorów kart (ROLL-17), obserwator arkusza odłączany (UI-14), rail w rAF (UI-16) |
| 10 - UX | `b708865` | UI-09/10/11/12, ROLL-11/12, COMM-11 (`game.drpg.safeword()` + keybinding), COMM-13, CORE-06/10/13/18 |
| 11 - higiena | `b3604be` | 10 martwych kluczy, martwe selektory (`#drpg-notice`, `#drpg-settings-launcher`, `.drpg-no-glass-effects`, `.drpg-compact`), jeden `esc`, poprawione komentarze |
| 12 - karta eventu | `1c0dde8`, `ffd4543` | Karta overflow na panelu eventów (karta Eclipse dodana i na prośbę z 13.09 zdjęta) |
| Higiena A | `94fc972` | Zduplikowane helpery scalone: `actingStudents`/`ownStudent`, `markResolutionStress`, `polylineLength`, `glassOn`/`SEAM_GLOW` z motion.mjs, `ownerIdsOf` |
| Higiena B | `e45abe5`, `e588ee2` | Wszystkie timeouty w `TIMING` (config.mjs), sweep ikon jako klauzula migracji, `PROJECT_SCALE.everyday.progress` zamiast 4, `newItemIdentity` w traps, ostatnie nieaktualne komentarze |
| Higiena C | `e9971b8` ... `93a89bd` (16 commitów) | Każda funkcja >300 linii z sekcji 6 podzielona (onSocket jako tabela handlerów, openItemTables, openRoomSetupDialog, openInvestigationDashboard, curtainShapes, playDiscoveryAnimation, addDoorwayGlow, flashOutline, performSearch, performSabotage, resolveCleanup, gmGiveItemDialog, openWhoIsAliveDialog, applyCall) i 30 z listy 150-300; ciała przeniesione, nie przepisane; po każdym pliku suite + scenariusze, dla glass.mjs dodatkowo DOM harnessu kurtyny bajt w bajt w 3 rozdzielczościach; zostały `registerSettings` (płaska tabela rejestracji) i `steps()` (tabela danych) |
| Higiena D | `31599e5` | 15 bloków `:root` w danganronpa.css scalone w jeden (każdy token z tą samą wartością końcową), martwa reguła `.drpg-safeword-button`, 6 ostatnich komentarzy sprzecznych z kodem |
| 13 - rozliczenie | `7e40243` | Pełne rozliczenie 152 ID z `findings-1.2.42/` kontra kod: 25 znalezisk, które nie weszły do zadań 1-11, domknięte tu (COMM-05/09/17/18, CORE-16, ITEM-17/18, MAP-15, ROLL-10/14/15/16, TEXT-09/11/12/13/15/16/17/18/19, UI-06/07/13). Pozostałe otwarte ID to wyłącznie decyzje z 9.1 (ITEM-04, MAP-12, DESP-03, CASE-11) |

**34 ID zamknięte pod innymi nazwami** (skrypt rozliczeniowy ich nie widzi, bo commit ani komentarz nie wymienia ID; sprawdzone ręcznie w kodzie 13.09): CORE-03/04/09/15, DESP-08/09/10/16/18/20, ITEM-10, MAP-05/06/08/09/10, TEXT-02/04/05/06/07/08/10/11/12/13/15/16/17/18, UI-01/02/04/05.

**Bilans po zadaniu 13.** Skrypt rozliczeniowy (każde `### ID` z `findings-1.2.42/*.md` szukane w sekcji 2 tego raportu, w commitach gałęzi i w komentarzach kodu) dał 152 znaleziska: 49 zamknięte w 1.2.43, 78 w zadaniach 1-11 i 13, 4 czekają na decyzję (ITEM-04, MAP-12, DESP-03 i CASE-11 - tabela 9.1), a reszta to pozycje "live check" z sekcji 7 i 9.2, których harness nie rozstrzyga. Wcześniejsze zdanie w tej sekcji, że po zadaniach 1-11 "zostały same decyzje", było za mocne: 25 drobnych ID (teksty, higiena, dwa wyścigi socketów) nie miało swojego zadania i weszło dopiero w 13.

Wydane jako 1.2.44 (decyzja z 13.09: "na koniec wrzuć całość jako release 1.2.X", co zastąpiło D10 B): `module.json` i stempel CSS mówią 1.2.44, notatki w `.github/release-notes/v1.2.44.md`, `main` przesunięty na tę gałąź, workflow Release uruchomiony z tagiem `v1.2.44`. Live checki z 9.2 pozostają do zrobienia na prawdziwym Foundry po aktualizacji.

### 9.3 Po 1.2.44: cztery stany i ekrany, które nie są biurkiem (wydane jako 1.2.45)

| Commit | Co weszło |
| --- | --- |
| `d5f8b0e` | Dwa komentarze wskazujące po podziałach na stary kształt kodu |
| `d6b069e` | **Faza jest właścicielem swojego stanu**, którąkolwiek drogą ktoś ją zapisze (`setClock` uzgadnia: wyjście z `classTrial` zamyka piętro, wejście resetuje postęp i nalicza za nieznalezione klucze; wygaszony Eclipse czyści swoje ruchy i rozgłasza `SYNC.eclipse`), więc zakończenie triala przez Edit campaign kończy go naprawdę. Karta incydentu na panelu eventów czyta obsadę z `incidentCast`, nie ze świata, więc nie znika po opening rollu. Kurtyna jest przecinana ponownie po powrocie do karty przeglądarki (`visibilitychange`), więc po zniknięciu panelu nie zostaje tafla z blurem nad niczym. Reset sezonu czyści też trwający incydent i jego obsadę. Trzy testy regresji |
| `c7014db` | **A** - progi ekranu (`BREAKPOINTS` w `settings.mjs`, jedno miejsce; arkusz i kurtyna czytają stamtąd), klasy `drpg-stacked`/`drpg-short` na `body`, kurtyna z własną bramką i płaskim tłem `drpg-glass-flat`, okna bez szkła tam, gdzie nie ma kurtyny (puls nic nie przemalowuje) |
| `aa9b9a6` | **B** - poniżej 1200 px bloki wychodzą z kolumn Foundry i układają się w stos (`scripts/narrow.mjs`, `styles/narrow.css` ładowany jako ostatni). Prawa kolumna przenoszona w całości, więc kafelek Projektów przychodzi z nią. Zegar jako zawijany wiersz, pipsy Despair 18 → 13 px |
| `240f0ff` | **C** - `stackShapes` w glass.mjs: partycja dla stosu budowana przez cięcie ekranu prostymi (dwa wypukłe kawałki z jednego, więc brak dziur i nakładek z konstrukcji). Wiersz przewinięty pod sufit stosu przycinany do tego, co widać. `pinRightColumn` nie działa przy stosie |

**Pomiary (harness kurtyny, headless Chromium, każdy rozmiar osobno).** Nakładające się pary bloków / bloki poza własną taflą / dziury przy krawędzi ekranu:

| Ekran | Przed | Po |
| --- | --- | --- |
| 1920x993, 1366x768, 1280x800 | 0/0/0, 0/0/0, 0/16/0 | bez zmian (32, 19, 16 tafli) |
| 1024x768 | 2/12/0 | 0/0/0 |
| 820x1180 | 3/20/0 | 0/0/0 |
| 500x813 | 5/14/122 | 0/0/0 |
| 393x852 | 5/11/131 | 0/0/0 |
| 360x740 | 5/15/199 | 0/0/0 |
| 980x386 | 2/16/169 | stos + płaskie tło (bez kurtyny) |

Czysto od 280x653 w górę. Skala (`autoScale`) nie była ruszana: podłoga 0.7 chroni typografię, a za "za duże na telefonie" odpowiadał układ, nie skala - obniżenie podłogi geometrii przy podłodze typografii 0.85 odtworzyłoby regresję z audytu 08.09.

Suite 122/12, osiem scenariuszy zielone, `config-prose` 490/490.

**Nowe live checki** (harness ich nie rozstrzyga, do sprawdzenia na prawdziwym Foundry):

18. Zakończenie triala przez Edit campaign zamyka piętro.
19. Panel eventu przeżywa opening roll.
20. Przełączenie karty przeglądarki i powrót: żadnej tafli z blurem nad niczym.
21. Telefon i tablet: dotyk, przewijanie stosu palcem, i czy Foundry samo przycina pozycję okien do ekranu (`ApplicationV2` klamruje `left`/`top` - założone, nie zmierzone).
22. **Stopka okna z tabelą przypięta w tej samej klatce** (16.09). `fitWindowToTable` i `fitWindowToTabs` wołają teraz `pinFooterAcrossScroll` od razu po `setPosition`, a dopiero potem jeszcze raz po dwóch klatkach. Zmierzone w Chromium: odczyt `content.clientWidth` tuż po zapisie szerokości widzi już **nową** szerokość (900 tam, gdzie stara była 400), bo odczyt wymusza przeliczenie układu - czyli te dwie klatki nie kupowały przeliczenia, wbrew notce, która tam stała. **Czego stąd nie da się rozstrzygnąć:** czy to samo zachodzi przez `ApplicationV2#setPosition({ height: "auto" })`, które pisze przez Foundry'ego i może się ścigać z jego własnym zapisem pozycji po renderze. jsdom nie odpowie - nie ma układu, `scrollWidth` to 0, `pinFooterAcrossScroll` wychodzi na `!scrolls`, więc test headless przeszedłby, nie mierząc niczego (to dokładnie awaria `stackShapes` z CLAUDE.md). **Jak sprawdzić:** otworzyć Investigation dashboard (okno, którego tabela naprawdę się nie mieści), przewinąć w prawo i sprawdzić, czy pasek przycisków jest osiągalny. Gorszy przypadek jest bezpieczny: późne wywołanie zostało jako siatka bezpieczeństwa, a funkcja jest idempotentna i sama sprząta, gdy nic się nie przewija.
23. **Kto ma prawo znaleźć cudzy projekt** (16.09). Non-obvious Observe w pokoju, w którym stoi sekretny projekt, rzuca przeciw DC 18 (`PROJECT_OBSERVE`, czyli `hidden`x`prep` z tabeli Observe) i po sukcesie dopisuje znalazcę do widzów projektu - tym samym `shareWith`, którym zabójca wciąga wspólnika. **Czego kod nie rozstrzyga:** czy tak samo ma działać rig morderstwa pośredniego. Dziś działa, bo jedna reguła bez wyjątku to jedyny rodzaj, jaki ten plik utrzyma w zgodzie z resztą - i bo student zauważający przygotowania zabójcy to gra działająca, nie przeciek. Ale znalazca dostaje ten sam dostęp co wspólnik (`canSee` -> może przy nim pracować, może go sabotować), a to już jest pytanie do stołu, nie do kodu. **Jak sprawdzić:** rozegrać jedną taką sytuację i zobaczyć, czy to psuje rozdział; GM cofa `unshareWith`. Jeśli odpowiedź brzmi "nie", wyjątek jest jedną linią w `secretsUnknownIn`.
24. **Pasmo 1200-1247 px: to nie kurtyna, to układ** (16.09). Zmierzone w Chromium, świeże wczytanie co 16 px (`audit/glass-harness.html`, wysokość 800, skala własna ekranu 0.7). Szyna Despair jest wyśrodkowana, a prawa kolumna przyklejona do ściany, więc zbliżają się do siebie w miarę zwężania ekranu; odstęp między nimi to `W/2 - 628`. Poniżej ~1248 px jest **ujemny** - pudełka obu bloków nachodzą na siebie fizycznie, po 4 px przy 1248 i 28 px przy 1200. Dwa bloki zajmujące to samo miejsce nie mogą dostać osobnych tafli, bo tafle nie mogą się nachodzić, więc samosprawdzenie melduje 16 `blockFails` i melduje prawdę. Nie jest to stała szerokość: szerokość szyny zależy od liczby wierszy Despair i od suwaka skali (0.8-1.4), więc przesunięcie progu `BREAKPOINTS.narrow` tego nie rozwiąże - przy suwaku 1.4 kolizja zaczyna się dużo wyżej. **Czego stąd nie da się rozstrzygnąć:** czy to w ogóle widać przy stole. Na zrzucie przy 1216 tusz się nie zderza - nachodzą marginesy - a skutek jest taki, że szyna Despair stoi na tafli tacki zamiast na własnej. **Jak sprawdzić:** zwęzić okno Foundry'ego do ~1220 px i zobaczyć, czy pasek Despair i pasek stanu są za blisko. **Możliwe dźwignie, żadna jeszcze nie wybrana:** ograniczyć szerokość `#drpg-despair` do tego, co zostaje między kolumnami; przestać centrować szynę, gdy nie ma na to miejsca; albo podnieść próg układu stosu.
25. **Karta dowodu nie mieści się w rogu i kafelek nie może urosnąć** (16.09). Kafelek powiadomień pod Stained Glass ma sztywne 430 x 220 z `overflow: hidden`, a karta Class Triala z Truth Bulletem, jego analizą i komentarzem potrzebuje 459 px przy 1920 x 1080 - na ekranie zostawała nazwa, cztery plakietki i nic więcej. Karta ma teraz własny pasek przewijania zamiast obcinania, więc nic nie ginie. **Czego kod nie rozstrzyga:** gdzie ta karta ma naprawdę stać. Powiększenie kafelka zostało zmierzone i odpada: róg dzieli miejsce z szyną narzędzi Foundry'ego, a jej wysokość jest ograniczana tak, by kafelka nie dotykała (`room` w `moduleLayout`). Przemiot w Chromium na 1920x1080, 1440x900, 1280x800, 1366x600 i 1024x768: 430x220 czyste, 430x260 nakłada się na szynę przy 1366x600, 430x300 daje 19 dziur przy krawędzi na 1280x800, 430x480 rysuje szynę narzędzi na gołej mapie przy 1440x900. Szerokość nie pomaga - 620x260 jest gorsze niż 430x260, bo pochylenie tafli rośnie z szerokością. **Możliwe dźwignie, żadna niewybrana:** dowód dostaje własne miejsce na czas triala (środek ekranu jest pusty); albo kafelek przesuwa się w prawo, za szynę, tak jak już robi to układ stosu (`noticesClearOfTheTools`); albo zostaje jak jest, z przewijaniem.




### 9.1 Decyzje - podjęte 13.09 i wdrożone

| # | Decyzja | Wybór | Commit |
| --- | --- | --- | --- |
| D1 | Progi widoczne | **A**, dynamicznie: każdy briefing drukuje progi z tabeli dla tej postaci (narzędzie w ręce, świadkowie, świeża scena), okno rzutu mówi "beat N" | `5858b2a` |
| D2 | Ledger odkrytych pokoi | **B**, tajny per gracz (unia u GMa, własne wiersze u gracza, pull przy dołączeniu, odbudowa unii z klientów, migracja z world setting; scenariusz 60-ledger 14/14; przekaźnik harnessu honoruje `recipients`) | `f78de10` |
| D3 | Pule Despair | **C**, liczby jawne, overflow zamaskowany | `1210949` |
| D4 | Gear "jedno w ręce" | **A**, auto-ready na każdej drodze wejścia z szeptem do właściciela | `1210949` |
| D5 | Wiązanie śladów w incydencie | **B**, tylko uczestnicy albo pokój incydentu, reszta do decyzji GMa | `1210949` |
| D6 | Nieudany sabotaż | **B**, tylko pokój i GM | `1210949` |
| D7 | Podsłuch LiveKit | usunięty w całości; reset głosu jako kafelek w Między sesjami | `1210949` |
| D8 | Redakcja tekstów | **B**, pierwszy przebieg wg 3.2 i 3.3 (poniżej) | ten commit |
| D9 | Alias i `SETTINGS.blackened` | **B**, usunięte teraz (wpis w notatkach 1.2.44) | `1210949` |
| D10 | Wydanie 1.2.44 | **B** zmienione 13.09 na "wydać całość jako 1.2.X" - wydane jako 1.2.44 po higienie | (ten commit) |

Dodatkowo (prośba z 13.09): karta eventu dla Despair overflow na panelu (`1c0dde8`); karta Eclipse zdjęta na drugą prośbę (`ffd4543`).

**D8 - co weszło z 3.2:** "phase" → pora dnia w `Settings.hudTicker.hint` i `Summary.lede`; `Vote.verdictNoteKnown` "every Blackened"; `Calls.whichPlayer` "Which student?", `Panel.whoIsAlive` "Students" (PL już było "Uczniowie"); "Final Truth Remnant" wszędzie; "Free Move" wielką literą (11 kluczy); OBJECTION wielkimi tylko na banerze, przycisku i trybie; "Analyze" w `config.mjs`; "Role reversal"; "Level Up"; "hiding place"/"drawer" → "stash" (12 kluczy); "Gamemaster" → "GM" poza rolą Foundry; "clue" tylko w planerze Key Remnantów. **Z 3.3:** wszystkie skróty z tabeli (config: `finishingBlow.hint`, `useItem.hint`, `freeCrit.effect`; klucze: `Music.noSituational`, `Eclipse.actionsLocked`, `Anonymity.blocked`, `Assign.title`, `Observe.pickConfirm`, `Eclipse.endAndAdvance`, `Chapter.endTitle`, `Trap.rearm`, `Hud.roomTokens`) w obu językach. **Nie ruszone, do Twojego przebiegu 1.3.0:** masowe ujednolicenie Remnant/trace (56+78 kluczy), GM/Monokuma w prozie, student/character/player poza dwoma kluczami, etykiety kafelków "Behind Closed Doors"/"Public Announcement" (to nazwy z glosariusza - skrócenie ich to Twoja decyzja).

### 9.1a Co zostało do zrobienia (stan po 13.09, po higienie)

Wszystkie 152 ID z `findings-1.2.42/` są zamknięte albo rozstrzygnięte decyzją; sekcja 6 (higiena) jest zrobiona w całości (A-D powyżej). Zostają trzy rzeczy, żadna nie jest kodem do napisania teraz:

| # | Co | Kto | Kiedy |
| --- | --- | --- | --- |
| 1 | Live checki z sekcji 7 i 9.2 na prawdziwym Foundry (canvas, CSS, Dice So Nice, LiveKit) | GM przy stole | po aktualizacji do 1.2.44 |
| 2 | Ręczna redakcja tekstów wg 3.1-3.3 (Remnant/trace 56+78 kluczy, GM/Monokuma w prozie, etykiety "Behind Closed Doors"/"Public Announcement") | Dawid | 1.3.0 "Stained Update" |
| 3 | `registerSettings` (505 linii kodu, płaska lista rejestracji) i `steps()` (tabela danych) zostają długie z natury; jeśli kiedyś przeszkadzają, naturalny szew to jedna funkcja na grupę ustawień | - | opcjonalnie |

### 9.3b Przegląd 14.09 i jego wdrożenie

Przegląd całości po 1.2.45 dał ocenę 8/10 i listę siedmiu punktów. Cztery z nich są kodem i zostały wdrożone tu; trzy nie są moje (live checki przy stole, redakcja tekstów 1.3.0) albo są nimi tylko częściowo (pomiar wydajności na żywo).

| Commit | Punkt | Co weszło |
| --- | --- | --- |
| `6693b47` | 1 | **Defekt wydany w 1.2.45.** Stos sięgał 8 px od prawej krawędzi, a pasek zakładek Foundry stoi w ostatnich ~50: 48 px każdego wiersza było za nim (48x419 przy 393x852, 48x386 przy 820x1180, 48x353 przy 1024x768) - na szynie Despair dokładnie tam, gdzie są liczniki. Odstęp mierzony od lewej krawędzi samego paska, nie od szerokości. Ten sam pomiar znalazł drugą kolizję: kafelek powiadomień na szynie narzędzi (80 px z 393). Utrata 56 px zepchnęła stepper Despair do własnej linii - wiersz nie zawija się już wcale, bo to właśnie zawijanie blokowało kurczenie: pipsy są jedyną częścią, która ustępuje |
| `b85316e` | 2 | **Re-triage 12 akceptowanych porażek.** Trzy to był harness: shim trzymał dane dokumentu w `_source` za garstką ręcznych getterów, więc `wall.c` było `undefined` - stąd "32 kwadraty otwarte" w teście schodkowej ściany. Moduł miał rację od początku. Czwarta to `innerText`, którego jsdom nie ma. Piąta to limit plecaka (test grantuje teraz z `override`). Dziewięć pozostałych naprawdę wymaga przeglądarki i mówi czego: `needs(warunek, dlaczego)` rzuca `Skipped`, runner liczy je osobno. **125→126 przechodzi, 0 pada, 9 pominiętych**; `01-runtests` 4/4 pierwszy raz. Scenariusz pilnuje też, by liczba pominiętych nie rosła |
| `7d2bff4` | 4 | **Dostępność.** `scripts/a11y.mjs`: jedno przemiecenie nadaje `aria-label` kontrolkom, które mają tylko ikonę i tooltip (tooltip jest rysowany, nie odczytywany); kontrolki, których nie umie nazwać, trafiają do `game.drpg.a11y()` - nazwa zmyślona jest gorsza niż cisza. Stos powiadomień i karta eventu to `aria-live="polite"`. Fokus wchodzi do okna modułu przy otwarciu. `forced-colors`: kurtyna i opaski okien (canvasy, których wymuszona paleta nie dosięgnie) znikają, reszta dostaje systemową ramkę i dwa kolory, pipsy mówią "wydany" obrysem zamiast przezroczystością, pierścień fokusu przez `Highlight`. `prefers-contrast: more` podnosi przygaszony bone. **Korekta do przeglądu:** `--drpg-sg-gm` 4.03 nie było błędem AA - ten token nigdy nie jest literą (52 użycia: tło, ramka, pędzel). Jedyne miejsce, gdzie czerwień niesie słowa, to plakietka prep (bone 4.18, naprawdę za mało) - ma teraz 90% czerwieni na tuszu, bone 4.96 |
| `4cd10a5` | 5 | **Pomiar wydajności.** Headless: puls kosztuje 91 ms/klatkę przy 1920x993, 55 przy 1366x768, 2 na telefonie - co mówi, jak koszt skaluje się z powierzchnią tafli, i nic o prawdziwej maszynie z GPU (headless Chromium składa canvas programowo). Puls jest już malowany w połowie rozdzielczości, więc oczywista oszczędność była wzięta dawno. `game.drpg.perf()` zdejmuje liczbę tam, gdzie ktoś gra: budżet klatki jak jest, z wstrzymanym pulsem, różnica, jedno przecięcie szkła, gorące lookupy |
| `df52472` | 7 | `CLAUDE.md` (komendy, co znaczą trzy liczby suite, pułapki, styl, wydanie) i `CONTRIBUTING.md`. Oba `export-ignore` |

**Nie moje:** punkt 3 (live checki - sesja przy stole) i punkt 6 (redakcja tekstów 1.3.0 - Dawid).

Wydane jako 1.2.46: `module.json` i stempel CSS mówią 1.2.46, notatki w `.github/release-notes/v1.2.46.md`, `main` przesunięty na tę gałąź, workflow Release z tagiem `v1.2.46`.

### 9.3c Wydanie 1.2.47

Dwadzieścia commitów, i większość z nich ma ten sam kształt: coś, co moduł trzymał w dwóch miejscach, albo pokazywał w miejscu za małym na to.

| Commit | Co weszło |
| --- | --- |
| `1530a7c` | **Dwupoziomowy opis Remnantu.** Observe kupuje pierwszy, Analyze drugi; jeden zapis w kluczu odpowiedzi, publikowany na kopię dopiero temu, kto za niego zapłacił |
| `e4359e4`, `983b7c6` | **Polski.** Teksty przestają zakładać, kto trzyma kontroler, i przestają mówić o jednym uczniu w liczbie mnogiej |
| `bf135d9`, `bfa0d2a` | **Morderstwo, które widzą tylko jego ludzie.** Czerwone krawędzie, karta eventu i playlista `murder` dla uczestników, GM-a i strony trzeciej wchodzącej do pokoju - i dla nikogo więcej. Morderstwo pośrednie nie mówi nic swojemu zabójcy: jest gdzie indziej, a rzuca ofiara |
| `fe22044`, `7bc370b` | **Co kosztuje płynność, zmierzone.** Dominuje pełnoekranowy `backdrop-filter` kurtyny - malowanie, nie skrypt. Trzy optymalizacje obalone tym samym pomiarem i wpisane do arkusza, żeby nikt ich nie powtarzał. `game.drpg.perf()` i `game.drpg.whySlow()` zdejmują liczbę przy stole |
| `b9b300e`, `b4d198a`, `09280e4` | **Przestaje płacić za nic.** Trzy obserwatory budzone przez rzeczy, które się nie wydarzyły; arkusz rotacji pisany, gdy reguły się zmieniają, a nie co przebieg; stopka przypięta w tej samej klatce |
| `db108c2`, `35b09de` | **Pack i tagi.** Grupowanie i sortowanie po rozdziale albo po lokacji; Faint staje się typem odkrywanym przez Analyze; tagi znikają, a GM poprawia typ z dashboardu |
| `217ef6f`, `2f80ffd`, `862ab3f` | **Projekty na mapie.** Token, bramka odkrywania (wejście do pokoju / Observe na sekretny), i jedna reguła `knowsProject` pytana na każdym kliencie - bo dokument tokena dociera do każdej przeglądarki, a `hidden` znaczy "tylko GM" |
| `19be6a6` | **Trzy samozwrotne pomiary w kurtynie.** Kolumna to stos, nie sąsiedztwo; pin czytany z nieobróconej szyny; klatka czytana z szerokości, którą kurtyna sama wpisała |
| `fbf870c`, `3bd9cad` | **Dowód.** Niesie opis po analizie, przestaje być ucinany, i dostaje środek ekranu. Panel eventów w obu motywach, z kartami safeworda i otwartego głosowania |
| `f0ea05f` | **Planner Key Remnantów mówi, co jest na mapie** - a nie jaki był domyślny wybór |

**Nowe live checki:** 23 (czy rig morderstwa pośredniego ma być znajdowany przez Observe), 24 (pasmo 1200-1247 px to kolizja układu, nie geometrii), 25 (gdzie ma naprawdę stać karta dowodu - wybrane rozwiązanie: własne miejsce na czas triala).

Weryfikacja: suite 140 passed, 0 failed, 9 skipped; dziesięć scenariuszy zielonych; proza 492/492; samosprawdzenie kurtyny czyste przy wszystkich ośmiu rozmiarach.

**Znaleziska tego przeglądu, których nie ruszałem:** przyciski launcherów nachodzą na pasek zakładek o 34 px, identycznie przy 1920x993 - to układ biurka sprzed tej pracy, nie stosu. Przy 280-320 px szerokości kafelek Projektów styka się z launcherami.

### 9.3d Po 1.2.47: trzy uwagi od stołu (niewydane)

Zgłoszone 16.09, po wydaniu 1.2.47. Wszystkie trzy to jedna klasa błędu - element,
który stoi obok swojego szkła zamiast na nim albo w nim.

| Co zgłoszone | Co się okazało | Czym naprawione |
| --- | --- | --- |
| "Powiadomienie jest za małe na swój kafelek" | Karta zajmowała 110 z 165 px kafelka przy 1920x1080 i 86 z 220 przy 2560x1440 - im szerszy kafelek, tym mniej wierszy zawija to samo zdanie, więc luka rośnie z ekranem. Do tego zapomniana reguła z 1.2.27 (`max-height: 148px * --drpg-sg-scale`) stała PÓŹNIEJ w pliku niż ta pisana dla kafelka 220 px, więc wygrywała każdy remis: karty rozwiązywały się do 125,8 px na kafelku o 165 | `flex: 1 0 auto` na karcie (`1 1 auto` sprawdzone i odrzucone: przy dwóch kartach kurczy krótszą do 37 px, bo pojemnik przewijany ma minimalny rozmiar zero), płyta treści rozciągnięta na resztę karty, tekst wyśrodkowany przez `align-content` na kontenerze BLOKOWYM - żeby marginesy akapitów dalej się zlewały. Stara reguła wysokości skasowana, nie poprawiona |
| "Token projektu nie ma tej samej ramki, co remnanty" | `paint()` w `remnant-ring.mjs` wychodziło na pierwszej fladze: token bez `isRemnant` to był token z zniszczonym pierścieniem | Gałąź projektu w `frameFor()`. Kolor czytany z WŁASNEGO tintu tokenu, który `projects-map.mjs` wpisał ze stanu projektu - jedna liczba, ten sam dokument, żadnego drugiego odczytu z odliczania (ono jest bramkowane własnością i może nie być tego klienta). Jedna waga: "ukończony" mówi już kolor, a ciężka ramka znaczy na tracie "wzmocniony". Test regresji z mutacją sprawdzoną |
| "Kafelki po prawej nachodzą na sekcję projektów i akcji" | Prawdziwa regresja, i nie tam, gdzie wyglądała. `pinRightColumn` rezerwuje odstęp od szyny zakładek, ale rezerwował tylko SWING (wychylenie obrotu), a `railBox` rezerwuje `swing + slack`, gdzie slack to koszt pochyłej krawędzi tafli na długości szyny - około 51 px przy szynie 620. Kolumna stała 43 px w środku pasma, przez co liczyła się jako przyklejona do ściany (`hugR`, próg 120 px), jej tafla wbiegała pod szynę, a kawałek tafli nachodzący na taflę treści jest wyrzucany przez partycję - więc górne kafelki szyny stały na szkle tacki | Pin rezerwuje `swing + slack`, ale bierze tyle, ile zostawia mu szyna Despair (wyśrodkowana, nie może ustąpić): nigdy mniej niż przedtem, nigdy tak daleko, żeby przeciąć ją swoim paddingiem. Osobno: wypełniacz jest teraz wycinany z pasma na całej wysokości, nie tylko na biegu kafelków - sekcje i tak są z tego zwolnione, a ograniczenie kosztowało 5 px gołej mapy w prawym górnym rogu |

#### Pułapka pomiarowa, przez którą pierwsza tura liczb była nieprawdziwa

`liveSignature()` czyta tylko BLOCKS - szyny Foundry nie są blokami z rozmysłem (patrz
komentarz przy `BLOCKS`), więc dołożenie zakładek po załadowaniu strony **nie
przecina kurtyny ponownie**: `refreshGlass()` znajduje tę samą sygnaturę i publikuje
starą partycję. Pierwsza tura pomiarów tego zadania dokładała przyciski przez
`page.evaluate` i mierzyła kafelki piętnastozakładkowej szyny na szkle pociętym dla
sześciu. Liczby były zbieżne co do kierunku i błędne co do wartości. Poprawnie: szyna
musi być w HTML-u **przed** załadowaniem (u mnie `page.route` przepisuje harness w
locie). Dopisane do `CLAUDE.md`.

#### Co naprawdę zmierzono (szyna 15 zakładek obecna od startu)

Rogi kafelków szyny zakładek stojące na własnej tafli, i na ilu RÓŻNYCH taflach stoją:

| Rozmiar | 1.2.47 | teraz |
| --- | --- | --- |
| 2560x1440 | 60/60, 1 tafla | 60/60, **1 tafla** |
| 1920x1080 | 54/60, 2 tafle, 6 rogów w dziurze, eg11 | 60/60, **1 tafla** |
| 1600x900 | 42/60, 3 tafle (18 na sekcji) | 60/60, **1 tafla** |
| 1440x900 | 42/60, 3 tafle (18 na sekcji) | 60/60, **1 tafla** |
| 1366x768 | 36/60, 4 tafle (24 na sekcji) | 60/60, **1 tafla** |
| 1280x800 | 45/60, 4 tafle (15 na sekcji) | 60/60, **1 tafla** |

Jedna tafla trzyma też szynę 6, 10, 18 i 22 zakładek przy każdym z tych rozmiarów -
z jednym wyjątkiem: 1280x800 i 18+ zakładek, gdzie szyna fizycznie nie mieści się na
ekranie (18 x 42 px + 44 = 800). Szyna narzędzi: 32/32 przy 1440 i wyżej, 26/32 i 30/32
przy 1366 i 1280 - to stara kolizja z kafelkiem powiadomień, opisana w `cutStrips`, nie
ruszana.

#### Trzecia uwaga: jedna tafla na wszystkie kafelki Foundry po prawej

Nie dało się jej załatwić przesuwaniem kolumny, bo zawadzały **własne przyciski
modułu**. Messenger i dźwięk są przypięte do prawego dolnego rogu - i tam samo rośnie w
dół szyna zakładek Foundry. Przy 1366x768 z piętnastoma zakładkami launchery stały na
x 1278..1344, y 620..746, a dwa ostatnie kafelki szyny na x 1280..1331, y 626..668:
przyciski modułu były rysowane **na** przyciskach Foundry. To jest ta kolizja, którą
audyt 1.2.47 zapisał w "czego nie ruszałem" (34 px), i okazała się być też dziurą w
szkle: launchery to BLOK, ich tafla wbiega w ścianę (`hugR`), a kawałek paska nachodzący
na taflę treści jest wyrzucany.

Trzy zmiany, każda zmierzona osobno:

| Co | Dlaczego |
| --- | --- |
| `clearLaunchers()` w glass.mjs - przyciski wchodzą do środka o szerokość pasma szyny, ale **tylko wtedy**, gdy stałyby w jej biegu | Na wysokim ekranie szyna kończy się setki pikseli nad nimi i nic się nie rusza (1920x1080: odstęp 31 px, bez zmian). Warunek to ich GÓRA kontra dół szyny - odczyt pionowy, ruch poziomy, więc nie mierzy własnego wyniku. Poprawka liczona z błędu (`chcę - mam`), bo `right` to odstęp od bloku zawierającego, a pod tym motywem nie jest nim ekran: 9 px różnicy tutaj, 22 px na prawej kolumnie |
| Wypełniacz wycinany z pasma do końca biegu szyny **albo do podłogi** - zależnie od tego, czy jakaś sekcja trzyma ścianę niżej | Wysoki ekran: launchery zostają przy ścianie, pasek musi się nad nimi zatrzymać, a ścianę pod nimi kryje wypełniacz (bez tego 25 px gołej mapy przy dolnej krawędzi, 1920x1080). Niski: launchery już odeszły, ściana jest paska aż do dołu (bez tego 28 px przy 1366x768) |
| Pasek kończący się na podłodze kończy się **za** nią i nie zwęża się po drodze | Szew u stopy paska jest przechylony, więc jeden koniec siadał na `y = H`, a drugi 13 px wyżej; do tego stopa zwężała się do 87 px w paśmie szerokim na 121. Obie dziury przy dolnej krawędzi, obie zmierzone |

Samosprawdzenie kurtyny przy ośmiu rozmiarach: `ov0 nc0 bf0 eg0 ff0` wszędzie - w tym
dwie stojące szczeliny krawędziowe przy 1920 i 2560, które 1.2.47 jeszcze miał.
Przemiatanie szerokości 1200-1560 przy 800 px wysokości: `bf16` tylko przy 1200-1224
(tak jak w 1.2.47), pojedyncze `eg1` przy 1272, 1320 i 1416 - to podpikselowy szew
między dwiema sąsiednimi taflami sekcji (sprawdzone punktowo: pokryte 1 px obok, z obu
stron), artefakt reguły "pół odstępu minus piksel" z 1.2.47, nie dziura.

**Odrzucone po pomiarze, żeby nikt nie próbował trzeci raz:** wycięcie tafli SEKCJI z
pasma szyny (z osłoną na własny blok albo bez) - szyna przestaje stać na cudzym szkle i
zaczyna stać na dziurze: 18 rogów na niczym i 28 szczelin krawędziowych przy 1600x900,
bo tafla paska zaczyna się pod taflą kolumny i nic nie pokrywa tego, co kolumna oddała.
Cztery wcześniejsze kształty tego samego pomysłu są opisane w `cutStrips`. Odrzucone
też: liczenie pinu prawej kolumny z pasma zamiast z lewej krawędzi szyny (pasmo jest
kotwiczone do ŚCIANY, więc na harnessie wychodziło 27 px za mało) i kalibracja odstępu
bloku zawierającego dla samej kolumny (przy 1280 przysuwała ją do szyny Despair na 2 px).

Weryfikacja całości: suite **141 passed, 0 failed, 9 skipped**; dziesięć scenariuszy
zielonych; proza 492/492.

### 9.2 Live checks nadal otwarte

Lista z sekcji 7 pozostaje w mocy; harness nie rozstrzyga żadnej z nich. Po zadaniach 8-10 doszły trzy nowe do sprawdzenia na prawdziwym Foundry:

15. **MAP-02 po naprawie:** cudzy token wchodzący do mojego pokoju ma pojawić się dopiero na granicy, nie w starym pokoju.
16. **UI-10 po naprawie:** trial z dwiema sticky kartami pod Stained Glass - trzecia karta (odmowa) ma wyprzeć najstarszą sticky, nie zniknąć.
17. **COMM-11:** Controls -> Danganronpa RPG -> "Safeword - stop the scene": przypisać klawisz, nacisnąć bez otwartego arkusza.

Po E03 (1.2.60) doszły te, na których opiera się ochrona po stronie GM-a, a których harness nie rozstrzyga (przegląd E03, 24.09.2026):

18. **Nadawca na kanale systemu:** czy Foundry v14 podaje `senderId` słuchaczom `system.daggerheart`. Harness podaje go zawsze. Sprawdzenie: gracz rzuca z wydaniem Hope; u GM-a Hope postaci spada, a `game.drpg.relayGuard().refused` nie ma `unknownSender`. Gdyby miał, każda zmiana Daggerhearta od gracza jest odrzucana i GM dostaje o tym jedną kartę.
19. **API socketu:** czy `game.socket` na v14 ma `listeners`, `off` i `on` i czy strażnik znalazł słuchacza Daggerhearta - dopiero oba razem dają `game.drpg.relayGuard().state` `"ok"` (albo `"changed"`/`"unnamed"`), a nie `"noApi"`, `"notFound"` ani `"backstop"`. `"ok"` nic nie mówi o `prependAny`, którego używa tylko tryb awaryjny: to osobny odczyt, `typeof game.socket.prependAny` w konsoli GM-a.
20. **`noHook` i okno właścicieli** - trzy osobne odczyty: (a) na głównym GM-ie `Hooks.once("updateActor", (a, c, o) => console.log("updateActor", o.noHook))`, potem "All Players: Owner" w Configure Ownership - czy hook w ogóle przychodzi; (b) u GM-a, który używał okna, `Hooks.once("closeDocumentOwnershipConfig", app => console.log("close", app?.document?.name))` - czy hook o tej nazwie przychodzi; (c) wynik łączny: `ownership.default` wraca do OBSERVER. (c) przechodzi, gdy działa (a) albo (b), więc nie rozstrzyga żadnego z nich. Harness przyjmuje ostrożniejsze odczytanie (`noHook` wycisza oba hooki) i ma jednego GM-a, który jest zarazem głównym: droga GM-a, który NIE jest główny i zamyka okno, nie jest zmierzona. Sprawdzić ją przy dwóch GM-ach.
21. **Kolejność pokwitowania Rerolla:** czy przepisanie rzutów wiadomości dociera do GM-a przed prośbą o cofnięcie (strażnik po każdej odmowie pyta jeszcze raz po `TIMING.rerollReceiptRetryMs`). Sprawdzenie: prawdziwy Reroll na Observe, Sabotage, akcji kryzysowej (także udanym Role reversal i Survive), sprzątaniu, Analyze, postępie projektu, śladzie oraz Reroll, który przestawia rzut między Hope a Fear u postaci z przypisanym Monokumą (Despair - to pierwsza paczka po przepisaniu, najbardziej narażona na kolejność); żaden nie może skończyć się toastem "klient GM-a odmówił". W harnessie prawdziwy `rerollLastAction` przeszedł tylko dla Sabotage.
22. **Ruch przez kilka pokoi:** jak v14 dzieli przeciągnięcie z kilkoma punktami trasy na aktualizacje i jak nazywa się pole poziomu tokena (`level`). Od tego zależy, czy odesłanie tokena i pułapka przy przejściu rozpoznają pokoje z trasy.
23. **Toasty:** czy `ui.notifications` na v14 escapuje HTML. Tekst odmowy przekaźnika i tak nie niesie `<` ani `>` (`plainWhat`).
24. **Blokada zasobów gracza:** wygląd arkusza pod `body.drpg-player.drpg-resources-locked`, z ustawieniem włączonym i wyłączonym; nie oglądany.

Po E30 (1.2.61) harness modeluje fragmenty v14, których nikt nie sprawdził na prawdziwym Foundry. Każdy ma identyfikator LIVE-E30-nn, pod którym wymienia go `audit/harness/README.md` ("What the harness cannot do"):

25. **LIVE-E30-01 - klucz `-=` na v14:** aktualizacja z kluczem `flags.<scope>.-=<klucz>` na aktorze i na tokenie (tak zdejmował flagi `migrateRemnants` przed E30). Czy klucz zostaje, czy zapisuje się dosłowny klucz `-=...` i czy konsola pokazuje ostrzeżenie o przestarzałej składni. Harness przyjmuje, że klucz niczego nie usuwa, i zgłasza każdy taki zapis.
26. **LIVE-E30-02 - API operatorów:** czy `foundry.data.operators.ForcedDeletion` i `ForcedReplacement` mają `create`, czy tylko konstruktor, i czy `_del` jest wartością, czy funkcją (Daggerheart 2.10.5 raz woła `_del()`, action-base-config.mjs:584). W harnessie `_del` jest wartością, a `create()` zwraca jedną wspólną instancję.
27. **LIVE-E30-03 - co dostaje hook:** kształt `changes` w `preUpdateActor` i `updateActor` po `unsetFlag`, `_del` i `_replace`: instancja operatora, zwykła wartość czy brak klucza. Harness podaje instancję. Do tego trzy rzeczy o krokach przed zapisem, które harness przyjmuje z pamięci: czy `_preUpdate` dokumentu biegnie przed hookiem `preUpdate`, czy aktualizacja opróżniona przez hook (np. przez `resource-guard.mjs`) w ogóle idzie do serwera i czy wtedy przychodzi `updateActor`, oraz czy aktualizacja niczego niezmieniająca wywołuje hooki `update` (harness nie liczy różnicy i je wywołuje).
28. **LIVE-E30-07 - `migrateRemnants` na kopii starego świata:** `game.drpg.migrateRemnants()` dwa razy na kopii świata sprzed ledgera śladów (DRPG_FIXTURES). Zapisać podsumowanie obu przebiegów (moved, filled, stripped, already i ślady wciąż z flagami), `_source.flags` kilku tokenów przed i po oraz różnicę ledgera między przebiegami: drugi przebieg nie powinien w nim niczego zmienić. Tu nie próbowane: harness mierzy jeden ślad zbudowany w teście tier 2, nie prawdziwy stary świat.
29. **LIVE-E30-04 - co wolno Asystentowi:** konto z rolą Assistant GM: `game.user.update({ role: 4 })` z jego konsoli ma zostać odrzucone przez serwer, a zapis ustawienia świata (dowolnego ustawienia modułu o zasięgu world) ma przejść. Harness przyjmuje jedno i drugie z pamięci (Assistant jest GM-em od roli 3, rola nie rośnie ponad własną, ustawienia świata od roli 3), nie ze źródła v14.
30. **LIVE-E30-05 - ktoś wychodzi:** co widzi przeglądarka GM-a, gdy gracz zamyka kartę: czy przychodzi hook `userConnected` z `false` i czy `game.users.get(id).active` jest już wtedy `false`; oraz czy użytkownik, któremu GM zmienia rolę, zostaje wylogowany. Harness ustawia `active` i woła hook w tej kolejności i nikogo nie wylogowuje.
31. **LIVE-E30-06 - Asystent przy stole:** scenariusz `17-assistant` na sandboksie z kontem Assistant GM, przynajmniej sekcje B i C: prośba Asystenta przez przekaźnik Daggerhearta jest oceniana jak prośba gracza (C2 i C3 nic nie zmieniają u GM-a), a Hope własnej postaci gracza nadal przechodzi (B1). W harnessie C2 i C3 były czerwone przed zmianą w `relay-guard.mjs` (E30) i zielone po niej; na prawdziwym v14 nie sprawdzone.
32. **LIVE-E30-08 - zainstalowane wersje:** odczytać wersje Dice So Nice, Isometric Perspective, LiveKit i Daggerhearta z folderu Data instalacji, na której gra stół (albo uruchomić harness z `DRPG_FOUNDRY_DATA` wskazującym na ten folder), i odświeżyć nimi `audit/harness/versions.json`. Dziś są tam liczby odczytane przez audyt S14-28 (6.2.9, 14.0.2, 0.6.8), nie sprawdzone ponownie.
33. **LIVE-E30-09 - jak v14 dołącza CSS modułu:** w konsoli GM-a `[...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).filter(r => r.href?.includes("danganronpa-rpg")).map(r => [r.href, r.layerName])` - czy są wszystkie arkusze z `module.json` w tej kolejności, każdy przez `@import` w warstwie `modules`, oraz co zwraca `getComputedStyle(document.body).getPropertyValue("--drpg-window-max")` na zwykłym ekranie. Harness dołącza je tak od E30 (`audit/harness/lib/css.mjs`), z opisu w `diagnostics.mjs`, nie z odczytu v14.
34. **LIVE-E30-10 - okno tier 2 w prawdziwym v14:** `game.drpg.runTests({ tier: 2 })` jako GM: czy rysuje się okno DialogV2, którego tytuł i tekst nazywają świat, czy Cancel stoi pierwszy i jest jedynym przyciskiem domyślnym, i czy Enter zaraz po otwarciu wybiera Cancel (nic się nie uruchamia, wynik to odmowa bez zmian w świecie). Harness sprawdza tylko konfigurację okna, którą moduł podaje (01-runtests B), nie narysowane okno ani klawisz.

Po E31 (1.2.62) doszły te, których harness nie rozstrzyga (plan E31, sekcja 7; wymienia je `audit/harness/README.md`, "What the harness cannot do"):

35. **LIVE-E31-01 - Reroll przez tabelę:** prawdziwy Reroll na Observe, Analyze, akcji kryzysowej, sprzątaniu, sabotażu, postępie projektu, śladzie i Despair: u GM-a żadnego `Refused a`, u gracza żadnego komunikatu „... nie została wykonana”. Harness modeluje pokwitowanie przepisaniem rzutów, nie `Roll#reroll`.
36. **LIVE-E31-02 - czas odpowiedzi:** potwierdzenie przychodzi teraz po strażnikach, nie przed nimi; tylko prośbę z kolejki projektu (postęp, sabotaż, jego cofnięcie) klient GM-a potwierdza od razu po przyjściu, bo jej strażnicy czekają w kolejce za wcześniejszymi zapisami (przegląd E31; w harnessie, sześć sabotaży naraz: przed zmianą n-te potwierdzenie przychodziło razem z odpowiedzią na poprzednią prośbę, po 3-109 ms, po zmianie wszystkie po 2 ms, a odpowiedzi po 83-231 ms). Na prawdziwym serwerze zmierzyć czas do potwierdzenia przy odesłaniu tokena (budżet `TIMING.ackMs`, 8 s) i czas do odpowiedzi przy Rerollu sabotażu (dwie prośby w kolejce; budżet `TIMING.rulingMs`, 3 min). Znana granica: prośba typu `reply` dostaje odpowiedź dopiero po wykonaniu, więc akcja kryzysowa, po której ofiara dwóch zabójców się wyczerpuje, czeka na decyzję GM-a (`checkVictimSpent`); gdy GM zdecyduje po ponad 3 min, gracz dostaje „Klient GM-a nie odpowiedział na czas.”, choć akcja i tak się wykona.
37. **LIVE-E31-03 - GM wychodzi w trakcie:** gracz prosi o sabotaż, GM zamyka kartę przed odpowiedzią: jeden komunikat „Klient GM-a nie odpowiedział na czas.” (po 8 s, gdy potwierdzenie nie przyszło; po zegarze odpowiedzi, `TIMING.rulingMs`, gdy przyszło), obietnica rozstrzygnięta; gdy GM wróci przed tym zegarem, prośba jest ponawiana raz, z tym samym id.
38. **LIVE-E31-04 - podłożony przedmiot po czasie:** wolny serwer, odpowiedź na sprawdzenie podłożenia po 5 s (`TIMING.plantRequestMs`) i po ponad 10 s: w obu przypadkach przedmiot wraca do pokoju (`late`), dopóki klient GM-a przyjmuje zwrot (`TIMING.plantWindowMs`, 2 min).
39. **LIVE-E31-05 - handOff przy reduced motion:** z włączonym przełącznikiem ruchu wiersz w panelu GM-a (gm-panel.mjs:742) i krok Season setup (season-setup.mjs:560): okno wraca bez sekundowej pauzy.
40. **LIVE-E31-06 - polski gracz, angielski GM:** odmowa prośby gracza z językiem polskim: komunikat po polsku, linia w logu GM-a po angielsku, z nazwą gracza.

Po E04 (1.2.63) magazyn GM-a (sprawa w przeglądarkach GM-ów) opiera się na rzeczach, których harness nie rozstrzyga (plan E04, sekcja 9; wymienia je `audit/harness/README.md`, "What the harness cannot do"):

41. **LIVE-E04-01 - zegar serwera:** czy `game.time.serverTime` na v14 istnieje, jest skończoną liczbą i idzie za serwerem, gdy zegary systemowe dwóch przeglądarek różnią się o minuty; stemple magazynu z obu przeglądarek mają być ułożone według czasu serwera. Harness przesuwa `Date.now` jednej przeglądarki, a `serverTime` jest zegarem jednej maszyny.
42. **LIVE-E04-02 - dołączenie przy prawdziwym stole:** Forge albo LAN, dwóch GM-ów: czas od `ready` GM-a do nawodnienia magazynu (`game.drpg.gmStoreStatus()`), wielkość sekcji śladów tej kampanii i czy część `gms.state` po 256 KB dochodzi cała - i jaka największa dochodzi.
43. **LIVE-E04-03 - localStorage po aktualizacji:** na świecie stołu, bajty każdego starego i nowego klucza i suma modułu oraz czas jednego zapisu przy tej wielkości (`gmStoreStatus()`; nie `perf()`, którego ciało jest przypięte).
44. **LIVE-E04-04 - GM traci sieć i wraca bez przeładowania:** czy `game.socket` na v14 znów emituje `connect`, czy wymiana rusza jeszcze raz i czy dochodzą zapisy z przerwy.
45. **LIVE-E04-05 - Kopia sprawy i Przywróć w przeglądarkach:** Chrome, Firefox i aplikacja desktopowa: plik się zapisuje, a pole wyboru pliku go czyta (`readTextFromFile`/FileReader). Harness trzyma zapisany plik w pamięci i podaje tekst wprost.
46. **LIVE-E04-06 - próba aktualizacji na kopii świata właściciela:** z zapisanym magazynem przeglądarki (jednolinijkowiec z notatek 1.2.63): spis przejętych i pozostawionych wierszy w każdym magazynie, czysta kontrola zdrowia, każdy ślad, bullet, obsada i Mastermind do odczytania; potem dołącza drugi GM z pustą przeglądarką.
47. **LIVE-E04-07 - dwa światy na jednym serwerze w jednej przeglądarce:** reset w świecie testowym zostawia magazyn kampanii; i czy Setup > Duplicate World daje kopii nowe `game.world.id` (od tego zależy, czy dwie kopie świata mają osobne sprawy).
48. **LIVE-E04-08 - weryfikacja z briefu na żywo:** otwarte morderstwo, GM zmienia przeglądarkę, kontrola zdrowia ostrzega, Przywróć oddaje obsadę i incydent da się dokończyć (także przez "Wpisz obsadę ręcznie").
49. **LIVE-E04-09 - reset należy do głównego GM-a:** odmowa na koncie Assistant i na drugim Gamemasterze, z nazwą głównego GM-a; okno wymienia GM-a offline; jego przeglądarka jest przycięta przy następnym logowaniu, gdy jest sam.
50. **LIVE-E04-10 - odczyt zapisanego ustawienia na v14:** `game.settings.storage.get("world")`, którego używa `worldWasInPlay`, na świecie zaktualizowanym z v1.1.0: safeword zostaje, kartka się pokazuje. Harness modeluje `getSetting(key)` na swojej mapie.
51. **LIVE-E04-11 - dwie karty jednej przeglądarki na jednym świecie:** ślady zapisywane w obu kartach; żaden zapis nie ginie. Harness nie ma dwóch kart jednej przeglądarki.
52. **LIVE-E04-12 - ktoś dołącza:** co widzą pozostałe przeglądarki, gdy GM wczytuje świat na v14: czy hook `userConnected` z `true` przychodzi, zanim jego klient doszedł do `ready` i ma słuchaczy modułu, i co gracz dostaje najpierw - ten hook czy pakiet mostu "GM słucha" (gm-bridge.mjs `onGmReady`), na który gracze pytają o drzwi, obsadę i mgłę. `primaryGmId` liczy GM-a, którego pakiet przyszedł przed hookiem, więc pytanie nie powinno przepaść w żadnej kolejności; nie sprawdzone przy stole. Harness woła hook dopiero, gdy klient jest gotowy. (LIVE-E30-05 to ktoś, kto wychodzi.)

Znane luki po E03, świadomie zostawione (nie live checki, tylko zapis):

- Edycja Truth Bulleta zrobiona przez gracza, gdy żaden GM nie był online, nie jest porównywana przy wczytaniu: kopia strzegąca żyje tylko w pamięci przeglądarki GM-a i powstaje przy wczytaniu z przedmiotów takich, jakie są, więc nie ma czego starszego porównać. E04 (1.2.63) dał wspólny zapis GM-ów (magazyn GM-a), ale nie to porównanie: właściciel odłożył je do E43, etapu o wrogim kliencie (25.09.2026).
- Przekaźnik przyjmuje bez sprawdzania rzutu: Hope, Stress i Health na własnej postaci w granicach, zasoby aktorów, którzy nie są uczniami, ładunki (bez górnej granicy) i ilości własnych przedmiotów, tyknięcia odliczań po jednym, dowolną zmianę odliczania, którego gracz jest właścicielem, sumy rzutów obronnych na własnym tokenie, dane rzutu grupowego i tag teamu drużyny, kolejność środowisk dowolnej sceny - wszystko bez limitu częstotliwości. Fear nie jest limitowany, tylko odnotowywany powyżej czterech kroków w dziesięć sekund. Uczciwość liczb to warstwa druga (E28, E29).
- Reroll śmiertelnej akcji kryzysowej (Finishing blow, ofiara bez Health i Sanity) jest przyjmowany jak każdy inny, a `undoLastCrisis` nie cofa śmierci (`killCharacter`). To było tak przed E03; do rozstrzygnięcia w etapie incydentu.
- Pokwitowanie Rerolla dowodzi przepisania rzutów własnej karty, nie zapłaty; powtórzenie ostatniej akcji kryzysowej z nową sumą zależy od E28, E29.
- Przy dwóch GM-ach zmiany Daggerhearta za graczy robi tylko główny; wysłana w chwili jego przeładowania może przepaść.
- Postać z tokenami na kilku scenach: wyszukiwanie i ślad biorą scenę z prośby, jeśli postać ma tam token; przekaźnik pułapek najpierw scenę, którą ogląda gracz, a dopiero bez tokenu tam wszystkie sceny. Nie mierzone przy stole.
- Powtórka Rerolla sprzed E03, znaleziona przy przeglądzie E03: Reroll akcji kryzysowej Use item oddaje przedmiot i zostawia jego efekt, a Reroll, który daje krytyczny Strike, nie zadaje obrażeń (reroll.mjs); ślad z pierwszego rzutu gracza nie jest przestrajany ani zdejmowany przy jego Rerollu, bo zakładka gracza nie trzyma id śladu, więc może zostać drugi ślad. Do etapu Rerolla i incydentu.
