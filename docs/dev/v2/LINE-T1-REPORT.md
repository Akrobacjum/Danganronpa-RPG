# Linia T1 - raport (murder, death, eclipse)

Gałąź `claude/v2-t1` z `claude/dazzling-bohr-juuh4g`, 27.11.2026. Specyfikacja: `docs/dev/v2/LINE-T1.md`. Etap w
`tools/stages.json`: `E131` (planowany 1.2.130, z E83, `touches: sockets, rolls, scenes`). Bez pull requesta, bez
wydania, bez `module.json`, bez `tools/stages.mjs ship`, bez CHANGELOG.md, bez plików waiver.

Jak pracowałem: testy pisane przed kodem i czytane jako czerwone na kodzie bazy (`redcheck`: testy z drzewa, kod
z podanego sha), potem kod, potem zielone na drzewie roboczym. Każdy commit przeszedł przed zapisem QUICK (lint,
check - 26 części, gate) i prose na swoim własnym stanie w osobnym worktree, z `node tools/registry.mjs --write`
zrobionym tam (pomocnik `commit.sh`). Tiers 0-2 czytane na drzewie roboczym (szeroki przebieg i przebiegi celowane)
i raz całe na końcu (`npm test`, sekcja 2). Kilka commitów rozdzielałem po kawałkach diffu z jednego drzewa roboczego;
raz to zgubiło linię (R5740, sekcja 6) - poprawka w osobnym commicie.

## 1. Stan każdej pozycji

