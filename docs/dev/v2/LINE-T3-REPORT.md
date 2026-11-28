# Raport linii T3 - Investigation, rozprawa, koniec rozdziału

Gałąź `claude/v2-t3`, założona z `claude/dazzling-bohr-juuh4g` na 31d5812 (1.2.129). Specyfikacja:
`docs/dev/v2/LINE-T3.md`. Etap `E133` w `tools/stages.json` (planned 1.2.130). Napisane 28.11.2026, uzupełnione tego samego dnia o cztery ostatnie pozycje.

Skrót: z 34 wierszy sekcji 2 zrobione wszystkie 34 (cztery ostatnie - TRIAL-08, EXP-GM-11, EXP-PL-17, EXP-GM-10 - po
prośbie koordynatora z 28.11.2026, po pierwszej wersji tego raportu). Bez pull
requesta, bez wydania, bez zmian `module.json`, `CHANGELOG.md` i bez `node tools/stages.mjs ship`. Na Forge nic nie było
uruchamiane: jedyna zmieniona kontrola Forge (S1b TRIAL-06) jest sprawdzona tylko `node --check`, ESLint i czytaniem.

## 1. Stan pozycji

Części scenariusza 58 nazywam ich etykietą w `58-case-two-gms.mjs` (np. "58 INV-01").

| ID | stan | commit | testy | uwagi |
| --- | --- | --- | --- | --- |
| INV-01 | zrobione | 1fdb5d3 | R9124; T3 INV-01; 58 INV-01 | okno opisu rysuje się z wiersza `observeStore` u każdego pełnego GM-a poza tym, którego to okno (`askDescribeHere`, `describeAskedHere`); szept zostaje jako zapis (P11) |
| INV-02 | zrobione | 1fdb5d3 | R9125; T3 INV-02 (+ "counting GM"); 58 INV-02 | okna pozostałych zamyka `closeAnsweredWindows`; przycisk w szepcie żywy tylko przy otwartym pytaniu (`describeButtonLive`); `describeTakenBy` mówi czyje słowa i pod jaką nazwą |
| INV-03 | zrobione | 6966f52 | T3 INV-03 | `describeFind` szepcze właścicielowi `DRPG.Observe.describing` przy deklaracjach innych niż specific/anything; zmieniony filtr r122-D-2 (po treści i `gmPopup`) |
| INV-04 | zrobione | 581aeb9 | R9126; T3 INV-04 (+ "second GM"); 58 INV-04 | `describingLeftHere` przy hydracji kończy tylko wiersze GM-a niepołączonego; zastrzeżenie pomiaru 58 w sekcji 6 |
| INV-05 | zrobione | 1fdb5d3, 1ec17b8 | T3 INV-05; 58 INV-05 | szept `describeTimedOutGms` do wszystkich GM-ów, okna pozostałych zamknięte z `describeTakenTimedOut` |
| INV-07 | zrobione | bdf0825, c5d1a7e | R9128; T3 INV-07; 58 INV-07 | bez odpowiedzi karta `holdCharge` z "Pobierz opłatę"; `game.drpg.chargeKeyFee`; R7130 dopasowany |
| INV-09 | zrobione | af1bf21 | R9127 | `describeRecovered` w EN i PL nazywa obie przyczyny |
| INV-12 | zrobione | 7286c53, 2a6815b, 67e8de3 | R9129; T3 INV-12; 33 INV-12; 58 INV-12 | nowa akcja `resolve.lost` (bez `REASONS`), linie gracza `Observe/Analyze.unresolved`, karta GM-ów `unresolvedGms`; bez automatycznego zwrotu akcji (P7) |
| TRIAL-01 | zrobione | 79a4164 | R9121; T3 TRIAL-01 (+ "second GM"); 58 TRIAL-01 | `chapterEndStopped` czyta `notRun` i `halted`; `markHaltedEnd` u głównego przy `onGmStoresHydrated` - czeka na T2 (sekcja 6) |
| TRIAL-02+PRIM-07+VOICE-09+MURDER-07 | zrobione | 9ec314e | R9120; T3 TRIAL-02, T3 VOICE-09, T3 MURDER-07; 58 TRIAL-02 | `relayRefusal`/`tellRelayedRefusal` na końcu `bridge-guards.mjs`; bez nowego kodu w `REASONS`; R164 i R321 zmienione w tym commicie |
| TRIAL-03 | zrobione | ec84627, 2d769cb, a6fe4ac | T3 TRIAL-03 (+ "second GM", "third GM"); 58 TRIAL-03; R8732 zmieniony | zajęcie werdyktu u głównego (`claimVerdict`, nowy plik `verdict-claim.mjs`), kroki u naciskającego; 97 U1 oczekuje `by === GM2` |
| TRIAL-04+PRIM-05 | zrobione | be1883e, a6fe4ac | R9123; T3 TRIAL-04 (+ "second GM", "Assistant GM"); 58 TRIAL-04; R8731 zmieniony | nowa akcja `season.reset`; grupy czytane z `RESET_GROUPS` przy sprawdzeniu; okno otwarte jako główny, gdy główny się zmieni, odmawia jak dziś (P13) |
| TRIAL-05 | zrobione | ec84627, 857caa9 | R9122; R8143 zmieniony | `finishElsewhere` tylko u Asystenta (`mayFinish`) |
| TRIAL-06 | zrobione | 9cfee74, d496768, e246839 | R9142; T3 TRIAL-06 | ostrzeżenie `DRPG.Vote.silentGone` z imionami uczniów w oknie głosowania, podglądzie i oknie werdyktu (nowy plik `vote-gone.mjs`); podstawa liczenia bez zmian (P1); kontrola S1b przepisana |
| TRIAL-07 | zrobione | 910b39b, c820fd7 | R9130; T3 TRIAL-07 (+ 2x "primary GM"); 58 TRIAL-07 | `holdSentence` - karta GM-ów z "Wykonaj wyrok ponownie" (`data-drpg-sentence-again`); główny nie wykonuje sam (P8) |
| TRIAL-08 | zrobione | a9d03a4, 383c779 | R9143; T3 TRIAL-08; 58 TRIAL-08 | `reconcilePhase` zapisuje wiersz `phaseStepStore` (blok T3 `gm-stores.mjs`, klucz `gmPhaseSteps`) przed pierwszym krokiem i po każdym; główny dokańcza wiersz przy gotowości (sprzed własnego F5) i przy wyjściu GM-a, który go pisał (`finishPhaseSteps`). Wywołania zostają w `reconcilePhase` w tej samej kolejności (lista `runSteps` nie wzięta - sekcja 6). Budżet nie jest idempotentny po wydaniu akcji: `started` przed, `done` po; rozpoczęty i nieskończony nie biegnie drugi raz, idzie do `failed`, GM-owie dostają szept (P9) |
| TRIAL-10 | zrobione | 8692c24 | R9135; T3 TRIAL-10 | `objectionSpeakersFresh` przy odmowie noSpeaker, `objectionAimedElsewhere` przy innym celu niż podgląd; czeka na `drpgPrimaryChanged` z T2 (sekcja 6) |
| TRIAL-12 | zrobione | 3c3eebc | R9134 (tier 0) | `summaryWarning` z `DRPG.CaseSummary.wrongVerdictHint` tylko po błędnym werdykcie |
| TRIAL-14 | zrobione | f291658 | T3 TRIAL-14 | `holderGone` dla Objection/Rebuttalu po czasie łaski, karta GM-ów `DRPG.Floor.holderGone`; bez części 58 |
| TRIAL-15 | zrobione | c923094 | T3 TRIAL-15 (+ 2x "primary GM") | `tellWrittenHere` najwyżej raz na minutę na przeglądarkę, szept bez `gmPopup` |
| TRIAL-16 | zrobione | f893908 | R9131 | tekst `openNoBallots` bez podsunięcia restartu |
| PRIM-06 | zrobione | ec84627 | T3 PRIM-06 (+ "second GM"); 58 PRIM-06 | ta sama droga zajęcia co TRIAL-03 |
| PRIM-10 | zrobione | b91568b | R9133 | `stepRefusal` z `DRPG.Floor.bar.notPrimary` |
| EXP-GM-03 | zrobione | 5264395, 3385c89 | R9141; T3 EXP-GM-03 | `waitingCards()` w `messenger-gm.mjs`, `waitingObserves()` w `observe.mjs`, okno `waitingFirst` z "Zacznij mimo to"; sygnatura `waitingCards` odbiega od sekcji 4 (sekcja 6) |
| EXP-GM-04 | zrobione | 9cfee74, d496768 | T3 EXP-GM-04; R312, R2050, R1257, R4752 zmienione | `closeRound` zapisuje `resultCard`, nie ogłasza; podgląd `previewVoteResult` z "Ogłoś wynik"; nowy op `announce` i krok konsoli `announceVote` |
| EXP-GM-10 | zrobione | 3f87755 | R9146; T3 EXP-GM-10 | magazyn `erasedRemnantStore` (blok T3, klucz `gmErasedRemnants`, `backup: true`, grupa `remnants`); wiersz pisany w `resolveEraseRoad` po udanym `removeRemnant` z `receipt.erased`; Reroll, który przywraca Remnant, usuwa wiersz; zwijana lista "Usunięte przy sprzątaniu (n)" pod tabelą zakładki Remnanty, tylko do odczytu |
| EXP-GM-11 | zrobione | 42c490f | R9144; T3 EXP-GM-11 | "Wybrani uczniowie" w oknie Daj Truth Bullet z polami wyboru żyjących uczniów; `giveToMany`, z którego korzysta Wszyscy; bez zaznaczonych Daj wstrzymany. Zakładka Daj okna rzeczy (własny wybór `who`) i plan bez zmian |
| EXP-GM-12 | zrobione | cc1e9c8, 3385c89 | R9139; T3 EXP-GM-12; R4755 zmieniony | trzy pola w oknie werdyktu (nowy plik `verdict-skips.mjs`), `verdict.skip` na rekordzie, `DRPG.Vote.verdictSkipped` na karcie GM-ów |
| EXP-PL-08 | zrobione | 7bd6a6d | R9138; T3 EXP-PL-08 | `tellCopyChanged` - jeden szept na kopię z częściami, które się zmieniły; odczyt tylko przy przeanalizowanej kopii, obraz razem z resztą (P6) |
| EXP-PL-11 | zrobione | 45682b1 | R9137 | `DRPG.Chapter.bodyCalledNext`, nowe zdanie `Explain.phase.investigation`, karta `DRPG.Explain.investigationStarted` w `reconcilePhase` |
| EXP-PL-13 | zrobione | d7d982b | R9140; T3 EXP-PL-13; R1252 zmieniony (10 kroków) | ostatni krok `players` w `CHAPTER_END_STEPS`, jedna publiczna karta (P10) |
| EXP-PL-16 | zrobione | f893908 | R9132 | `ballotFormHtml` wydzielony z `castBallot`, `DRPG.Vote.ballotFinal` |
| EXP-PL-17 | zrobione | 42c490f | R9145; T3 EXP-PL-17 | flaga `copyOrigin` przy każdej drodze tworzenia kopii (Observe, łup z ciała, przekazanie i Present, Daj jednemu i kilku, Reveal Monokumy, Autopsy) i `gaveTo` na kopii dającego; plakietka Kopie na arkuszu z podpowiedzią ze zdaniami |
| CTL-03..CTL-30 | zrobione | d63b1d4, cc1e9c8 | R9136; R4755 | `nodeButton` z `opensMap` w konsoli rozprawy: bez `aria-expanded`, podpowiedź `DRPG.Tips.Case.nodeOpensMapTooltip`; komentarze w `case-trial.mjs` i `case-map.mjs` poprawione |

