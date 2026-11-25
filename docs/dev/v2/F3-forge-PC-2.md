# F3 na Forge - punkty 2-3 z komputera właściciela (25.11.2026)

Zlecenie: `docs/dev/v2/PROMPT-PC.md` (D2-21). Wykonał czat Claude Code uruchomiony przez właściciela na jego komputerze.
Raporty i zrzuty: `audit/forge/out/` (poza repozytorium). Każda liczba niżej pochodzi z tamtejszych `report.json`.

## Gdzie i na czym

To był komputer właściciela, nie chmura: Windows 11 Home, host HONORATKA, karty graficzne NVIDIA GeForce RTX 4080 SUPER
i AMD Radeon (zintegrowana), prawdziwa sieć (LiveKit Forge łączył się na każdej przeglądarce).

| Co | Wartość |
| --- | --- |
| Node.js / git | 22.22.0 / 2.52.0 |
| Repozytorium | świeży klon w `C:\Users\chrob\Desktop\drpg-tests`, gałąź `claude/dazzling-bohr-juuh4g` od e04ecc63 (folder "Danganronpa RPG" właściciela nietknięty) |
| Playwright (z `audit/harness`, `npm ci`) | 1.56.1; przeglądarki do `%LOCALAPPDATA%\ms-playwright` (`npx playwright install chromium firefox`) |
| Chromium we wszystkich przebiegach poza pierwszym S0 | Chrome for Testing 151.0.7922.34 (`chromium-1234`, był już na dysku), przez `DRPG_CHROMIUM` - niżej dlaczego |
| Firefox | 142.0.1 (build 1495), bez okna |
| Gra | Foundry 14.370, Daggerheart 2.12.8, danganronpa-rpg 1.2.129; avclient-livekit 0.6.8, dice-so-nice 6.4.5, forge-vtt 1.14.10, isometric-perspective 14.0.6 |
| Świat | `drpg-qa-forge-2` ("DRPG-QA-FORGE-2"), kopia `drpg-qa-forge` zrobiona przez właściciela jako kopia zapasowa; oryginał nie był uruchomiony ani zmieniany |
| Zmienne | `DRPG_FULL_RENDER=1` w każdym przebiegu, `DRPG_FORGE_WORLD=drpg-qa-forge-2`, adres tylko w `DRPG_FORGE_URL` |

Dwie decyzje po drodze:

- **Świat.** `doctor.mjs` odmówił pracy: aktywny był `drpg-qa-forge-2`, nie `DRPG-QA-Forge`. Właściciel: to kopia, o którą
  prosiłem, wybierz jeden z dwóch. Testowałem na uruchomionej kopii, więc `drpg-qa-forge` zostaje stanem wyjściowym do
  końcowego sprawdzenia (D2-15).
- **Chromium 151 zamiast 141.** Pierwszy S0 na Chromium Playwrighta 1.56.1 (141.0.7390.37) pokazał na każdym koncie
  czerwone powiadomienie Foundry: "Foundry Virtual Tabletop uses modern JavaScript features which are unsupported on
  Chromium version less than 146". Wszystko dalej szło na Chrome for Testing 151 przez `DRPG_CHROMIUM` (zmienna z README).

## Wyniki

### S0 - `doctor.mjs`

| Przebieg | Zalogowane | Kontrakt ok / niezgodne / nieodczytane | Błędy modułu | Brakujące tłumaczenia | Głos | Czas |
| --- | --- | --- | --- | --- | --- | --- |
| Chromium 141, pełna grafika | 6 z 6 (pierwsza próba, 120 s na /join) | 46 / 0 / 24 na każdej z 6 | 0 | 0 | `connected` na każdej, jeden pokój `dlaXJC4A...` | 195 s |

Główny GM: GM1 na każdej przeglądarce. Motyw Stained Glass na każdej. Powiadomienia: ostrzeżenie o Chromium 141 na
każdej; na GM1 i GM2 "The case planner is empty here and the server holds no copy of it"; w konsoli GM1 "Access
Unauthorized. Please enter your API key or sign in to The Forge." i "danganronpa-rpg | The case's server copy could not
be written" (FORGE-01). W konsoli każdej przeglądarki "Unable to acquire local audio: Not supported" (bez mikrofonu).
Zero toastów LiveKit - FORGE-03 z S0 był skutkiem zablokowanego LiveKit w chmurze, tu się nie pojawił.

### Zestaw testów modułu - `suite.mjs`

**Pierwszy raz skończył się na Forge**: 1931 zaliczonych, 58 niezaliczonych, 80 pominiętych, 0 czerwonych, w 990 s
(GM1 + P1-P3, cały przebieg 1105 s). Strona GM1 nie przeładowała się ani razu. W chmurze nie skończył w 40 minut -
skoro tu trwał 16,5 minuty, przyczyną było programowe rysowanie bez GPU, nie zawieszenie.

80 pominiętych to głównie warunki środowiska: 48 razy brak folderu `tools/` w zainstalowanym module, reszta brak w świecie
śladów, schowków, uczniów w pokojach albo stand-inu LiveKit. 58 niezaliczonych - FORGE-09 niżej.

### Scenariusze