| ID | stan | commit | testy (R i nazwy tier 2, części 57) | uwagi |
| --- | --- | --- | --- | --- |
| MURDER-01+D2-12 | zrobione | 94af3e9 | R8920; "T1 MURDER-01 ...", "T1 D2-12 ..." | pole obsady `atLights`; zasłona tylko dla otwarcia przy świetle; poza Eclipse Hope/krytyk daje "?" od razu. Forge S1a MURDER-01, D2-12: bez zmian - już mierzą zachowanie 2.0 |
| MURDER-02+D2-06 | zrobione | f2523df | R8922; "T1 D2-06 ..." x2 | maska zostaje po końcu incydentu, gdy ofiara przeżyła; schodzi przy wyjściu z pokoju i z porą dnia. Forge S1a D2-06/MURDER-02: bez zmian - już mierzy 2.0 |
| MURDER-03 | zrobione | afd5bbe, aa544ea | R8927, R8928; 57 MURDER-03 | imię nad "?" tylko u GM-a; głos zmarłego z obsady wychodzi z pokoju od chwili śmierci; Wycisz teraz w trackerze nie jest rysowane. Głosu S1a nie mierzy; 57 MURDER-03 mierzy imię (p2 i gm2), nie pokój głosu p3 (sekcja 6) |
| MURDER-04 | zrobione | 5609e25 | R8933; "T1 MURDER-04 ..."; 57 MURDER-04 | Rzuć za gracza w trackerze; pole obsady `openingThrower`; bez nowej akcji mostu (zapis stanu z drugiego GM-a wystarcza). Forge: brak kontroli |
| MURDER-05 | zrobione | e223951, d1ad108 | R8930, R5740 (przystosowany); "T1 MURDER-05 ..."; 57 MURDER-05 | okno u każdego pełnego GM-a, pierwsza odpowiedź zapisana w wierszu zamyka pozostałe. Forge S1b MURDER-05: nie ruszana (S1b nie jest plikiem T1) |
| EXP-PL-02 | częściowo | 658302a, ten commit (test D2-28) | R8923; "T1 EXP-PL-02 ..." x2; 33 T1-DAY-03 | światła: pokój, druga deklaracja, zdrada, odpowiedź GM-a, potem zasłona tylko potwierdzonych i zegar, potem otwarcia. Nie zrobione: D2-28 (odpowiedź na P1, przyszła po zakończeniu pozycji) - rzut otwarcia przed zegarem; patrz sekcja 6. Forge S1a: czekanie kontroli EXP-PL-02 bez zmian |
| EXP-GM-02 | zrobione | e223951 | "T1 EXP-GM-02 ..."; 57 EXP-GM-02 | karta GM-ów z `gmPopup`, raz na znalazcę i ciało. Forge S1b: nie ruszana |
| EXP-PL-03+EXP-GM-15+D2-09+D2-11 | zrobione | cdbe1bb | R8926; "T1 D2-09 ..." x2; 57 D2-09 | zwolnienie czytane na GM-ie (klucz rysowania, incydent, obsada), stempel tylko na wiadomości GM-a; Reroll też nic. Forge S1a D2-09/D2-11: bez zmian - już mierzy brak Hope/Despair |
| D2-08+D2-10 | zrobione | 94af3e9, d35e338 | tier 2 "T1 D2-08 ..."; R8921 (tekst bez imion) | jedno zdanie do ofiary, bez imion. Forge S1a D2-08/D2-10: zawężona do wpisu z DRPG.Murder.victimAttemptFailed (d35e338) |
| DAY-03 | zrobione | 658302a | "T1 DAY-03 ..."; 33 T1-DAY-03; 57 DAY-03 | światła drugiego GM-a czytają pokój przez głównego, akcja mostu `eclipse.judge`. Forge S4 C2 się zmieni (sekcja 6) |
| DAY-04 | zrobione | 658302a | "T1 DAY-04 ..." x2 | wiersz deklaracji przeżywa przeładowanie; zgubiony po zakończonym Zaćmieniu zdejmowany przy ready głównego z linią i zwrotem akcji (P3) |
| DAY-08 | zrobione | a2d1d85 | R8924 | linia i przycisk Wyślij bez notatki w oknie Direct Murder |
| MURDER-06 | zrobione | 5609e25 | R8934; "T1 MURDER-06 ..."; 57 MURDER-06 | jedno wywołanie w haku `userConnected` gm-bridge.mjs po `releaseClaimsOf`. Forge S3: nie mierzy tego |
| MURDER-08 | zrobione | 437c46e, d699989 | "T1 MURDER-08 ..."; 57 MURDER-08 | przekaźnik w osobnym commicie (437c46e); `setRemnantFlagsMany` to magazyn GM-ów, działa na każdym GM-ie |
| MURDER-09 | zrobione | 9e93cfc | R8935, R1360 (przystosowany); "T1 MURDER-09 ..."; 57 MURDER-09 | pytanie jako pole obsady `question` zamiast nowego magazynu (specyfikacja dopuszcza oba); `spentAsked` i `noKillerTold` usunięte |
| MURDER-10 | zrobione | d699989 | - (bez kodu) | zdanie handbooka GM-a 13.4 w akapicie, który zmieniały też MURDER-08/INV-06, więc w ich commicie; fakty s13.p33.f13-f14 |
| MURDER-11 | zrobione | 5609e25 | R8933; "T1 MURDER-11 ..."; 57 MURDER-11 | brak zaproszenia, gdy rzucający GM stoi i jest połączony; linia do gracza |
| MURDER-12 | zrobione | 5609e25 | R8932 | linia trackera, gdy otwarcie czeka na wybór statystyki |
| MURDER-14 | zrobione | 5609e25 | R8932 | zdanie do zabójców na początku Stage 6, linia trackera; bez akcji mostu (P7) |
| INV-06 | zrobione | d699989 | R8931; 57 INV-06 | pyta ogłaszający (połączony pełny GM), inaczej główny; Autopsja zostaje na głównym |
| EXP-PL-05 | zrobione | 23edfcf | - (bez kodu) | handbooki gracza 10 i GM-a 13.4 |
| EXP-PL-06 | zrobione | 05dcce9 | R8925 | zdanie o powrocie w `yourMoves` i `moved` (wszystkie formy), handbook gracza 2 i 17.2 |
| EXP-PL-07 | zrobione | 658302a | "T1 EXP-PL-07 ..." x2 | odmowa GM-a, druga deklaracja i odrzucona zdrada przy świetle zwracają akcję (P2) |
| EXP-PL-10 | zrobione | 797b088 | R8929; 57 EXP-PL-10 | przepuszczony tylko wątek Widza do samych GM-ów, ta sama reguła na głównym; messenger-app.mjs bez zmian (sekcja 6) |

