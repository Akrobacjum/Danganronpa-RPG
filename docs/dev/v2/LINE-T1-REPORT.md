# Linia T1 - raport (murder, death, eclipse)

Gałąź `claude/v2-t1` z `claude/dazzling-bohr-juuh4g`, 27.11.2026. Specyfikacja: `docs/dev/v2/LINE-T1.md`. Etap w
`tools/stages.json`: `E131` (planowany 1.2.130, z E83, `touches: sockets, rolls, scenes`). Bez pull requesta, bez
wydania, bez `module.json`, bez `tools/stages.mjs ship`, bez CHANGELOG.md, bez plików waiver.

Jak pracowałem: testy pisane przed kodem i czytane jako czerwone na kodzie bazy (`redcheck`: testy z drzewa, kod
z podanego sha), potem kod, potem zielone na drzewie roboczym. Każdy commit przeszedł przed zapisem QUICK (lint,
check - 26 części, gate) i prose na swoim własnym stanie w osobnym worktree, z `node tools/registry.mjs --write`
zrobionym tam (pomocnik `commit.sh`). Tiers 0-2 czytane na drzewie roboczym (szeroki przebieg i przebiegi celowane)
i raz całe na końcu w kształcie CI (lint, check, gate, osiem shardów suite, scenariusze; sekcje 2 i 6). Kilka commitów rozdzielałem po kawałkach diffu z jednego drzewa roboczego;
raz to zgubiło linię (R5740, sekcja 6) - poprawka w osobnym commicie.

## 1. Stan każdej pozycji

