# audit/forge - testy na Forge (droga do 2.0, F3)

Napisane 24.11.2026. Narzędzia, które logują testowe konta do gry testowej na Forge, czytają, co widzi każda
przeglądarka, i uruchamiają scenariusze. Wyniki trafiają do `audit/forge/out/` (poza repozytorium). Plan i decyzje:
`docs/dev/v2/`.

**Adresu gry nie wpisujemy do repozytorium.** Repozytorium jest publiczne, a gra testowa ma konta GM-ów bez haseł.
Adres podaje się tylko w zmiennej środowiskowej przy uruchomieniu.

| Narzędzie | Co robi | Pisze do świata? |
| --- | --- | --- |
| `doctor.mjs` (S0) | loguje 6 kont, odczytuje wersje, głównego GM-a, kontrakt modułu, błędy, brakujące tłumaczenia, stan głosu; zrzuty ekranu w rozmiarach z `DRPG_SIZES` | nie |
| `suite.mjs` | wbudowany zestaw testów modułu, poziomy 0-1 (`game.drpg.runTests({ tier: 1 })`), diagnostyka i spis świata | nie |
| `lib.mjs` | wspólne: zmienne, przeglądarka, logowanie, blokada cudzego świata | - |
| `run.mjs` | uruchamia scenariusze z `scenarios/`: `node audit/forge/run.mjs s2-second-gm [s3-disconnects ...]` | zależy od scenariusza |
| `table.mjs`, `page-kit.mjs`, `scenarios/lib/` | narzędzia scenariuszy w stronach przeglądarek | - |

## Scenariusze (napisane 24.11.2026, przed pierwszym uruchomieniem)

Każda kontrola opisuje zachowanie 2.0 z triage i rejestru decyzji (`docs/dev/v2/`). Na 1.2.129 kontrole znanych
błędów mają nie przechodzić; po poprawkach ta sama kontrola ma przejść. Kontrole oznaczone `FLOW` sprawdzają tylko,
czy scenariusz sam przeszedł swoje kroki. Każdy scenariusz poza S7 (bez `DRPG_S7_FOG=1`) pisze do świata testowego: szczegóły w nagłówku
pliku. **Przed pierwszym uruchomieniem kopia zapasowa świata testowego** - końcowe sprawdzenie (D2-15) startuje z
tego samego stanu.

| Scenariusz | Konta | Co mierzy | Uwagi |
| --- | --- | --- | --- |
| `s1a-day-murder` | 6 | Daily Life z decyzjami obu GM-ów, Eclipse, Direct Murder i decyzje D2-06, D2-08..D2-12, MURDER-01..03, EXP-PL-02, DAY-01 | część kontroli zależy od kości (nieudane otwarcie: rzadko); na starcie stan świata przygotowany albo odmowa (niżej) |
| `s1b-case-trial` | 6 | odkrycie ciała, Investigation, Class Trial, głosowanie, werdykt, koniec rozdziału (MURDER-05, EXP-GM-02..04, INV-01/02, TRIAL-01/03/06/07) | startuje ze stanu po s1a albo zakłada własny incydent; kończy w następnym rozdziale; na starcie jak s1a, stan po s1a zachowany |
| `s2-second-gm` | 4 | drugi GM robi każdą pracę GM-a (CALLS-01/03, INV-01/02, TRIAL-02/04, DAY-01, EXP-GM-01, PRIM-01) | reset sezonu tylko do pytania, bez wykonania |
| `s3-disconnects` | 5 | gracz offline, odświeżenie w trakcie prośby, odświeżenie i odejście głównego GM-a, GM wychodzi w Eclipse | |
| `s4-two-gms-at-once` | 3 | dwaj GM-owie naciskają to samo naraz | |
| `s5-voice` | 6 | pokój LiveKit każdego klienta wobec planu modułu, czasy przełączenia, ponowne połączenia | wymaga `DRPG_FAKE_MEDIA=1`; pokoje bez sypialni, ruchy GM1 z pominięciem ścian (`free`, niżej) |
| `s6-soak` | 6 | 2 h zwykłej gry: pamięć, błędy, przeładowania; ruchy graczy liczone osobno: doszły / odmowa z komunikatem / bez komunikatu (FORGE-05) | `DRPG_SOAK_MINUTES`; sąsiad bez sypialni |
| `s7-look` | 2 | zrzuty najważniejszych okien w rozmiarach z `DRPG_SIZES`, mieszczenie się, pole komunikatora; z `DRPG_S7_FOG=1` faza `fog-leak` (EXP-PL-04, tylko pomiar) | nie pisze do świata, poza fazą `fog-leak`, która pisze i odkłada (kafelek, drzwi, światło; niżej); także `DRPG_BROWSER=firefox` |
| `s8-load` | 3 | krzywa wydajności przy rosnącej liczbie Remnantów, tokenów, projektów, wiadomości i okien; warunki przebiegu na każdym poziomie | sprząta po sobie (po znaczniku, niżej); bez progów; `DRPG_S8_RELOAD=1` - test sprzątania po przeładowaniu |