## 2. Dodane testy

Numery R (zakres linii R8920-R9019), po kolei:

- R8920 (tier 0) - MURDER-01: zasłona otwarcia tylko dla incydentu otwartego przy świetle (`veilWanted`).
- R8921 (tier 1) - D2-08/D2-10: zdanie ofiary nieudanego otwarcia bez imion, w obu językach.
- R8922 (tier 1) - MURDER-02/D2-06: koniec incydentu zdejmuje maskę tylko tam, gdzie ofiara zginęła (`maskEndsAtClose`).
- R8923 (tier 1) - EXP-PL-07: teksty odmowy mówią, że akcja wraca.
- R8924 (tier 1) - DAY-08: okno notatki Direct Murder.
- R8925 (tier 1) - EXP-PL-06: linie przejść w Eclipse.
- R8926 (tier 1) - D2-09: `rollPaysResources`, `incidentRollExempt`.
- R8927 (tier 1) - MURDER-03: `drawMaskName` tylko u GM-a.
- R8928 (tier 1) - MURDER-03: `deathVoiceGone` od chwili śmierci.
- R8929 (tier 1) - EXP-PL-10: `spectatorMessageAllowed`.
- R8930 (tier 1) - MURDER-05: `answersBodyPrompt`, `bodyPromptAnsweredElsewhere`.
- R8931 (tier 1) - INV-06/MURDER-08: `caseAskerId`, `askedHere`.
- R8932 (tier 1) - MURDER-12/14: `trackerWaitLines`, `tellKillersStageSix`.
- R8933 (tier 1) - MURDER-04/11: przycisk Rzuć za gracza, `openingThrowerStands`.
- R8934 (tier 1) - MURDER-06: `expectedParticipants`, `participantAway`.
- R8935 (tier 1) - MURDER-09: `incidentQuestionOpen` i drogi pytania.

Następny wolny numer po linii: R8936 (`node tools/check.mjs registry`).

Tier 2 (blok `// T1 murder-death-eclipse`): "T1 MURDER-01 ...", "T1 D2-12 ...", "T1 D2-08 ...", "T1 D2-06 ..." (2),
"T1 EXP-PL-02 ..." (2), "T1 DAY-04 ..." (2), "T1 DAY-03 ...", "T1 EXP-PL-07 ..." (2), "T1 D2-09 ..." (2),
"T1 MURDER-05 ...", "T1 EXP-GM-02 ...", "T1 MURDER-08 ...", "T1 MURDER-04 ...", "T1 MURDER-11 ...", "T1 MURDER-06 ...",
"T1 MURDER-09 ...", oraz czerwony na cel do E131 "T1 D2-28 - the lights wait for the opening's result before the clock
moves" (sekcja 6; przeczytany 28.11.2026: "1 red until a later stage").

Scenariusz `audit/harness/scenarios/57-murder-two-gms.mjs` (warstwa ci, wiersz w README): części MURDER-05, EXP-GM-02,
MURDER-08, INV-06, DAY-03, MURDER-04, MURDER-06, MURDER-11, MURDER-09, MURDER-03, EXP-PL-10, D2-09 - 13/13 checks
passed, 45 s (27.11.2026). `33-bridge-paths`: część T1-DAY-03 (asystent GM-a pyta `eclipse.judge` - ok; gracz -
odmowa, zalogowana i powiedziana).

Zmienione istniejące testy, z powodem:

- R7405 i pięć testów tier 2 z epoki E112 (`atLights: true` na otwarciu, którego zasłona dotyczy); test "a failed
  opening tells the victim only that somebody tried..." (wcześniej "... tells the victim nothing") - D2-08 każe ofiarę
  powiadomić; scenariusz 21 (otwarcie z `atLights: true`). Commit 94af3e9.
- "1.2.128 S0-MASKLEFT", scenariusz 97 Z1, scenariusz 13 (linia ofiary o próbie), R3510 (liczby wywołań) - D2-06 i
  D2-08. Commit f2523df.