### Kontrole Forge (nie uruchamiane)

| Kontrola | zmieniona? | po zmianie powinna | dlaczego |
| --- | --- | --- | --- |
| S1b INV-01 | nie | zaliczyć | okno opisu otwiera się samo u GM2 z wiersza magazynu (INV-01) |
| S1b INV-02 | nie | zaliczyć | okno GM2 zamyka się, gdy GM1 nazwie znalezisko pierwszy (`closeAnsweredWindows`) |
| S1b EXP-GM-03 | nie | zaliczyć | okno ma nagłówek `DRPG.Messenger.gm.waiting` i słowa prośby; stopka: destrukcyjny "start" i zamknięcie "cancel" (`NOT_YES`), więc zestaw naciśnie "Zacznij mimo to" |
| S1b EXP-GM-04 | nie | zaliczyć | `closeRound` nic nie ogłasza; na GM2 otwiera się okno podglądu, którego primary to "Ogłoś wynik" |
| S1b TRIAL-06 | tak (e246839) | zaliczyć | przepisana na zatwierdzone ostrzeżenie: zalicza, gdy podgląd albo okno werdyktu GM2 zawiera imię ucznia rozłączonego gracza (`DRPG.Vote.silentGone` przez `i18n`), szczegóły zapisują `total` i `inBox`, podstawa równa `issued` |
| S1b TRIAL-03 | nie | zaliczyć | okna werdyktu otwierają się u naciskającego GM2 (kroki biegną u niego po zajęciu) |
| S1b TRIAL-07 | nie | zaliczyć (jak na 1.2.129) | karty `holdSentence` ta kontrola nie mierzy - mierzy ją T3 TRIAL-07 i 58 TRIAL-07 |
| S1b TRIAL-01 | nie | zaliczyć | GM1 po F5 oznacza rekord jako `halted` przy otwarciu magazynów, GM2 widzi Dokończ/Porzuć; po scaleniu z T2 moment to gotowość głównego |
| S2 D1 | nie | zaliczyć | to samo co S1b INV-01: okno samo u drugiego GM-a |
| S2 D2 | nie | zaliczyć | okno drugiego GM-a zamyka się i GM dostaje `describeTakenBy` |
| S2 G1 | nie | zaliczyć | powód odmowy (`DRPG.Chapter.notStopped`) wraca do pytającego przez `relayedRefusal` |
| S2 H1 | nie | zaliczyć | okno resetu rysuje się u drugiego pełnego GM-a, odmowy nie ma |

"Powinna zaliczyć" to odczyt kodu i wyników harnessu, nie pomiar na Forge.

## 2. Testy

### Numery R (wszystkie w `docs/dev/R-REGISTRY.md`, stempel `E39` - sekcja 4 specyfikacji)