| ID | stan | commit | testy (R i nazwy tier 2, części 57) | uwagi |
| --- | --- | --- | --- | --- |
| MURDER-01+D2-12 | zrobione | 94af3e9 | R8920; "T1 MURDER-01 ...", "T1 D2-12 ..." | pole obsady `atLights`; zasłona tylko dla otwarcia przy świetle; poza Eclipse Hope/krytyk daje "?" od razu. Forge S1a MURDER-01, D2-12: bez zmian - już mierzą zachowanie 2.0 |
| MURDER-02+D2-06 | zrobione | f2523df | R8922; "T1 D2-06 ..." x2 | maska zostaje po końcu incydentu, gdy ofiara przeżyła; schodzi przy wyjściu z pokoju i z porą dnia. Forge S1a D2-06/MURDER-02: bez zmian - już mierzy 2.0 |
| MURDER-03 | zrobione | afd5bbe, aa544ea, 2bc9bd9 (scenariusz 75) | R8927, R8928; 57 MURDER-03 | imię nad "?" tylko u GM-a; głos zmarłego z obsady wychodzi z pokoju od chwili śmierci; Wycisz teraz w trackerze nie jest rysowane. Głosu S1a nie mierzy; 57 MURDER-03 mierzy imię (p2 i gm2), nie pokój głosu p3 (sekcja 6) |
| MURDER-04 | zrobione | 5609e25 | R8933; "T1 MURDER-04 ..."; 57 MURDER-04 | Rzuć za gracza w trackerze; pole obsady `openingThrower`; bez nowej akcji mostu (zapis stanu z drugiego GM-a wystarcza). Forge: brak kontroli |
| MURDER-05 | zrobione | e223951, d1ad108, 83131bd (scenariusz 10) | R8930, R5740 (przystosowany); "T1 MURDER-05 ..."; 57 MURDER-05 | okno u każdego pełnego GM-a, pierwsza odpowiedź zapisana w wierszu zamyka pozostałe. Forge S1b MURDER-05: nie ruszana (S1b nie jest plikiem T1) |
| EXP-PL-02 | zrobione | 658302a, 83131bd, fe6681c | R8923; "T1 EXP-PL-02 ..." x2; 33 T1-DAY-03 | światła: pokój, druga deklaracja, zdrada, odpowiedź GM-a, potem zasłona tylko potwierdzonych; od 83131bd (D2-28) otwarcia i czekanie na ich wynik przed zegarem, potem zegar, potem reszta wierszy. Forge S1a: czekanie kontroli EXP-PL-02 bez zmian (sekcja 6) |
| D2-28 (dodatkowa) | zrobione | 7abfac3 (test czerwony), 83131bd, fe6681c (dwa testy) | "T1 D2-28 - the lights wait ...", "T1 D2-28 - an opening rolled at the Night Eclipse's lights ..." | odpowiedź właściciela na P1: rzut otwarcia przed porą dnia, światła czekają; linia do GM-ów, gdy nikt nie rzuca; Nocne Zaćmienie dalej jak w nocy. Sekcja 6 |
| EXP-GM-02 | zrobione | e223951 | "T1 EXP-GM-02 ..."; 57 EXP-GM-02 | karta GM-ów z `gmPopup`, raz na znalazcę i ciało. Forge S1b: nie ruszana |
| EXP-PL-03+EXP-GM-15+D2-09+D2-11 | zrobione | cdbe1bb, 83131bd (scenariusz 72; P13) | R8926; "T1 D2-09 ..." x2; 57 D2-09 | zwolnienie czytane na GM-ie (klucz rysowania, incydent, obsada), stempel tylko na wiadomości GM-a; Reroll też nic. Forge S1a D2-09/D2-11: bez zmian - już mierzy brak Hope/Despair |
| D2-08+D2-10 | zrobione | 94af3e9, d35e338 | tier 2 "T1 D2-08 ..."; R8921 (tekst bez imion) | jedno zdanie do ofiary, bez imion. Forge S1a D2-08/D2-10: zawężona do wpisu z DRPG.Murder.victimAttemptFailed (d35e338) |
| DAY-03 | zrobione | 658302a | "T1 DAY-03 ..."; 33 T1-DAY-03; 57 DAY-03 | światła drugiego GM-a czytają pokój przez głównego, akcja mostu `eclipse.judge`. Forge S4 C2 się zmieni (sekcja 6) |
| DAY-04 | zrobione | 658302a | "T1 DAY-04 ..." x2 | wiersz deklaracji przeżywa przeładowanie; zgubiony po zakończonym Zaćmieniu zdejmowany przy ready głównego z linią i zwrotem akcji (P3) |
| DAY-08 | zrobione | a2d1d85, 7abfac3 (R4751) | R8924, R4751 (przystosowany: 36 kluczy DRPG.Tips.Actions) | linia i przycisk Wyślij bez notatki w oknie Direct Murder |
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
| EXP-PL-07 | zrobione | 658302a, 83131bd (zdrada przy Etapie 6, oferta) | "T1 EXP-PL-07 ..." x2 | odmowa GM-a, druga deklaracja i odrzucona zdrada przy świetle zwracają akcję (P2) |
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
"T1 MURDER-09 ...", "T1 D2-28 - the lights wait for the opening's result before the clock moves" (zatwierdzony w 7abfac3
jako `expectedRed("E131")`, czerwony na d35e338 z właściwego powodu: zaproszenie szło po zdjęciu Eclipse; zielony od
83131bd), "T1 D2-28 - an opening rolled at the Night Eclipse's lights reads Night ..." (83131bd).

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
- D2-28 (83131bd): światła czekają na wynik otwarcia, a w tier 2 gracze nie rzucają, więc każdy test kończący Zaćmienie
  z otwarciem rozstrzyga je sam. Helper `throwingOpenings` (tier 2) patrzy na incydent, nie na zaproszenie (otwarcie
  może czekać na zaproszenie, pytanie GM-a o statystykę albo rzut GM-a za nieobecnego), i ląduje rzut jak gracz:
  "a second declaration in the same Eclipse and a betrayal", "a second killer in the same Eclipse", "a killer allowed in
  the dark who stands alone" (rzut 20, żeby incydent stał przy następnych wierszach, jak stał przed D2-28),
  "A113-C2-6", "a betrayal declared in the Eclipse after Night", "a betrayal declared in the dark moves no stamp"
  (20), "a betrayal declared in an Eclipse costs an action" (24 z Hope, jak dotąd po zegarze); w fe6681c jeszcze
  "a declaration made in the dark lives only on the GMs ..." i "an approved opening opens on its statistic ... (E68 C9)"
  (20) - parkują przez `parkDirectMurder`, więc mój skaner z 83131bd ich nie złapał, a drugi zawisł w shardzie 2/8. "1.2.121 STG-01"
  czyta kość straży w trakcie czekania, potem nieudany rzut. `lightsOnOne` (testy T1) ląduje rzut poniżej 8. "refused at
  the lights, the offer comes back": incydent z haka otwierany z `atLights` (w Zaćmieniu przepuszczany tylko taki).
  grid XI02 i XI07: krok `eclipse` puszcza koniec świateł dalej, gdy incydent stoi przy otwarciu, a krok `close` (albo
  sprzątanie przypadku) czeka na koniec świateł. R3510 (eclipse.mjs line 6). Scenariusze 10 F3 (okno ciała u gm2 też,
  MURDER-05), 61 F3 (pola `atLights`, `openingThrower`, `question` zatajone jak `openingTrait`), 72 (czwarta flaga
  `incidentFree`, D2-09; P13) - te trzy to skutki wcześniejszych pozycji, nie D2-28: wcześniej nie puściłem tych
  scenariuszy (sekcja 6).