- "1.2.121 the lights veil ..." (dwie deklaracje: obie powiedziane, żadna nie zasłonięta, bo zasłona po pytaniu), R346
  (wiersz spisu `SHEET eclipse.mjs#sweepLostDeclarations`), R160 (`eclipse.judge` w przepływie murder-incident),
  R3510 (eclipse.mjs +2), "T1 DAY-03" (kolejność sprzątania). Commit 658302a.
- R815, R832, R835 (zmarły z obsady w pokoju "dead" od śmierci, świadek na nikogo nie czeka, bez 1500 ms) i trzy
  testy tier 2: "1.2.122 CTRL-80 ...", "the dead channel opens when the body is found", "E72 C8 Silence now" -
  MURDER-03. Commity afd5bbe, aa544ea.
- R5740 (pełny GM, który nie jest głównym, odpowiada) - MURDER-05. Commity e223951, d1ad108.
- R3510 (body.mjs +1, murder-rules.mjs +2, murder-ui.mjs +1) i R2035 (`incidentTrackerHtml` dwa ostrzeżenia) - EXP-GM-02,
  MURDER-04/06/14. Commity e223951, 5609e25.
- R1360 (niszcząca stopka "End the murder" czytana w `askIncidentQuestion` zamiast `killerFell`) - MURDER-09. 9e93cfc.
- tests-grid.mjs: pola obsady `atLights`, `openingThrower`, `question` w FRESH i w liście zatajonych.

Mutanty (każdy cofnięty po przebiegu, 27.11.2026):

| Mutant | Co zmienia | Wynik |
| --- | --- | --- |
| D2-09 z pola pakietu | `incidentRollExempt` czyta samą flagę, bez autora-GM-a | KILLED - 57 D2-09 (forged 0, plain 1) |
| bramka Widza | `spectatorMessageAllowed` przepuszcza wszystko | KILLED - R8929 |
| `eclipse.judge` | `handleEclipseJudge` odpowiada pustym odczytem | KILLED - 57 DAY-03 |

Ostatni `npm test` (audit/harness, worktree na 7abfac3, 4 rdzenie): w toku (start 28.11.2026 01:49 UTC); wynik dopiszę tu po końcu przebiegu.

## 3. Zmienione sekcje handbooków

Handbook gracza (PL i EN):

- 1 (Widz) - Widz pisze do GM-ów w swoim wątku komunikatora (EXP-PL-10).
- 2 (Eclipse) i 17.2 - powrót do pokoju też jest przejściem (EXP-PL-06).
- 4 (akapit Direct Murder) - odrzucone zgłoszenie oddaje akcję (EXP-PL-07).
- 6 (wstęp) - rzut otwarcia i rzuty kryzysu nie zasilają puli i nie dają Hope (D2-09).
- 10 - rzut otwarcia bez Hope i Despair (D2-09); porażka otwarcia mówi ofierze o próbie bez imion (D2-08); "?" poza
  Eclipse od razu i GM widzi, kto to (MURDER-01, D2-12, MURDER-03); maska zostaje, gdy ofiara przeżyła (D2-06); kolejność
  przy świetle (EXP-PL-02); rany i plakietki są jawne (EXP-PL-05); sprzątanie kończy GM, napisz w komunikatorze (MURDER-14).
- 13 - głos po śmierci wychodzi z pokoju od razu (MURDER-03).
- 17.10, 17.13 - notatki techniczne do powyższych (MURDER-01, MURDER-03).

Handbook GM-a (PL i EN):

- 3 (kolumna Zrób) - zdanie o Wycisz teraz (MURDER-03).
- 7 (Zdobywanie) - rzut otwarcia i rzuty kryzysu nie płacą (D2-09).
- 9.5 (akapit "Pokój Widzów") - ofiara wychodzi z pokoju w chwili śmierci (MURDER-03).
- 12.3 - światła w dwóch krokach, wiersz przeżywa przeładowanie, odczyt przez głównego, zwrot akcji (EXP-PL-02, DAY-03,
  DAY-04, EXP-PL-07); 12.5 - przeciek z P1 opisany.
