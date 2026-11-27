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
czy scenariusz sam przeszedł swoje kroki. Każdy scenariusz poza S7 pisze do świata testowego: szczegóły w nagłówku
pliku. **Przed pierwszym uruchomieniem kopia zapasowa świata testowego** - końcowe sprawdzenie (D2-15) startuje z
tego samego stanu.

| Scenariusz | Konta | Co mierzy | Uwagi |
| --- | --- | --- | --- |
| `s1a-day-murder` | 6 | Daily Life z decyzjami obu GM-ów, Eclipse, Direct Murder i decyzje D2-06, D2-08..D2-12, MURDER-01..03, EXP-PL-02, DAY-01 | część kontroli zależy od kości (nieudane otwarcie: rzadko) |
| `s1b-case-trial` | 6 | odkrycie ciała, Investigation, Class Trial, głosowanie, werdykt, koniec rozdziału (MURDER-05, EXP-GM-02..04, INV-01/02, TRIAL-01/03/06/07) | startuje ze stanu po s1a albo zakłada własny incydent; kończy w następnym rozdziale |
| `s2-second-gm` | 4 | drugi GM robi każdą pracę GM-a (CALLS-01/03, INV-01/02, TRIAL-02/04, DAY-01, EXP-GM-01, PRIM-01) | reset sezonu tylko do pytania, bez wykonania |
| `s3-disconnects` | 5 | gracz offline, odświeżenie w trakcie prośby, odświeżenie i odejście głównego GM-a, GM wychodzi w Eclipse | |
| `s4-two-gms-at-once` | 3 | dwaj GM-owie naciskają to samo naraz | |
| `s5-voice` | 6 | pokój LiveKit każdego klienta wobec planu modułu, czasy przełączenia, ponowne połączenia | wymaga `DRPG_FAKE_MEDIA=1`; pokoje bez sypialni, ruchy GM1 z pominięciem ścian (`free`, niżej) |
| `s6-soak` | 6 | 2 h zwykłej gry: pamięć, błędy, przeładowania; ruchy graczy liczone osobno: doszły / odmowa z komunikatem / bez komunikatu (FORGE-05) | `DRPG_SOAK_MINUTES`; sąsiad bez sypialni |
| `s7-look` | 2 | zrzuty najważniejszych okien w rozmiarach z `DRPG_SIZES`, mieszczenie się, pole komunikatora | nie pisze do świata; także `DRPG_BROWSER=firefox` |
| `s8-load` | 3 | krzywa wydajności przy rosnącej liczbie Remnantów, tokenów, projektów, wiadomości i okien | sprząta po sobie; bez progów |

Proponowana kolejność pierwszego przebiegu: S7 (nie pisze), S4, S2, S3, S5, S1a, S1b, S8, S6 (najdłuższy).

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
