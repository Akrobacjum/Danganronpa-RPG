# F3 na Forge - przebiegi S0 i zestawu testów według `audit/forge/README.md` (24.11.2026)

Zlecenie: przygotować komputer do testów na Forge i uruchomić kroki 4-7 z README (S0 w pełnej grafice, z
fałszywym mikrofonem, w Firefoksie, wbudowany zestaw testów). Gra: świat testowy `drpg-qa-forge` (id i tytuł tak
odczytane na każdej przeglądarce), konta GM1, GM2, P1-P4. Raporty i zrzuty: `audit/forge/out/` (poza repozytorium).

## Najważniejsze zastrzeżenie: to NIE był komputer właściciela

Sesja miała przygotować komputer właściciela, ale działała w kontenerze w chmurze. Komputer "Honoratka" jest na
liście Remote Control, lecz żaden z jego folderów nie jest udostępniany sesjom w chmurze (`cannot_be_used`,
`not_available`, bez podanej przyczyny). Narzędzie Desktop Commander, dostępne w sesji, działa w tym samym kontenerze
(host `vm`, ta sama ścieżka Node), nie na komputerze właściciela. Wszystko niżej zmierzono więc w tych samych
warunkach co S0 (`F3-forge-S0.md`): bez GPU i przez proxy sesji, które nie przepuszcza LiveKit. To, po co README
kieruje testy na komputer właściciela (GPU, prawdziwa sieć dla głosu), nadal nie jest sprawdzone.

## System i wersje

| Co | Wartość |
| --- | --- |
| System | Ubuntu 24.04.5 LTS, jądro 6.18, x86_64; 4 rdzenie, 15 GB RAM, bez GPU |
| Node.js / npm | 22.23.5 / 10.9.9 (wymagane 22.x: zgodne) |
| git | 2.43.0 |
| Repozytorium | `/home/user/Danganronpa-RPG`, było na `claude/wonderful-pascal-g9og3n` (9a92dae9), bez lokalnych zmian; przełączone na `claude/dazzling-bohr-juuh4g` (2ff1f9e1) |
| Playwright (z `audit/harness`, `npm ci`) | 1.56.1 |
| Przeglądarki Playwright | Chromium 141.0.7390.37 (build 1194) i Firefox 142.0.1 (build 1495), pobrane do `node_modules` (`PLAYWRIGHT_BROWSERS_PATH=0`), żeby nie nadpisać przeglądarek kontenera |
| Chromium użyty w krokach 4, 5 i 7 | Chrome for Testing 158.0.8127.36 kontenera (`/opt/pw-browsers/chromium-1243`, przez `DRPG_CHROMIUM`); krok 4 ruszył, zanim build 1194 się pobrał, i dla porównywalności zostałem przy nim |
| Gra (z każdej przeglądarki) | Foundry 14.370, Daggerheart 2.12.8, danganronpa-rpg 1.2.129; moduły: avclient-livekit 0.6.8, dice-so-nice 6.4.5, forge-vtt 1.14.10, isometric-perspective 14.0.6 |

Co trzeba było zmienić w środowisku (za zgodą właściciela, poza repozytorium):

- Sieć sesji: dodany host `cdn.playwright.dev` (pobieranie przeglądarek Playwright było blokowane, 403).
- Firefox nie ufał certyfikatowi proxy sesji (`SEC_ERROR_UNKNOWN_ISSUER`): dodany przez plik zasad Firefoksa
  wskazany zmienną `PLAYWRIGHT_FIREFOX_POLICIES_JSON` (plik w katalogu tymczasowym sesji). Na komputerze właściciela,
  bez proxy, to niepotrzebne.
- Pakiet `libegl1` (apt). Nie wystarczył do WebGL w Firefoksie bez okna; czy był potrzebny w trybie z oknem (niżej),
  nie sprawdziłem.

## Wyniki kroków 4-7