- 13.1 - otwarcie poza Eclipse niczego nie zasłania, "?" od razu (MURDER-01, D2-12); imię nad "?" tylko u GM-a (MURDER-03);
  rzut otwarcia bez Hope i Despair (D2-09); Rzuć za gracza, brak zaproszenia, gdy GM rzuca, linia o wyborze statystyki
  (MURDER-04, MURDER-11, MURDER-12); maska po incydencie (D2-06).
- 13.2 - rzut kryzysu bez Hope i Despair (D2-09).
- 13.3 - Stage 6 trwa do Zakończ morderstwo, zabójca wie (MURDER-14).
- 13.4 - rany jawne (EXP-PL-05); okno świadków u każdego GM-a (MURDER-05); odkrycie ogłasza każdy pełny GM, pytania po
  ogłoszeniu u ogłaszającego (MURDER-08, INV-06, MURDER-10); karta o samotnym znalazcy (EXP-GM-02).

Zdań poza sekcjami linii (sekcja 4 specyfikacji) nie zmieniałem. Fakty handbooków (`docs/handbook-facts.*.en.json`)
zmienione w tych samych commitach co akapity, `node tools/check.mjs text` zielony.

## 4. Nowe i zmienione klucze i18n (EN i PL)

Przestrzenie T1:

- DRPG.Murder: victimAttemptFailed, incidentRollFree, openingWaitsOnPick, trackerStageSixWaits, stageSixEndsByGm,
  throwForPlayer, throwForPlayerConfirm, openingThrownByGm, awayTitle, awayGm, awayTracker, awayHint.openingRoll,
  awayHint.incident, awayHint.resolution, questionAnswered (nowe).
- DRPG.Action: murderNoteCloseSends, murderSendNoNote (nowe, DAY-08); murderAskNote, murderRefused, murderParked,
  murderSpendsAnyway, murderSecondDeclaration, murderRefusedGm (nowe lub przepisane, EXP-PL-02/07).
- DRPG.Eclipse: declarationLost, declarationLostGm, declarationLostOpenGm (nowe, DAY-04); yourMoves, moved (zmienione,
  każda forma liczby, EXP-PL-06).
- DRPG.Body: answeredElsewhere, loneFinderTitle, loneFinderGm (nowe).
- DRPG.Spectator.noChat (zmieniony).
- Proza config.mjs: MURDER_OPENING killer.failure (zmieniona, EN w config.mjs, PL w lang; D2-08).

W cudzych przestrzeniach (dopisane na końcu):

- DRPG.Bridge.what["eclipse.judge"] (nowa akcja mostu, DAY-03).
- DRPG.Tips.Actions.murderSendNoNoteTooltip (podpowiedź przycisku DAY-08; `check tooltips` wymaga jej dla każdego
  przycisku).

## 5. Do notatek wydania

- Direct Murder poza Eclipse nie chowa już tokenu zabójcy ani nie wycisza go przed rzutem; przy Hope albo krytyku "?"
  pojawia się od razu (94af3e9; R8920, R8921, "T1 MURDER-01", "T1 D2-12").
- Ofiara nieudanego otwarcia dostaje jedno zdanie, że ktoś próbował ją zabić, bez imion (94af3e9; "T1 D2-08").
- Maska zabójcy zostaje po końcu incydentu, gdy ofiara przeżyła; schodzi przy wyjściu z pokoju i z nową porą dnia
  (f2523df; R8922, "T1 D2-06").
- Przy świetle moduł najpierw pyta GM-a i sprawdza pokój, a dopiero potem zasłania potwierdzonych zabójców i przesuwa
  zegar; odrzucona deklaracja nigdy nie jest zasłonięta (658302a; "T1 EXP-PL-02").
- Deklaracja z Zaćmienia przeżywa przeładowanie GM-a; zgubiona po skończonym Zaćmieniu wraca graczowi jako akcja, z
  linią (658302a; "T1 DAY-04").