Proponowana kolejność pierwszego przebiegu: S7 (bez `DRPG_S7_FOG=1` nie pisze), S4, S2, S3, S5, S1a, S1b, S8, S6 (najdłuższy).

**Stan świata na starcie S1a i S1b (F3PC2-S1-STATE; linia T4, 27.11.2026).** Drugi przebieg S1a/S1b (25.11.2026) oblał
dwie kontrole FLOW przez stan świata po wcześniejszych przebiegach (rozdział 3, dzień 6, zmarli i ożywieni P1-P4,
dodatkowe żetony "P3"). Odtąd oba scenariusze na starcie czytają świat (`scenarios/lib/s1-kit.mjs` `worldState`: faza,
rozdział, dzień, Eclipse, incydent, `murderState`, zatrzymany koniec rozdziału, zmarli wśród P1-P4, nadmiarowe żetony
postaci na aktywnej scenie, okna otwarte u GM1 i GM2, pusty planer), przywracają drogami modułu, co się da
(`prepareWorld`: koniec Eclipse bez przesuwania zegara, zamknięcie incydentu, faza Daily Life zamiast Investigation,
ożywienie, usunięcie nadmiarowych żetonów P1-P4, wznowienie gry, zamknięcie okien GM-ów), czytają go ponownie i
**odmawiają z kodem 2** (powód w raporcie, `refused`), gdy się nie da: Class Trial w toku, koniec rozdziału zatrzymany w
połowie, brak aktywnej sceny z pokojami, a z `DRPG_S1_CHAPTER=<n>` także inny rozdział. Stan przed i po jest w notatkach
raportu ("world state before", "world prepared", "world state after"). S1b zachowuje stan, który zostawia S1a (incydent
na Stage 6, ofiara martwa i nieznaleziona) i startuje z niego; bez niego zakłada własny incydent. `run.mjs` z kilkoma
scenariuszami po odmowie jednego uruchamia następne i kończy kodem 2 (1, gdy coś innego nie przeszło).

**Końcowe sprawdzenie (D2-15) startuje z `drpg-qa-forge`** - świata nieuruchamianego od 24.11.2026 - albo z jego świeżej
kopii, nie z `drpg-qa-forge-2` (po przebiegach z 25.11.2026: rozdział 3, dzień 6, karty, zgony, wiadomości, żetony).
Kolejność jak wyżej; S1b zaraz po S1a, bo startuje ze stanu, który S1a zostawia.