Mutanty (każdy cofnięty po przebiegu, 27.11.2026):

| Mutant | Co zmienia | Wynik |
| --- | --- | --- |
| D2-09 z pola pakietu | `incidentRollExempt` czyta samą flagę, bez autora-GM-a | KILLED - 57 D2-09 (forged 0, plain 1) |
| bramka Widza | `spectatorMessageAllowed` przepuszcza wszystko | KILLED - R8929 |
| `eclipse.judge` | `handleEclipseJudge` odpowiada pustym odczytem | KILLED - 57 DAY-03 |
| D2-28 bez czekania (28.11.2026) | `awaitOpening` wraca od razu | KILLED - "T1 D2-28 - the lights wait" (atResult) |
| pora świateł zawsze następna | `holdLightsTimeOfDay(incomingTimeOfDay(...))` także przy Zakończ bez przesuwania | KILLED - "T1 D2-28 - the lights wait" (held) |
| `atNight` bez pory świateł | czyta tylko `incomingTimeOfDay` | KILLED - "T1 D2-28 - an opening rolled at the Night Eclipse's lights" |
| Etap 6 liczy się dla zdrady | `confirmed > 0` (stan z 658302a) | KILLED - "a betrayal declared in an Eclipse costs an action" |
| oferta nie wraca | bez `refuseParkedBetrayal` | KILLED - "a second declaration in the same Eclipse and a betrayal" |

Ostatni pomiar całości (audit/harness, 4 rdzenie, 28.11.2026), w kształcie CI, bo `npm test` w jednym kawałku nie mieści
się tu w limicie etapu suite (sekcja 6):

| Część | sha | Wynik |
| --- | --- | --- |
| suite, 8 shardów (`DRPG_SUITE_SHARD=i/8 node run-all.mjs suite`), `node suite-merge.mjs` | fe6681c | **3973 passed, 0 failed, 27 skipped, 0 red**: green; 1875 testów tier 2 na liście; shard 1 (tiers 0-1, części A i B) 2074 passed, 0 failed, 16 skipped, 2518 s; shardy 2-8 po 752-932 s |
| lint, check (26 części), gate (62/62) | 2bc9bd9 | green, 102 s |
| scenariusze (`node run-all.mjs scenarios`) | 2bc9bd9 | 54/54 green, 4645 s |

2bc9bd9 różni się od fe6681c tylko scenariuszem 75 (`git diff fe6681c 2bc9bd9 --stat`: jeden plik), więc suite z fe6681c
dotyczy tego samego kodu modułu i tych samych testów. Wcześniej na 83131bd: shard 4/8 czerwony przez E40-T5 (sekcja
6, na fe6681c zielony), shard 2/8 zawieszony na teście E68 C9 (poprawka w fe6681c), scenariusze 51/54 (75 poprawiony
w 2bc9bd9; 72 i 73 sekcja 6).