| R | tier | pozycja | co mierzy (skrót) |
| --- | --- | --- | --- |
| R9120 | 1 | TRIAL-02 | odmowa przekazana mówi kluczem z zamkniętej listy i istniejącym, wartości wyescapowane |
| R9121 | 1 | TRIAL-01 | koniec z `notRun` albo `halted` jest zatrzymany na każdym GM-ie |
| R9122 | 1 | TRIAL-05 | zatrzymany werdykt innego GM-a dokańcza pełny GM; `finishElsewhere` tylko Asystent |
| R9123 | 1 | TRIAL-04 | wiersz `season.reset`: grupy z rejestru, obsada z trzech wyborów, odpowiedź, limit czekania |
| R9124 | 1 | INV-01 | okno opisu pytane u każdego pełnego GM-a poza właścicielem okna, raz |
| R9125 | 1 | INV-02 | przycisk "Opisz tutaj" tylko przy otwartym pytaniu |
| R9126 | 1 | INV-04 | hydracja kończy tylko wiersze GM-a niepołączonego |
| R9127 | 1 | INV-09 | tekst odzyskania nie zgaduje przyczyny (EN, PL) |
| R9128 | 1 | INV-07 | `game.drpg.chargeKeyFee` |
| R9129 | 1 | INV-12 | `resolve.lost`: cichy, bez czekania, ponawiany, trzymany do własnej postaci i rzutu |
| R9130 | 1 | TRIAL-07 | "Wykonaj wyrok ponownie" działa tylko, gdy wyrok czeka |
| R9131 | 1 | TRIAL-16 | `openNoBallots` bez podsunięcia restartu |
| R9132 | 1 | EXP-PL-16 | karta do głosowania mówi, że głosu nie da się zmienić |
| R9133 | 1 | PRIM-10 | odmowa kroku podłogi po zmianie głównego |
| R9134 | 0 | TRIAL-12 | ostrzeżenie w podglądzie podsumowania tylko po błędnym werdykcie |
| R9135 | 1 | TRIAL-10 | Objection wycelowany w kogoś innego niż podgląd mówi w kogo |
| R9136 | 1 | CTL-03..30 | węzeł schematu w konsoli mówi, że otwiera Mapę; na Mapie bez zmian |
| R9137 | 1 | EXP-PL-11 | karta ciała i wyjaśnienie fazy; karta startu Investigation |
| R9138 | 1 | EXP-PL-08 | części zmiany kopii, odczyt tylko przy przeanalizowanej |
| R9139 | 1 | EXP-GM-12 | odznaczone kroki złego werdyktu |
| R9140 | 1 | EXP-PL-13 | linie karty nowego rozdziału z wyborów końca |
| R9141 | 1 | EXP-GM-03 | `waitingCards` czyta te same karty co "Czeka na decyzję" |
| R9142 | 1 | TRIAL-06 | `goneBallots`: wydane, niewrócone, gracz niepołączony teraz |
| R9143 | 1 | TRIAL-08 | `phaseRowFinishesHere` (pisarz nieobecny - tak; inny połączony - nie; ja po F5 - tak; faza inna - nie; nic nie zostało - nie) i `phaseStepsLeft` (rozpoczęty budżet - nie drugi raz) |
| R9144 | 1 | EXP-GM-11 | `pickedRecipientRows`: pole na ucznia, zaznaczony ten, dla którego okno otwarto; droga okna przez `giveToMany` |
| R9145 | 1 | EXP-PL-17 | `copyOriginLines`: klucz na pochodzenie, bez imion przy `givenMany` i `autopsy`, `gaveTo`, brak flagi - null |
| R9146 | 1 | EXP-GM-10 | `erasedRemnantsHtml`: brak wierszy - brak sekcji; dwa wiersze - dwa elementy, od najnowszego, tekst wyescapowany |

Następny wolny numer linii: R9147.

### Tier 2 (blok `// T3 investigation-trial-chapter` w `scripts/tests-tier2.mjs`)

T3 TRIAL-02, T3 VOICE-09, T3 MURDER-07, T3 TRIAL-01 (+ "T3 TRIAL-01 second GM"), T3 TRIAL-03 (+ "second GM", "third GM"),
T3 PRIM-06 (+ "second GM"), T3 TRIAL-04 (+ "second GM", "Assistant GM"), T3 INV-01, T3 INV-02 (+ "counting GM"), T3 INV-05,
T3 INV-04 (+ "second GM"), T3 INV-03, T3 INV-07, T3 INV-12, T3 TRIAL-07 (+ 2x "primary GM"), T3 TRIAL-15 (+ 2x "primary GM"),
T3 TRIAL-14, T3 TRIAL-10, T3 EXP-PL-08, T3 EXP-GM-12, T3 EXP-PL-13, T3 EXP-GM-03, T3 EXP-GM-04, T3 TRIAL-06,
T3 TRIAL-08, T3 EXP-GM-11, T3 EXP-PL-17, T3 EXP-GM-10.
Wpisy "+ ..." to rola przeglądarki w tym samym teście, nie osobne testy.

### Scenariusz 58 (`audit/harness/scenarios/58-case-two-gms.mjs`, nowy, warstwa `ci`, wiersz w `audit/harness/README.md`)

Części: 0 (gm2 dołącza, wszyscy czytają GM-a ziarna jako głównego), TRIAL-02, TRIAL-01, TRIAL-03, PRIM-06, TRIAL-04,
INV-01, INV-02, INV-05, INV-04, INV-07, INV-12, TRIAL-07, TRIAL-08 - 14 części. TRIAL-08: gm2 zaczyna rozprawę
przez `setClock` z zawieszonymi zapisami aktorów (jego wejście staje w budżecie, oznaczonym `started`) i przeładowuje
się; gm dokańcza resztę przy wyjściu gm2, budżetu nie daje drugi raz. Bez części dla INV-03, INV-09, TRIAL-05, TRIAL-06,
TRIAL-10, TRIAL-12, TRIAL-14, TRIAL-15, TRIAL-16, PRIM-10, EXP-GM-03, EXP-GM-04, EXP-GM-12, EXP-PL-*, CTL - te mierzą
tylko testy tier 1/2 (jedna przeglądarka wystarcza do ich odczytu albo zabrakło czasu; TRIAL-14, TRIAL-10, EXP-GM-03 i
EXP-GM-04 zyskałyby na części z dwoma GM-ami).

### `33-bridge-paths`

Nowa faza "INV-12": p1 zgłasza Observe, którego główny nie rozliczył - jedna karta GM-ów, suma z rekordu GM-ów; drugie
zgłoszenie tego rzutu nie daje drugiej karty, p1 nie dostaje odmowy. `season.reset` bez nowego wiersza: macierz H
obejmuje każdą akcję `gmOnly`.

### Zmienione istniejące testy (każdy w commicie zmiany, uzasadnienie w komunikacie)

