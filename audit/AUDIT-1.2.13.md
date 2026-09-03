# Audyt Danganronpa RPG v1.2.13 - kod, flow gry i UX

**Data:** 2026-09-01 · **Stan:** `2a74643` (working tree czysty, `module.json` 1.2.13) ·
**Metoda:** audyt statyczny całego źródła (90 skryptów, `lang/en.json`,
`styles/*.css`, makra), bez uruchamiania świata. Znaleziska oznaczone
"do potwierdzenia na żywo" wymagają jednego przebiegu w sandboxie.

Poprzedni audyt: `AUDIT-1.1.88.md` (ocena 7.5-8/10). Z tamtej listy nadal otwarte
jest LIVE-001 (patrz A5).

---

## Stan realizacji (aktualizowane w trakcie prac)

Kolejność z sekcji H, wykonywana krok po kroku na gałęzi `main`, bez commitów.

| Krok | Zakres | Stan |
| --- | --- | --- |
| 1 | A1, A2, A26, A6, A7, A10, A12, `&mdash;`, pusty blok `clock.mjs`, rename w `retuneRemnant`, `PROJECT_ITEMS` | zrobione |
| 1b | LIVE-001 ledgerem (A5) - **oba** stany | zrobione |
| 2 | Formularze: A22, A23, A24, A25 | zrobione |
| 3 | Proporcja pokoi (A21) | zrobione |
| 4 | Kopia i komentarze po decyzjach (A13, A14, F1, Q1-Q14) | zrobione |
| 5 | Dieta komunikatów (E1, E3, E7) | zrobione |
| 6 | Teksty (F2, F3, F4, F5) w en.json i config.mjs | zrobione |
| 7 | Okna DMa (E6, E8, E9, E10) | zrobione |
| 8 | Skrócenie (C2, C3, A15) | zrobione; A18 (`patches.mjs`) dopisane w weryfikacji 03.09, C3 i A15 domknięte w trzeciej turze |
| 9 | Komentarze i pliki (C1, C4, C5) | zmierzone; wykonana ta część, która nie wymaga uruchomienia świata |
| 10 | CSS (C6) | zmierzone; **nie wykonywać w tej formie** - patrz niżej |

### Co się zmieniło w samym audycie

Trzy znaleziska nie przetrwały czytania kodu i są w dokumencie skorygowane:

- **A11 wycofane.** Wszystkie osiem handlerów `gm-bridge.mjs` bierze autorytet
  z `senderId` od Foundry, a `payload.userId` służy wyłącznie za adres. Kod jest
  poprawny, żadnej zmiany nie wprowadzono.
- **A22, punkt trzeci, był błędny.** Karta orzeczenia z `createItem` powstaje
  tylko dla `goalKey === "specific"`, gdzie `category` jest `null`. Żaden cel
  nie ginie.
- **A23 źle zdiagnozowane.** Zapisane w pułapce `category`/`tier` nigdy nie są
  czytane - przedmiot bierze kategorię szukającego. Realny problem jest inny:
  select kategorii w oknie podłożenia jest martwy, a `useItem` obsługuje tylko
  usables, więc wyzwalacz przedmiotowy odpali się wyłącznie u kogoś, kto szukał
  usable. To decyzja o regule, nie poprawka - czeka na Ciebie.

### Trzy decyzje Dawida z 03.09, wykonane

**1b (LIVE-001): przenosimy oba.** Tożsamości wychodzą z danych świata w całości.

- `SETTINGS.incidentCast` i `SETTINGS.blackenedLedger` są client-scoped,
  synchronizowane DM do DMa po sockecie adresowanym odbiorcą, dokładnie jak
  klucz odpowiedzi Truth Bulletów i Mastermind.
- Każdy uczestnik incydentu dostaje swoją kopię obsady osobnym, adresowanym
  komunikatem. Postronny nie dostaje nic - nawet pustej koperty.
- `murderState()` **nadal zwraca jeden scalony obiekt**, więc żaden czytelnik
  w module się nie zmienił. Zmieniło się to, co w nim znajduje klient
  postronnego: mechanika, zero nazwisk.
- `CAST_FIELDS` to linia podziału: `killerId`, `killerTurnId`, `victimId`,
  `thirdId`, `thirdSide`. Reszta - etap, tura, co zablokowane, co wydane -
  zostaje w świecie, bo obaj uczestnicy potrzebują tego na żywo co turę.
- **Znalazłem przy tym realny błąd, który sam bym wprowadził:** `movement.mjs`
  i `private-rolls.mjs` czytały ustawienie świata *bezpośrednio*, żeby uniknąć
  cyklu importów, więc po podziale dostałyby połowę bez nazwisk i przestałyby
  zamykać uczestników w pokoju. Naprawione przez `incidentParticipants()`
  w `settings.mjs` - w tym samym pliku i z tego samego powodu, dla którego
  mieszka tam `iAmTheMastermind`. Obaj czytelnicy potrzebowali tylko listy
  id, nie ról, więc ról nie dostają.
- Migracja: świat zaktualizowany w trakcie rozdziału ma nazwiska w danych
  świata. Jeden klient (`isPrimaryGm`) przenosi je raz i **zeruje kopie
  w świecie** - poprawka, która zostawia starą wartość czytelną, niczego nie
  poprawiła.
- Test regresji, który sprawdzał, że nikt nie wyjdzie z incydentu, pilnował
  mechanizmu, nie gwarancji. Przepisany tak, żeby sprawdzał obie połowy:
  że `lockedInIncident` **pyta**, i że `incidentParticipants` **odpowiada
  wszystkimi trzema**. Snapshot pakietu testów obejmuje teraz oba nowe
  magazyny, bo inaczej przebieg zostawiałby na przeglądarce obsadę incydentu,
  którego już nie ma.

**E7: zbiorczy, z wyjątkiem.** Ślady są zbierane i mówione raz - na zmianie
pory dnia albo na końcu Zaćmienia, czyli w dwóch momentach, w których stół i tak
się zatrzymuje. Wyjątek jest sednem reguły: gracz kopiujący ślad, którego żaden
DM nie edytował, to nie szum, tylko pytanie - nikt jeszcze nie zdecydował, co ten
ślad mówi, a odpowiedź musi paść, gdy gracz na niego patrzy. Taki ślad wyskakuje
z kolejki i idzie natychmiast, a digest już go nie powtarza. `markRemnantEdited`
wołane jest z dokładnie trzech okien, w których edytuje **człowiek**: zapis
dashboardu, pola karty śladu i zmiana nazwy w Give / take. Nie z `retuneRemnant`
ani `setRemnantPublic` - przez te dwa idzie sprzątanie zabójcy i rozstrzygnięcie
Observe, a żadne z nich nie jest DMem decydującym, co ślad znaczy.

**A23: tak, tylko dla szukającego usable.** Czyli obecna reguła jest tą, której
chcemy. Zniknął więc martwy select kategorii, `plantItem` nie zapisuje już
nieczytanych `category`/`tier`, a okno mówi DMowi, dlaczego podłożony przedmiot
staje się pułapką tylko dla kogoś, kto szukał usable - żeby nikt nie wydał
projektu na pułapkę, która nie może wypalić.

### Poza planem: przebudowa panelu i huba przedmiotów (Dawid, 03.09)

Zlecone w trakcie kroku 8, nie ma tego w sekcji H.

**Panel DMa.** Sekcja "Right now" to teraz cztery kafelki w kolejności:
Players, Projects, Sound, Killing Game Rules. "Give / take items" zniknęło -
jest jednym przyciskiem **Items** w stopce okna Players (Dawid, 03.09, po
krótkim epizodzie z przyciskiem na każdym wierszu), a drugie drzwi do tego
samego okna były zbędne. "Player status" przemianowane na **Players**, bo
przestało być read-outem w chwili, gdy dostało przyciski Kill i Invite
w wierszach. "Edit campaign" zjechało na początek Between sessions: nazwa
kampanii i skok zegara to przygotowanie, nie akcja w scenie. Sprawdzone, że
`nextStep` nadal znajduje `jump` po przenosinach - lookup spłaszcza wszystkie
sekcje, nie tylko rozwinięte.

**Hub Give / take: jedno okno zamiast menu.** Było pięć przycisków, z których
każdy otwierał coś innego, a jedyna rzecz, którą DM chce zobaczyć przed
naciśnięciem któregokolwiek - co student faktycznie ma - siedziała za szóstym.
Teraz: wybór studenta, pod nim **ekwipunek i zawartość skrytki**, a pod tym dwa
taby, **Give** i **Take**, ze stopką idącą za zakładką (`wirePanelTabs`, ten sam
mechanizm co w Item Tables i Sound). Pod spodem nic się nie zmieniło -
`giveItemDialog`, `giveTruthBulletDialog`, `giveKeyDialog` i `takeItemDialog`
to te same okna.

- "Look inside the stashes" usunięte: schowany przedmiot to zwykły przedmiot
  z flagą na arkuszu właściciela, więc lista, którą hub i tak przechodzi, już go
  zawiera. `openVaultInspector` zostaje w API dla DMa, który chce wszystkie
  skrytki naraz.
- "Give a room key" przeniesione do taba Give.
- **"Take an item away" już zabierało Truth Bullety** - jego picker chodzi po
  wszystkich kategoriach i ma komentarz o tym, że bullet ma `tier: null`. Nowy
  przycisk to więc **filtr na tej samej ścieżce**
  (`takeItemDialog(actor, { only: "truthBullet" })`), nie drugi kod; okno zmienia
  tytuł i komunikat "nic nie ma", żeby DM nie czytał złego nagłówka.
- **"Take a room key away"** (03.09, druga tura): ten sam filtr
  (`only: "bedroomKey"`). Klucz do własnej sypialni nie jest oferowany -
  patrz "Weryfikacja realizacji" niżej.

**"Give existing" - znaleziony i naprawiony błąd (opis od Dawida).** Był to
**jeden select z wynikami wszystkich tabel naraz**, gdzie tabela służyła tylko
za etykietę `<optgroup>`. Przy zainstalowanym domyślnym zestawie to kilkaset
wierszy, a DM, który wiedział, z której tabeli chce brać, i tak szukał jednej
linii w liście wszystkiego. Druga połowa: kategoria i tier szły za
**przedmiotem**, czyli za złym końcem - to tabela wie, jaka jest kategoria
i tier.

Teraz dwa selecty: najpierw tabela, potem co w niej jest. Zmiana tabeli
przebudowuje listę przedmiotów i przestawia kategorię oraz tier na to, czym ta
tabela jest; oba zostają edytowalne, bo pula pokojowa nie niesie własnej
kategorii. Opcje przedmiotów budowane są w JS przy zmianie, a nie renderowane
ukryte - `<select>` z ukrytymi opcjami to kontrolka zwracająca wartości, których
człowiek nie widzi.

**Dwie rzeczy warte zapisania na przyszłość.** Po pierwsze, `lang/en.json`
zepsuł się na chwilę przez wstawkę bez przecinka; po tym powstał wstawiacz
kluczy przechodzący przez `json` zamiast sklejania tekstu, z weryfikacją po
zapisie. Po drugie, między usunięciem przycisku "Give a room key" a daniem mu
nowego miejsca klucz był **nieosiągalny** - kolejność takich dwóch ruchów ma
znaczenie i lepiej robić je w jednym kroku.

### Weryfikacja realizacji (03.09, po zamknięciu H)

Każdy punkt sekcji H sprawdzony od nowa, przez czytanie kodu i te same
narzędzia co po każdym kroku (klucze, bilans nawiasów, importy, i18n, pola
formularzy, strażnik socketu, LIVE-001, długie myślniki). Wynik: **kroki 1-10
trzymają się**, z pięcioma poprawkami i czterema rzeczami, które zostały
zapisane zamiast zrobione.

**Poprawione w tej turze:**