Czas to ścianowy czas przebiegu (od startu przeglądarki do raportu). "Ostatni" to przebieg po ostatniej poprawce
scenariusza; wcześniejsze są w tabeli, bo poprawki są opisane niżej.

| Przebieg | Kontrole | Niezaliczone (ID) | Zaliczone (ID) | Czas |
| --- | --- | --- | --- | --- |
| S7 Chromium (1) | 62 / 72 | 10 x "no text overflows" (błąd pomiaru, poprawka 1) | OWNER-129-WRITEBOX x4 | 102 s |
| S7 Chromium (2) | 64 / 72 | 8 x "no text overflows" (błąd pomiaru, poprawka 2) | OWNER-129-WRITEBOX x4 | 101 s |
| **S7 Chromium (ostatni)** | **70 / 72** | 2 x "no text overflows" w komunikatorze GM-a (FORGE-07) | OWNER-129-WRITEBOX x4, reszta bez ID | 104 s |
| S7 Firefox (1) | 0 / 0 | przebieg wywrócony przy zamykaniu sondy /join (poprawka 3) | - | 4 s |
| **S7 Firefox (ostatni)** | **66 / 68** | te same 2 co w Chromium | (pole pisania: Firefox bez `field-sizing`, notatka) | 123 s |
| **S4** | **12 / 13** | DAY-06 (C3) | E-GM-01 x8, DAY-06 (B), DAY-03 (C2) | 120 s |
| **S2** | **10 / 21** | CALLS-01 x2, CALLS-03 x2, INV-01, INV-02, TRIAL-02, TRIAL-04, DAY-01, PRIM-01 x2 | E-GM-01 x6, EXP-GM-01 x2 | 533 s |
| S3 (1) | 6 / 14 | fazy A, C, D, E, F przerwane (strona P1 na `chrome-error://`, poprawka 4) | - | 350 s |
| S3 (2) | 12 / 20 | jak niżej; PRIM-02 (D1) zaliczony fałszywie (poprawka 5) | - | 611 s |
| **S3 (ostatni)** | **11 / 20** | CF-02, DAY-F01, CALLS-04, PRIM-03, C9, C6, DAY-F08, PRIM-02 x2, PRIM-01, CALLS-02, CF-07 | CF-02 (A2), CALLS-04 x2, CF-01 x2, CALLS-02 (C2), CF-07 (C2), DAY-F08 (E2), DAY-F11 x2, C7 x2, C6 (D3), C8, DAY-F05 | 615 s |
| S1a (1) | 6 / 18 | rzuty nieodczytane (poprawka 6) | - | 396 s |
| S1a (2) | 10 / 21 | DAY-01, FLOW x2, EXP-PL-02, MURDER-01 x3, D2-09 x2, D2-11 x2, D2-06 x2, MURDER-02 x2 | FLOW x5, D2-11 x2, D2-12 x2, D2-06 | 337 s |
| **S1a (ostatni, przed S1b)** | **10 / 26** | FLOW x2, DAY-01, EXP-PL-02, MURDER-01 x6, D2-09 x4, D2-11 x4, D2-06 x2, MURDER-02 x2 | FLOW x5, D2-12 x2, D2-06, D2-08, D2-10 | 482 s |
| S1b (1) | 4 / 11 | EXP-GM-02, MURDER-05, INV-01, INV-02, EXP-GM-03, EXP-GM-04, TRIAL-06; przerwany w "chapter" (poprawka 7) | FLOW x2, TRIAL-03, TRIAL-07 | 564 s |
| **S1b (ostatni)** | **4 / 10** | EXP-GM-02, FLOW, EXP-GM-03, EXP-GM-04, TRIAL-06, TRIAL-01 | FLOW x2, TRIAL-03, TRIAL-07 | 720 s |
| S5 (1) | 26 / 37 | VOICE-01 x8, VOICE-02 x2 (martwi P1 i P3, poprawka 8), błąd modułu na GM2 | VOICE-01 x12, VOICE-02 x2, VOICE-07 x2, VOICE-06, VOICE-05 x2, PRIM-03, PRIM-02 | 381 s |
| S5 (2) | 28 / 37 | VOICE-01 x6, VOICE-02 x2 (odczyt przed dojściem żetonu, poprawka 9), błąd modułu na GM2 | jak wyżej | 445 s |
| **S5 (ostatni)** | **32 / 37** | VOICE-01 x4, VOICE-02 (żetony nie doszły do pokoi: FORGE-05) | VOICE-01 x16, VOICE-02 x3, VOICE-07 x2, VOICE-06, VOICE-05 x2, PRIM-03, PRIM-02, brak błędów modułu | 423 s |
| S8 (1) | 21 / 31 | 9 x "no new error from the module" (FORGE-01), sprzątanie (poprawka 10) | reszta bez ID | 729 s |
| **S8 (ostatni)** | **22 / 31** | 9 x "no new error from the module" (FORGE-01) | sprzątanie i zegar | 741 s |
| **S6 (120 min)** | **19 / 20** | "no error from the module on gm1" (11 x FORGE-01) | strony bez przeładowań x6, pamięć pod 30 MB/h x6, błędy modułu 0 na GM2 i P1-P4, pętla zagrała | 7337 s |