| Test | commit | dlaczego |
| --- | --- | --- |
| R164, R321 (tier 0) | 9ec314e | zbieracz `relayRefusal` w DELEGATES; odmowa finishOtherGm przez `say` |
| R8732 (tier 1), R321, tier 2 "a stopped verdict is finished by the GM who gave it ..." | ec84627 | trasa "claim" dla pełnego GM-a |
| R8731 (tier 1) | be1883e | drugi pełny GM może resetować (przez głównego), Asystent nie |
| R8143 (tier 1) | 857caa9 | Dokończ werdykt wyszarzony tylko u Asystenta |
| 97-two-gms U1 | 2d769cb | werdykt dokańczany u gm2, `by === GM2` |
| r122-D-2 (tier 2) | 1fdb5d3, 6966f52 | filtr szeptów po treści i `gmPopup` (nowe szepty opisu) |
| R7130 | bdf0825 | opłata za Klucze z kartą przy braku odpowiedzi |
| R3510 (spis kart, tier 0) | 1ec17b8, 2a6815b, c923094, f291658, 45682b1, 7bd6a6d, d7d982b, 6966f52 | nowe karty i linie w policzonych plikach |
| R2035, R2054 | c5d1a7e, f893908 | nowe miejsca ostrzeżeń (`holdCharge`, `openNoBallots`) |
| R311 | c820fd7 | wiersz spisu dróg rozprawy dla `holdSentence` |
| R4752, R4755 (spis podpowiedzi) | cc1e9c8, 3385c89, 9cfee74 | nowe podpowiedzi `Tips.Trial.*`, `Tips.Case.nodeOpensMapTooltip` |
| R1252 | d7d982b | koniec rozdziału ma 10 kroków (`players`) |
| R312, R2050, R1257; tier 2 test liczenia "two-name vote" | 9cfee74, d496768 | op `announce`, krok konsoli `announceVote`, pola `resultCard`/`resultAnnouncedAt`; test woła `closeVote({ preview: false })` i `announceVote` |
| R6, R1560 (`tools/api-surface.json`) | 67e8de3, c5d1a7e | `requestResolveLost` z `local`; `chargeKeyFee` |
| R4752 (48 kluczy), `tools/tooltip-census.json` (wiersz `ballotFormHtml` usunięty) | 6a52df4 | pole wyboru na karcie głosu ma własną podpowiedź zamiast wiersza spisu (CI 651 czerwone na `check tooltips`) |
| 88-flow-length "the Class Trial", `audit/harness/flow-length.json` (verdict) | 8484751 | odpowiedź "start" na pytanie EXP-GM-03 i sprawdzenie, że się pojawiło; krok Ogłoś z EXP-GM-04 w wierszu verdict (GM 8 -> 9). Opis w sekcji 2, "Ostatni pełny" |
| R22, R3510 (tier 0) | 383c779 | R22: spis nazw nie czytał parametrów metody w literale obiektu - `step` jest funkcją zagnieżdżoną; R3510: `clock.mjs` +1 "built" (szept o dokończonej zmianie fazy) |
| "Back up the case, then Restore, brings every store back" (tier 2) | 3f87755 | fikstura dla nowego magazynu z `backup: true`, `erasedRemnants` |
| R4752 (bez zmiany liczby) i spis podpowiedzi | 42c490f, 3f87755 | nowe klucze w `DRPG.Tips.Sweep.Gm` (`pickedTargetTooltip`) i `DRPG.Tips.Sweep.Case` (`erasedListTooltip`); żaden test liczący tych rodzin nie był czerwony |
| 61-gmstore-case J1 | 7f10014 | trzymało starą odmowę resetu drugiemu GM-owi; TRIAL-04 ją zmienił (okno u gm2, plan do głównego). J1 czyta teraz: okno u gm2 (1), brak odmowy, po anulowaniu żadnego pakietu `season.reset`, zegar nie przecięty, wybór Mastermind zostaje. Specyfikacja kazała uruchomić 65, 58 i 33, nie 61; CI 645 (d7d982b) pokazało czerwone J1 |

### Mutanty (na kopii drzewa, nigdy na drzewie)

| Mutant | sprawdzane | wynik |
| --- | --- | --- |
| `resolve.lost`: suma z pakietu zamiast z rekordu (handler czyta `payload.total`, sanitizer przepuszcza `total`) | R9129 | KILLED |
| to samo | T3 INV-12 | SURVIVED - runner (`rolled` z `onRecord`) i tak wpisuje sumę z rekordu, więc ten test nie mierzy tej linii handlera; mierzy ją R9129 |
| `season.reset`: sanitizer grup bez zamkniętej listy (`value.filter(key => typeof key === "string")`) | R9123 | KILLED (28.11.2026 na e246839: "groups: registry keys kept once, anything else dropped" czerwone) |

| pole wyboru głosu bez `tipAttr` (6a52df4) | R4752; `check tooltips` | KILLED oba (R4752 FAIL; census: "draws a radio with no tooltip and no hint") |
| TRIAL-08: rozpoczęty budżet uruchamiany ponownie (`phaseStepsLeft` bez warunku `ONCE_STEPS`) | R9143; 58 TRIAL-08; T3 TRIAL-08 | KILLED, KILLED (Aiko odzyskała akcje); tier 2 SURVIVED - jego wiersz ma budżet `done`, jak w specyfikacji |
| TRIAL-08: wiersz połączonego GM-a dokańczany (`return true`) | R9143; T3 TRIAL-08 | KILLED; tier 2 SURVIVED (jego pisarz jest nieobecny) |
| EXP-GM-11: `giveToMany` daje tylko pierwszemu | T3 EXP-GM-11 | KILLED |
| EXP-PL-17: kilku zapisane jako `given` | T3 EXP-PL-17 | KILLED |
| EXP-GM-10: wiersz nie zapisywany | T3 EXP-GM-10 | KILLED |
| EXP-GM-10: Reroll nie usuwa wiersza | T3 EXP-GM-10 | KILLED |

Inne mutanty nie były mierzone. To mniej niż metoda (`docs/dev/METHOD.md`) zakłada dla każdej oznaczonej drogi.

### Ostatni pełny `npm test`

Pełny `npm test` nie mieści się w tym kontenerze: `run-all.mjs` zabija suite po 108 minutach (`SUITE_TIMEOUT_MS`),
a jeden bieg 01-runtests trwa tu dłużej. Bieg monolityczny zabiłem; zgodnie z ustaleniem koordynatora za pełny bieg
uznaje się zielone CI. Stan na 28.11.2026, 07:15 UTC:

| Co | sha | wynik |
| --- | --- | --- |
| **CI run 662** | **8484751** (30 pozycji i poprawki CI) | **zielony**: 19 zadań success (lint, check, gate; 8 shardów suite; 8 kubełków scenariuszy; plan; verdict), 2 zadania CRLF pominięte jak przy każdym pushu |
| CI run 665 / 667 / 671 | a9d03a4 / 383c779 / 3f87755 (TRIAL-08; R22 i R3510; EXP-GM-11, EXP-PL-17, EXP-GM-10) | w kolejce - **wyniku nie znam w chwili pisania**; run tego raportu też |
| CI run 651 / 645 / 658 / 659 / 661 | e246839 / d7d982b / 6a52df4 / 7f10014 / 5799d56 | czerwone, przyczyny niżej, wszystkie poprawione do 8484751 (662 zielony) |
| lokalnie: tiers 0-1 | 3f87755 (drzewo robocze tych samych plików) | **2080 passed, 0 failed, 16 skipped, 0 red** |
| lokalnie: 8 shardów suite + `suite-merge.mjs` | e246839 | 3981 passed, 0 failed, 27 skipped, 0 red; merge zielony |
| lokalnie: `npm run quick` z pobranym `origin/main` | 3f87755 | zielone: lint 461 plików 0 problemów, check 26 części, gate 62/62 |
| lokalnie: scenariusze po TRIAL-08 | 383c779 | 41 52/52, 63 79/79, 18 94/94, 65 59/61 (2 expected red), 61 118/118, 97 58/58, 58 15/15, 88 27/27 |
| lokalnie: scenariusze po EXP-GM-11, EXP-PL-17, EXP-GM-10 | 3f87755 | 95 4/4, 62 62/62, 72 163/166 (3 expected red), 10 45/45, 13 87/87, 34 17/17, 60 19/19, 40 90/90, 99 23/23, 33 93/95 (2 expected red), 30 309/311 (2 expected red) |
| lokalnie: tier 2 testów linii | a9d03a4, 3f87755 | T3 TRIAL-08, T3 EXP-GM-11, T3 EXP-PL-17, T3 EXP-GM-10 i "Back up the case, then Restore" zielone; pełnego tier 2 lokalnie nie uruchamiałem po e246839 |