**S8: znacznik, sprzątanie i trzeci przebieg (F3PC2-S8-CLEANUP, F3PC2-S8-CURVE; linia T4, 27.11.2026).** Każdy dokument,
który S8 tworzy, dostaje `flags.world.drpgQa` = znacznik przebiegu (`s8-<czas>`, `page-kit.mjs` `runTag`; zakres `world`,
nie modułu): żetony NPC, aktor NPC i publiczne wiadomości w danych tworzenia, ślady (`placeRemnant`), karty
(`whisperToOwner`) i wiadomości komunikatora (`sendMessengerMessage`) zaraz po utworzeniu, a to, co moduł tworzy obok
(aktor Remnantów, żeton projektu, ogłoszenie), po każdym poziomie z zapisu hooków GM1. Projekt nie jest dokumentem: ma
znacznik w nazwie. Sprzątanie szuka najpierw po znaczniku w całym świecie (każda scena, czat, aktorzy z przedmiotami,
przedmioty, dzienniki, projekty), potem po identyfikatorach; raport mówi, ile znalazł którą drogą (`byTag`,
`byIdOnly`). Liczba oznaczonych żetonów i stojących żetonów NPC i śladów S8 jest zapisana przed i po każdym poziomie.
Dokumenty ze znacznikiem innego przebiegu S8 są tylko liczone (`otherRuns`), nie usuwane.

- **Test sprzątania:** `DRPG_S8_RELOAD=1` - strona GM1 przeładowana w środku sprzątania (po pięciu usuniętych), drugie
  podejście na świeżej stronie bez zapisu hooków, kontrola "cleanup after a reload leaves nothing tagged" (`FLOW`).
  Krótko: `DRPG_S8_REMNANTS=30 DRPG_S8_TOKENS=8 DRPG_S8_PROJECTS=4 DRPG_S8_MESSAGES=30 DRPG_S8_RELOAD=1`.
- **Trzeci przebieg krzywej** (przed progami, D2-18; właściciel, D2-21): jak w nagłówku `s8-load.mjs` - na komputerze z
  kartą graficzną `DRPG_FULL_RENDER=1`, bez `DRPG_S8_RELOAD`, nic innego na pierwszym planie. Każdy poziom zapisuje
  warunki GM1 i P1 (`visibilityState`, `hasFocus()`, renderer WebGL, tryb wydajności i limit klatek Foundry,
  `DRPG_FULL_RENDER`, rozmiar i rozdzielczość płótna, `devicePixelRatio`, `hardwareConcurrency`, czas od wczytania,
  liczba otwartych stron, pamięć); pierwszy poziom po rozgrzewce (`DRPG_S8_WARMUP_MS`, 30 s bez pomiaru) i powtórzony
  po sprzątaniu ("baseline again, after the cleanup"). Notatka "curve: the conditions of every level" stoi obok krzywej.
- **32 żetony NPC "QA s8", które zniknęły między przebiegami 25.11.2026:** przeczytane 27.11.2026 - nic w
  `scripts/` nie usuwa zwykłego żetonu NPC postawionego przez GM-a na scenie z pokojami (usuwane są tylko: żetony
  śladów `isRemnant` - koniec rozdziału, reset sezonu, `removeRemnant`; żetony projektów bez projektu -
  `projects-map.mjs`; Widza i Monokubka - `spectator-dead.mjs`; upuszczenie gracza, którego zasady nie pozwalają -
  `movement.mjs` `removeDrop`, tylko żeton utworzony przez gracza; żetony na sali rozpraw - `trial-scene.mjs`; kopie
  niesionych żetonów - `call-world.mjs`; klucze nieznalezione - `case-realize.mjs`), reset sezonu (`placeCastStep` w
  `season-wipe.mjs`) tylko przesuwa żetony uczniów, a w `audit/forge` sprzątanie S8 usuwa tylko identyfikatory swojego
  przebiegu, a `table.mjs` `placeTokens` i `restore` innych scenariuszy tylko tworzą i przesuwają. Hipoteza (nie
  sprawdzona): usunęła je ręczna sonda sprzątająca z 25.11.2026 (poza repozytorium), która brała ślady sceny bez
  odróżnienia ich od innych żetonów bez właściciela; druga hipoteza: Foundry przy usunięciu aktora bazowego "QA s8 NPC"
  (żetony niepowiązane, `actorLink: false`) - zachowanie v14 nieprzeczytane w źródle. Odtąd liczby oznaczonych żetonów
  przed i po każdym poziomie i `otherRuns` na starcie pokażą, kiedy taki żeton znika.