- Światła drugiego GM-a czytają pokój przez głównego (658302a; "T1 DAY-03", 33 T1-DAY-03, 57 DAY-03).
- Odmowa GM-a, druga deklaracja i odrzucona zdrada przy świetle oddają akcję (658302a; "T1 EXP-PL-07").
- Okno notatki Direct Murder mówi, że zamknięcie wysyła zgłoszenie, i ma przycisk Wyślij bez notatki (a2d1d85; R8924).
- Linie przejść w Eclipse mówią, że powrót też jest przejściem (05dcce9; R8925).
- Rzut otwarcia i rzuty kryzysu nie dają Hope ani Despair; zwykłe rzuty postronnych bez zmian (cdbe1bb; R8926,
  "T1 D2-09", 57 D2-09).
- Zmarły widzi "?" bez imienia, a jego głos wychodzi z pokoju od chwili śmierci; Wycisz teraz zniknęło z trackera
  (afd5bbe; R8927, R8928, 57 MURDER-03).
- Widz może pisać do GM-ów w swoim wątku komunikatora (797b088; R8929, 57 EXP-PL-10).
- Okno "Uczniowie znaleźli ciało" pojawia się u każdego pełnego GM-a; pierwsza odpowiedź zamyka pozostałe (e223951;
  R8930, "T1 MURDER-05", 57 MURDER-05).
- Gdy uczeń sam znajdzie ciało, GM-owie dostają kartę z jego imieniem i pokojem (e223951; "T1 EXP-GM-02").
- Pytanie o Faint Prep i pytanie sprawy przy ciele otwierają się u GM-a, który ogłosił ciało (d699989; R8931,
  "T1 MURDER-08", 57 MURDER-08, INV-06).
- Tracker incydentu: Rzuć za gracza, linia, gdy otwarcie czeka na wybór statystyki, linia "Stage 6 trwa do Zakończ
  morderstwo", ostrzeżenie, gdy oczekiwany uczestnik wyszedł, i karta do GM-ów (5609e25; R8932-R8934, 57 MURDER-04,
  MURDER-06, MURDER-11).
- Pytanie o wyczerpaną ofiarę przy dwóch zabójcach i o poległych zabójców dostaje każdy pełny GM, pierwsza odpowiedź
  rozstrzyga (9e93cfc; R8935, "T1 MURDER-09", 57 MURDER-09).

## 6. Uwagi dla koordynatora

- Forge S4 `C2` (DAY-03): światła drugiego GM-a idą teraz przez głównego (`eclipse.judge`), więc kontrola, która
  czytała odczyt na przeglądarce kończącej, zmieni wynik. S4 to plik T4, nie ruszałem.
- Forge S1a: kontrola EXP-PL-02 czeka dalej jak dotąd; kod pyta teraz przed zegarem (pytanie GM-a przed świtem), więc
  jeśli kontrola czeka na świt przed pytaniem, jej odczyt się przesunie. Nie zmierzone (brak Forge w tej sesji).
- Pliki zmienione poza listami pozycji (konieczne do pozycji): `action-pipeline.mjs` (własny rzut GM-a w incydencie,
  D2-09), `bridge-asks.mjs` (`requestEclipseJudge`, `receipt` deklaracji GM-a), `tests-flows.mjs` (przepływ
  murder-incident), `tests-tier0.mjs` (R346, R3510, R2035 - istniejące tabele, nie blok T1), `tests-grid.mjs`,
  `bridge-wire.mjs` i `bridge-table.mjs` (akcja `eclipse.judge`; bridge-table.mjs ma 1749 linii przy granicy 1750).
- `messenger-app.mjs`: nie ma w nim bramki Widza (Widz nie dostaje innych wątków niż własny), więc nie było czego
  zawężać - plik bez zmian.
- Okno Uczniowie (gm-students.mjs, poza listą T1) nadal może rysować Wycisz teraz przy zmarłym; po MURDER-03 nie ma
  czego wyciszać. Do decyzji linii, która ma ten plik.
- Scenariusze 97 (Z1), 13 i 21 przystosowane w commitach C1-C2 (części, nie nowe części) - specyfikacja zabraniała
  tylko dopisywania części do 97, 33 (poza wierszami akcji), 61, 62.