Poprawki po e246839, każda z odczytem przed i po:
- `check tooltips` (6a52df4): wiersz spisu podpowiedzi przeniesiony z `castBallot` do `ballotFormHtml` (EXP-PL-16), a
  main go nie ma; pole wyboru na karcie głosu dostało własną podpowiedź. Lokalnie zielone, bo klon nie miał
  `origin/main` i porównanie się nie odbyło; po `git fetch origin main` czerwone, po poprawce zielone.
- `check registry` (5799d56): nowa nazwa R4752 w `docs/dev/R-REGISTRY.md`.
- 61 J1 (7f10014): trzymało odmowę resetu dla drugiego pełnego GM-a, którą TRIAL-04 celowo zmienił.
- 88-flow-length (8484751): od EXP-GM-03 Rozpocznij rozprawę pyta, gdy karty graczy czekają na decyzję GM-a, a w 88
  czekają trzy (wynik Observe, podpowiedź, rzut akcji dynamicznej - przepływy je obciążają i nie oceniają; zmierzone na
  kopii drzewa: bez flagi `settled`, z żywymi przyciskami, konsola też je pokazuje). Kolejka odpowiedzi dostała
  "start", check sprawdza, że pytanie się pojawiło. Linia `verdict` w `flow-length.json`: GM 8 -> 9 kliknięć i okien,
  Ogłoś z podglądu EXP-GM-04 (zapisane `DRPG_FLOW_LENGTH_WRITE=1`, przeczytane ręcznie: żaden inny wiersz się nie
  ruszył).

Wcześniejsze bramki w trakcie pracy (snapshot worktree, nie `npm test`): tiers 0-1 na 3385c89 - 2075 passed, 0 failed,
16 skipped; scenariusze 18, 63, 68 zielone na 3385c89; 18 i 63 zielone z kodem d496768; 40 zielone na 9cfee74; 58
zielone na każdym sha, na którym dopisywana była część.

## 3. Zmienione sekcje handbooków

Każda zmiana w EN i PL tym samym miejscem. Zdania dopisane do istniejących akapitów, nie nowe akapity - sekcja 6
(`docs/handbook-facts.*.json` przesuwa jednostki przy nowym akapicie albo punkcie).

| Plik | Sekcja | Co |
| --- | --- | --- |
| gm-handbook | 14.2 Okno Investigation (akapit stopki) | lista Usunięte przy sprzątaniu w zakładce Remnanty (EXP-GM-10) |
| gm-handbook | 14.4 Key Remnants | opłata, na którą główny nie odpowiedział, zostawia kartę z Pobierz opłatę; `game.drpg.chargeKeyFee` (INV-07) |
| gm-handbook | 14.6 Observe | okno opisu u każdego GM-a i zamykane u reszty (INV-01, INV-02, INV-05); karta nierozliczonego Observe/Analyze (INV-12) |
| gm-handbook | 14 (akapit Zaplanowany Truth Bullet) | Wybrani uczniowie w oknie Daj Truth Bullet (EXP-GM-11) |
| gm-handbook | 15 (wstęp, krok 1) | Zacznij Class Trial pyta, gdy prośby czekają (EXP-GM-03); kroki rozpoczęcia i zakończenia dokańczane przez głównego po przerwie, akcje nie drugi raz (TRIAL-08) |
| gm-handbook | 15, Pasek GM-a | rozłączony z głosem w Objection/Rebuttalu (TRIAL-14) |
| gm-handbook | 15, Głosowanie | podgląd wyniku i Ogłoś wynik (EXP-GM-04); ostrzeżenie o kartach rozłączonych (TRIAL-06) |
| gm-handbook | 15, Werdykt | Dokończ werdykt u każdego pełnego GM-a, odmowa mówiona naciskającemu (TRIAL-03, PRIM-06, TRIAL-02); kroki złego werdyktu do odznaczenia (EXP-GM-12); karta niewykonanego wyroku (TRIAL-07) |
| gm-handbook | 15, akapit **Show summary** (pod nagłówkiem Tryby rozprawy) | ostrzeżenie w podglądzie podsumowania po błędnym werdykcie (TRIAL-12) |
| gm-handbook | 16.1 Zakończ rozdział | zatrzymany koniec widoczny u każdego pełnego GM-a (TRIAL-01); powód odmowy wraca do pytającego (TRIAL-02); karta nowego rozdziału (EXP-PL-13) |
| gm-handbook | 16.2 Zresetuj sezon | reset drugiego pełnego GM-a biegnie u głównego (TRIAL-04) |
| player-handbook | 8, Truth Bullets | gracz dostaje szept o zmianie jego kopii (EXP-PL-08); plakietka Kopie, zdanie w akapicie po liście karty (EXP-PL-17) |
| player-handbook | 11 Investigation | start Investigation na karcie, kończy ją GM; linia "GM opisuje"; linia nierozliczonego Observe/Analyze (EXP-PL-11, INV-03, INV-12) |
| player-handbook | 12, Objection (akapit o celu) | "kto mówił" słyszy przeglądarka głównego; po zmianie głównego zaczyna od nikogo, a gracz słyszy, w kogo poszedł Objection (TRIAL-10) |
| player-handbook | 12, Głosowanie | wynik pojawia się, gdy GM go ogłosi (EXP-GM-04); oddanego głosu nie da się zmienić (EXP-PL-16) |
| player-handbook | 13 (ostatni akapit, "Gra Monocubem") | karta nowego rozdziału (EXP-PL-13) |

Poza sekcjami linii: nic. 6.3 GM-a nie mówi o resecie, więc bez zmian. Bez zdania w handbookach: TRIAL-15, TRIAL-16,
PRIM-10, CTL (teksty widać w oknie albo szepcie).

## 4. Klucze i18n

Względem 31d5812: 87 nowych, 6 zmienionych, 0 usuniętych (EN i PL, `node tools/check.mjs parity` zielone).

### W przestrzeniach T3

- `DRPG.Observe`: nowe `describing`, `unresolved`, `unresolvedGms`, `describeTakenBy`, `describeTakenTimedOut`,
  `describeTimedOutGms`; zmieniony `describeRecovered`.
- `DRPG.Analyze`: nowe `unresolved`, `unresolvedGms`.
- `DRPG.Investigation`: nowe `chargeUnanswered`, `erasedTitle.one`/`.other` (PL także `.few`, `.many`), `erasedRow`,
  `erasedRowNobody`, `erasedNoRoom` (EXP-GM-10).
- `DRPG.TruthBullet`: nowe `copyChanged`, `copyPart.name`, `copyPart.words`, `copyPart.image`, `copyPart.reading`;
  `recipientPicked`, `pickedLegend`, `pickedNone` (EXP-GM-11); `copyOrigin.label`, `.found`, `.shared`, `.given`,
  `.givenMany`, `.autopsy`, `.gave` (EXP-PL-17).
- `DRPG.Trial`: nowe `objectionAimedElsewhere`, `objectionSpeakersFresh`, `recordWrittenHere`, `sentenceNotCarried`,
  `sentenceAgain`, `sentenceAgainTooltip`; `phaseStepsEntryFinished`, `phaseStepsExitFinished`, `phaseBudgetCut`
  (TRIAL-08).