## 3. Zmienione sekcje handbooków

Handbook gracza (PL i EN):

- 1 (Widz) - Widz pisze do GM-ów w swoim wątku komunikatora (EXP-PL-10).
- 2 (Eclipse) i 17.2 - powrót do pokoju też jest przejściem (EXP-PL-06).
- 4 (akapit Direct Murder) - odrzucone zgłoszenie oddaje akcję (EXP-PL-07).
- 6 (wstęp) - rzut otwarcia i rzuty kryzysu nie zasilają puli i nie dają Hope (D2-09).
- 10 - rzut otwarcia bez Hope i Despair (D2-09); porażka otwarcia mówi ofierze o próbie bez imion (D2-08); "?" poza
  Eclipse od razu i GM widzi, kto to (MURDER-01, D2-12, MURDER-03); maska zostaje, gdy ofiara przeżyła (D2-06); kolejność
  przy świetle (EXP-PL-02), z rzutem otwarcia przed powrotem świateł (D2-28); rany i plakietki są jawne (EXP-PL-05);
  sprzątanie kończy GM, napisz w komunikatorze (MURDER-14).
- 13 - głos po śmierci wychodzi z pokoju od razu (MURDER-03).
- 17.10, 17.13 - notatki techniczne do powyższych (MURDER-01, MURDER-03).

Handbook GM-a (PL i EN):

- 3 (kolumna Zrób) - zdanie o Wycisz teraz (MURDER-03).
- 7 (Zdobywanie) - rzut otwarcia i rzuty kryzysu nie płacą (D2-09).
- 9.5 (akapit "Pokój Widzów") - ofiara wychodzi z pokoju w chwili śmierci (MURDER-03).
- 12.3 - światła w dwóch krokach, wiersz przeżywa przeładowanie, odczyt przez głównego, zwrot akcji (EXP-PL-02, DAY-03,
  DAY-04, EXP-PL-07); od 83131bd: otwarcia w trwającym Eclipse, światła czekają na wynik, linia do GM-ów i co wtedy
  zrobić (D2-28); 12.5 - akapit o przecieku z P1 zastąpiony zdaniem, że nieudane otwarcie kończy się przed świtem (D2-28).
- 13.1 - otwarcie poza Eclipse niczego nie zasłania, "?" od razu (MURDER-01, D2-12); imię nad "?" tylko u GM-a (MURDER-03);
  rzut otwarcia bez Hope i Despair (D2-09); Rzuć za gracza, brak zaproszenia, gdy GM rzuca, linia o wyborze statystyki
  (MURDER-04, MURDER-11, MURDER-12); maska po incydencie (D2-06); otwarcie zgłoszone w Eclipse rzuca się przed
  światłem, zegar czeka, w Nocnym Zaćmieniu jak w nocy (D2-28).
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
- DRPG.Eclipse: declarationLost, declarationLostGm, declarationLostOpenGm (nowe, DAY-04); lightsWaitOpening (nowy,
  D2-28); yourMoves, moved (zmienione, każda forma liczby, EXP-PL-06).
- DRPG.Murder.betrayalWhy.second (nowy: zdrada odrzucona przy świetle jako druga deklaracja, 83131bd).
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
- Rzut otwarcia morderstwa zgłoszonego w Eclipse zapada, zanim wrócą światła: zegar czeka na wynik, więc nieudana
  próba kończy się, gdy Eclipse wciąż chowa tokeny; GM-owie dostają linię, że światła czekają (Rzuć za gracza albo
  Zakończ morderstwo); morderstwo z Nocnego Zaćmienia dalej rzuca jak w nocy (83131bd; "T1 D2-28" x2).
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
  `bridge-wire.mjs` i `bridge-table.mjs` (akcja `eclipse.judge`; bridge-table.mjs ma 1749 linii przy granicy 1750);
  dla D2-28: `settings.mjs` (`lightsTimeOfDay`, `holdLightsTimeOfDay` obok `incomingTimeOfDay`), `murder.mjs` (fasada:
  eksport `refuseParkedBetrayal`), scenariusze 10, 61, 72 i 75 (istniejące kontrole, bez nowych części).
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
  (wiersz 57), `scripts/tests-tier2.mjs` (testy kończące Zaćmienie, które inne linie mogą dopisać: od D2-28 każdy z
  otwarciem przy świetle musi je rozstrzygnąć, np. `throwingOpenings`, inaczej zawiśnie).