Niemal każda niezaliczona kontrola w S1-S4 to błąd znany z triage, a więc oczekiwany wynik "przed" na 1.2.129:
CALLS-01/02/03/04, PRIM-01/02/03, INV-01/02, TRIAL-01/02/04/06, DAY-01, DAY-06, DAY-F08, MURDER-01, MURDER-02, D2-06,
D2-09, EXP-GM-02/03/04, EXP-PL-02, CF-02, C6, C9. Wyjątki: dwie kontrole FLOW w S1a/S1b i FORGE-05 - niżej.

## Najważniejsze pomiary

### S1-S4

- **S4**: trzy pary jednoczesnych naciśnięć (odmowa, trudność, Hope Call) rozstrzygnięte raz, przegrany GM dostaje
  "GM1 already ruled on this card." albo "GM1 is ruling on this card right now."; zegar przesunięty raz; koniec Eclipse
  raz, zapisany przez głównego GM-a; ten sam Truth Bullet dany raz ("already"). DAY-06: drugi GM przy otwartej rundzie
  słyszy tylko "“Asking the players whether they are done” was not carried out. You cannot do that right now."
- **S2**: drugi GM ustawia trudność, odmawia i zatwierdza Hope Call poprawnie (A1-A4). CALLS-01: przez 150 s co 20 s
  "GM1 is ruling on this card right now.", karta kończy się "Nobody answered in time". TRIAL-04: "Only the primary GM,
  GM1, can reset the season.". TRIAL-02: drugi GM słyszy "The game did not allow it", przyczynę ("No end of the chapter
  waits to be finished.") słyszy tylko główny.
- **S3**: P1 offline 20 s - po ok. 6,5 s strona wypada z gry (FORGE-04), karta kończy się "Answered by GM1, but nothing
  confirms that the answer arrived.". Przeładowanie głównego GM-a: 22,6 s do gotowości, 17,1 s bez GM-a, który jest
  głównym i słucha (PRIM-03, próg scenariusza 3 s). Po odejściu głównego GM2 przejmuje rolę po 0,8 s, ale nie dostaje
  żadnej informacji (PRIM-02) i nie widzi w interfejsie, że jest głównym (PRIM-01); po powrocie GM1 rola wraca do GM1.
- **S1a**: otwarcie morderstwa w czterech przebiegach: Hope (D2-12 zaliczone na obu mapach w 1 s), Despair, krytyk,
  porażka (D2-08 i D2-10 zaliczone: ofiara dostaje powiadomienie bez nazwiska). D2-09: każde otwarcie zmieniło Hope albo
  Despair (+1). MURDER-01: żeton zabójcy znika z map ofiary i świadka przed wynikiem rzutu (`veiled`). D2-06: po
  przeżyciu ofiary "?" znika z końcem incydentu, a nie przy wyjściu zabójcy z pokoju.
- **S1b**: TRIAL-03 (okna werdyktu tylko na GM2) i TRIAL-07 (wyrok wykonany, gdy GM1 odcięty) zaliczone; TRIAL-01:
  koniec rozdziału przerwany przeładowaniem GM1 (`stage: "applying"`) nie pokazuje się drugiemu GM-owi jako zatrzymany.
  TRIAL-06: "1 ballot never came back. The count above is out of every ballot issued".

### S5 - głos (LiveKit Forge, `DRPG_FAKE_MEDIA=1`, Chromium)

Liczby z ostatniego przebiegu (z dwóch poprzednich w nawiasach, gdy różne):