- `DRPG.Floor`: nowe `waitingIntro`, `startAnyway`, `waitingObserve`, `holderGone`, `next.announceVote`,
  `lead.announceVote`, `bar.notPrimary`; zmienione `next.finishElsewhere`, `lead.finishElsewhere`.
- `DRPG.Vote`: nowe `silentGone.one`, `silentGone.other` (PL także `.few`, `.many`), `notYet`, `announce`, `previewIntro`,
  `previewTitle`, `verdictSkipped`, `wrongSteps.legend`, `wrongSteps.offers`, `wrongSteps.rule`, `wrongSteps.despair`,
  `ballotFinal`, `finishTaken`; zmieniony `openNoBallots`.
- `DRPG.Chapter`: nowe `newChapter.title`, `.fresh`, `.kept`, `.morning`, `.sweep`, `.faint`, `.keys`, `.items`,
  `.keptFaint`, `.bullets`, `.nothing`, `bodyCalledNext`, `step.players`.

### W cudzych przestrzeniach (dopisane na końcu obiektu)

- `DRPG.Bridge.what.season.reset`, `DRPG.Bridge.what.resolve.lost` (T2).
- `DRPG.Tips.Case.nodeOpensMapTooltip`.
- `DRPG.Tips.Trial.notYetTooltip`, `announceTooltip`, `wrongStepOffersTooltip`, `wrongStepRuleTooltip`,
  `wrongStepDespairTooltip`, `startAnywayTooltip`, `ballotChoiceTooltip` - spis podpowiedzi (R4752) wymaga klucza
  `Tips.*` dla każdego przycisku z podpowiedzią; specyfikacja ich nie wymieniała. `ballotChoiceTooltip` (6a52df4) to
  podpowiedź pola wyboru na karcie głosu: CI odrzuciło wiersz spisu `tools/tooltip-census.json` przeniesiony z
  `castBallot` do `ballotFormHtml` (sekcja 2, "CI").
- `DRPG.Explain.investigationStarted` (nowy).
- `DRPG.CaseSummary.wrongVerdictHint`.
- `DRPG.Case.store.phaseSteps`, `DRPG.Case.store.erasedRemnants` - nazwy nowych magazynów w oknach sprawy (R173).
- `DRPG.Tips.Sweep.Gm.pickedTargetTooltip` (EXP-GM-11), `DRPG.Tips.Sweep.Case.erasedListTooltip` (EXP-GM-10).

### Istniejące klucze bez właściciela, zmienione

- `DRPG.GmStore.resetPrimaryOnly` (TRIAL-04): bez "gdy będziesz jedynym połączonym GM-em".
- `DRPG.Explain.phase.investigation` (EXP-PL-11): zdanie o tym, co zmienia Investigation i że kończy je GM.

Tylko czytane: `DRPG.Messenger.gm.waiting`, `DRPG.Voice.resetRefused.*`, `DRPG.Body.*`, `DRPG.Eclipse.bodyLocked`.
`docs/text-style.md`, `docs/glossary.json`, `docs/text-budgets.json` bez zmian; nowe teksty są wyżej.

## 5. Do notatek wydania

- Okno opisu znaleziska z Observe otwiera się u każdego GM-a, a gdy jeden odpowie, u reszty zamyka się z informacją, czyje
  słowa poszły (1fdb5d3; R9124, R9125, 58 INV-01/INV-02).
- Gdy nikt nie opisze znaleziska na czas, wiedzą o tym wszyscy GM-owie (1fdb5d3; T3 INV-05, 58 INV-05).
- Odświeżenie głównego GM-a nie kończy okna opisu, w którym pisze drugi GM (581aeb9; R9126, 58 INV-04).
- Gracz, którego Rozejrzyj się trafiło w nieopisany ślad, wie, że GM go opisuje (6966f52; T3 INV-03).
- Opłata za nieznalezione Key Remnanty, na którą główny GM nie odpowiedział, zostawia GM-om kartę z Pobierz opłatę;
  w konsoli `game.drpg.chargeKeyFee()` (bdf0825; R9128, 58 INV-07).
- Observe albo Analyze, którego główny GM nie rozliczył, bo wypadł, mówi graczowi, że akcja jest wydana i GM rozliczy ją
  ręcznie, a GM-owie dostają kartę z wynikiem rzutu (7286c53; R9129, 58 INV-12).
- Odmowa wykonana u głównego GM-a (koniec rozdziału, Dokończ werdykt, odkrycie ciała, Napraw głos) mówi naciskającemu GM-owi
  prawdziwy powód (9ec314e; R9120, 58 TRIAL-02).
- Koniec rozdziału przerwany odświeżeniem głównego albo zmianą fazy jest widoczny jako zatrzymany u każdego GM-a
  (79a4164; R9121, 58 TRIAL-01).
- Każdy pełny GM może dokończyć zatrzymany werdykt, także cudzy; okna kroków otwierają się u niego (ec84627; 58 TRIAL-03,
  58 PRIM-06).
- Drugi pełny GM może zresetować sezon - reset biegnie u głównego z planem z jego okna (be1883e; R9123, 58 TRIAL-04).
- Okno głosowania, podgląd wyniku i okno werdyktu ostrzegają GM-ów, ile kart mają rozłączeni gracze i których uczniów
  (9cfee74; R9142, T3 TRIAL-06).
- Zamknij i policz pokazuje GM-owi wynik, a stół widzi go dopiero po Ogłoś wynik (9cfee74; T3 EXP-GM-04).
- Wyrok, którego główny GM nie potwierdził, zostawia GM-om kartę z Wykonaj wyrok ponownie (910b39b; R9130, 58 TRIAL-07).
- Zapis przebiegu rozprawy zrobiony z tej przeglądarki, bo główny nie odpowiedział, jest mówiony GM-om (c923094; T3 TRIAL-15).
- Rozłączony gracz z głosem w Objection albo Rebuttalu daje GM-om kartę z podpowiedzią (f291658; T3 TRIAL-14).
- Objection po zmianie głównego GM-a mówi, jak główny słyszy salę, albo w kogo naprawdę trafił (8692c24; R9135).
- Podgląd podsumowania sprawy po błędnym werdykcie ostrzega, że zawęża podejrzanych (3c3eebc; R9134).
- Odmowa kroku podłogi po zmianie głównego mówi o zmianie głównego, nie o braku rozprawy (b91568b; R9133).
- Karta do głosowania mówi, że głosu nie da się zmienić; okno bez kart nie podsuwa restartu (f893908; R9131, R9132).
- Zacznij Class Trial pyta, gdy prośby graczy albo opisy znalezisk czekają na GM-a (5264395; R9141, T3 EXP-GM-03).
- Okno złego werdyktu ma trzy pola: Reinforced Level Up, nowa zasada, Despair - odznaczone nie biegną (cc1e9c8; R9139).
- Gracz dostaje szept, gdy GM zmieni jego kopię Truth Bulletu (7bd6a6d; R9138).
- Karta odkrycia ciała i wyjaśnienie fazy mówią, po co jest Investigation i że kończy ją GM; jej start jest na karcie
  (45682b1; R9137).
- Koniec rozdziału z Next chapter daje stołowi kartę: co zaczyna się od nowa, co zostaje (d7d982b; R9140).
- Węzeł schematu w konsoli rozprawy mówi, że otwiera go na Mapie (d63b1d4; R9136).
- Rozpoczęcie albo zakończenie Class Trial przerwane przeładowaniem GM-a albo utratą połączenia dokańcza główny GM; akcji
  na rozprawę nie rozdaje drugi raz i mówi GM-om, gdy przerwa wypadła w ich trakcie (a9d03a4; R9143, T3 TRIAL-08, 58 TRIAL-08).