- D2-28 (odpowiedź właściciela na P1, przekazana przez koordynatora 27.11.2026 i zapisana w `docs/dev/v2/DECISIONS.md`
  na `claude/dazzling-bohr-juuh4g`; listy koordynatora 28.11.2026: wdrożyć w tej linii). Stan: **zrobione** w 83131bd,
  test red-first w 7abfac3. Co jest:
  - eclipse.mjs `judgePendingMurders`: pierwszy krok jak dotąd (pokój, zdrada, druga deklaracja, odpowiedź GM-a), zasłona
    potwierdzonych, potem otwarcia (morderstwo, zdrada) w trwającym Eclipse, każde czekane do wyniku (`awaitOpening`:
    rzut wylądował, incydent zamknięty albo zastąpiony; sprawdzane 4 razy na sekundę), potem zegar, potem reszta wierszy.
    Gdy otwarcie czeka, GM-owie dostają linię z `gmPopup` (`DRPG.Eclipse.lightsWaitOpening`: Rzuć za gracza w trackerze
    albo Zakończ morderstwo). Otwarcie sprzed przeładowania GM-a (incydent tego zabójcy z `atLights`) nie otwiera się
    drugi raz, tylko jest czekane.
  - murder-rules.mjs: `openMurder` i `openBetrayal` przepuszczają w Eclipse tylko otwarcie świateł (`atLights`).
    `atNight` w Eclipse czyta porę, do której idą światła (settings.mjs `lightsTimeOfDay`, ustawiana przez `endEclipseNow`
    na czas osądu: następna pora albo ta sama przy Zakończ bez przesuwania; po przeładowaniu w trakcie czekania - pora,
    do której Eclipse prowadzi). Dzięki temu morderstwo z Nocnego Zaćmienia rzuca z przewagą nocy, jak wtedy, gdy zegar
    szedł pierwszy. roll-draw.mjs `situationReading` czyta to samo `atNight`, więc bez zmian w roll-draw.mjs.
  - Nie zmierzone: przeładowanie GM-a w trakcie czekania i ponowne Zakończ Eclipse (kod to obsługuje, test tego nie
    przechodzi); stół z prawdziwym graczem, który rzuca po kilku minutach.
- Przy D2-28 wyszły trzy błędy z wcześniejszych commitów tej linii, poprawione w 83131bd:
  - 658302a (EXP-PL-02) liczył incydent na Etapie 6 jako już otwarty, więc zdrada przy świetle dostawała werdykt "druga
    deklaracja" i nie zamykała Etapu 6. Testy "a betrayal declared in an Eclipse costs an action ..." i "a second
    declaration in the same Eclipse and a betrayal ..." były przez to czerwone od 658302a, a ja ich nie puściłem
    (szerokie przebiegi tier 2 szły z `--only`). Teraz Etap 6 nie liczy się dla zdrady, jak przed linią, a zdrada
    odrzucona jako druga deklaracja oddaje ofertę (`refuseParkedBetrayal`, `DRPG.Murder.betrayalWhy.second`).
  - Scenariusze 10 (F3), 61 (F3), 72 i 75 (E) nie były puszczone po MURDER-05, MURDER-01/04/09, D2-09 i MURDER-03;
    ich kontrole oczekiwały zachowania sprzed linii. Przystosowane, każda z powodem w komentarzu (sekcja 2; 75 w
    2bc9bd9 - znalazł go dopiero pełny przebieg scenariuszy na 83131bd).