| Krok | Przebieg | Zalogowane | Kontrakt ok / niezgodne / nieodczytane | Błędy modułu | Brakujące tłumaczenia | Głos (`av.roomState`, `av.roomName`) | Czas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | Chromium, `DRPG_FULL_RENDER=1` | 5 z 6 (GM1 nie wszedł) | 46 / 0 / 24 na 4 przeglądarkach, 45 / 0 / 25 na P4 | 0 | 0 | "disconnected" na 4, "connecting" na P2; nazwa pokoju pusta wszędzie | 21 min |
| 5 | jak 4 + `DRPG_FAKE_MEDIA=1` | 5 z 6 (P3 nie wszedł) | 46 / 0 / 24 na każdej | 0 | 0 | "disconnected" na 4, "connecting" na P4; nazwa pusta | 26 min |
| 6a | `DRPG_BROWSER=firefox` jak w README (Firefox bez okna) | 0 z 6 | - | - | - | - | 13 min |
| 6b | Firefox z oknem pod Xvfb | 6 z 6 | 46 / 0 / 24 na każdej | 0 | 0 | "connecting" na każdej; nazwa pusta | 6,5 min |
| 7 | `suite.mjs`, GM1 + P1-P3 | 4 z 4 | (diagnostyka GM1: 47 / 0 / 23) | - | - | - | 46 min, bez wyniku |
| 7b | `suite.mjs`, sam GM1 (`DRPG_ROLES=gm1`) | 1 z 1 | (diagnostyka GM1: 46 / 0 / 24) | - | - | - | 41 min, bez wyniku |

Główny GM odczytany zgodnie na każdej przeglądarce: GM2 w kroku 4 (GM1 nie wszedł), GM1 w krokach 5 i 6b. Motyw
Stained Glass na każdej. Żadna przeglądarka nie zapisała błędu JavaScript pochodzącego z modułu (`window.__errors`),
w konsolach nie było ani jednej linii z `danganronpa`/`drpg`.

### Krok 4 - S0, pełna grafika

- GM1: `page.selectOption: Timeout 30000ms exceeded` w trzech próbach - formularz /join nie pokazał listy kont w
  30 s. Po przebiegu odczytałem /join osobno: opcja GM1 była dostępna (nie wyłączona). Przyczyny nie ustaliłem; w S0
  ten sam objaw miał GM2, w kroku 5 P3, więc wygląda na obciążenie kontenera przy pierwszym ładowaniu, nie na konto.
- Jedyna różnica kontraktu: na P4 `hook-dice-so-nice-ready` nieodczytany (na pozostałych ok) - P4 logował się
  ostatni i Dice So Nice mógł nie zdążyć; nie sprawdzałem tego dalej.
- 24 nieodczytane pozycje to te same co w S0: haki, których S0 nie wywołuje (arkusz, okno rzutu, Dice So Nice,
  okno obrazka) i pozycje głosu i czatu (`rtc-client-keys`, `livekit-attach-audio`, `voice-modes`, ...).
- Powiadomienia: na każdej przeglądarce stos "Error connecting to LiveKit Server: could not establish signal
  connection: Failed to fetch" (23-37 powiadomień na przeglądarkę, prawie wszystkie o LiveKit; 0 na P4); na GM2 dodatkowo "The case planner is empty here and
  the server holds no copy of it..." (FORGE-01). W konsolach: połączenie do `livekit.forge-vtt.com` odrzucone przez
  proxy (`ERR_TUNNEL_CONNECTION_FAILED`) i 307 razy "Unable to acquire local audio".
- Zrzuty: 8 z 12 (P2 i P4 1920x1080: limit 120 s zrzutu przekroczony; GM1 nie wszedł).

### Krok 5 - głos z fałszywym mikrofonem

- Fałszywy mikrofon działa: "Unable to acquire local audio" spadło z 307 (krok 4) do 0.
- Głos się nie połączył: `roomState` "disconnected" albo "connecting", `roomName` pusty na każdej przeglądarce.
  Przyczyna: proxy sesji odrzuca `livekit.forge-vtt.com` (w S0 zablokowany celowo, D2-04: głos testujemy z komputera
  właściciela). Hostu nie dopuszczałem; nawet z nim ruch WebRTC prawdopodobnie nie przeszedłby przez proxy HTTPS -
  tego nie mierzyłem.
- Powiadomienia: 40-60 na przeglądarkę, prawie wszystkie o LiveKit ("Failed to fetch" i "Abort handler called"); 0 na
  P4.
- GM1: "Access Unauthorized. Please enter your API key or sign in to The Forge." oraz komunikat o pustym planerze
  sprawy - to samo co FORGE-01 w S0.
- GM2: "You have lost connection to the server, attempting to re-establish." i "Server connection re-established."
  (jak FORGE-02 w S0) oraz "The GM store did not hear from GM1. It carries on with what this browser holds, and their
  copy is merged when it arrives."