- **Q5, drugie zdanie.** Komentarz przy Motive był poprawiony ("SIX, and it
  began at nine"), ale sąsiedni komentarz przy New Rule wciąż nazywał Motive
  "the other nine-point Call it now ties". Zdanie było prawdą w chwili D10f
  i przestało nią być w E24; teraz mówi obie połowy.
- **A3 nie było w żadnym kroku H.** Werdykt audytu mówił "do wydania po
  A1-A4", a krok 1 wymieniał A1, A2 i dalsze - A3 i A4 wypadły z listy.
  A3 poprawione jedną linią: `stow()` liczy zajętość skrytki przez
  `stashItemsIn(actor, room)`, czyli tym samym fallbackiem "bez stempla =
  skrytka główna", którym lista już ją pokazywała. A4 zostaje (niżej).
- **Trzy martwe klucze i18n**, dwa moje: `Items.manageNote` i `Items.title`
  zostały bez czytelnika po przebudowie huba, `Roster: {}` był na liście A15
  i przetrwał krok 8. Usunięte; `Items.rowButton` przemianowane na
  `hubButton`, bo przestało być przyciskiem wiersza.
- **E1: bilans to 242 `warn`, nie 241** - policzone ponownie.
- **A18 `patches.mjs` był w kroku 8 i nie został zrobiony ani odnotowany.**
  Dopisany jako rejestr siedmiu nadpisań z `diagnosePatches()` na
  `game.drpg`, ładowany na żądanie (nie jest w grafie startowym, sprawdzone).
  Każdy wiersz mówi, co nadpisuje, po co, kiedy jest zainstalowane, i ma
  `probe()`: czy cel nadal istnieje i czy siedzi tam nasza funkcja. Dwa
  jednolinijkowe ślady, żeby dało się to rozpoznać: nazwa `drpgClose` na
  wrapperze w `motion.mjs` i getter `refreshStateParked()` w
  `iso-shield.mjs`. Pola `since` nie ma - dat nie znam i nie zmyślam.

**Trzecia tura (03.09, "Wykonajmy pozostałe rzeczy") - zrobione:**

- **A15, reszta.** Trzy aliasy usunięte: `manageRestRooms` z API razem
  z `openRestRoomsDialog` w `rest.mjs` (Room Setup ma te dwie kolumny), alias
  `openMusicDialog` w `music.mjs`, `trialQueue` w `trial-floor.mjs` i w API.
  Makra `05-region-discord.js` i `06-voice-spike.js` skasowane. Żadne makro
  w repozytorium ani test ich nie wołało.
- **A4 - zawężone do jednego rzutu.** Przeczytałem `build/daggerheart.js`
  (2.6.5): `buildConfigure` odpala `daggerheart.postDualityRollConfiguration`
  z **instancją rzutu** jako pierwszym argumentem, a `buildEvaluate` zaraz po
  tym woła `roll.evaluate()`. Podmiana generatora siedzi więc teraz na własnym
  `evaluate` **tego** rzutu (własność instancji nad prototypem, jak `render`
  w `sheet.mjs`): zakładana przed rzutem, zdejmowana w `finally` po nim. Rzut
  porzucony między konfiguracją a wykonaniem zabiera wrapper ze sobą; żaden
  inny rzut na kliencie nie zobaczy załadowanej kości. Odpadły dwa hooki
  zwalniające (`postRollDuality`, `createChatMessage`) i zmienna `original`.
  "u = 0 to górna ścianka" bez zmian. **Do sprawdzenia na żywo:** jeden Free
  Critical w sandboxie.
- **F3, `Eclipse.announce.*`.** Trzecie zdanie wycięte z trzech kluczy;
  reguła "tylko Direct Murder wydaje akcję" mieszka teraz
  w `Hud.eclipseRunningTooltip` (77 znaków, w limicie E3), obok istniejących
  `Eclipse.actionsLocked` (odmowa przy próbie) i `actionsMurderOnly` (panel
  statusu). Dziewięć z dziewięciu wierszy F3.
- **C3, reszta tabeli.** Trzy czytelniki zegara - `getClock`, `isEclipse`,
  `incomingTimeOfDay` - mieszkają w `settings.mjs`, liściu, do którego oba
  końce każdego z tych cykli sięgają; `clock.mjs` i `eclipse.mjs`
  re-eksportują je pod starymi nazwami, więc żaden importer się nie zmienił.
  Zniknęły kopie w `overflow.mjs`, `fog.mjs`, `visibility.mjs`, `hud.mjs`
  i inline w `movement.mjs`. Dalej: `remaining` w `hud.mjs` importowane
  z `character.mjs`; `locate` w `cleanup.mjs` zastąpione przez `locateActor`
  z `movement.mjs` (ten sam kształt, o jedną linię pełniejszy); `refOf`
  eksportowane z `murder.mjs`; `regionBounds` w `fog.mjs` zastąpione przez
  `boundsOf` z `movement.mjs` (nadzbiór: placeable, potem polygony, potem
  surowe kształty); `regionsByName` z `vault.mjs` czyta też `rest.mjs` - to
  jedyna zmiana zachowania w tej turze: odpoczynek liczy pokoje po
  `workingScene()`, nie po `canvas.scene`, czyli tak jak reszta modułu.
  Sprawdzone skanem całego grafu statycznego: **zero cykli**, tyle samo co
  w HEAD. Trzy wiersze audytu okazały się nieduplikatami: `report(title,
  lines)` istnieje już tylko w `diagnostics.mjs`; `spendStress` w `murder.mjs`
  ma gałąź "płacone krwią", której wersja z `cleanup.mjs` nie ma;
  `restoreStress` jest tylko w `cleanup.mjs`. **Trzy systemy zakładek
  zostają** - to przebudowa okien, której nie sprawdzę bez przeglądarki.

**Sandbox (03.09, po trzeciej turze) - świat `drpg-qa-f1`, dwa konta.**
Foundry uruchomione headless z binarki Electron, DM na `localhost:30099`,
Gracz A na `127.0.0.1:30099`. Najpierw składnia: `vm.SourceTextModule` na
wszystkich 91 skryptach - czysto.

- **Znaleziony i naprawiony błąd z 1b, którego żadne sito statyczne nie
  widziało.** `registerIncidentCastSync` robił migrację i prośby o obsadę od
  razu przy rejestracji - a `registerMurder` biegnie z `init`, gdy `game.user`
  jest jeszcze `null`. Wzorzec był wzięty z Mastermind, którego rejestracja
  biegnie z `ready`. Wyjątek ucinał resztę `registerMurder`: **brak
  detekcji trzeciej strony, odkrycia ciała i wyczerpania ofiary na każdym
  kliencie**, z jedną linią w konsoli. Prośby i migracja siedzą teraz
  w `Hooks.once("ready")`; po przeładowaniu konsola czysta, dziewięć
  słuchaczy `updateToken` na miejscu.
- **Pakiet regresji: 117 przeszło, 0 nie (drugi przebieg, po obu poprawkach; pierwszy 116/1).** Jedyny nieudany test w pierwszym przebiegu
  ("the betrayal outlives the incident") czytał `writeState` w oknie 1200
  znaków, a po 1b funkcja urosła (komentarze liczą się do długości, bo
  `stripComments` zachowuje ich rozmiar) - uzbrajanie okna zdrady nadal jest
  w jedynym pisarzu stanu. Test czyta teraz całą funkcję do jej klamry.
- **LIVE-001 na dwóch kontach.** Incydent Player B → QA Witness: DM widzi
  nazwiska, ustawienie świata niesie 14 kluczy mechaniki i **zero nazwisk**,
  klient Gracza A (postronny) ma `incidentCast = {}`, `murderState()` bez
  nazwisk, `incidentParticipants() = []`. Incydent Player A → Player B:
  klient Gracza A dostaje po sockecie obsadę z oboma id, a po `endMurder`
  obsada u niego znika.
- **A4 na żywo.** Uzbrojony rzut: wrapper na instancji, pierwsza kość 12,
  druga uczciwa (10), generator przywrócony natychmiast po `evaluate`; kolejny
  rzut nie ma wrappera i wypada losowo (3, 6).
- **Q9 na żywo.** Na 14.365 ślad to `token.ruler` z polem `visible`; trzy
  pozostałe nazwy nie istnieją na tokenie. Martwe gałęzie usunięte, komentarz
  SPIKE NEEDED zastąpiony potwierdzeniem. Czego sandbox nie pokaże: śladu
  z perspektywy drugiego gracza podczas prawdziwego przeciągania - narzędzie
  nie przeciąga płótna PIXI. Jeden ruch przy stole.
- **Panel i hub.** Kafelki w kolejności Players, Projects, Sound, Killing
  game rules; Edit campaign w Between sessions; okno Players ma stopkę Apply
  / Items / Close (Enter na Apply) i tylko Kill / Invite w wierszach. Items
  otwiera hub z selectem studenta, ekwipunkiem i skrytką, tabami Give (trzy
  przyciski) i Take away (trzy przyciski, tamte ukryte i wyłączone). "Take
  a room key away": Gracz A ma tylko klucz do własnej sypialni, więc okno
  mówi "holds no key to anybody else's room". "Give existing": zmiana tabeli
  przebudowała listę (Toilet paper → Rope) i przestawiła tier 0 → 1. Anuluj
  wraca do huba, Close huba wraca do Players.
- **`keepLive` na Monocub:** po `actor.update` region przebudowany w miejscu
  po 235 ms, słuchacz `updateActor` dochodzi przy otwarciu i schodzi przy
  zamknięciu. Mastermind idzie tą samą ścieżką (region istnieje tylko przy
  wybranym Mastermindzie; w świecie QA nikt nie jest wybrany).
- **`diagnosePatches()`** na żywo: siedem celów obecnych, pięć rozpoznanych
  jako nasze, dwa `null` zgodnie z projektem.

**Pułapka środowiska, żeby nikt nie gonił ducha:** karta w ukrytym panelu
ma timery ograniczone (a po pięciu minutach do jednego na minutę), więc
pakiet trwa cztery minuty zamiast jednej, a `setTimeout` w sondzie może
przespać przebudowę `keepLive` - mierzyć pętlą, nie jednym czekaniem.

**Czwarta tura (03.09, "Kontynuuj to co zostało i wydanie") - znaleziska
spoza H:**

- **A16** - `hasGm()` rozdzielone: `gmOnline()` to samo pytanie, `hasGm()`
  to odmowa z toastem, którą wszystkie prośby mostu nadal wołają.
- **A17** - " · Hope" / " · Despair" z `gm-bridge.mjs` i `.replace("{count}")`
  z `explain.mjs` idą przez i18n. Raporty diagnostyczne po angielsku
  w kodzie zostają - to konsola.
- **A19** - dwa `giveItemDialog` to teraz `gmGiveItemDialog` (DM daje)
  i `handOverDialog` (gracz przekazuje); publiczna nazwa `game.drpg.giveItemDialog`
  bez zmian, żeby nie łamać makr.
- **E4** - podsumowanie pory dnia to karta w stosie popupów (`sticky`), nie
  modal `DialogV2.prompt` na starcie każdego Zaćmienia. Klasa
  `.drpg-summary-dialog` została w 25 listach selektorów CSS jako martwy
  token - do zdjęcia w przebiegu CSS (C6), nie tutaj.
- **E11** - karta orzeczenia "szukam konkretnie" mówi, że Create an item
  zostawia ją otwartą.
- **D2** - `usableKindFor` i `classifyEntryName` czytają jeden indeks nazw
  budowany przy pierwszym pytaniu i zrzucany na sześciu hookach tabel;
  na żywo: 0,7 ms na zbudowanie, 0 ms na pytanie.
- **D6** - `markThreadRead` pisze tylko, gdy w wątku jest coś nieprzeczytanego;
  na żywo dwa wywołania to jeden zapis.
- **C3, zakładki** - Room Setup i Investigation Dashboard mają jedno
  okablowanie (`wireDashboardTabs` w utils), zamiast dwóch kopii pętli.
  Dwa mechanizmy zakładek zostają z powodu: to okna tabelaryczne mierzone
  przez `fitWindowToTabs` po `display`, a `panelTabs` to okna formularzowe
  ze stopką idącą za zakładką. `keepLive` zna oba.
- **E2 - nie zrobione, celowo.** Okno wariantu z briefingiem jest jedynym
  potwierdzeniem akcji: zablokowany dialog rzutu sam się wysyła (`ce3ace9`),
  więc "prosto do rzutu" znaczy "bez potwierdzenia". Tylko Move ma osobny
  briefing; reszta niesie go w swoim oknie.
- **E5 - już zgodne.** Każde pozostałe "Remnant" w tekstach to nazwa typu
  (Key, Prep, Tamper, Faint, Final Truth) albo narzędzie DMa; jedyne
  ostrzeżenie o wzmocnionym śladzie idzie do DMa.
- **E12 - nie zrobione, z reguły E1.** Toast "tylko DM" to odmowa, a toast
  jest od odmów; wyciszanie 38 miejsc odebrałoby jedyną odpowiedź na wołanie
  z makra.
- **D4, D5 - zmierzone, bez zmian.** `clearSystemConditions` to filtr
  w pamięci bez zapisu, gdy nic nie znajdzie; `YIELD_MS` dotyczy tylko
  kluczy z `yieldsTo` i jest strojone uchem (E17).

Sandbox po turze: 117 przeszło, 0 nie. Konsola czysta poza jednym błędem rdzenia Foundry
(zakładka Placeables na ukrytym panelu). Na żywo: zakładki Room Setup
i Investigation przełączają się, karta podsumowania wstaje jako `sticky`
bez modalu, `game.drpg.giveItemDialog` nadal jest funkcją, a usunięte aliasy
są `undefined`.

**Poza H, domknięte w czwartej turze** (wyżej). D1 zamknięte przez A10 (cache
ledgeru), D3 przez E7, D7 to C4.

**Dwie zmiany od Dawida z tej tury:**

- **Take a room key away.** Give miał drzwi do klucza, Take nie - a "Take an
  item away" listowało klucze tylko wśród wszystkiego. Trzeci przycisk taba
  Take to ten sam filtr co dla Truth Bulletów (`only: "bedroomKey"`), z własnym
  tytułem i własnym "nic nie ma". Klucz do **własnej** sypialni nie jest
  oferowany w żadnym z tych okien: właściciel go nie potrzebuje
  (`mayEnterBedroom`), a `reconcileBedroomKeys` oddałby go przy następnym
  ładowaniu - zabranie, które samo się cofa, to nie jest opcja.
- **Jeden przycisk Items w stopce Players** zamiast przycisku na każdym
  wierszu. Hub i tak pyta o studenta u siebie, więc szesnaście drzwi do tego
  samego pokoju pytało o to samo dwa razy. Przycisk bez callbacku zwraca swoją
  nazwę; gałąź pod oknem otwiera hub bez wybranej osoby i wraca do tabeli,
  tak jak Kill w wierszu (E6, D-F5-2). Enter nadal trafia w Apply - stopka
  zaczyna się od niego.

---

## 0. Werdykt

**Silnik reguł: bardzo dobry. Warstwa kodu i komunikatów: przeciążona.**

Moduł robi rzeczy, których mało który moduł Foundry próbuje: klucz odpowiedzi
trzymany poza światem (Truth Bullety, Remnanty, Mastermind), każdy socket
sprawdza `senderId`, migracje są idempotentne i mierzą, okna GM odświeżają się
na żywo, jest własny pakiet regresji. To wszystko działa i jest przemyślane.

Ceną jest objętość. 82 tysiące linii, z czego 41% to komentarze, i to nie
komentarze "dlaczego", tylko kronika: kto, kiedy, co było wcześniej, numer
pułapki. Do tego 546 dynamicznych importów, 5 plików powyżej 3.5 tysiąca linii,
te same funkcje pomocnicze pisane po dwa i trzy razy, oraz 6.6 tysiąca linii
diagnostyki i testów ładowanych do produkcji przy każdym starcie.

Po stronie UX moduł mówi za dużo naraz. Jedno zdarzenie dla gracza to często
karta w chacie, popup i toast; dla DMa dochodzi szept, dźwięk i wpis w wątku.
Kafelki panelu zamykają i otwierają okno przy każdym kliknięciu. Dwadzieścia
trzy teksty mają ponad 220 znaków, jeden ma tysiąc. Cztery podpowiedzi ustawień
opisują zachowanie, którego moduł już nie ma, a cztery formularze DMa oferują
listy kategorii sprzed rozdzielenia usables na Healing i Sanity Relief
(A21-A25, w tym dwa znaleziska Dawida).

| Obszar | Ocena | Jednym zdaniem |
| --- | --- | --- |
| Poprawność reguł | 8/10 | Kilka realnych błędów (A1-A4), reszta to niespójności komentarz/kod. |
| Bezpieczeństwo danych | 8/10 | Bardzo dobrze, jedno świadome ryzyko (A5). |
| Czytelność kodu | 5/10 | Kronika zamiast dokumentacji, duplikaty, pliki-giganty. |
| Wydajność | 7/10 | Dwa miejsca kwadratowe (D1, D2), reszta drobiazgi. |
| Flow gracza | 7/10 | Logika dobra, komunikacja potrójna, teksty za długie. |
| Flow DMa | 6/10 | Wszystko jest, ale za wieloma drzwiami, z migotaniem okien i z formularzami, które nie nadążyły za regułami. |
| **Razem** | **7/10** | Do wydania po A1-A4; do utrzymania po sekcjach C i E. |

### Liczby

| Miara | Wartość |
| --- | --- |
| Skrypty / linie | 90 / 81 745 (bez testów 76 349) |
| Linie komentarzy | 31 619 (41%) |
| Największe pliki | fog 5316, tests 5396, action-rolls 4390, config 3955, sheet 3919, murder 3533 |
| `await import()` | 546 (632 z `.then`) |
| `ui.notifications.*` | 339 wywołań |
| `DialogV2.wait/confirm/prompt` + `tableDialog` | 99 + 14 |
| Szepty / ogłoszenia | 83 `whisperToOwner`, 46 `whisperToGms`, 38 `announce` |
| Lokalne `const esc = ...` | 46 kopii w 25 plikach |
| CSS | 14 778 linii, 682 `!important`, 141 sekcji, 200 tokenów |
| en.json | 2745 linii, 2216 kluczy, 23 teksty > 220 znaków, 3 klucze użyte a niezdefiniowane, ~11 niewykorzystanych |

---

## A. Błędy i miejsca wrażliwe

Priorytet: **P1** psuje regułę lub bezpieczeństwo, **P2** działa źle w
konkretnej sytuacji, **P3** brud, który kiedyś zaboli.

### A1 · P1 · Safeword nigdy nie gra dźwięku - `scripts/safeword.mjs:83-96`

Literał obiektu w `announce({...})` ma **dwa klucze `flags`** (linie 86 i 90).
W ES2015+ drugi nadpisuje pierwszy bez błędu, więc flaga `sfx: { key:
"safeword", gm: true }` znika i na kartę trafia tylko `safeword: true`. Jedyne
zdarzenie, które celowo ignoruje suwak głośności, jest nieme. Nic innego w
module nie odtwarza tego klucza (`grep "safeword"` w sfx.mjs to tylko wyjątek
od wariacji).

**Naprawa:** jeden obiekt `flags: { [MODULE_ID]: { sfx: {...}, safeword: true,
popupKind: "none" } }`. Warto dołożyć kryterium do tieru 0 testów: "żaden literał
nie ma dwóch takich samych kluczy" (ESLint `no-dupe-keys` znalazłby to od razu).

### A2 · P1 · Darkness z Overflow nie ogranicza przejść w Zaćmieniu - `eclipse.mjs:677`, `movement.mjs:213`

`overflowCrossings()` obniża limit przejść (np. 2 do 1), a `movesLeft()` /
`eclipseAllowance()` to honorują. Ale:

- `movement.mjs:213` odmawia przejścia dopiero przy `used >= ECLIPSE_MOVES`
  (stała 2), więc drugie przejście pod Darkness **przechodzi**;
- `eclipse.mjs:677` szepcze graczowi `left: ECLIPSE_MOVES - used`, więc HUD i
  karta mówią "1 zostało", a reguła mówi "0".

Efekt: debuff, który gracz widzi na karcie Overflow, w praktyce nie działa na
ruch. Oba miejsca powinny czytać `eclipseAllowance()` (jedno źródło).

### A3 · P2 · Stara skrytka nie liczy się do limitu - `vault.mjs:687` - **poprawione 03.09**

Nie było w żadnym kroku H (patrz "Weryfikacja realizacji"). `stow()` liczy
teraz przez `stashItemsIn(actor, room)`.

`stow()` liczy zajętość przez `stashRoom === room`, a przedmioty schowane przed
E11 nie mają tej flagi (co sam komentarz przy `ITEM_FLAGS.stashRoom` nazywa
"unmarked = primary"). `stashItemsIn()` stosuje ten fallback, `stow()` nie.
Skrytka z czasów przed E11 pokazuje pełną listę, ale przyjmuje kolejne rzeczy
ponad `VAULT_LIMIT`.

### A4 · P2 · `forced-roll.mjs` podmienia globalny generator liczb - `forced-roll.mjs:82-98` - **zawężone do jednego rzutu, 03.09**

Hook konfiguracji Daggerheart 2.6.5 niesie instancję rzutu, więc podmiana
siedzi na jej własnym `evaluate` i schodzi w `finally` - patrz "Weryfikacja
realizacji", trzecia tura.

`CONFIG.Dice.randomUniform` jest nadpisywany na czas jednego rzutu i
przywracany po nim. Każdy inny rzut wykonany na tym kliencie w tym oknie
(makro, Dice So Nice, drugi aktor tego samego użytkownika, `reroll`) zje
wymuszoną sekwencję. Bezpieczniej: przekazać wartości do własnej instancji
`Roll` (`roll.evaluate` z `minimize`/własnym `DiceTerm`), nie przez globalny
hak.

### A5 · P1 (znane) · `murderState` w ustawieniu świata niesie `killerId` - LIVE-001

Poprzedni audyt: tożsamość zabójcy w trakcie incydentu jest czytelna z konsoli
gracza. `fromIncident` na tokenie zostało świadomie zaakceptowane (D11), ale
`killerId` w `murderState` nie ma takiego wpisu decyzji. **Pytanie Q16.**

### A6 · P2 · Key Remnant z karty orzeczenia ląduje na scenie, na którą patrzy DM - `investigation.mjs` `createKeyRemnant`

`createKeyRemnant()` bierze `canvas.scene`. Kartę "Create a Key Remnant here"
DM klika zwykle z innej sceny niż gracz (sam moduł wielokrotnie to zaznacza
przy `locateActor`). Wynik: "There is no region called X" albo ślad na złej
mapie. Trzeba przekazać `sceneId` z karty (jest w `pending` Observe).

### A7 · P2 · Wynik rzutu rozpoznawany po tekście - `private-rolls.mjs:312-318`

`rollOutcomeOf()` maluje kartę po regexie `critical|fear|despair|hope` na
`flavor + content`. Karta z orzeczeniem "No Hope left" albo komentarzem
"critical mistake" dostaje kolor, którego nie zasłużyła. Powinno czytać
`message.rolls[0]` (Daggerheart trzyma `hope`/`fear` w `DualityRoll`), tak jak
robi to `action-rolls.mjs` w `readDuality`.

### A8 · P2 · `retuneRemnant` zapisuje pasmo widoczności do publicznej nazwy tokenu - `remnants.mjs`

Blok "rename by visibility label" własnym komentarzem przyznaje, że dla
każdego śladu od czasu ledgeru jest no-op. Dla tokenu sprzed migracji (nazwa
zaczyna się od "Obvious ...") zapisuje słowo pasma z powrotem do `token.name`,
czyli wycieka to, co `migrateRemnants` neutralizuje. Do usunięcia. **Pytanie Q13.**

### A9 · P2 · `hideMovementTrail` nigdy nie potwierdzone na żywo - `visibility.mjs:324`

Cztery zgadywane nazwy właściwości (`ruler`, `dragRuler`, `_ruler`,
`movementRuler`) i komentarz "SPIKE NEEDED, NOT YET CONFIRMED LIVE". Jeśli
żadna nie trafia, w Zaćmieniu ślad przeciągania tokenu pokazuje innym, dokąd
kto poszedł. Do sprawdzenia na v14.365 w jednym przebiegu. **Pytanie Q9.**

### A10 · P2 · Ledger Truth Bulletów nie ma cache - `truth-bullets.mjs` `readLedger`

`secretOf()` parsuje ustawienie klienckie przy każdym wywołaniu. To dokładnie
problem zmierzony w E17 dla Remnantów (0.86 ms na odczyt, 27 ms na pokój) i
tam naprawiony przez `ledgerCache`. Dashboard śledztwa woła `secretOf` na
każdy Bullet każdego ucznia przy każdej przebudowie `keepLive` (`watch: {
actors: true }`, czyli przy każdej zmianie przedmiotu na dowolnym aktorze).
Patrz D1.

### A11 · WYCOFANE (2026-09-02) - `gm-bridge.mjs` czyta nadawcę poprawnie

Znalezisko było błędem audytu, wycofane przy realizacji kroku 1 po przeczytaniu
wszystkich ośmiu handlerów socketu w pliku.

Grep pokazał `payload.userId !== game.user.id` i wyciągnąłem z tego zły wniosek.
W rzeczywistości te dwie linie zawsze chodzą w parze i odpowiadają na dwa różne
pytania:

```js
if (payload.userId !== game.user.id) return;   // adres: czy to do MNIE?
if (!game.users.get(senderId)?.isGM) return;   // uprawnienie: czy nadał to DM?
```

Tożsamość nadawcy jest brana wyłącznie z `senderId`, czyli z argumentu Foundry,
którego nadawca nie może podrobić. Sprawdzone: `onGmReady`, `onAck`,
`onRulingResult`, `onHopeCallResult`, `onObserveTargetResult`,
`onCleanupTracesResult`, `onSabotageResult` (przez wspólny `replyForMe`) oraz
`onOpeningAsk` i `onOpeningCancel` (własną parą linii). `onSocket` ma nad tym
komentarz opisujący nieudaną wcześniejszą próbę nadpisywania `payload.userId`,
która psuła każde oczekiwanie na odpowiedź.

To jest ten sam wzorzec, co w `voice-client.mjs`. Nic tu nie wymaga zmiany.

### A12 · P2 · `refreshTableCopy` i `resealSecretProjects` uruchamiane przez każdego DMa naraz

Komentarz przy `refreshTableCopy` mówi wprost "runs at ready on every GM
client". Dwóch DMów = dwa równoległe `table.update` na tych samych tabelach.
Migracje (`migrate.mjs`) słusznie idą przez `isPrimaryGm()`; te dwa przebiegi
powinny tak samo.

### A13 · P2 · Podpowiedzi ustawień opisują stare zachowanie - `lang/en.json`

| Klucz | Mówi | Kod robi |
| --- | --- | --- |
| `Settings.lockPlayerResources.hint` | "Health and Sanity stay editable: players mark their own damage" | `resource-guard.mjs` blokuje oba od 1.0.1 |
| `Settings.enforceAnonymity.hint` | "Holds default ownership at None" | `anonymity.mjs` ustawia OBSERVER i cenzuruje arkusz |
| `Settings.despairFromRolls.hint` | "Divide the students up from the gear on the Despair bar" | zębatka zniknęła; to zakładka Despair Flow w panelu |
| `Settings.musicEnabled.hint` | "GM panel → Right now → Music by state" | kafelek nazywa się "Sound", zakładka "Music" |
| `Anonymity.forcedOnCreate` | "set to None" | nieużywany klucz, i tak nieprawdziwy |

To pierwsza rzecz, którą DM czyta w Configure Settings. **Pytania Q10, Q11.**

### A14 · P2 · Teksty o śmierci mówią o zniszczeniu ekwipunku, kod go zostawia

`Chapter.deathNote`: "Everything they carried is destroyed, Truth Bullets
included." `Chapter.revived`: "Their destroyed inventory does not come back."
`Chapter.keepItems`: "Keep their inventory (not a killing-game death)".
Nagłówek, komentarz `reviveCharacter` i JSDoc `killCharacter` (`chapter.mjs:71`,
"D1's it all vanishes") mówią to samo. Kod jest jednoznaczny:
`killCharacter` (`chapter.mjs:85-100`, komentarz "Dawid, 27.08") usuwa **tylko
Truth Bullety**, przedmioty zostają na ciele, `itemsGone` liczy tylko kule,
a checkbox `keepItems` chroni dziś wyłącznie kule. `handover.mjs` ma `lootBody`,
które ma sens tylko wtedy, gdy przedmioty zostają. Pięć tekstów i dwa
komentarze do poprawy. **Pytanie Q3** (już tylko o brzmienie, nie o regułę).

### A15 · P3 · Martwy kod i identyczne gałęzie

- `clock.mjs:110` pusty `if (next.session > before.session) { }` - tylko komentarz.
- `projects.mjs:777` `current: up ? Math.min(current, target) : Math.min(current, target)`.
- `tables.mjs` `PROJECT_ITEMS` - trzy reguły przewodnika "NOT WIRED UP, KEPT ON PURPOSE". **Pytanie Q12.**
- `rest.mjs` `openRestRoomsDialog` - wrapper otwierający Room Setup; `music.mjs` `openMusicDialog`; `trial-floor.mjs` `trialQueue` - trzy aliasy "kept for macros".
- `macros/05-region-discord.js`, `macros/06-voice-spike.js` - oba oznaczone jako historyczne/nieuruchamialne.
- Niewykorzystane klucze i18n: `Anonymity.forcedOnCreate`, `Anonymity.notYours`, `Music.tabPlay`, `Music.tabPlaylists`, `Music.title`, `Project.gmCanAdjust`, `Tables.tabEdit`, `Tables.tierTarget`, `Roster: {}`; do sprawdzenia `Sheet.groupWeapons/groupTools/groupCleaners` (możliwe użycie dynamiczne).
- `diagnostics.mjs` `fileSizes` ma na sztywno listę 12 plików, podczas gdy `tests.mjs` słusznie crawluje z `module.mjs`.

**Stan 03.09:** pusty blok, ternary, `PROJECT_ITEMS`, klucze i18n (z `Roster`
włącznie, usuniętym w weryfikacji) i `fileSizes` - zrobione. Trzy aliasy
i dwa makra - **usunięte w trzeciej turze** (patrz "Weryfikacja realizacji").

### A16 · P3 · `hasGm()` łączy pytanie ze skutkiem ubocznym - `gm-bridge.mjs:1285`

Każde wywołanie bez aktywnego DMa rzuca toast. Kto zapyta "czy jest DM", żeby
przyciemnić kafelek, dostanie toast przy każdym renderze.

### A17 · P3 · Teksty poza i18n

`gm-bridge.mjs:1839` literały `" · Hope"` / `" · Despair"`; `explain.mjs:211`
`.replace("{count}", ...)` zamiast `game.i18n.format`; `diagnostics.mjs` i
`voice.mjs` całe raporty po angielsku w kodzie (akceptowalne dla konsoli, ale
`report()` wysyła je też do chatu).

### A18 · P3 · Globalne monkey-patche (siedem) - **rejestr dopisany 03.09**

`scripts/patches.mjs`: tabela `PATCHES` i `diagnosePatches()` na `game.drpg`,
ładowane na żądanie. Bez pola `since` - patrz "Weryfikacja realizacji".

| Plik | Co nadpisuje | Ryzyko |
| --- | --- | --- |
| `critical.mjs:110` | `DualityRoll.addDualityResourceUpdates` | aktualizacja systemu zmienia sygnaturę |
| `forced-roll.mjs:82` | `CONFIG.Dice.randomUniform` | A4 |
| `no-scrolling-text.mjs` | `InterfaceCanvasGroup.prototype.createScrollingText` | inne moduły tracą scrolling text |
| `motion.mjs` | `ApplicationV2.prototype.close` | każde okno w Foundry przechodzi przez nasz kod |
| `voice.mjs:210` | `ui.notifications.info/warn` | filtr po treści stringów, zależny od locale avclient |
| `iso-shield.mjs` | `_refreshState` w łańcuchu prototypów Tokena | uzasadnione, dobrze opisane |
| `sheet.mjs` | `render` per instancja arkusza | "Sheet flicker" z pamięci projektu |

Każdy ma powód, każdy jest opisany, ale nie ma jednego miejsca, które je
wylicza. Proponuję `scripts/patches.mjs` z rejestrem `{ target, why, since }`
i jednym `diagnosePatches()`.

### A19 · P3 · Dwa eksporty `giveItemDialog` o różnych sygnaturach

`gm-items.mjs:263` `giveItemDialog(actor)` (DM daje) i `handover.mjs:110`
`giveItemDialog(actor, item)` (gracz przekazuje). `api.mjs` eksportuje ten
drugi pod publiczną nazwą, `messenger-app.mjs` importuje pierwszy. Do zmiany
nazwy: `gmGiveItemDialog` / `handOverDialog`.

### A20 · P3 · `&mdash;` w trzech miejscach

`secret.mjs:65` (STUB szeptu, renderowany w chacie jako em dash), `vault.mjs:1618`
i `vault.mjs:1934` (pusta komórka tabeli skrytek). Pamięć projektu mówi o
czterech celowych wyjątkach. **Pytanie Q15.**

### Formularze, które nie nadążyły za regułami

Jedna klasa błędu: lista opcji budowana z `ITEM_CATEGORIES` z lokalnym filtrem,
w czterech miejscach z czterema różnymi filtrami. Reguły zmieniły się dwa razy
(usables rozdzielone na Healing / Sanity Relief w E-tabelach, klucze do pokoi
jako kategoria `bedroomKey`), a formularze nadążyły tylko w oknie Give items
(`gm-items.mjs` `categoriesFor`, które dzieli `usable:healing` /
`usable:stress` i pomija `bedroomKey`). Reszta została przy starej liście.
Pierwsze dwa punkty zgłosił Dawid.

### A21 · P2 · Brak sposobu na wyłączenie pokoju z liczenia 1.5 pokoju na gracza (Dawid)

Przewodnik (G-36): około półtora pokoju na gracza, "corridors and dormitories
aside". Moduł liczy tę proporcję w **dwóch miejscach dwoma wzorami**:

- `season-setup.mjs:184-189` (wiersz "Enough rooms for the cast"): `regions.size`
  sceny roboczej, czyli **każdy** region łącznie z sypialniami, korytarzami i
  regionami bez nazwy, przeciw `Math.ceil(uczniowie x 1.5)`.
- `vault.mjs:1880-1897` (Room Setup, zakładka Doors, linia "{open} shared rooms
  open..."): pokoje **bez właściciela** i **odblokowane**, korytarze wliczone,
  przeciw `Math.round(żyjący x 1.5)`.

Ten sam świat dostaje dwie różne odpowiedzi, a korytarz zawyża obie.
**Propozycja:** flaga regionu (np. `drpgNotARoom`) jako kolumna "Counts as a
room" na zakładce Doors obok "Locked at start", sypialnie wykluczone
automatycznie, korytarze przez odznaczenie; jedna funkcja `sharedRooms(scene)`
w `vault.mjs`, z której czytają oba miejsca; jeden wzór zaokrąglenia.

### A22 · P2 · Item Tables > Create an item nie zna Healing / Sanity Relief (Dawid) - `tables.mjs` `openItemTables`

Lista kategorii to `ITEM_CATEGORIES` minus `truthBullet`: jedna pozycja
"Usable" i dodatkowo "Room Key". `tierTableIdFor()` rozumie już postać
`usable:healing`, więc brakuje tylko opcji w select. Skutki:

- z gołym "Usable" cel tieru to wycofana "DRPG Usables - Tier N": w starym
  świecie przedmiot ląduje w mieszanej tabeli, której `usableKindFor` nigdy nie
  czyta; w nowym dostaje "No tier pool exists" i może trafić tylko do pul
  pokojowych. Tak czy inaczej przedmiot nie ma rodzaju i przy użyciu pyta
  "Health czy Sanity";
- "Room Key" tworzy przedmiot z kategorią `bedroomKey` bez flagi pokoju: klucz
  do niczego;
- preset z karty orzeczenia Search (`action-rolls.mjs:1104-1109`) niesie
  `category: "usable"` bez celu, bo `data.category` dla healing i stress to to
  samo "usable" - rodzaj ginie po drodze.

**Naprawa:** jedna eksportowana lista `pickableCategories({ splitUsables,
includeKeys })` używana przez wszystkie cztery formularze; do presetu dodać
`goal`.

### A23 · P2 · Plant the item (pułapka) - ta sama stara lista - `traps.mjs:451-453`

"Usable" bez rodzaju i "Room Key" jako opcja. Zasadzony usable nie ma rodzaju,
więc ofiara przy użyciu dostaje pytanie Health/Sanity zamiast cichego
zadziałania, a "Room Key" jako pułapka to klucz bez pokoju. Ten sam fix co A22.

### A24 · P2 · Room Setup > Searching: "Room Key" do faworyzowania - `vault.mjs:1559`

Kolumny "Good place to look for" / "Bad place to look for" budowane z tej
samej listy: oferują "Room Key", o który Search nigdy nie pyta. "Usables" bez
podziału jest tu akceptowalne (Search przekazuje `category: "usable"` dla obu
celów, `action-rolls.mjs:997`), ale DM nie może powiedzieć "leki tu, komfort
gdzie indziej". Minimum: usunąć `bedroomKey`; opcjonalnie dzielić po rodzaju,
jeśli `favoursCategory` dostanie cel.

### A26 · P1 · Limit usables w kodzie to 2, reguła mówi 3 - `config.mjs` `ITEM_CATEGORIES.usable.limit`

Decyzja Q4 (2026-09-02): usables 3, gear 2 (1 w ręce, 1 schowany). Gear w
kodzie zgadza się (`LIMIT_GROUPS.gear.limit` 2, `maxStowed` 1); usables mają
`limit: 2`, więc trzeci przedmiot leczniczy jest dziś odrzucany albo wpychany
do skrytki. Komentarz `config.mjs:597` "Usables still cap at three" był
prawdą o regule, nie o kodzie. Do zmiany: `usable.limit` 2 → 3; komentarze
"three between the weapons, the cleaning tools and the tools" (`inventory.mjs`
`canCarry`) i "three usable items, one crime tool and two cleaning tools"
(`vault.mjs:4`) → aktualne liczby.

### A25 · P2 · "Everybody carries something" zalicza klucz do sypialni - `season-setup.mjs:136-138`, `diagnostics.mjs:1146`

Test "czy uczeń ma przedmiot startowy" to `ITEM_CATEGORIES` bez filtra, a klucz
do sypialni ma kategorię `bedroomKey` (`vault.mjs:195`). Każdy uczeń z
przypisaną sypialnią przechodzi wiersz "Everybody carries their opening item"
z pustą torbą. Wykluczyć `bedroomKey` i `truthBullet`; lepiej sprawdzać
przedmiot startowy wprost (tier 2, opis `startingItemNote`).

---

## B. Pytania do Dawida - komentarz przeczy kodowi

Zgodnie z ustaleniem niczego tu nie rozstrzygam. Każde pytanie ma dwie możliwe
odpowiedzi: poprawić komentarz/tekst albo poprawić kod.

| # | Gdzie | Komentarz / tekst | Kod | Pytanie |
| --- | --- | --- | --- | --- |
| Q1 | `fog.mjs:2648` i `2683` | "MIPMAPS OFF" a 35 linii dalej "Mipmaps are the answer to minification" | `mipmap: OFF` (dwa razy) | Które jest zamiarem? Jeśli OFF, drugi blok jest kroniką do usunięcia; jeśli mipmapy, kod jest zły. |
| Q2 | `chapter.mjs` nagłówek | "session start clears evidence" | Z7 to usunęło, sweep jest ręczny w dashboardzie | Zaktualizować nagłówek? |
| Q3 | `chapter.mjs:71` JSDoc, `reviveCharacter`, `Chapter.deathNote`, `revived`, `keepItems`, `itemsGone` | ekwipunek zniszczony przy śmierci (D1) | `killCharacter:85-100` zostawia przedmioty, usuwa tylko Truth Bullety (Dawid, 27.08) | Kod jest jednoznaczny, więc pytanie jest o brzmienie: "Their Truth Bullets die with them; what they carried stays on the body" i checkbox "Keep their Truth Bullets" pasują? |
| Q4 | `config.mjs:597`, `vault.mjs:4`, `inventory.mjs` `canCarry` JSDoc | "Usables still cap at three"; "three usable items, one crime tool and two cleaning tools"; "three between the weapons, the cleaning tools and the tools" | `LIMIT_GROUPS.gear.limit` = 2 (1 w ręce + 1 schowany), `usable.limit` = 2 | Które liczby są regułą? |
| Q5 | `config.mjs:2063` | Motive to "the other nine-point Call" | Motive kosztuje 6 | Cena Motive: 6 czy 9? |
| Q6 | `config.mjs` `relief` | dwa sprzeczne komentarze o cenie | jedna liczba w kodzie | Która cena? |
| Q7 | `config.mjs` `TRIAL` | "nothing reads a tie yet" | `vote.mjs` zapisuje `tied`, jest `Vote.tiedVerdictNote` | Komentarz do usunięcia? |
| Q8 | `hud.mjs:6` | HUD w `#ui-middle`, "top centre" | montuje się w `#ui-left-column-1` | Nagłówek stary? |
| Q9 | `visibility.mjs:324` | "SPIKE NEEDED, NOT YET CONFIRMED LIVE" | cztery zgadywane właściwości | Czy spike był robiony? Jeśli nie, robię go jako pierwszy krok. |
| Q10 | `en.json` `lockPlayerResources.hint` | Health/Sanity edytowalne | zablokowane | Zamiar: zablokowane (jak w 1.0.1)? |
| Q11 | `en.json` `enforceAnonymity.hint` | ownership None | OBSERVER + cenzura | Zaktualizować hint? |
| Q12 | `tables.mjs` `PROJECT_ITEMS` | "guide content that never reached a screen" | nic tego nie czyta | Podpiąć do ekranu wyniku projektu, czy usunąć i zapisać w handbooku? |
| Q13 | `remnants.mjs` `retuneRemnant` | "the rename above is a no-op" | rename nadal wykonywany | Usunąć blok? |
| Q14 | `trial-floor.mjs`, `Floor.mode.discussion` | `FLOOR_MODES.discussion` = "Nonstop Debate"; komentarz sam nazywa to mylącym | "discussion" gdzie indziej = brak floor | Zmienić klucz na `debate`? |
| Q15 | `secret.mjs:65`, `vault.mjs:1618/1934` | reguła "zero em dashy" | trzy `&mdash;` | To te celowe wyjątki? |
| Q16 | `murder.mjs` `murderState` | LIVE-001 otwarte od 1.1.88 | `killerId` w world setting | Świadome ryzyko (dopisać do D-decyzji) czy naprawa (ledger GM jak Mastermind)? |
| Q17 | `clock.mjs:110` | pusty blok z komentarzem | nic | Coś miało się dziać przy nowej sesji? |
| Q18 | `secret.mjs` / pamięć | "cztery em dashe zostawione celowo" | znalazłem trzy w skryptach, zero w en.json i CSS | Gdzie jest czwarty? |

### B2. Decyzje Dawida (2026-09-02)

| # | Decyzja | Co się zmienia |
| --- | --- | --- |
| Q1 | mgła po oddaleniu wygląda dobrze, mipmapy zostają wyłączone | usunąć komentarz "Mipmaps are the answer" (`fog.mjs:2683`) |
| Q2 | sweep jest ręczny | nagłówek `chapter.mjs` do aktualizacji (komentarz) |
| Q3 | ekwipunek zostaje na ciele, Truth Bullety giną | jak kod; pięć tekstów i dwa komentarze z A14 do poprawy (kopia) |
| Q4 | gear: 2 sloty, 1 w ręce + 1 poza ręką; usables: 3 | gear = kod (`LIMIT_GROUPS.gear.limit` 2, `maxStowed` 1); **usables: kod** `config.mjs` `usable.limit` 2 → 3 (nowe A26); komentarze mówiące o "three gear" w `inventory.mjs` i `vault.mjs:4` → 2 |
| Q5 | Motive kosztuje 6 | komentarz `config.mjs:2063` |
| Q6 | cena Relief z kodu | usunąć sprzeczne komentarze przy `relief` |
| Q7 | komentarz TRIAL o remisie do usunięcia | komentarz |
| Q8 | HUD ma być w lewej kolumnie, to stan docelowy | nagłówek `hud.mjs` do aktualizacji (komentarz) |
| Q9 | "chyba był robiony" | zostaje "do potwierdzenia na żywo": 5 minut w sandboxie, komentarz SPIKE NEEDED do usunięcia po potwierdzeniu |
| Q10 | zablokowane dla gracza, edytowalne dla DMa | jak kod; hint `lockPlayerResources` do poprawy (F1) |
| Q11 | odpowiedź dotyczyła widoczności tokenu Remnanta po zamianie w Truth Bullet: to już działa (`revealSourceOf` w `truth-bullets.mjs` + `myRemnantRefs` w `visibility.mjs`) | hint `enforceAnonymity` do poprawy pod kod (OBSERVER + cenzura), patrz F1 |
| Q12 | nie trzeba podpinać | usunąć `PROJECT_ITEMS` z `tables.mjs`; trzy przedmioty projektowe zostają regułą handbooka |
| Q13 | usunąć | blok zmiany nazwy tokenu w `retuneRemnant` (`remnants.mjs`) do usunięcia (A8) |
| Q14 | nazwy: discussion, debate, rebuttal; OBJECTION zostaje osobnym trybem | `FLOOR_MODES.discussion` → `debate`, klucz `Floor.mode.discussion` → `debate`; tryby: debate, objection, rebuttal; "discussion" oznacza tylko trial bez otwartego floor |
| Q15, Q18 | zero długich myślników, wszędzie "-" | trzy `&mdash;` (`secret.mjs:65`, `vault.mjs:1618`, `vault.mjs:1934`) → "-" (kod). Cztery pozostałe siedzą w `audit/harness/results/*.json` i **tam zostają**. To nie jest tekst modułu, tylko zapis tego, co moduł wypisał podczas dawnego przebiegu testów - `audit/harness/results` jest czystym archiwum, nic go nie czyta ani nie porównuje. Podmiana znaku w takim pliku to poprawianie protokołu z tego, co się wydarzyło. Reguła "zero długich myślników" dotyczy kodu i tekstów użytkownika, a te są czyste: 0 wystąpień w `scripts/`, `lang/`, `styles/`, `macros/`, `module.json` i `README.md` |
| Q16 | naprawić ledgerem | `killerId` (i tożsamość stron incydentu) do ledgera GM-side, jak Mastermind; `murderState` w świecie niesie tylko to, co gracz i tak widzi (krok 1b w H) |
| Q17 | usunąć pusty blok | `clock.mjs:110` (kod, kosmetyka) |

### Wyjaśnione (Q1, Q12, Q13) - po ludzku, z decyzją w tabeli wyżej

- **Q1, mipmapy.** Mgła w `fog.mjs` rysuje kafelki z tekstury. Kiedy kafelek na
  ekranie jest mniejszy niż tekstura (mapa oddalona), karta graficzna musi ją
  pomniejszyć. Mipmapa to zestaw gotowych pomniejszonych kopii tekstury, dzięki
  którym pomniejszenie jest gładkie; bez mipmap oddalona mgła może migotać lub
  ziarnić. Kod je **wyłącza** (`mipmap: OFF`) i pierwszy komentarz mówi, że
  celowo; drugi komentarz 35 linii dalej mówi, że mipmapy są rozwiązaniem.
  Pytanie sprowadza się do: czy mgła po oddaleniu mapy wygląda dziś dobrze?
  Jeśli tak, komentarz "Mipmaps are the answer" jest do usunięcia. Jeśli
  migocze, kod jest do zmiany.
- **Q12, PROJECT_ITEMS.** W `tables.mjs` jest lista trzech przedmiotów z
  przewodnika, które powstają z projektów, nie z przeszukania: Sleeping draught
  (3 Sanity albo uśpienie ofiary), Lethal poison (projekt Desperate), Gift
  (natychmiast oddany, 3 Hope dla twórcy). Żaden ekran ich nie oferuje. Pytanie:
  czy ukończony projekt ma proponować DMowi jeden z nich do wręczenia (przycisk
  na karcie "Finished"), czy lista ma zniknąć z kodu, a reguła zostać tylko w
  handbooku?
- **Q13, retuneRemnant.** Po Rerollu moduł zmienia poziom widoczności śladu.
  Stary fragment tej funkcji zmienia przy okazji nazwę tokenu (wstawia słowo
  "Obvious" / "Hidden"), co po przeniesieniu klucza odpowiedzi do ledgeru nic
  nie robi, a dla tokenu sprzed migracji wpisałoby to słowo do publicznej nazwy.
  Pytanie było tylko "czy mogę ten fragment usunąć". Proponuję: tak.

---

## C. Skrócenie kodu (bez zmiany zachowania)

### C1 · Komentarze: z kroniki do dokumentacji

31.6 tys. linii komentarzy. Typowy blok: "Dawid, 28.08", "trap 153",
"this used to ... measured ... so now ...". To jest historia zmian, nie opis
kodu, i czyta się ją zamiast kodu. Propozycja:

1. Zostawić przy funkcji tylko: co robi, niezmienniki, pułapki Foundry (te są
   cenne: "`-=key` nic nie robi", "`load()` nie settluje przed kliknięciem").
2. Kronikę ("used to", "measured on 28.08", numery trapów) przenieść do
   `docs/decisions.md` z kotwicami `D6`, `E17`, `trap 153` i linkować.
3. Podwójne bloki JSDoc scalić (znalezione: `rollTrait`, `paintResourceBars`,
   `presentDialog`, `bulletBadges`, `requestHopeCallApproval`, `dualityBar`,
   `breakOnDespair`/`equippedFor`, `checkRepairCompletion`/`announceTrapReady`,
   `openMastermindDialog` x3, `isAnalysable`/`isIdentified`, `diagnoseDice`).

Cel: 15-20% linii komentarzy. To samo w CSS (141 sekcji z tytułami w stylu
"THE PURPLE WAS IN THE FOOTER ALL ALONG").

### C2 · Diagnostyka i testy poza ścieżką produkcyjną - **zrobione w jednej połowie, druga odrzucona**

**Pakiet testów: zrobione, i to jest cały zysk tego kroku.** `tests.mjs`
(5435 linii) miał dokładnie jednego importera - `api.mjs` - więc każdy klient
przy stole, łącznie z graczami, którzy nie mogą go uruchomić, parsował całą
regresję przed startem świata. Za thunkiem nie jest pobierany, dopóki ktoś nie
wpisze nazwy. `runTests` jest już `async`, więc wołający nic nie zauważy.

Zmierzone przez przejście grafu importów statycznych od `module.mjs`:
**80 578 → 75 187 linii parsowanych przy starcie**, z dwulinijkowej zmiany.

**`diagnostics.mjs`: nic tu nie da.** Importuje go `module.mjs`
(`warnAboutPageTinting`, `verifyStylesheet` biegną przy starcie), więc plik
i tak jest w grafie - leniwe gettery w `api.mjs` przeniosłyby tylko krawędź.

**Podział `fog.mjs`: ODRZUCONE, z dowodem.** Audyt szacował ~1500 linii
narzędzi konsolowych; zmierzone jest **755**. Ale problem nie jest w rozmiarze:
pięć z dziewięciu narzędzi czyta **stan modułu** - `fogTexture`,
`lastFogReason`, `lastClearances`, `lastGlow`, `driftTick`, `animationsOn`,
`dissolveGeneration`, `roomOutline` - plus piętnaście prywatnych funkcji
(`regionShapes`, `doorwayEdges`, `wallAlongEdge`, `neighbourBeyond`…).
Wyniesienie ich znaczy wyeksportowanie całego wnętrza `fog.mjs`. To nie są
narzędzia stojące obok stanu - to są narzędzia **do** tego stanu, a `whyBlack`,
który nie widzi `lastFogReason`, nie jest diagnostyką. 755 linii z 75 tysięcy
to 1% startu; cena to prywatne wnętrzności modułu w publicznym API.


- `fog.mjs` niesie ~1500 linii narzędzi konsolowych (`doorwayReport`,
  `whatIsHere`, `checkRegions`, `whyBlack`, `diagnoseFog`, `measureCoverage`,
  `fogPeek`). Wydzielić do `fog-diagnostics.mjs`, ładować z `game.drpg` przez
  getter z `import()` na żądanie.
- `diagnostics.mjs` (1193) i `tests.mjs` (5396) są importowane statycznie przez
  `api.mjs`, więc każdy klient parsuje 6.6 tys. linii przy starcie. Te same
  gettery leniwe. `runTests` zostaje na `game.drpg`, ale jako
  `(...a) => import("./tests.mjs").then(m => m.runTests(...a))`.

### C3 · Duplikaty do jednej definicji

| Funkcja | Gdzie | Uwagi |
| --- | --- | --- |
| `report(title, lines)` | diagnostics, voice, music, fog | jedno w utils |
| `isEclipse` | eclipse, fog, visibility | eclipse jest źródłem |
| `getClock` | clock, overflow | overflow duplikuje "żeby uniknąć cyklu" - cykl da się przeciąć przez `settings.mjs` |
| `incomingTimeOfDay` | hud, eclipse, movement | |
| `remaining` | character, hud | |
| `spendStress`, `restoreStress`, `refOf` | murder, cleanup | |
| `locate` vs `locateActor` | cleanup, movement | |
| `regionBounds` vs `boundsOf` | fog, movement | |
| `regionsByName` | rest, vault | |
| `esc` | **zrobione**: 34 z 46 → jeden `export const esc` w utils. Zostaje 12 gołych aliasów `foundry.utils.escapeHTML`, bo one **nie robią tego samego**: bez `?? ""` `escapeHTML(null)` wypisuje słowo "null" na czyjejś karcie. Uwaga na przyszłość: pięć z tych dwunastu siedzi w `action-rolls.mjs`, który importuje teraz wersję null-safe - w tych pięciu funkcjach `esc` znaczy co innego niż w reszcie pliku |
| tabs | `panelTabs` (`data-drpg-gmt-*`) vs Room Setup (`data-drpg-tab/panel`) vs Investigation (`drpg-dashboard-tab`) | trzy systemy zakładek, jeden wystarczy |
| listy kategorii | gm-items `categoriesFor`, tables `categories`, traps `catOptions`, vault `categories` | cztery filtry `ITEM_CATEGORIES`, jeden aktualny (A22-A24) |
| proporcja pokoi | season-setup `roomCount`, vault `paintRatio` | dwa wzory na jedną liczbę (A21) |
| `onCreateChatMessage`, `onPreUpdateActor`, `onSocket` | po 3 kopie | nazwy lokalne, ale przy 40 handlerach socketu warto mieć rejestr |

Reszta tabeli scalona w trzeciej turze 03.09 - czytelniki zegara przez
`settings.mjs` jako liść, pozostałe przez eksport z pliku źródłowego; trzy
wiersze okazały się nieduplikatami. Patrz "Weryfikacja realizacji". Zostają
tylko trzy systemy zakładek.

### C4 · Dynamiczne importy - **premisa audytu nie broni się w tę stronę**

543 miejsca w 56 plikach (audyt: 546). Rozumowanie audytu brzmiało: skoro
`api.mjs` i tak importuje prawie wszystko statycznie, "unikanie cyklu" nic nie
oszczędza. Pierwsza połowa jest prawdziwa, ale wniosek nie: te importy nie
istnieją, żeby oszczędzać ładowanie, tylko żeby **cykl nie powstał**. Zamiana
ich na statyczne nie odsłania cyklu, który był - ona go **tworzy**, a moduł
ES z cyklem nie wybucha, tylko wydaje `undefined` w losowym miejscu.

Sensowna wersja tej pracy to ustalenie kierunku zależności i rozrywanie
prawdziwych pierścieni zdarzeniami - projekt architektoniczny, nie krok.
Zrobione dotąd w tym duchu: `incidentParticipants()` w `settings.mjs` (LIVE-001)
i `esc` w `utils.mjs`, obie dokładnie po to, żeby czytelnik nie musiał sięgać
w drugą stronę.

#### Oryginalna propozycja


546 `await import("./x.mjs")`. Komentarze uzasadniają je cyklami, ale `api.mjs`
i tak importuje statycznie prawie wszystko przy starcie, więc "unikanie cyklu"
nie zmniejsza kosztu ładowania, a każdy `await import` w gorącej ścieżce to
mikro-opóźnienie i utrata typowania. Propozycja: ustalić kierunek zależności
(`config → settings → utils → domena → ui`), przenieść to, co da się przenieść
(np. `whisperToOwner` w `remnants.mjs`, `roomOfActor` w `truth-bullets.mjs`),
a prawdziwe pierścienie (movement/vault/mastermind/chapter) rozerwać przez
zdarzenia (`Hooks.callAll`) zamiast wzajemnych wywołań.

### C5 · Pliki-giganty - **`onSocket` zmierzone, niezmiennik domknięty testem**

`onSocket` to 767 linii i 28 gałęzi (audyt mówił 39 - to liczba wystąpień
`action ===`, nie gałęzi). Zamiast przepisywać punkt wejścia socketu na mapę
handlerów, najpierw go **zmierzyłem**:

| | |
| --- | --- |
| gałęzi | 28 |
| z pełnym strażnikiem (`senderOf` + `ownsActor`) | 20 |
| czytających `payload.actorId` **bez** pełnego strażnika | **0** |

Czyli własność, którą deklaratywna mapa miała uczynić widoczną, **już
obowiązuje**. Przepisanie 767 linii bezpiecznego kodu, którego nie mogę
uruchomić, kupiłoby czytelność za ryzyko w jedynym miejscu modułu, gdzie błąd
znaczy "gracz działa cudzą postacią".

Zamiast tego dopisany test **R1b**: czyta źródło, dzieli `onSocket` na gałęzie
i przewraca się, jeśli którakolwiek działa na `payload.actorId` bez sprawdzenia
nadawcy i własności. Sprawdzony w obie strony - przechodzi na obecnym kodzie,
a po wyjęciu strażnika z `ACTION_MEDDLE` wskazuje dokładnie tę gałąź. To kupuje
samą własność zamiast jej wyglądu, i chroni tę dwudziestą dziewiątą gałąź,
dopisaną kiedyś w pośpiechu trzysta linii w głąb pliku.

**Podziały plików: nie na ślepo.** `action-rolls.mjs` (4398), `sheet.mjs`
(3936), `config.mjs` (3959) - to są przebudowy, których poprawność widać
dopiero w działającym świecie. Zostawiam z pomiarem, nie z połową roboty.

#### Oryginalna lista


- `action-rolls.mjs` 4390: jeden plik na akcję (`actions/search.mjs`,
  `actions/observe.mjs`, ...) plus wspólny `roll.mjs`.
- `config.mjs` 3955: rozdzielić reguły (liczby, tabele) od kopii (opisy, hinty,
  efekty Calli) - handbook jest autorytetem kopii, więc kopia powinna leżeć
  w jednym miejscu obok `en.json`, nie między stałymi.
- `gm-bridge.mjs` 1986: `onSocket` to 40-gałęziowy `if`; zamienić na mapę
  `handlers[action]` z deklaracją `{ gmOnly, ownsActor, run }`.
- `sheet.mjs` 3919: injektory per sekcja (`sheet/inventory.mjs`, `sheet/actions.mjs`, ...).

### C6 · CSS - **ZMIERZONE, i w tej formie nie wykonywać**

Audyt: "konsolidacja po komponencie usunęłaby większość `!important`".
Policzone, przez sprawdzenie, co każdy z nich selekcjonuje:

| | |
| --- | --- |
| `!important` w arkuszu | 629 |
| sięgających poza własne klasy modułu (walczą z warstwą Foundry) | **563** |
| nazywających wyłącznie `.drpg-*` (walczą z tym plikiem) | 66 |

Czyli konsolidacja mogłaby usunąć **10,5%**, nie "większość" - myliliśmy się
o rząd wielkości. Reszta jest nośna: CSS modułu leży w warstwie `modules`,
która odwraca zwykłą specyficzność, i to jest zapisane w pamięci projektu
jako pułapka, która już raz kosztowała godzinę.

**Martwy CSS: nie ma czego sprzątać, i pilnuje tego pakiet.** Mój doraźny
test dał 20 klas "stylowanych, a nieemitowanych"; po dopasowaniu prefiksów
(`drpg-role-${key}`, `drpg-popup-tone-${x}`) zostały 4, a te obejmuje test
**R2**, który ma własną, łagodniejszą definicję rodzin klas. Nie obchodzę
istniejącego testu własną definicją.

Przebudowa 14,8 tys. linii CSS, której nie mogę wyrenderować, żeby zobaczyć,
co się rozjechało, to najbardziej ryzykowna rzecz w całym planie. Do zrobienia
z przeglądarką, komponent po komponencie.

#### Oryginalna propozycja


14.8 tys. linii i 682 `!important`. Sekcje są warstwami czasu, nie
komponentami: "STAGE 3", potem "THE RED WINS THE ARGUMENT", potem "NOTHING IN
THIS MODULE IS PURPLE", potem "THE PURPLE WAS IN THE FOOTER ALL ALONG" - każda
nadpisuje poprzednią. Konsolidacja po komponencie (HUD, arkusz, dialogi, chat,
panel) usunęłaby większość `!important` (potrzebne zostają te, które walczą z
warstwą `modules` Foundry, opisane w pamięci projektu).

---

## D. Wydajność

| # | Gdzie | Problem | Skala |
| --- | --- | --- | --- |
| D1 | `investigation.mjs` `buildCase` + `truth-bullets.mjs` `secretOf` | pełna przebudowa HTML dashboardu przy każdym `updateItem`/`updateActor`, a w niej `secretOf` (parsowanie ustawienia) na każdy Bullet | 16 uczniów x 10 kul x 40 śladów = setki parsowań na jedno zdarzenie |
| D2 | `tables.mjs` `usableKindFor`, `classifyEntryName` | iteracja po wszystkich tabelach i wynikach na każdy wiersz arkusza / edytora | ~25 tabel x 4 wiersze na wiersz, przy 30 wierszach = 3000 porównań na render |
| D3 | `remnants.mjs` `announceRemnant` | szept do DMów przy każdym postawionym śladzie; incydent stawia ślad prawie co akcję | spam chatu DMa |
| D4 | `states.mjs` `syncStates` | `clearSystemConditions` (skan efektów) przy każdym zapisie HP/Sanity | drobne |
| D5 | `sfx.mjs` `onDocumentClick` + `YIELD_MS` | globalny listener capture na każde kliknięcie + 120 ms opóźnienia dźwięku przycisku | odczuwalne jako "lag" kliknięcia |
| D6 | `messenger.mjs` `markThreadRead` | zapis ustawienia klienckiego + `Hooks.callAll` przy każdej wiadomości i renderze | drobne |
| D7 | 546 `await import` | patrz C4 | drobne, ale wszędzie |

D1 i D2 to ten sam kształt, który E17 zmierzył i naprawił dla ledgeru
Remnantów. Rozwiązanie identyczne: cache z inwalidacją na
`clientSettingChanged` / `updateRollTable`.

---

## E. Flow gry i UX

### E1 · Gracz: jedno zdarzenie, trzy powierzchnie

Typowa akcja: kafelek → okno wariantu z briefingiem → dialog rzutu (zablokowany)
→ szept w chacie **i** popup z tej samej treści (`popup.mjs` łapie każdą kartę)
**i** często `ui.notifications.info`. Do tego dźwięk. Gracz uczy się ignorować
wszystko.

Propozycja jednej reguły: **popup jest odpowiedzią, chat jest zapisem, toast
jest odmową.**

- Popup: wynik akcji, karta orzeczenia, coś, co gracz ma przeczytać teraz.
- Chat: to samo, jako historia (już jest).
- Toast: tylko "nie da się" (brak akcji, zły pokój, brak DMa) i błędy. Zero
  toastów "zrobione" po akcji, która i tak pokazała kartę.

**Wykonane, i szacunek okazał się zły.** Z 339 wywołań `ui.notifications`
221 było już typu `warn`, a 32 to `error` - czyli odmowy i błędy, zgodne z
regułą. Do przejrzenia zostawało 86 `info`. Po przeczytaniu każdego z nich:

- **60 z 86 jest jedyną informacją zwrotną na swojej ścieżce.** Zapis formularza
  DMa (`Project saved`, `Renamed to`, `Vault saved`) nie wystawia żadnej karty.
  Skasowanie toasta zostawiłoby DMa bez odpowiedzi na pytanie "czy się zapisało".
- **Reszta to w większości pokwitowania dla DMa przy karcie adresowanej do kogoś
  innego.** `{actor} received {item}` leci do DMa, który nacisnął przycisk;
  szept "You have been given something" leci do gracza. To dwie osoby, nie dubel.
- **20 z nich to jednak odmowy podane jako `info`** - "nothing to do", "already
  running", "no keys left", "the GM said not this time". Każda kończy się
  natychmiastowym `return`. Te przepisano na `warn`: ta sama treść, ta sama
  chwila, ale reguła "toast to odmowa" jest teraz prawdziwa w kodzie, a nie
  tylko w audycie.

Bilans po zmianie: 242 `warn`, 66 `info`, 32 `error` (policzone ponownie 03.09).

### E2 · Gracz: okno wariantu nie zawsze jest potrzebne

Akcje z jednym wariantem i bez pola tekstowego (Rest w oznaczonym pokoju, Work
on project z jednym projektem w pokoju, Use item tier 1/2) mogą iść prosto do
rzutu; briefing (koszt, pokój, cecha) mieści się w nagłówku dialogu rzutu, gdzie
i tak jest `dialogContent`.

### E3 · Gracz: tooltipy kafelków

**Wykonane.** Osobno klucze, osobno sklejki w kodzie.

- **11 kluczy wiszących na hover miało ponad 80 znaków** (najdłuższy 157:
  `Hud.elapsedTooltip`). Wszystkie skrócone do jednego zdania; po zmianie żaden
  tooltip nie przekracza 80 znaków.
- **Uwaga na `Settings.*.hint`.** To nie są tooltipy, tylko opisy w menu
  ustawień, i w kroku 4 kilka z nich celowo *wydłużono*, żeby mówiły prawdę
  (A13). Limit 80 znaków ich nie dotyczy.
- **Sklejki w `sheet.mjs`:** tooltip kafelka akcji i przycisku Calla powtarzał
  `costLabel`, który jest wydrukowany na twarzy tego samego kafelka trzy linijki
  niżej, a nad nim jest jeszcze pasek koloru mówiący, jaki to rodzaj kosztu.
  Koszt usunięto z obu tooltipów. Zostaje hint plus to, czego z kafelka odczytać
  się nie da i tylko wtedy, gdy obowiązuje: dlaczego zablokowane, dlaczego nie
  stać, dlaczego nie ma na czym, dlaczego dziś za darmo. Zwykły hover to teraz
  jedna linia.

### E4 · Gracz: trzy pływające kółka i modal na każdym Zaćmieniu

Messenger, Sound i (na arkuszu) Safeword. `day-summary.mjs` otwiera
`DialogV2.prompt` każdemu graczowi na start każdego Zaćmienia - to modal
przerywający przeciąganie tokenu w jedynym momencie, gdy gracz ma coś
przeciągnąć. Lepiej: popup "sticky" albo wpis do wątku Messengera.

### E5 · Gracz: "Trace" czy "Remnant"

Token nazywa się "Trace", karta "A trace", zakładka "Traces", ale przyciski
"Clear Faint Remnants", "Which Remnant are they closest to?", "Key Remnants",
raport "Remnants". Dla gracza to dwa pojęcia. Propozycja: **Trace** wszędzie,
gdzie patrzy gracz; **Remnant** tylko w nazwach typów (Key Remnant, Final
Truth Remnant) i w narzędziach DMa.

### E6 · DM: kafelki zamykają i otwierają panel - **zrobione**

Z ośmiu miejsc close/reopen zostało pięć, i każde z pozostałych ma powód:
cztery otwierają własne okno, do którego DM idzie i wraca (menedżer
przedmiotów ma to zapisane jako decyzja D-F5-2), a piąte, w konsoli trialu,
ma własny komentarz o odmowie przy zmianie sygnatury.

Naprawione są dokładnie te, które audyt wymienia z nazwy - "reopen po każdym
Give Hope" - w trzech oknach:

- **Who is alive** już miało `keepLive` z `watch: { actors: true }`, więc
  close/reopen był tam **zbędny**. `wireRow` dostał opcję `keepOpen`, użytą
  tam, gdzie akcja nie otwiera żadnego okna (`setMonocub`), plus zdjęty
  reopen z konwersji Despair na Hope.
- **Monocub** i **Mastermind** nie miały `keepLive` w ogóle, więc samo zdjęcie
  reopenu zostawiłoby nieaktualne liczby. Oba dostały region live tym samym
  wzorcem, który Who is alive już stosuje: wiersze jako funkcja, `watch:
  { actors: true }`, i przewiązanie przycisków w `after`, bo `keepLive`
  wymienia węzły razem z listenerami.

Oba dopisane do listy `MUST_BE_LIVE` w pakiecie testów - ta lista jest wprost
opisana jako "osąd, nie zgadywanka", a bez wpisu zmiana mogłaby po cichu
wrócić.


`gm-panel.mjs:352,686,744`: kafelek → `dialog.close()` → akcja → `openGmPanel()`.
Ten sam wzorzec w Investigation Dashboard (każdy przycisk stopki), hubie Give /
take, konsoli trialu (reopen przy zmianie sygnatury), Monocub i Mastermind
(reopen po każdym "Give Hope"). Panel migocze, gubi scroll i pozycję.
Rozwiązania: (a) `keepLive` na regionach, które i tak są przebudowywane;
(b) okna tylko-do-odczytu (Remnant table, log, diagnostyka) otwierać obok,
bez zamykania panelu; (c) dla akcji w wierszu (Give Hope) aktualizować wiersz,
nie okno.

### E7 · DM: sześć powierzchni dla jednego pytania

**Pierwsza połowa tego znaleziska jest nieaktualna - kod już to ma zrobione.**
Sprawdzone przez przeczytanie `callGm` i wszystkich dziesięciu miejsc, które ją
wołają:

- `callGm` **wybiera**, a nie sumuje: postać z właścicielem dostaje kartę
  w wątku (i to ona niesie dźwięk i popup), postać bez właściciela dostaje szept.
- Dźwięk jest jeden. `messenger.mjs` ma na to własny komentarz: bardziej
  szczegółowy dźwięk *zastępuje* ogólny, "dwa dźwięki na jedną wiadomość to
  sposób, w jaki stół uczy się nie słyszeć żadnego".
- Badge zostaje dla zwykłej rozmowy, nie dla próśb o orzeczenie.
- Toast nie pada na żadnej z dziesięciu ścieżek.
- Jedyny `whisperToGms` obok `callGm` (`analyze.mjs:196`) siedzi w `catch` - to
  awaryjna droga, gdy most nie zadziała, a nie druga relacja.

Komentarze w kodzie powołują się na "the notification diet", więc ta praca
została wykonana wcześniej, a audyt opisał stan sprzed niej.

**Druga połowa stoi i czeka na decyzję.** `announceRemnant` szepcze DMom pełną
kartę przy każdym śladzie (D3), a przebieg sezonu E24 liczył czterysta śladów
Prep na rozdział. Propozycja jednego szeptu zbiorczego zmienia moment, w którym
DM dowiaduje się o śladzie - to decyzja o przepływie informacji przy stole,
więc nie wprowadzam jej sam.

Dodatkowo `announceRemnant` szepcze DMom przy każdym śladzie (D3). Podczas
incydentu to kilkanaście szeptów w minutę. Propozycja: jeden szept zbiorczy na
koniec tury / na `drpgEclipseChanged`, a pojedyncze ślady tylko w logu.

### E8 · DM: okna z zakładkami i jeden przycisk Apply - **reguła już obowiązuje tam, gdzie miała**

Sprawdzone przez przeczytanie: w oknie Sound zakładka Effects **zapisuje przy
`change`** (`input?.addEventListener("change", () => write(input.value))`
w `sfx.mjs`), a jej brak przycisku Apply jest opisany własnym komentarzem i
celowy. To nie jest usterka - to jest wzorzec, który E8 proponuje.
Item Tables przez `wirePanelTabs` też go trzyma.

Zostaje realna część: Room Setup i Despair Flow używają **innego systemu
zakładek** (`data-drpg-tab/panel`) i zapisują wszystko jednym Apply.
Ujednolicenie trzech systemów zakładek to przebudowa, nie przejście UX -
należy do sekcji C, nie tutaj.


Room Setup (6 zakładek), Despair Flow (4), Item Tables (4), Sound (3). W Sound
Apply jest tylko na Music; w Item Tables stopka zmienia się per zakładka; w
Room Setup i Despair Flow Apply zapisuje wszystko. `wirePanelTabs` już to
umie, więc chodzi o konsekwencję: ta sama zasada we wszystkich (proponuję:
zakładki edytowalne inline zapisują od razu, zakładki formularzowe mają Apply
w stopce, i nic więcej).

### E9 · DM: Investigation Dashboard - **filtr zrobiony**

Dashboard otwiera się teraz na **bieżącym rozdziale**. Rozstrzygane w `readAs`,
bo to jedyne miejsce, które ma listę i biegnie przed renderem selecta - a jeśli
ten rozdział nie zostawił jeszcze żadnego śladu, filtr wraca na "wszystkie
rozdziały", bo inaczej wskazywałby opcję, której w selekcie nie ma. Raz, przy
pierwszym odczycie: DM, który sam poszerzy filtr, zachowuje to do końca.

Zapis per wiersz na blur zostaje do rozważenia - to siedem kolumn na N śladów
i zmiana modelu zapisu całego okna.


Siedem kolumn z inputami dla każdego śladu na każdej scenie, plus tabela "kto
co ma", plus trzy zakładki, wszystko przebudowywane na żywo. Dwie zmiany:
domyślny filtr rozdziału = bieżący rozdział (`reading.chapter` startuje pusty,
czyli "wszystkie"), i zapis per wiersz na blur (jak w edytorze tabel i karcie
Remnanta), bez jednego wielkiego Save, który czyta 7 x N pól.

### E10 · DM: Item Tables - **zakładka zwinięta**

Zakładka "Install" była dwoma akapitami i przyciskiem w stopce. Akapity
przeniesione na spód zakładki Tier pools, przycisk dopisany do jej stopki
(`editTiers: ["newPool", "install"]`), zakładka usunięta razem z martwym
kluczem `Tables.tabInstall`. Cztery zakładki, trzy.

Wspólny komponent "nowy przedmiot" - przyczyna A22 - został załatwiony
w kroku 2 przez `pickableCategories()`, którego oba formularze teraz używają.


Zakładka "Install" to notatka i przycisk w stopce; może być przyciskiem na
zakładce Tier pools ("Install the default set"). Zakładka "Create an item"
dubluje formularz "Give existing / Create new" z okna Give items - jeden
formularz "nowy przedmiot" powinien być komponentem użytym w obu. To ten
brak wspólnego komponentu jest przyczyną A22: Give items dostało podział na
Healing / Sanity Relief, Item Tables nie.

### E11 · DM: karty orzeczeń

Bardzo dobre (przyciski na karcie, `settleCall`). Dwie uwagi: przycisk
"Create an item" nie zamyka karty (świadomie), ale karta nie mówi, że nie
zamknie; oraz `DRPG.Bridge.nothingThere` "There is nothing" bez kropki i
kontekstu.

### E12 · Powiadomienia DMa o błędach

`error()` → toast + log awarii (`Failures`) - dobrze. Ale `warn()` z
`hasGm()` (A16) i `ui.notifications.warn` w `onDeny` typu "Only a GM can open
the panel" pojawiają się także w ścieżkach, gdzie gracz nigdy nie powinien
trafić (`openItemTables` przez API). Te powinny być cichym `return null`.

---

## F. Teksty do skrócenia lub poprawienia

Handbook rządzi brzmieniem; kopia siedzi w `en.json` **i** w `config.mjs`
(opisy akcji, hinty, efekty Calli). Poniżej konkretne propozycje (angielskie,
bo tak trafiają do modułu).

### F1 · Błędne merytorycznie (patrz A13, A14)

| Klucz | Propozycja |
| --- | --- |
| `Settings.lockPlayerResources.hint` | "Actions, Hope, Health, Sanity and statistics change only through play or by the GM. GMs are unaffected." |
| `Settings.enforceAnonymity.hint` | "Other players open a redacted sheet: name, portrait, Health, Sanity and what is held. Everything else is hidden." |
| `Settings.despairFromRolls.hint` | "A Despair result feeds that student's Monokuma. Assign students in GM panel > Despair Flow." |
| `Settings.musicEnabled.hint` | "The playlist follows the game: Eclipse, trial, investigation, time of day, pause. Map playlists in GM panel > Sound > Music." |
| `Chapter.deathNote` | zależnie od Q3; jeśli przedmioty zostają: "Their Truth Bullets are destroyed. What they carried stays on the body and can be taken from it. The body stays on the map; the dead no longer count as being in the room." |
| `Chapter.revived` | "{name} is no longer marked dead. Truth Bullets destroyed at death do not come back." |
| `Anonymity.forcedOnCreate` | usunąć (nieużywany) |

### F2 · Za długie (ponad 220 znaków) - **zrobione**

Z 26 tekstów powyżej 220 znaków zostało 7, a `config.mjs` nie ma już żadnego.
Ostatnia siódemka zostaje świadomie: `Season.roomGuide` (391) to instrukcja
rysowania pokoi, `Overflow.explainBody` (325) i `Music.trialNote` (288) to
reguły, a cztery pozostałe notatki niosą po jednym fakcie, którego nie da się
wyciąć bez utraty zasady. 220 znaków to cel, nie prawo - tekst, który po
skróceniu przestaje mówić, co zrobić, jest gorszy, nie krótszy.

Przy okazji wyszły dwie rzeczy, które nie były skracaniem:

- `Panel.whoIsAliveNote` nadal opisywał **starą regułę śmierci** ("a death
  empties an inventory"). Poprawione na "destroys Truth Bullets".
- `Monocub.who` ("Which Monocub") odpowiadał na **dwa różne pytania**:
  w `call-effects.mjs` faktycznie wybiera Monocuba, a w `monocub.mjs` etykietuje
  `<select name="target">`, czyli wybiera cel. Rozdzielone na dwa klucze zamiast
  psucia jednego z dwóch miejsc.
- `Trial.objectionWarning` kończył się "leaves the discussion running" - ostatnie
  miejsce, w którym "discussion" znaczyło otwartą debatę (Q14).

Sprawdzone maszynowo: żaden nowy tekst nie wymyślił placeholdera, którego
wywołujący nie podaje. Jedyny usunięty to `{item}` w `Items.stowShape`, co jest
bezpieczne - Foundry ignoruje nadmiarowe dane.

#### Lista wyjściowa

| Klucz | Znaków | Propozycja |
| --- | --- | --- |
| `Season.roomGuide` | 1047 | dwa zdania + link do handbooka: "Walls first, then one named Region per room, drawn to the walls with snapping on. A doorway is a gap in the walls. The check below reports overlaps, borders off their walls and corners off the grid; it never edits the map." |
| `Overflow.explainBody` | 549 | "Despair past a full pool collects here. At the threshold it pays that much and one effect is drawn from the GM's pool for one time of day. A verdict empties it." |
| `Music.trialNote` | 457 | "Objection beats Debate beats Discussion. A rebuttal keeps the Objection's music. Each pick is a random track, never the last one. Give the Objection playlist a short fade." |
| `Season.hint.cursor` | 335 | "Foundry shows every cursor to the table with a name on it. This hides the two GM roles' pointers; players keep theirs." |
| `Settings.isoTokenShield.hint` | 334 | "Keeps Isometric Perspective out of token configuration windows, where it breaks editing. The map projection is untouched. Off to reach its Isometric tab; no reload." |
| `Vault.manageNote` | 294 | "Favoured category: advantage when searching for it here. Bad category: disadvantage. A room with no table falls through to the global pool." |
| `Tables.newPoolNote` | 284 | "A room table is what a room stocks; point a room at it in Room Setup. Tier tables answer dice and cannot be assigned. "Room - Tier N" answers that roll in that room first." |
| `TruthBullet.remnantNote` | 258 | "The bullet copies the trace: type, difficulty, room, action and crime tie. The marker becomes visible to whoever holds it. Renaming here renames the trace." |
| `Murder.betrayalRule` | 248 | "Two bodies, one evening: the trial untangles two killings. Blackened for the first is not Blackened for the second. Decide by the end of the day." |
| `Vault.stashesIntro` | 248 | "Who has a stash where, and whether it is hidden. Click a cell to cycle: none, open, hidden. A bedroom gives its owner an open stash." |
| `Trial.objectionWarning` | 240 | "An OBJECTION takes the floor: {objection} s for you alone, then {rebuttal} s of rebuttal with the person you name. Presenting leaves the discussion running." |
| `Overflow.explainVeil` | 239 | "Players see "?" instead of the number. A courtesy, not a secret: the counter is world data." |
| `Vote.verdictNote` | 237 | "Right: the Blackened is executed, survivors Level Up. Wrong or tied: the accused is executed, the Blackened stays with a Reinforced Level Up and a new rule, and every pool fills." |
| `Chapter.endNote` | 231 | "Revealing types is permanent. Nothing else here deletes anything; Faint Remnants and Truth Bullets are swept from the Investigation Dashboard." |
| `Anonymity.aboveLimited` | 228 | "Shared as Owner to everyone, so the redaction never runs: {actors}. Set them back to Observer." |
| `Tables.rolesNote` | 225 | "Also works as: tick what this entry can do besides its own category. It still takes one slot." |
| `Explain.phase.investigation` | 261 | "A body has been found. Observe traces, Analyze what you collect, and build the Truth Bullets you will present at the trial." |
| `Murder.openSelfNote`, `openedSelfNote`, `Season.hint.sound`, `Settings.regionFog.hint` | 222-232 | po jednym zdaniu do wycięcia w każdym |

### F3 · Nieczytelne albo niezręczne - **dziewięć z dziewięciu, 03.09**

`Eclipse.announce.*` skrócone w trzeciej turze; reguła o akcjach mieszka
w `Hud.eclipseRunningTooltip`. `Floor.mode.discussion` to Q14.

| Klucz | Teraz | Propozycja |
| --- | --- | --- |
| `Observe.requestPrompt` | "The dice are thrown. Now say what you were looking for. The GM matches it against the room without seeing your roll, so this makes nothing easier or harder." | "What were you looking for? The GM matches it to the room without seeing your roll." |
| `Items.stowShape` | "{item} is the only {group} in your hands. Two stowed is one too many - ready the other one first, or drop it." | "Only one {group} may be stowed. Ready the other one first, or drop it." |
| `Bridge.nothingThere` | "There is nothing" | "Nothing was there." |
| `Floor.mode.discussion` | "Nonstop Debate" pod kluczem `discussion` | patrz Q14 |
| `Eclipse.announce.*` | trzy zdania o akcjach w środku komunikatu o świetle | "Lights out. Place your token: up to {n} connected rooms. Nobody sees anyone until the Eclipse ends." (reszta w tooltipie HUD) |
| `Panel.whoIsAliveNote` | 210 znaków tłumaczące, co robi dropdown | "The dropdown only fixes a flag. The buttons run the real thing." |
| `Season.introOutstanding` | "A season can start without them - it just starts wrong..." | "{n} still to do. Each missing piece shows up the moment it matters." |
| `Cleanup.transformActionHint` | cztery zdania | "Rename it and describe it as something innocent. Threshold three lower than erasing; a critical also makes it quieter and refunds the Sanity." |
| `Monocub.silencedNote` | wspomina "Confusion" bez wyjaśnienia | "They cannot discuss the crime until the chapter ends. Confusion still works." |

### F4 · Kopia w `config.mjs` - **częściowo, i celowo**

Reguła "hint = jedno zdanie" nie przetrwała zderzenia z kodem. 74 pola były
ponad limitem, ale to niemal wyłącznie hinty dźwięków, które trzymają celowy
dwuczęściowy kształt: **kto to słyszy** i **dlaczego to ma znaczenie**. To są
dokładnie dwa pytania, które DM ma, przypisując plik do zdarzenia. Sklejenie ich
w jedno zdanie usunęłoby jedną z dwóch odpowiedzi.

Przycięte zostały trzy realnie rozwlekłe (trzyzdaniowe: `sabotageFailed`,
`projectDone`, `analyzeMiss`) plus `meddle`, jedyny powyżej 220 znaków.
`config.mjs` nie ma już żadnego pola ponad limitem długości.

#### Oryginalna propozycja

Opisy akcji (`ACTIONS[*].description`, `hint`), efekty Calli
(`HOPE_CALLS`/`DESPAIR_CALLS` `effect`), hinty SFX (`SFX_EVENTS[*].hint`) to
akapity. Ten sam limit: hint jedno zdanie, description dwa. Hinty SFX
(np. "This one is heard constantly, so each play bends its speed very
slightly...") można wyciąć do "Bends slightly on each play."

### F5 · Spójność terminów - **sprawdzone**

"Advancement" nie występuje w żadnym tekście użytkownika - `en.json` mówi
wszędzie "Level Up", więc drugi punkt był już spełniony. "Which Monocub"
naprawione (wyżej). "Trace" / "Remnant" to E5 i należy do sekcji E, nie do
tego kroku.

#### Oryginalna lista

- "Trace" / "Remnant" (E5).
- "Level Up" (kopia) vs "Advancement" (kod, API, makro `advancement.js`) - kod
  może zostać, ale tooltip przycisku i tytuł okna niech mówią jedno.
- "Confusion" (kopia) vs `meddle` (klucz) - zgodnie z komentarzem w config,
  celowe; wystarczy pilnować, żeby "Meddle" nie wyciekło (jest w
  `Monocub.who` "Which Monocub" - to akurat błąd: pole wybiera **cel**, nie
  Monocuba; powinno być "Who").
- "time of day" konsekwentnie, dobrze. "GM" / "Gamemaster" / "Monokuma" w
  komunikatach do gracza - Monokuma tam, gdzie mówi fikcja, GM tam, gdzie mówi
  moduł.

---

## G. Co działa dobrze (nie ruszać)

- Klucze odpowiedzi poza światem: ledgery Truth Bulletów i Remnantów, Mastermind,
  plan pułapek; każdy socket sprawdza `senderId` po obu stronach.
- `migrate.mjs`: klauzule idempotentne, gate na `since`, odczyt zwrotny po
  usunięciu klucza.
- `live.mjs` `keepLive` / `alreadyOpen` - właściwy model dla okien DMa; trzeba
  go tylko konsekwentnie użyć (E6).
- `sync.mjs` koalescencja, `music.mjs` `asOurs` licznik, `voice-client.mjs`
  kolejka apply - trzy dobrze rozwiązane wyścigi.
- Karty orzeczeń z przyciskami i `settleCall`.
- Tier 0 testów czytających źródło - to ten mechanizm powinien dostać regułę
  z A1.
- `api.mjs` normalizacja "actor albo id".

---

## H. Proponowana kolejność

1. **Naprawy P1/P2 w kodzie:** A1, A2, A26 (usables 3), A6, A7, A10, A12, trzy `&mdash;`, pusty blok `clock.mjs:110`, blok rename w
   `retuneRemnant` (Q13), `PROJECT_ITEMS` (Q12) (pół dnia). Wszystkie
   pytania rozstrzygnięte 2026-09-02.
1b. **LIVE-001 ledgerem (A5, decyzja Q16):** tożsamość stron incydentu do
   ledgera GM-side na wzór Mastermind; `murderState` w świecie tylko z tym, co
   gracz i tak widzi. Pół dnia plus test w sandboxie na dwóch kontach.
2. **Formularze, które nie nadążyły (A22-A25):** jedna lista
   `pickableCategories`, podział usables w Item Tables i w pułapce, `bedroomKey`
   poza listami i poza testem "carries something", `goal` w presecie karty
   orzeczenia. Jeden dzień, bo to cztery okna i jeden test w checkliście.
3. **Proporcja pokoi (A21):** flaga "Counts as a room" na zakładce Doors,
   jedna funkcja `sharedRooms()`, jeden wzór w checkliście i w Room Setup.
   Pół dnia.
4. **Kopia i komentarze po decyzjach (A13, A14, F1, B2):** hinty ustawień
   i teksty o śmierci pod to, co kod robi (Q3, Q10 rozstrzygnięte), nagłówki
   `chapter.mjs` i `hud.mjs`, komentarze przy Motive, Relief, TRIAL i limitach,
   komentarz o mipmapach (Q1), hint `enforceAnonymity` (Q11), zmiana nazwy
   trybu floor na `debate` z OBJECTION jako osobnym trybem (Q14). Dwie godziny.
5. **Dieta komunikatów (E1, E3, E7):** jedna reguła powierzchni, przegląd 339
   toastów, tooltipy do 80 znaków. Największy zysk czytelności za najmniej kodu.
6. **Teksty (F2, F3):** en.json i config.mjs, z handbookiem jako autorytetem.
7. **Okna DMa (E6, E8, E9, E10):** `keepLive` zamiast close/reopen, jedna
   zasada Apply, domyślny filtr rozdziału, wspólny formularz "nowy przedmiot".
8. **Skrócenie (C2, C3, A15):** diagnostyka i testy leniwie, duplikaty, martwy
   kod, `patches.mjs`. Mierzalne: minus ~8 tys. linii bez zmiany zachowania.
9. **Komentarze i pliki (C1, C4, C5):** kronika do `docs/decisions.md`, podział
   gigantów, importy statyczne. Duża praca, najlepiej po wydaniu.
10. **CSS (C6):** ostatnie, razem z planem identyfikacji wizualnej.

Po punktach 1-4 (z 1b) moduł nadaje się do wydania. Po 5-7 gra się w niego
lepiej. Po 8-10 da się go utrzymać.

**Uwaga z weryfikacji 03.09:** werdykt mówi "do wydania po A1-A4", a krok 1
nie wymieniał A3 ani A4. A3 poprawione 03.09; A4 czeka na test z kośćmi na
żywo.