- Zwrot akcji gracza (EXP-PL-07, DAY-04) liczony z kwitu, który zna tylko GM (`receipt` własnej deklaracji GM-a); pakiet
  gracza kwitu nie niesie, więc zwrot gracza to zawsze jedna akcja - jak przy deklaracji.
- Harness: przy ponownym połączeniu gracza pierwsze `advancement.ask` z jego ready dochodzi do głównego, zanim ten liczy
  gracza jako połączonego, i jest odrzucane ("unknown sender"); ponowne zaproszenie otwarcia (`reaskOwedOpening`)
  odpala wtedy dopiero przy następnym pytaniu strony. Scenariusz 57 MURDER-11 pyta jeszcze raz. Czy tak jest na v14 -
  nie wiem (warto sprawdzić przy stole, MURDER-11).
- Historia gałęzi: R5740 był czerwony od e223951 do d1ad108 (linia oczekiwania zgubiona przy rozdzielaniu zmian).
  QUICK każdego commitu był zielony; tiers 0-2 czytałem na drzewie roboczym, nie na każdym commicie.
  R4751 (liczy klucze DRPG.Tips.Actions) był czerwony od a2d1d85 (DAY-08 dodał 36. klucz) do 7abfac3; znalazł go
  dopiero pełny `npm test` na d35e338 (A1-A3 01-runtests: 2068 passed, 1 failed, 16 skipped), bo jedyny wcześniejszy
  pełny przebieg tier 0-1 (27.11.2026, ok. 22:50) szedł na drzewie sprzed klucza - klucz dopisałem przy commicie, gdy
  `check tooltips` zażądał podpowiedzi dla nowego przycisku - a późniejsze szły z `--only`. Ten przebieg przerwałem po etapie suite i puściłem pełny od nowa na 7abfac3.
- Spodziewane konflikty przy scalaniu: `lang/*.json` (DRPG.Bridge.what, DRPG.Tips.Actions - dopisane na końcu),
  handbook GM-a 13.4 i 9.5 (linie T3/T4), `scripts/tests-tier0.mjs` (R3510 - każda linia zmieniająca liczby wywołań
  kart), `docs/dev/R-REGISTRY.md` (generowany: po scaleniu `node tools/registry.mjs --write`), `audit/harness/README.md`
  (wiersz 57).

- D2-28 (odpowiedź właściciela na P1, przekazana przez koordynatora 27.11.2026 i zapisana w `docs/dev/v2/DECISIONS.md`
  na `claude/dazzling-bohr-juuh4g`; drugi list koordynatora 28.11.2026: wdrożyć w tej linii). Stan: **częściowo** -
  w gałęzi jest tylko test red-first, oznaczony jako czerwony na cel do E131: tier 2 "T1 D2-28 - the lights wait for the
  opening's result before the clock moves" (`expectedRed("E131", ...)`; czerwony na d35e338 z właściwego powodu:
  zaproszenie otwarcia szło po tym, jak zegar zdjął Eclipse). Kod napisałem i sprawdziłem, ale go nie zatwierdziłem:
  - co działało: kolejność świateł (zasłona potwierdzonych, otwarcie w trwającym Eclipse, czekanie na wynik otwarcia,
    dopiero potem zegar, potem reszta wierszy), wyjątek `atLights` w `openMurder` i w `openBetrayal`, Nocne Zaćmienie
    jako noc w `atNight` (czyta je też roll-draw.mjs), linia do GM-ów z `gmPopup` (Rzuć za gracza, Zakończ morderstwo),
    handbooki GM-a 12.3, 12.5 (bez akapitu o przecieku), 13.1 i gracza 10. Test D2-28 i "T1 EXP-PL-02", "T1 DAY-04",
    "T1 EXP-PL-07", "1.2.121 the lights veil", "E112 - the opening veils", "1.2.122 STG-31" przechodziły.
  - co zatrzymało: w tier 2 strony graczy siedzą cicho (`__dialogAuto` false, komentarz w audit/harness/lib/shim.mjs:
    "the suite runs on the GM alone; a player auto-answering an opening roll would race it"), więc każde otwarcie przy
    świetle czeka na rzut, który nigdy nie pada. Z 11 testów tier 2 kończących Zaćmienie z dozwoloną deklaracją, które
    przepuściłem pojedynczo, pierwsze trzy zawisły ("a second declaration in the same Eclipse and a betrayal ...",
    "a second killer in the same Eclipse is told only ...", "a killer allowed in the dark who stands alone ..."); reszty
    nie zmierzyłem. Każdy taki test trzeba przepisać tak, by rozstrzygał otwarcie (jak zrobiłem w `lightsOnOne`: rzut
    poniżej 8 na GM-ie chwilę po zaproszeniu) i sprawdzić, czy jego odczyt dalej mierzy to samo - to robota dla każdego
    testu osobno, a pełne `npm test` trwa tu ponad godzinę. Bez tego zatwierdzony kod zawiesiłby suite w CI.
  - decyzja do podjęcia (pytanie P12 niżej): czy testy mają rozstrzygać otwarcie same, czy harness ma dostać stronę
    gracza, która rzuca na zaproszenie w tier 2. Szkic kodu jest opisany wyżej punkt po punkcie; nie jest w gałęzi.