- Daj Truth Bullet ma Wybrani uczniowie: każdy zaznaczony dostaje własną kopię (42c490f; R9144, T3 EXP-GM-11).
- Truth Bullet na arkuszu ma plakietkę Kopie: skąd jest ta kopia i czy inni mogą mieć swoją, bez imion, których gracz
  nie zna (42c490f; R9145, T3 EXP-PL-17).
- Zakładka Remnanty okna Investigation wymienia Remnanty usunięte przy sprzątaniu: co, gdzie, kiedy i czyje sprzątanie
  (3f87755; R9146, T3 EXP-GM-10).

## 6. Uwagi dla koordynatora

**Czekam na T2.**
- TRIAL-01: `markHaltedEnd` jest wołane przy `onGmStoresHydrated` (`registerHaltedEnd` w `module.mjs`); po scaleniu ma
  iść na gotowość głównego (PRIM-03).
- TRIAL-10: zmiana celu po przejęciu roli głównego jest czytana w chwili Objection; `drpgPrimaryChanged` z T2 nie jest
  użyty, bo go tu nie ma.
- EXP-GM-03: `waitingCards` ma nazwę z sekcji 4, ale nie jej sygnaturę: przyjmuje opcjonalne `{ messages, words }`
  (dla R9141; woła się ją bez argumentów) i zwraca `{ messageId, player, who, text }` zamiast
  `{ messageId, actorId, userId, kind, text }`. Przy scaleniu zostaje wersja T2; `trial-floor-ui.mjs` `waitingFirst`
  czyta z niej tylko `who` (imię gracza) i `text`, więc trzeba go przepiąć na `userId` -> imię, a R9141 na wersję T2.
- INV-04, INV-01: odzysk wierszy przy hydracji, nie przy gotowości głównego.

**Czekam na T1.**
- `body.mjs`: jedna linia karty ogłoszenia (`bodyCalledNext`, EXP-PL-11), `say` w `runDiscovery` i odpowiedź w
  `discoverOnPrimary` (MURDER-07, 9ec314e). Argumentów `handleBodyDiscover` nie przestawiałem.

**Pliki u granic długości.**
- `scripts/verdict.mjs` 1500 linii (limit 1500 pliku dzielonego); dlatego nowe pliki `verdict-claim.mjs` (TRIAL-03,
  czytany tylko przez `import()`, w `open-cost.mjs` `NOT_WARMED`) i `verdict-skips.mjs` (EXP-GM-12, TRIAL-06). T5
  dopisuje krok motywów do `VERDICT_STEPS` - zabraknie miejsca na więcej niż wiersz tablicy.
- `scripts/bridge-table.mjs` 1749 z 1750; wiersze `season.reset` i `resolve.lost` są jednoliniowe, konwertery
  `resetGroupsOf`/`resetCastOf` w `bridge-runs-records.mjs`. T1/T2/T5 dopisujący wiersze przekroczą 1750.
- Nie dzielone, więc `check lengths` ich nie trzyma, ale urosły: `observe.mjs` 1648 -> 1874, `trial-floor-ui.mjs`
  2106 -> 2177.
- Wiersze nowych plików (`verdict-claim.mjs`, `verdict-skips.mjs`, `vote-gone.mjs`) nie są dopisane do tabeli
  `.claude/rules/code.md` - to nie są cięcia czystym przeniesieniem, a plik reguł nie był w zakresie linii.

**Fasada.** `vote.mjs` (szczyt rodziny, z własnym kodem kart i rund) eksportuje dwie nowe nazwy: `ballotFormHtml`
(EXP-PL-16) i `announceVote` (EXP-GM-04). Według `.claude/rules/code.md` kod kart do głosowania należy do `vote.mjs`,
ale to warto potwierdzić przy scaleniu.

**Pliki poza listą sekcji 4, zmienione:** `module.mjs` (`registerSentenceAgain`, `registerHaltedEnd`), `api.mjs`
(`chargeKeyFee` na końcu), `open-cost.mjs` (`NOT_WARMED`), `tests-flows.mjs` (przepływy `season-reset-second-gm` i
`resolve-lost`), `case-map.mjs`, `case-trial.mjs`, `case-summary.mjs`, `truth-bullets.mjs`, `tools/api-surface.json`,
`tools/tooltip-census.json`, `audit/harness/scenarios/97-two-gms.mjs` (U1, 2d769cb), `scripts/trial-modes.mjs` (EXP-PL-17,
jedna opcja Reveal), `scripts/tests-tier0.mjs` (R3510, R22 - 383c779), `audit/harness/scenarios/61-gmstore-case.mjs` (J1),
`audit/harness/scenarios/88-flow-length.mjs` i `audit/harness/flow-length.json`.

**Przewidywane konflikty.** `bridge-runs-records.mjs` koniec pliku (`handleResolveLost`, `resetGroupsOf`/`resetCastOf`;
T1 dopisuje `eclipse.judge`); `bridge-table.mjs` koniec `BRIDGE_ACTIONS` i długość; `bridge-wire.mjs` (dwie stałe
`ACTION_`); `lang/*.json` końce `DRPG.Bridge.what` i `DRPG.Tips.Trial`; `trial-floor.mjs` (`TRIAL_NEXT_STEPS`, T5);
`chapter.mjs` (`CHAPTER_END_STEPS` ma teraz `players` jako ostatni - T5 dopisze zerowanie motywów); `R-REGISTRY.md`
(generowany); `gm-stores.mjs` - jeden blok T3 na końcu pliku (`phaseStepStore`, `erasedRemnantStore`); `settings.mjs` -
dwa klucze (`gmPhaseSteps`, `gmErasedRemnants`) i ich rejestracje po `minePassages`.

**Odstępstwa od specyfikacji.**
- Handbooki: nowe treści jako zdania dopisane do istniejących akapitów, także karta nowego rozdziału w sekcji 13
  (specyfikacja: osobny akapit). Nowy akapit albo punkt przesuwa jednostki `docs/handbook-facts.*.json` i
  `check text` jest czerwone.
- 58 INV-04: w harnessie okno gm (po powrocie jako główny) odpowiada samo domyślnymi słowami, więc część sprawdza, że
  znalezisko wyszło raz, przez okno wiersza, bez karty odzyskania i bez "already held" u p1 - ale nie, że słowa to
  słowa gm2 (opis w nagłówku 58). Pełny pomiar wymaga stołu.
- TRIAL-06: imię ucznia rozłączonego gracza to jego przypisana postać, inaczej uczeń, którego jest właścicielem,
  inaczej nazwa użytkownika.
- EXP-GM-04: podgląd jest otwierany w `closeVote` bez czekania (`closeVote({ preview = true })`); czekanie na okno
  zawieszało wołających (bieg zabity po 900 s).