- P3 nie wszedł (ten sam limit 30 s na /join). Zrzuty: 7 z 12 (GM2, P2, P4 1920x1080 po 120 s).

### Krok 6 - Firefox

- 6a, dokładnie jak w README (`DRPG_BROWSER=firefox node audit/forge/doctor.mjs`): **`doctor.mjs` nie czyta
  `DRPG_BROWSER`** - ma własne uruchamianie przeglądarki i zawsze startuje Chromium (`lib.mjs` `launch()`, który
  obsługuje Firefoksa, używa tylko `suite.mjs`). Żeby wykonać krok, uruchomiłem kopię `doctor.mjs` z katalogu
  tymczasowego (poza repozytorium) z jedną zmianą: przeglądarka z `lib.mjs` `launch()`. Wynik: 0 z 6 - w Firefoksie
  bez okna nie powstaje kontekst WebGL ("Exhausted GL driver options"), Foundry przerywa start (`can't access property
  "getExtension", te is undefined`) i formularz /join w ogóle się nie rysuje (w DOM zostaje pusty
  `<template id="join-game">`).
- 6b: ta sama kopia, ale Firefox z oknem (`headless: false`) na wirtualnym ekranie Xvfb (`xvfb-run`). WebGL 2.0
  działa (Mesa, programowo), 6 z 6 zalogowanych, 0 błędów modułu, 0 brakujących tłumaczeń, kontrakt 46 / 0 / 24 na
  każdej. Przebieg trwał 6,5 min wobec 21-26 min w Chromium. Przy zrzutach jądro zabiło proces Firefoksa z braku
  pamięci (ok. 8,5 GB), więc zrzutów jest 7 z 12 (brak P2 1920x1080, P3 i P4); raport był już zapisany.
- Na Firefoksie nie ma ostrzeżenia Foundry o wyłączonym sprzętowym przyspieszeniu (w Chromium jest na każdym zrzucie).

### Krok 7 - wbudowany zestaw testów (`suite.mjs`)

- GM1, P1, P2, P3 zalogowani. `game.drpg.runTests({ tier: 1 })` na GM1 nie skończył się w 40 minutach (limit
  `suite.mjs`): wynik "suite: no result", więc nie ma liczb passed / failed / skipped ani nazw niezaliczonych testów.
- **Przeładowań nie było**: `navigations` puste (w chmurze dwie wcześniejsze próby kończyły się przeładowaniem
  strony GM1 - tu nie wystąpiło). Strona GM1 żyła do końca: po limicie odpowiedziała na `diagnose` i spis świata.
- Na czym zestaw stanął, nie wiem: `runTests` nie wypisuje postępu test po teście, tylko wynik na końcu, a
  `suite.mjs` nie zbiera konsoli strony.
- Diagnostyka GM1 po limicie: kontrakt 70 pozycji, 47 ok, 0 niezgodnych, 23 nieodczytane.
- Spis świata (tylko odczyt): aktywna scena "DRPG: SHB Ultimate Aether Plaza" (25 regionów, 0 żetonów); dalej "DRPG
  test - dwa piętra" (5 regionów, 2 żetony, 2 poziomy) i "DRPG: SHB Trial Grounds" (2 regiony); 8 aktorów; zegar:
  kampania "DanganRPG: Safe Havens Bleed", sezon 5, rozdział 1, dzień 1, codzienność, rano; brak trwającego
  morderstwa; głos włączony w ustawieniach; gra wstrzymana.
- 7b (sam GM1, żeby odróżnić obciążenie od zawieszenia): też bez wyniku w 40 minutach, też bez przeładowań
  (`navigations` puste), strona żywa po limicie (diagnostyka: 70 pozycji, 46 ok, 0 niezgodnych, 24 nieodczytane).
  Obciążenie kontenera przy jednej przeglądarce wciąż ok. 4 (4 rdzenie zajęte). Czyli liczba przeglądarek nie jest
  jedyną przyczyną; czy zestaw stoi na jednym teście, czy tylko idzie bardzo wolno przy programowym rysowaniu, z tych
  danych nie da się rozstrzygnąć. Dla porównania: bez Foundry, w harness, poziomy 0-1 trwają 200-212 s (CLAUDE.md),
  ale to inne środowisko i nie przekłada się wprost.

## Co widać na zrzutach

Obejrzane: GM1 (krok 5, oba rozmiary; krok 6b 1920x1080), GM2 (krok 4, oba rozmiary), P1 (krok 4 i krok 6b, oba
rozmiary).