## 7. Pytania do właściciela

| # | Pytanie | Domyślne linii |
| --- | --- | --- |
| P1 | EXP-PL-02: po potwierdzonym morderstwie przy świetle rzut otwarcia odbywa się już za dnia pod zasłoną; gdy się nie uda, token zabójcy wraca w pokoju ofiary, a ofiara dostaje powiadomienie z D2-08 - mapa mówi, kto próbował, wbrew D2-10. Czy rzut otwarcia też ma zapaść przed świtem (światła czekają na rzut), czy zostaje, jak jest? | linia pracowała na "zostaje, jak jest"; odpowiedź D2-28: przed świtem, światła czekają - niewdrożone (sekcja 6) |
| P2 | EXP-PL-07: czy zwrot akcji obejmuje też drugą deklarację i odrzuconą zdradę (ten sam tekst co odmowa, D6)? | tak (potwierdzone, D2-28 wiadomość koordynatora: P2-P7 potwierdzone) |
| P3 | DAY-04: zgłoszenie, które przepadło przez awarię przeglądarki GM-a - czy akcja wraca? | tak, z komunikatem |
| P4 | MURDER-03: czy także konto Widza i Monocub przestają widzieć imię nad "?"? | tak, imię widzą tylko GM-owie |
| P5 | D2-06: zabójca martwy, ofiara żywa - maska na ciele zabójcy zostaje do końca pory dnia? Cichy pokój głosu zabójcy też zostaje? | tak i tak (reguła maski bez zmian) |
| P6 | D2-08: treść i chwila powiadomienia ofiary | od razu; jedno zdanie bez imion |
| P7 | MURDER-14: podpowiedź "napisz do GM-a w komunikatorze" czy przycisk "Skończyłem sprzątać"? | podpowiedź, bez nowej akcji mostu |
| P8 | MURDER-04: Rzuć za gracza zamyka okno rzutu gracza, nawet gdy ten właśnie rzuca - czy GM ma pierwszeństwo? | tak: rzut GM-a się liczy, gracz dostaje linię |
| P9 | MURDER-06: karta o wyjściu uczestnika przychodzi też, gdy to tura ofiary w walce (podpowiedź: Oddaj turę). Czy tak, czy tylko przy otwarciu i Stage 6? | każdy etap, z podpowiedzią etapu |
| P10 | MURDER-09: Anuluj na pytaniu o wyczerpaną ofiarę - pytanie wraca przy następnej akcji kryzysu (jak dotąd). Zostaje? | zostaje |
| P11 | MURDER-03: przycisk Wycisz teraz w oknie Uczniowie (poza T1) - usunąć jak w trackerze? | zostawione bez zmian; decyzja linii tego okna |
| P12 | D2-28: w tier 2 gracze nie rzucają na zaproszenie, więc światła czekające na rzut zawieszają każdy test z otwarciem przy świetle. Testy mają same rozstrzygać otwarcie, czy harness ma rzucać za gracza w tier 2? | testy rozstrzygają same (bez zmiany harnessu); niewdrożone w tej linii |