- TRIAL-08: kroki nie są listą `steps.mjs` `runSteps` (specyfikacja: "jak `CHAPTER_END_STEPS`"). Każde wywołanie zostaje
  w `reconcilePhase` w tej samej kolejności, owinięte w `step(...)`, a dokończenie to `reconcilePhase(from, to, { only,
  rowKey })`; testy tier 0 (R113, R1033, R3404, R7172 i inne) czytają tę kolejność w źródle. Rejestracja odzysku idzie
  przez `trial-progress.mjs` `registerSentenceAgain` (`module.mjs` nic nie importuje z `clock.mjs`, a `module.mjs` nie
  jest na liście TRIAL-08). Odczyt budżetu: `openTrialBudget` (`resetAllActions` z `keepGrants`) ustawia akcje każdego
  ucznia na pełną pulę - powtórzony po wydaniu akcji w rozprawie oddałby ją, więc nie jest idempotentny w ogólności;
  komentarz nad `reconcilePhase` mówi o idempotencji dla drugiej debaty, nie dla F5. Poza tym: wiersz może dojść do
  głównego, zanim ostatni znacznik `done` piszącego zdąży się zsynchronizować - wtedy krok idempotentny biegnie drugi
  raz (bez skutku), a budżet bez znacznika `started` też (nie zmierzone; główny sprawdza tylko to, co do niego doszło).
- EXP-PL-17: Reveal Monokumy (`trial-modes.mjs` `revealInStep`, plik spoza listy) pisze `givenMany` - jedna opcja w
  wywołaniu. Present (`trial.mjs` przez `mintCopy`) pisze `shared` z imieniem prezentującego, a na kopii prezentującego
  `gaveTo` z imionami wszystkich uczestników. Kopia "told" zostawiającego ślad (własny ślad, o którym mu powiedziano)
  nie dostaje pochodzenia. Zdanie jest w podpowiedzi plakietki Kopie, nie w osobnym wierszu karty.
- EXP-GM-11: `RECIPIENT_PICKED` jest stałą w `gm-items.mjs` (`config.mjs` nie jest na liście pozycji); zakładka Daj
  okna rzeczy ma własny wybór ucznia i została bez zmian.

**Błędy spoza zakresu.** W trakcie pracy widziałem czerwone 65 X2/X2b i 33 A21b/E74-A2; 33 było później zielone
w całości, a 65 jest zielone w CI 651 (kubełek b3, e246839). Nie badałem, czy były czerwone na 31d5812. Wszystkie
czerwone, które CI pokazało na tej gałęzi (`check tooltips`, `check registry`, 61 J1, 88, R4752 w 645), były moje i są
poprawione (sekcja 2); żadnego nie zapisuję jako istniejącego wcześniej.

**Lokalne bramki a CI.** `tools/tooltip-census.mjs` porównuje spis z kopią `origin/main` tylko wtedy, gdy ją widzi.
Klon tej sesji jej nie miał, więc `npm run quick` było zielone mimo błędu. Warto, żeby linie przed pierwszym quick
robiły `git fetch origin main:refs/remotes/origin/main`. Specyfikacja kazała uruchomić przy TRIAL-04 scenariusze 65, 58
i 33, a 61 J1 też czyta reset drugiego GM-a; przy EXP-GM-03 i EXP-GM-04 nie wymieniała 88, który liczy kliknięcia
rozprawy.

**Nie zrobione, do przeniesienia:** części 58 dla TRIAL-14, TRIAL-10, EXP-GM-03, EXP-GM-04 (pozycje są zrobione i
mierzone testami tier 1/2).

## 7. Pytania do właściciela

Odpowiedzi nie było; linia pracowała na domyślnych.

| # | Pytanie | Domyślne linii |
| --- | --- | --- |
| P1 | TRIAL-06: zostaje ostrzeżenie o kartach rozłączonych graczy, czy podstawa liczenia też ma się zmienić? | tylko ostrzeżenie; podstawa bez zmian (D6); kontrola S1b przepisana na ostrzeżenie |
| P2 | EXP-GM-04: czy werdykt może zapaść, zanim wynik głosowania ogłoszono stołowi? | może; konsola podpowiada najpierw Ogłoś wynik głosowania |
| P3 | TRIAL-03 i PRIM-06: każdy pełny GM może zająć zatrzymany werdykt i dokończyć go u siebie; werdyktu, w którego oknach wykonawca siedzi, nikt nie przejmuje. Tak? | tak |
| P4 | EXP-GM-12: czy pominięcie Reinforced Level Up ma zabrać ofertę także, gdy GM zmieni zdanie później? | pominięty na stałe w tym werdykcie; GM daje Level Up ręcznie |
| P5 | EXP-PL-17: zdanie o kopiach mówi tylko to, co gracz wie z własnej akcji albo karty. Wystarczy? | tak |
| P6 | EXP-PL-08: zmiana obrazu też ma być ogłaszana? | odczyt tylko przy przeanalizowanej kopii; obraz ogłaszany razem z innymi częściami |
| P7 | INV-12: czy gracz ma dostać akcję z powrotem, gdy GM uzna rzut za nierozliczony? | bez automatycznego zwrotu; GM oddaje ręcznie |
| P8 | TRIAL-07: czy główny przy gotowości ma sam wykonać wyrok, którego nie potwierdził? | nie, tylko przycisk na karcie GM-ów |
| P9 | TRIAL-08: czy gdy F5 trafi w trakcie kroku budżetu, główny ma go powtórzyć? | nie - budżet nie jest idempotentny po wydaniu akcji; krok idzie do `failed`, GM-owie dostają szept |
| P10 | EXP-PL-13: karta nowego rozdziału ma też iść osobno do każdego gracza? | jedna publiczna karta, bez danych osobistych |
| P11 | INV-01: zostawić szept "Znalezisko ... czeka na opis" jako zapis? | zostawić jako zapis |
| P12 | EXP-PL-13: koniec rozdziału nie zeruje Despair, odpoczynków ani stanów (kod tego nie robi), więc karta o nich nie mówi. Czy koniec rozdziału ma je zerować? | nie; karta mówi tylko to, co kod zeruje i przenosi |
| P13 | TRIAL-04: okno resetu otwarte przez GM-a, który był głównym, a przestał nim być przed potwierdzeniem, odmawia jak dziś (65 U1). Ma zamiast tego przekazać reset nowemu głównemu? | odmawia jak dziś |
| P14 | Handbooki: nowe treści są zdaniami w istniejących akapitach, nie osobnymi akapitami (handbook-facts). Czy karta nowego rozdziału w sekcji 13 handbooka gracza ma mieć jednak osobny akapit (wtedy trzeba przeliczyć `docs/handbook-facts.*.json`)? | zdanie w ostatnim akapicie sekcji 13 |
| P15 | TRIAL-06: imię przy karcie rozłączonego gracza - przypisana postać, uczeń, którego jest właścicielem, albo nazwa użytkownika. Tak? | tak, w tej kolejności |
| P16 | TRIAL-15: szept o zapisie z tej przeglądarki najwyżej raz na minutę na przeglądarkę. Wystarczy? | tak |
| P17 | EXP-GM-03: Rozpocznij rozprawę pyta o każdą kartę, którą konsola pokazuje w "Czeka", także kartę po rzucie czekającą na ocenę GM-a (wynik Observe, podpowiedź, rzut akcji dynamicznej - tak było w 88). Czy pytanie ma obejmować tylko prośby wysłane przez gracza w komunikatorze? | wszystkie karty z "Czeka", jak konsola |
| P18 | EXP-PL-17: flaga `copyOrigin` stoi na przedmiocie, a flagi przedmiotów dochodzą do każdej przeglądarki - gracz z konsolą przeczyta u kogoś innego, od kogo ma kopię i komu ją przekazał (imiona uczniów, nie klucz odpowiedzi; `world-secrets.mjs` zabrania tylko `remnantRef`, `leftBy`, `leftByName`). Tak jak dziś treść samego Truth Bulletu. Zostawić, czy przenieść to do kopii gracza w magazynie GM-ów? | zostawić na przedmiocie |