- Każdy ekran: HUD modułu w stylu Stained Glass - zegar (On hold, Chapter 1 - Day 1, Daily Life, Morning),
  "Despair pools" u góry (Divakuma i Karimkuma 0/12), plansza "On hold" na środku (gra wstrzymana), kafelek "Voice
  disconnected" z instrukcją ("Reconnecting you now; if you still hear nobody in a minute, reload the page (F5)") po
  lewej na dole, przyciski w prawym dolnym rogu. Gracz widzi Actions / Move / Hope i Projects ("No projects yet."),
  GM - "Still to act 4 / 4", strzałki zegara oraz +/- przy pulach Despair.
- Powiadomienia: na każdym zrzucie pięć powiadomień przez całą szerokość środka (1150 px przy 1920, 820 px przy
  1366): cztery o LiveKit i (w Chromium) ostrzeżenie Foundry o braku sprzętowego przyspieszenia. Przy 1366x768
  zakrywają część HUD: u GM-a strzałkę ">" zegara i nagłówek Projects, u gracza etykietę Actions. To FORGE-03 z S0,
  przy zablokowanym LiveKit.
- Panel głosu po prawej (widoczny przy 1366x768 i u P1 w Firefoksie przy 1920x1080) ma ucięty napis stanu
  ("DISCONNECTED - DISCONNECT..." / "CONNECTING - CONNECTING - C...").
- Komunikator: na żadnym zrzucie nie jest otwarty - widać tylko jego przycisk (czerwona ikona dymków) w prawym
  dolnym rogu, wyglądający tak samo w Chromium i Firefoksie. Wyglądu samego okna komunikatora te zrzuty nie pokazują;
  `doctor.mjs` go nie otwiera.
- Firefox 1920x1080 (krok 6b): witraż nie pokrywa całego ekranu. U GM1 kończy się mniej więcej na 1366x768 (dalej
  widać mapę - szachownicę i plan pomieszczeń), u P1 około 1605x905 (dalej gładkie ukośne pasy); panel głosu P1
  stoi w środku ekranu. Zrzut jest robiony 1,5 s po zmianie rozmiaru z 1366x768 - wygląda na to, że witraż nie zdążył
  się przeciąć na nowy rozmiar albo w Firefoksie tego nie zrobił. Którego z dwóch, nie sprawdziłem. W Chromium przy
  1920x1080 witraż pokrywa cały ekran.
- W Chromium mapy sceny pod witrażem nie widać (ciemne szyby), w Firefoksie u GM1 widać ją wyraźnie. Przyczyny nie
  sprawdzałem (Chromium rysuje programowo przez SwiftShader i wolniej).

## Czego nie udało się zrobić i dlaczego

- Testów na komputerze właściciela: jego foldery nie są dostępne dla sesji w chmurze (wyżej). GPU i prawdziwy głos
  pozostają niesprawdzone.
- Połączenia głosu: proxy sesji odrzuca LiveKit (D2-04); fałszywy mikrofon sprawdzony tylko po stronie przeglądarki.
- Liczb zestawu testów (passed / failed / skipped, nazwy niezaliczonych): `runTests` tier 1 bez wyniku w 40 min,
  zarówno z czterema przeglądarkami, jak i z samym GM1.
- Kroku 6 dokładnie według README: `doctor.mjs` ignoruje `DRPG_BROWSER`; wykonany kopią spoza repozytorium.
- Zrzutów wszystkich kont: limity zrzutu (120 s) w Chromium, brak pamięci w Firefoksie.
- Logowania wszystkich kont w Chromium: po jednym koncie na przebieg nie przeszło limitu 30 s na /join.

## Propozycje (niezrobione, do decyzji)

- `doctor.mjs`: uruchamiać przeglądarkę przez `lib.mjs` `launch()`, żeby `DRPG_BROWSER` działał tak, jak opisuje
  README; dla Firefoksa w maszynie bez GPU tryb z oknem (Xvfb) albo informacja w README.
- `suite.mjs`: zbierać konsolę strony GM1 do raportu, żeby przy braku wyniku było wiadomo, na którym teście stanął.
- `audit/live/foundry.mjs` `login`: dłuższy limit niż 30 s na pojawienie się listy kont na /join przy pierwszym
  ładowaniu (zmierzone w S0 i tu: jedno konto na przebieg).