**S7 `fog-leak` (EXP-PL-04; linia T4, 27.11.2026), tylko z `DRPG_S7_FOG=1`.** Pomiar dla decyzji właściciela, bez
werdyktu i bez zmian w `fog.mjs` i `visibility.mjs`: w każdym rozmiarze z `DRPG_SIZES` GM1 wybiera pokój, który P1 ma
w dzienniku odkryć (`discoveredFor`), a w którym nie stoi; widok P1 przesunięty nad ten pokój (tylko kamera P1,
odłożona). Potem po jednej zmianie: kafelek `icons/svg/skull.svg` (`flags.world.drpgQa`), drzwi pokoju otwarte,
zamknięte, zamknięte na klucz, wyłączone AmbientLight pokoju, jeśli jest. Przed i po każdej zmianie zrzut ekranu P1
przycięty do pokoju (`p1-<w>x<h>-fogleak-<n>-<zmiana>-before|after.png`), różnica pikseli (średnia na kanał i odsetek
pikseli z kanałem zmienionym o więcej niż 24) i ikony drzwi z `canvas.controls.doors` P1 - wszystko w notatkach. Jedna
kontrola `FLOW`: "fog-leak (EXP-PL-04): the phase ran and put everything back" (każda zmiana zmierzona w każdym
rozmiarze, kafelek usunięty po znaczniku, drzwi i światło jak były; odkładanie w `finally`). Uruchomienie:
`DRPG_S7_FOG=1 DRPG_FULL_RENDER=1 ... node audit/forge/run.mjs s7-look`.

**Ruch żetonów (FORGE-05, D2-25; linia T4, 27.11.2026).** `table.mjs` `readTable` oznacza sypialnie
(`game.drpg.allBedrooms`), a `chooseRooms` (S5) i wybór sąsiada w S6 je pomijają: sypialnia jest zamknięta dla
wszystkich poza właścicielem i posiadaczem klucza, więc ruch do niej mierzył zamek, nie ruch. `moveTokens(..., { free:
true })` (tylko strona GM-a; S5 dla ruchów GM1) zapisuje ruch z opcją ruchu v14 `movement: { [id]: { constrainOptions:
{ ignoreWalls: true } } }`. **Założenie do potwierdzenia na pierwszym przebiegu S5**: kształtu opcji nie przeczytano w
źródle v14. Szczegóły kontroli "the plan sends ..." mają `arrived` (czy żeton stanął w pokoju) i `wrote.options`
(co wysłano); v14, który opcję pomija, zatrzyma żeton na ścianie jak dotąd, a taki, który ją odrzuca, da `threw`.

Logowanie (`lib.mjs` `login`) nigdy nie wpisuje hasła; wszystkie narzędzia, także `doctor.mjs`, uruchamiają przeglądarkę przez `lib.mjs` (od 25.11.2026 `doctor.mjs` czyta `DRPG_BROWSER`).

Każde narzędzie odmawia pracy (kod 2), gdy aktywny świat nie jest tym z `DRPG_FORGE_WORLD` albo jego nazwa nie zawiera
`qa`, `copy` ani `gate`. Świat kampanii jest na tym samym koncie Forge (D2-05).

## Zmienne