- D2-09 a konsola postronnego (pytanie P13): wiadomość GM-a z rzutem kryzysu albo otwarcia ma flagę `incidentFree`, a jej
  rzut ma Daggerheartowe `options.skips.resources: true` (zmierzone na p1 w scenariuszu 72, 28.11.2026). Oba mówią
  postronnemu z konsoli, że to był rzut incydentu, choć treści nie czyta (`readable: false`) i imion w niej nie ma.
  Flaga nie dodaje nowej informacji ponad `skips`; usunięcie obu wymaga innej drogi niż `skips` dla zwolnienia z Hope.
  Zostawione, zapisane jako pytanie.
- `npm test` bez podziału na shardy nie mieści się tu w swoim limicie: etap suite (01-runtests) ma 108 min (6480 s), a na
  7abfac3 został ubity po 6480 s, przy ok. 100 tys. z 119 tys. linii tier 2 (log pisany do końca, więc nie zawisł), gdy
  równolegle chodziły moje sondy tier 2. Run-all puścił potem scenariusze w tym samym worktree, a ja ten katalog usunąłem
  w trakcie, więc 38 z 54 scenariuszy skończyło się "no results file" - ten przebieg jest nieważny. Końcowy pomiar
  (sekcja 2) zrobiłem jak CI: lint, check, gate, osiem shardów suite połączonych przez `suite-merge.mjs`, scenariusze.
- Niestabilne poza linią (nie ruszałem, dla koordynatora):
  - tier 2 "an ask whose card is gone ends nothing when its time runs out (E40-T5)" liczy każdy zapis magazynu GM-ów w
    swoim ok. 3-sekundowym oknie, a główny GM pisze `clockBeat` co 60 s (hud-elapsed.mjs `beatClock`, `CLOCK_BEAT_MS`):
    na 83131bd w shardzie 4/8 złapał `clockBeat.patch` i był czerwony. Nie mój plik ani moja zmiana.
  - scenariusze 72 (12 czerwonych, pierwsza "Aiko and Daichi find Botan in Dorm B ...") i 73 (H2: u p1 karta Zaćmienia w
    grupie pory dnia) były czerwone w pełnym przebiegu na 83131bd, a osobno na tym samym kodzie zielone: 72 163/166 (3
    oczekiwane), 73 39/39. Obok pełnego przebiegu chodziły moje inne procesy (quick przy commitach), więc podejrzewam
    obciążenie i kolejność pakietów; przyczyny nie zmierzyłem.

## 7. Pytania do właściciela

| # | Pytanie | Domyślne linii |
| --- | --- | --- |
| P1 | EXP-PL-02: po potwierdzonym morderstwie przy świetle rzut otwarcia odbywa się już za dnia pod zasłoną; gdy się nie uda, token zabójcy wraca w pokoju ofiary, a ofiara dostaje powiadomienie z D2-08 - mapa mówi, kto próbował, wbrew D2-10. Czy rzut otwarcia też ma zapaść przed świtem (światła czekają na rzut), czy zostaje, jak jest? | linia pracowała na "zostaje, jak jest"; odpowiedź D2-28: przed świtem, światła czekają - wdrożone w 83131bd (sekcja 6) |
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
| P12 | D2-28: w tier 2 gracze nie rzucają na zaproszenie, więc światła czekające na rzut zawieszają każdy test z otwarciem przy świetle. Testy mają same rozstrzygać otwarcie, czy harness ma rzucać za gracza w tier 2? | testy rozstrzygają same (`throwingOpenings`, grid `run.lights`), harness bez zmian - zrobione w 83131bd |
| P13 | D2-09: postronny z konsoli widzi, że rzut GM-a był rzutem incydentu (flaga `incidentFree` i `options.skips.resources` w rzucie; treści i imion nie widzi). Czy to dopuszczalne, czy zwolnienie z Hope i Despair ma iść drogą, której nie ma w dokumencie wiadomości? | zostaje, jak jest (scenariusz 72 oczekuje czwartej flagi) |