| Pomiar | Wynik |
| --- | --- |
| Połączenie wszystkich 6 przeglądarek | wszystkie `connected` w 2,1-2,6 s od startu pomiaru |
| VOICE-01, jedno przejście A->B | żeton w pokoju po 1,46 s, strona w pokoju planu po 3,2 s od zapisu; przerwa 1,2 s, 1 połączenie (1549 ms) |
| VOICE-01, powrót B->A | przerwa 3,4 s, cisza 3,1 s, 2 połączenia (2194/1542 ms) |
| VOICE-02, A->B->C co 400 ms | 1 połączenie, B pominięte (w przebiegu 2: 3 połączenia, 4,8 s przerwy, B pominięte) |
| VOICE-02, C->B->A co 2500 ms | 3 połączenia, przerwa 4,7 s, cisza 3,9 s |
| VOICE-07, początek Eclipse | 5 stron zmienia pokój w ciągu 1 s (319-1160 ms); GM-owie cisza 1,8-2,6 s, gracze 0 s (pokój własny w 0,4-0,7 s) |
| VOICE-07, koniec Eclipse | 5 stron w ciągu 1 s; GM-owie cisza 1,2-2,5 s, gracze 1,7-2,9 s |
| VOICE-06, F5 gracza | strona gotowa po 19-33 s, w swoim pokoju po 24,7-43,3 s, 1 połączenie (3,5-6,9 s) |
| VOICE-05, główny GM wychodzi | GM2 główny po 0,30-0,33 s; P4 stojący poza pokojami zostaje w ostatnim pokoju (Jeweler's Shop), nie trafia do głównego |
| PRIM-02, GM1 wraca | logowanie 30,7-41,9 s, GM1 znów główny po 33,8-51,7 s, 2 ponowne połączenia GM1 (najpierw własny pokój `drpg-eclipse-<id>`, potem właściwy) |
| P4 offline 15 s | strona wypada z gry (FORGE-04); ponowne logowanie i z powrotem po 47-48 s; inne strony bez ponownych połączeń |
| FORGE-03 | 0 toastów LiveKit na każdej stronie we wszystkich trzech przebiegach |

### S8 - wydajność przy rosnącym świecie (GM1 i P1, pełna grafika, GPU)

Ostatni przebieg (pierwszy w nawiasie, gdy różny). fps i czasy klatek z `game.drpg.fps()`, pamięć po wymuszonym
odśmiecaniu, ruch P2 widziany na P1 (od zapisu do narysowania):

| Poziom | GM1 fps, mediana/p95 ms | P1 fps, mediana/p95 ms | Pamięć GM1/P1 MB | Węzły DOM GM1/P1 | Ruch P2 na P1 |
| --- | --- | --- | --- | --- | --- |
| stan wyjściowy | 51, 18,8/37 (277, 3,6/3,7) | 22, 45,2/66 (277) | 56/53 | 3935/2011 | 311 ms |
| 30 śladów | 48, 19,3/38,5 (278) | 41, 23,8/43,6 (278) | 60/57 | 4115/2041 | 314 ms |
| 60 śladów | 82, 10,9/27,7 (277) | 71, 12,8/26,7 (278) | 63/59 | 4295/2071 | 318 ms |
| 120 śladów | 60, 15,3/32,8 (277) | 58, 16,4/31,7 (278) | 67/63 | 4655/2131 | 322 ms |
| 240 śladów | 23, 41,6/60,4 (273) | 27, 37,2/59,8 (277) | 77/70 | 5375/2251 | 353 ms |
| + 8 żetonów, 4 projekty | 51, 18,2/37,3 (272) | 28, 37,4/60,9 (276) | 79/72 | 5492/2333 | 363 ms |
| + 16 żetonów, 8 projektów | 275, 3,6/3,7 (267) | 274, 3,6/3,7 | 80/73 | 5604/2414 | 463 ms |
| + 32 żetony, 16 projektów | 277, 3,6/3,7 (263, 3,6/7) | 279, 3,6/3,7 | 82/75 | 5828/2570 | 493 ms |
| 100 wiadomości | 278 (263, 3,6/7) | 278 | 82/76 | 7234/3795 | 412 ms |
| 300 wiadomości | 277 (260) | 276 | 83/77 | 10050/6235 | 381 ms |
| 600 wiadomości | 278 (250, 3,6/7,1) | 274 (259) | 84/78 | 14272/9900 | 410 ms |
| okna otwarte, cały świat | 260 (254) | 276 (266) | 85/78 | 15588/9927 | 434 ms |

- Pierwszy przebieg: płasko 250-278 fps od początku do końca. Drugi: pierwsze sześć poziomów 22-82 fps, potem 260-279.
  Nie wiem, skąd różnica (te same poziomy, ten sam komputer; w drugim przebiegu nie robiłem nic równolegle). Po 240
  śladach w obu przebiegach widać spadek względem poziomu wcześniej (277 -> 273; 60 -> 23), ale bez progów (D2-18)
  nie ma tu werdyktu. Krzywa wymaga trzeciego przebiegu, zanim właściciel ustali progi.
- Otwarcie komunikatora P1: 62-99 ms; historii powiadomień: 73-216 ms (rośnie z liczbą wiadomości).
- Okna przy zmianie świata (GM panel, Students, Investigation): pierwsza zmiana DOM po 394-900 ms; projekt zrobił
  176-464 mutacji w otwartych oknach; publiczna wiadomość nie zmieniła żadnego okna.
- Jedyne błędy modułu na każdym poziomie: "The case's server copy could not be written Access Unauthorized" na GM1
  (FORGE-01) - stąd 9 niezaliczonych kontroli błędów.

### S6 - dwie godziny gry (`DRPG_SOAK_MINUTES=120`, 6 przeglądarek, bez sztucznego mikrofonu)

04:22-06:24 UTC, 7337 s. 266 kroków gry bez ani jednego wyjątku; 89 ruchów graczy (32 doszły, 57 nie - niżej); zegar
pięć razy przez Eclipse (morning -> noon -> afternoon -> evening -> night -> następny morning) i z powrotem na koniec.

| Strona | Wzrost pamięci po odśmiecaniu (od 10. minuty, najmniejsze kwadraty) | Pamięć na starcie -> po 120 min | Węzły DOM | Przeładowania | Błędy modułu |
| --- | --- | --- | --- | --- | --- |
| GM1 | 2,07 MB/h | 56,1 -> 61,7 MB | 3962 -> 6666 | 0 | 11 w konsoli, każdy "The case's server copy could not be written Access Unauthorized" (FORGE-01) |
| GM2 | 1,83 MB/h | 54,6 -> ok. 60 MB | jak GM1 | 0 | 0 |
| P1 | 1,71 MB/h | 53,5 -> ok. 59 MB | 2036 -> ok. 3100 | 0 | 0 |
| P2 | 2,38 MB/h | 53,5 -> ok. 59 MB | 2065 -> ok. 3100 | 0 | 0 |
| P3 | 2,46 MB/h | 53,4 -> ok. 59 MB | 2062 -> ok. 3100 | 0 | 0 |
| P4 | 1,77 MB/h | 50,9 -> 59,1 MB | 2025 -> 3155 | 0 | 0 |

- Próg scenariusza 30 MB/h: każda strona ponad dziesięć razy poniżej. Węzły DOM rosną z liczbą wiadomości (340 -> 497).
- fps (`game.drpg.fps()`, na starcie i po 60 min, na każdej stronie): 144 kl./s, mediana 6,9 ms, p95 7,1 ms, 0 klatek
  ponad 33 ms - stałe, bez zmiany po godzinie (144 to częstotliwość ekranu; S8 bez okna mierzył bez tego limitu).
- 0 toastów LiveKit na każdej stronie przez całe dwie godziny.
- Liczniki modułu, które najszybciej rosły (P4 przez 2 h): `glass.pulseFrame.panes` 111 618, `fog.driftTick` 17 667,
  `visibility.applyToToken` 12 255, `glass.pulseFrame` 4293, każdy `refreshToken.*` 4100.
- Ruchy: z 89 próśb 32 doszły do pokoju (po 3,0-3,3 s), 2 z 7 zapisanych w notatkach odmów to "You cannot do that right
  now." (zwykła gra: brak ruchu albo akcji), 5 nie dało żadnego komunikatu - żeton został, gdzie był, albo stanął w
  innym pokoju (Player 15's Room -> Main Hall skończyło w Dorm). To ruchy gracza z jego własnej strony do pokoju
  sąsiedniego według modułu (`neighbouringRooms`) - kolejny dowód do FORGE-05.

## Co widać na zrzutach

Obejrzane: S0 GM1 1920x1080 i P1 2560x1440; S7 Chromium GM1: Students, messenger, Investigation 1920x1080, GM panel
2560x1440; P1: notices 1920x1080, sheet 2560x1440; S7 Firefox P1 HUD 1920x1080.

- Witraż pokrywa cały ekran w obu rozmiarach i w obu przeglądarkach. Problem z chmury (witraż ucięty w Firefoksie przy
  1920x1080) się nie powtórzył - był skutkiem Xvfb i braku GPU. Pod witrażem widać mapę sceny (w chmurze w Chromium nie).
- Wszystkie okna S7 mieszczą się na ekranie w obu rozmiarach (kontrole "is on screen" i "no part past the viewport"
  zaliczone wszędzie); tekst przycisków (Level Up, A character dies, Skip the Eclipse) mieści się, mimo że `scrollWidth`
  mówił inaczej (poprawka 1).
- Komunikator GM-a: podgląd wątku "Timeline" ucięty wielokropkiem ("WHAT WAITS FOR YOU, …"; FORGE-07). Aktywna zakładka
  (CHAT w komunikatorze, ACTIONS w arkuszu) jest ciemna, a nieaktywne jasne, z drobnymi kreskami nad aktywną - nit,
  do oceny właściciela, czy to zamierzone.
- Powiadomienia Foundry: pas przez środek górnej części ekranu, przy 1920x1080 zasłaniają linię "Despair overflow" pod
  pulami; karty modułu stoją w lewym dolnym rogu, zwinięte ("+2"). Nic nie zasłania przycisków.
- Panel głosu po prawej: napis stanu przewija się ("CONNECTED · CONNECTED · CONNECT…").
- Gracz widzi "Despair overflow · ?/14", GM "0/14" - zgodne z tym, że gracz nie zna przepełnienia.
- Investigation przy 1920x1080: pole mapy sprawy jest przezroczyste i przez nie widać rozmytą planszę "On hold" ze
  środka ekranu - nit.
- Na każdym zrzucie GM-a i gracza: plansza "On hold" (gra wstrzymana), HUD z zegarem, "Still to act 4 / 4" u GM-a.

## Poprawki scenariuszy

Każda to osobny commit na `claude/dazzling-bohr-juuh4g`, z powodem w opisie; po każdej scenariusz uruchomiony ponownie.
Żadna kontrola nie została osłabiona: każda poprawka sprawia, że kontrola mierzy to, co opisuje.

1. **203bb827 `s7-look`**: tekst mierzony Range'em zamiast `scrollWidth`. Każdy przycisk Stained Glass "wylewał się" o
   dokładnie 5 px: sonda pokazała ozdobną ramkę `::before` z `inset: -4px -5px`, a tekst w polu przycisku ("Skip the
   Eclipse": prawy brzeg tekstu 183,4, pola 183).
2. **483795f1 `s7-look`**: sam Range liczył obrócony HUD (1-3 px: obrys obróconego elementu jest szerszy niż tekst).
   Wylanie liczy się teraz, gdy pokazują je oba odczyty; ucięcie wielokropkiem nadal się liczy (komunikator GM-a dalej
   nie przechodzi).
3. **3ea8c7b1 `lib.mjs`**: Firefox raz rzucił przy zamykaniu strony-sondy /join ("Browser.removeBrowserContext: can't
   access property _maybeDontRestoreTabs"); przebieg idzie dalej i to wypisuje.
4. **29a52634 `s3-disconnects`**: po odcięciu sieci P1 ląduje na `chrome-error://` (FORGE-04) i kolejne fazy wołały
   stronę bez gry ("ui is not defined", "__fk.me is not a function"). Faza A czyta stronę surowo i loguje P1 ponownie;
   A1 dalej ocenia, co dotarło do P1, a jej szczegóły mówią `p1PageLeftGame`.
5. **50d3fc55 `s3-disconnects`**: D1 (PRIM-02) zaliczał się na jedynym powiadomieniu "Access Unauthorized. Please enter
   your API key or sign in to The Forge." - zapis kopii sprawy (FORGE-01), nie słowo o przejęciu stołu. D1 pomija teraz
   ten toast, komunikat o pustym planerze i toasty LiveKit, i wypisuje, co pominął. W ostatnim przebiegu D1 uczciwie nie
   przechodzi.
6. **e10107d3 `lib/s1-kit.mjs`**: kit nie odczytał żadnego rzutu. Rzut gracza rysuje główny GM (E28,
   `roll-draw.mjs`): wiadomość jest GM-a, bez postaci (mówca "Monokuma", `actor: null`), z flagą `supersededRoll` i
   `rollId`. Postać brana teraz z mówcy, a gdy go nie ma - z rejestru GM-ów (`drawnRecordOf`). Dopiero od tej poprawki
   D2-09, D2-11 i D2-12 są mierzone.
7. **5e425a5f `s1b-case-trial`**: faza "close" odcina GM1 na 15 s, strona GM1 ląduje na `chrome-error://`, a faza "chapter"
   czekała 180 s na jej przeładowanie. GM1 logowany ponownie; szczegóły TRIAL-07 mówią `gm1LeftGame` (GM1 wypadł ze
   stołu, a nie tylko przegapił zapis GM2 - przypadek, który przewidywała linia UNMEASURED nagłówka).
8. **911b7e37 `s5-voice`** (dwie zmiany w jednym commicie): po S1a i S1b P1 był stracony, a P3 zabity, więc plan słał ich do
   `drpg-spectators` - przygotowanie ożywia martwych P1-P4 drogą S1a (`reviveCharacter`); do szczegółów kontroli "the
   plan sends ..." dopisane, gdzie żeton stoi według modułu.
9. **3e74e64e `s5-voice`**: na Foundry 14 zapis x i y to ruch po ścieżce, który trwa sekundy (P1 przeszedł przez Yelena's
   Room, ułamkowe x i y). Zbieżność czytana od razu dopasowywała plan pokoju, którego żeton jeszcze nie opuścił
   ("single move" zbieżne po 40 ms, P1 wciąż w Dorm), i każda faza czytała ruch poprzedniej. Pomiar czeka teraz do 30 s,
   aż przesunięte żetony staną w swoich pokojach; czasy nadal liczone od zapisu.
10. **ada39e93 `s8-load`**: strona GM1 przeładowała się w środku sprzątania ("Execution context was destroyed") i w
    świecie zostało 220 żetonów, 188 śladów i 601 wiadomości. Identyfikatory zapisów są po stronie Node, więc
    sprzątanie powtarza się do 3 razy po powrocie strony GM1. W ostatnim przebiegu sprzątanie przeszło za pierwszym
    razem (powtórka nie była potrzebna, więc nie jest jeszcze sprawdzona w działaniu).
11. **0081b8fe `s5-voice`** i **430c7000 `s6-soak`** (przed uruchomieniem, na dowodach z S3 i S5): S5 loguje P4 ponownie,
    gdy faza offline wyrzuci jego stronę z gry (zadziałało: "pageLeftGame", z powrotem po 47-48 s); S6 daje ruchowi do
    15 s zamiast stałych 3 s, zanim policzy go jako odmowę.

Ręczne sprzątanie po pierwszym S8 (za zgodą właściciela): 601 wiadomości z okna czasu S8 (`_stats.createdTime`) i
wszystkie 198 śladów sceny SHB Ultimate Aether Plaza (spis świata z `suite.mjs` przed scenariuszami: 0 żetonów na tej
scenie, więc każdy ślad był dzisiejszy). Ślady S8 nie dały się odróżnić od innych: dziennik śladów żyje w magazynie GM-ów
w przeglądarce, a świeża przeglądarka sondy bez drugiego GM-a go nie ma. 32 żetony NPC "QA s8" zniknęły ze sceny między
dwoma przebiegami na sucho - nie wiem, co je usunęło.

## Znaleziska (proponowane wiersze)

| ID | Waga | Co | Dowód |
| --- | --- | --- | --- |
| FORGE-01 (uzupełnienie) | major | Potwierdzone na obu GM-ach: GM1 przy każdym zalogowaniu i GM2, gdy zostaje głównym, nie zapisuje kopii sprawy ("Access Unauthorized. Please enter your API key or sign in to The Forge."; S3 D, S5 koniec, S8 na każdym poziomie). Do tego: świeża przeglądarka GM-a bez drugiego GM-a online ma pusty magazyn GM-ów (dziennik śladów, planer) - "The case planner is empty here and the server holds no copy of it". Na Forge GM po zmianie przeglądarki lub komputera traci całą wiedzę GM-ów, dopóki nie wróci GM, który ją ma | `doctor` (oba GM-y), `s3-disconnects` D1 `all`, `s5-voice` koniec (GM2), `s8-load` (GM1, każdy poziom); sonda czyszcząca: `remnantData` = null dla 198 z 198 śladów |
| FORGE-04 | major | Po ok. 6,5 s bez sieci Foundry (nie moduł) pisze "Server connection lost" i przeładowuje stronę. Offline przeładowanie kończy się stroną błędu przeglądarki, która zostaje po powrocie sieci: gracz albo GM wraca dopiero po F5 i pełnym wczytaniu (30-48 s). Krótka przerwa w Wi-Fi wyrzuca więc kogoś ze stołu; moduł mógłby najwyżej uprzedzać o tym w kafelku głosu albo w powiadomieniu | sonda P1 (`probe-offline`, 25.11.2026 02:17: "Attempting to re-connect" co 0,5 s, po 6,4 s "Server connection lost", nawigacja na `chrome-error://chromewebdata/`, 30 s po powrocie sieci nadal tam); `s3-disconnects` A, `s5-voice` offline, `s1b-case-trial` close |
| FORGE-05 | do zbadania (major, jeśli to moduł) | Żeton przesunięty zapisem GM-a nie dochodzi do części pokoi: P2 z Electronic's Shop do Geon Pi's Room nie rusza się wcale, P1 zatrzymuje się w pokoju po drodze (Yelena's Room, Player 15's Room), P3 zostaje w Food Court; to samo przy przejściu P4 w Eclipse w S1a (dwa przebiegi, East Wing zamiast Main Hall). Głos w każdym przypadku poprawnie idzie za faktycznym pokojem. W S6 gracz przesuwający własny żeton do pokoju sąsiedniego według modułu: 57 z 89 ruchów nie doszło, wśród zapisanych w notatkach 5 z 7 bez żadnego komunikatu dla gracza. Nie rozstrzygnąłem: sypialnie bez klucza, ograniczenia ścieżki v14 (ruch do "głębokiego" punktu pokoju zatrzymuje się na ścianie) albo nakładające się regiony (FORGE-09a). Jeśli to moduł albo v14 przy zwykłym przeciągnięciu, gracz nie wie, czemu jego ruch nie wyszedł | `s5-voice` ostatni: `tokenNow` i `arrived` w kontrolach "the plan sends ..."; `s1a-day-murder` "P4 crosses"; `s6-soak` notatki "step N: pX move" i licznik `moves` |
| FORGE-06 | minor | Dwa błędy z kodu Foundry (stos bez plików modułu), oba w trakcie scenariuszy, które przesuwają żetony i zmieniają głos: przy ogłoszeniu ciała `TypeError: Cannot read properties of null (reading 'clientWidth') at DepthSortPlaceable.panCanvas` na P1; w S1b `TypeError: Cannot read properties of undefined (reading 'settings') at CameraViews._configureRenderParts`. Czy moduł je wywołuje (zebranie żetonów, dok kamer), nie sprawdziłem | `s2-second-gm` koniec, błędy P1; `s1b-case-trial` ostatni, błędy na końcu |
| FORGE-07 | nit | Komunikator GM-a: podgląd wątku "Timeline" ucięty wielokropkiem (308 px tekstu w 179 px przy 1920x1080, 363 px przy 2560x1440), w obu przeglądarkach | `s7-look` ostatni Chromium i Firefox, `gm1-*-messengerGm.png` |
| FORGE-08 | nit | Offline moduł nie wczytuje ikon śladów (`Error: Invalid Asset modules/danganronpa-rpg/icons/remnant-*.svg` przy `loadTexture`); po powrocie strona i tak się przeładowuje (FORGE-04), więc bez skutku dla gracza | sonda P1 |
| FORGE-09a | minor (świat) | Świat kampanii: schowek w "Marie's Room" należy do nieistniejącej postaci; 5 nakładających się regionów na SHB Ultimate Aether Plaza (Dorm na Player 9's Room, Marie's Room i Main Hall; Player 9's Room na Marie's Room; Player 16's Room na Jacob's Room) | `suite.mjs`: "every stash belongs to somebody who exists", "no two rooms on the scene stand on the same floor" |
| FORGE-09b | - (środowisko) | Testy, które nie miały czego mierzyć: gra wstrzymana bez żetonów uczniów na scenie (R1009, R1010, R1011, R1018, R1051, R1052, R8875), brak `glass-harness.html` w zainstalowanym module (R3465); prawdopodobnie też testy kaskady CSS (R1323, R1331, R1332, R1333, R3576, R2026, R829, R2018: "winner: nobody") - hipoteza: Forge serwuje CSS z `assets.forge-vtt.com`, a reguł arkusza z innej domeny nie da się czytać | `suite.mjs` |
| FORGE-09c | minor (testy) | Testy napisane pod harness, które na prawdziwym v14 rzucają: R7791 "Cannot assign to read only property 'format' of object '#<Localization>'", R1459 "Cannot redefine property: items", R1489 "this.system.getRollData is not a function"; R1066 "Cannot read properties of undefined (reading 'style')" (test albo moduł). Test "tier 0/1 changed nothing" złapał zapis ustawień klienta `core.rtcClientSettings` i `rtcDockBefore` (R1487) i przełączenie dźwięków playlisty "Pause" (najpewniej muzyka pauzy modułu) | `suite.mjs` |
| FORGE-09d | do triage (R7931 i R505 najpierw) | Kandydaci na prawdziwe błędy: R7931 (dok kamer nazwał ukrytego uczestnika albo nie przywrócił nazwy - możliwy wyciek tożsamości), R505 (okno obrazka pokoju: 2 elementy z kodu opisu zamiast 0), R111 (okno podręczników wychodzi poza dół ekranu przy 1920x1080), R4721 i R6602 (skok do sekcji podręcznika nie przewija: 0 zamiast 312 px; może skutek R111), R8273 (linia push-to-talk nie idzie za zmianą klawisza), R296 (otwarcie historii powiadomień odtwarza dźwięki - może muzyka pauzy) | `suite.mjs` |
| FORGE-09e | do triage | Geometria przy 1920x1080 inna niż oczekiwana (R1400, R474, R476, R512, R299 - przyciski w rogu i stos powiadomień; R508 kafelek pokoju 292 zamiast 265 px; R543 portret w kafelku głosu przesunięty o 29 px) oraz testy czasu i odświeżania (R3705, R4420, R6850, R5380, R5381, R3985, R7973, R7974, R8545, R1353, R1458, R3463, R1387, R1524, R1455, R1471). Zrzuty w tych miejscach wyglądają w porządku; czy to rozjazd oczekiwań z harness, czy prawdziwe przesunięcia, nie rozstrzygnąłem | `suite.mjs` |
| FORGE-10 | nit | Chromium poniżej 146 dostaje od Foundry 14 czerwone powiadomienie przy każdym wejściu; dotyczy też narzędzi testowych na Playwright 1.56.1 (Chromium 141) | S0 z Chromium 141 |

Inne obserwacje bez wagi:

- EXP-PL-01: uprawnienia Foundry - `SHOW_CURSOR` i `SHOW_RULER` nie mają żadnej roli, `PING_CANVAS` od Trusted Player
  wzwyż; gracz nie pinguje, nie widać jego kursora ani linijki (płótno GM1 nie miało kursora P1).
- Pole pisania komunikatora: 3 linie na starcie w obu przeglądarkach (Chromium z `field-sizing: content`, Firefox bez
  niego, ale `min-height` daje te same 2,98-3 linii); rośnie do 3,5-9,3 linii przy pięciu i dziesięciu.
- Firefox bez okna i bez sztucznego mikrofonu: LiveKit `initializing` / `disconnected` (Chromium w tych samych
  warunkach `connected`).
- Drugi przebieg S1a i S1b: dwie kontrole FLOW zależne od stanu świata po wcześniejszych przebiegach - karta trudności
  P3 nie dotarła do GM1 ("no Set difficulty card reached gm1"), GM1 nie dostał pytania o ciało (otwarło mu się za to okno
  "The case on this browser", prawdopodobnie FORGE-01).
- S3 C: przeładowanie głównego GM-a z otwartym oknem orzeczenia - karta trzymana przez niego daje się potem orzec
  (C2 zaliczone); D5 (jedyny GM przeładowany z oknem) - karta zostaje trzymana "GM2 is ruling on this card right now"
  w jego własnym imieniu (CALLS-02), scenariusz ją usunął.

## Czego nie zrobiłem i dlaczego

- **Nie rozstrzygnąłem FORGE-05** (dlaczego żetony nie dochodzą do pokoi). Kluczowe pomiary głosu są zebrane; propozycja
  dla S5: wybierać tylko sąsiednie pokoje bez sypialni (jak S1a: `roomNames` bez sypialni) albo zapisywać ruch z
  `movement.constrainOptions.ignoreWalls`, i sprawdzić, która z dwóch przyczyn to robi.
- **Nie powtarzałem S1a/S1b trzeci raz.** Po kilku przebiegach świat odbiega od stanu wyjściowego (rozdział 3, dzień 6,
  zmarli i ożywieni P1-P4, cztery dodatkowe żetony "P3"), a dwie porażki FLOW w drugim przebiegu wyglądają na skutek tego
  stanu.
- **Powtórka sprzątania S8 po przeładowaniu GM1** (poprawka 10) nie została sprawdzona w działaniu: w drugim przebiegu
  przeładowania nie było.
- **Różnicy krzywych fps S8** nie wyjaśniłem; potrzebny trzeci przebieg.
- **58 testów zestawu** rozpisałem tylko z komunikatów, bez sond; R7931 i R505 warto sprawdzić pierwsze.

## Przed końcowym sprawdzeniem

Świat testowy `drpg-qa-forge-2` jest po tych przebiegach wyraźnie zmieniony (zegar, zgony, karty, wiadomości, tokeny).
Końcowe sprawdzenie (D2-15) startuje z `drpg-qa-forge`, który nie był uruchamiany - albo z nowej kopii niego.