| Zmienna | Znaczenie |
| --- | --- |
| `DRPG_FORGE_URL` | adres gry, np. `https://<nazwa>.forge-vtt.com` (wymagane) |
| `DRPG_FORGE_WORLD` | nazwa świata testowego, np. `DRPG-QA-Forge` (wymagane) |
| `DRPG_FORGE_USERS` | JSON z nazwami kont, domyślnie `{"gm1":"GM1","gm2":"GM2","p1":"P1","p2":"P2","p3":"P3","p4":"P4"}` |
| `DRPG_ROLES` | które konta loguje `suite.mjs`, domyślnie `gm1,p1,p2,p3` |
| `DRPG_BROWSER` | `chromium` (domyślnie) albo `firefox` |
| `DRPG_FULL_RENDER=1` | przeglądarki testowe rysują w pełnej jakości (na komputerze z kartą graficzną); bez tego najniższy tryb wydajności Foundry i 10 kl./s |
| `DRPG_FAKE_MEDIA=1` | sztuczny mikrofon i kamera, żeby głos mógł się połączyć (S5) |
| `DRPG_CHROMIUM` | inny Chromium niż pobrany przez Playwright |
| `DRPG_HEADFUL=1` | przeglądarki z oknem. Firefox bez okna na maszynie bez GPU nie dostaje WebGL i Foundry nie rysuje /join (w chmurze: Firefox z oknem pod `xvfb-run`). Na komputerze z ekranem okna pojawią się na pulpicie |
| `DRPG_SIZES` | rozmiary ekranu do zrzutów i sprawdzeń, domyślnie `1920x1080,2560x1440` (docelowe rozdzielczości stołu, D2-20); pierwszy z nich to rozmiar, w którym strona się otwiera |
| `DRPG_JOIN_MS` | ile strona /join może się ładować przy logowaniu, domyślnie 120000 ms |
| `DRPG_S7_FOG=1` | S7: faza `fog-leak` (EXP-PL-04, pomiar mgły odwiedzonego pokoju; pisze i odkłada) |
| `DRPG_S8_RELOAD=1` | S8: przeładowanie strony GM1 w środku sprzątania i kontrola "cleanup after a reload leaves nothing tagged" |
| `DRPG_S8_WARMUP_MS` | S8: rozgrzewka przed pierwszym pomiarem, domyślnie 30000 ms (bez pomiaru); poziomy: `DRPG_S8_REMNANTS`, `DRPG_S8_TOKENS`, `DRPG_S8_PROJECTS`, `DRPG_S8_MESSAGES`, `DRPG_S8_SETTLE_MS` (nagłówek `s8-load.mjs`) |
| `DRPG_S1_CHAPTER` | rozdział, w którym S1a i S1b muszą startować; inny - odmowa z kodem 2 (bez zmiennej rozdział jest tylko zapisany) |

## Na komputerze właściciela

Dlaczego tam: w chmurze nie ma karty graficznej (sześć przeglądarek z Foundry nie mieści się w czasie), a ruch głosu
LiveKit nie przejdzie przez proxy sesji w chmurze. Na komputerze jest prawdziwa sieć i GPU.

1. Zainstaluj Node.js 22 LTS (nodejs.org) i git.
2. Pobierz repozytorium i przejdź na gałąź pracy:
   ```
   git clone https://github.com/Akrobacjum/Danganronpa-RPG.git
   cd Danganronpa-RPG
   git checkout claude/dazzling-bohr-juuh4g
   ```
3. Zainstaluj zależności narzędzi i przeglądarki Playwright (z folderu `audit/harness`, żeby wersje się zgadzały):
   ```
   cd audit/harness
   npm ci
   npx playwright install chromium firefox
   cd ../..
   ```
4. Uruchom świat testowy na Forge, a świat kampanii zostaw nieuruchomiony.
5. Uruchom kontrolę stołu. W PowerShell (Windows):
   ```
   $env:DRPG_FORGE_URL="https://<nazwa>.forge-vtt.com"
   $env:DRPG_FORGE_WORLD="DRPG-QA-Forge"
   $env:DRPG_FULL_RENDER="1"
   node audit/forge/doctor.mjs
   ```
   W bash (macOS, Linux):
   ```
   DRPG_FORGE_URL=https://<nazwa>.forge-vtt.com DRPG_FORGE_WORLD=DRPG-QA-Forge DRPG_FULL_RENDER=1 node audit/forge/doctor.mjs
   ```
6. Test głosu: to samo z `DRPG_FAKE_MEDIA=1`.
7. Firefox: to samo z `DRPG_BROWSER=firefox`.

Z Claude Code: otwórz folder repozytorium w Claude Code na komputerze i poproś o uruchomienie testów według tego pliku.
Albo włącz Remote Control dla tego folderu w aplikacji Claude (ustawienia Claude Code), wtedy sesja w chmurze może
uruchamiać te polecenia na komputerze; to wymaga zgody przy każdym podłączeniu.

## Co zmierzono do tej pory

`docs/dev/v2/F3-forge-S0.md`.
