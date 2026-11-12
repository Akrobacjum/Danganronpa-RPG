# Sesja 0 - pakiet sprawdzeń przy prawdziwym stole

Wersja modułu: **1.2.107**. Spisane 12.11.2026 z `audit/AUDIT-1.2.42.md` (sekcja 9.2 i sekcja 7, która według 9.2
"pozostaje w mocy"), `audit/gate/` i `audit/perf-baseline.json`, notatek wydań `.github/release-notes/v1.2.*.md`,
podręczników z `docs/handbooks/` i plików `docs/dev/*/STATUS.md` na otwartych gałęziach.

## Po co to jest

Moduł ma setki rzeczy zmierzonych tylko w przeglądarce bez ekranu (harness w jsdom). Audyt nazywa je "live checks"
(`LIVE-...`): to, czego żaden test bez prawdziwego Foundry nie rozstrzygnie. Ten pakiet zbiera je w jedną listę do
zrobienia przy stole, ułożoną tak, jak płynie sesja - od przygotowania przed wejściem graczy, przez pierwszy dzień,
morderstwo, śledztwo, Class Trial i egzekucję, po przypadki brzegowe na koniec.

Nie trzeba zrobić wszystkiego naraz. Sesja 0 jest prawdziwą grą: większość sprawdzeń z bloków C-G to **patrzenie w trakcie
gry** i zapisanie, co się stało. Sprawdzenia, które wymagają celowego psucia (przeładowania, zamknięcia karty GM-a, prób z
konsoli), są zebrane w blokach J i na koniec, żeby nie przerywały gry.

Ile pakiet rozstrzyga i czego nie, liczy `docs/live/coverage.json` (każdy identyfikator dokładnie raz) i
`node docs/live/check-coverage.mjs`. Wyniki zapisuj w `docs/live/RESULTS-TEMPLATE.md`.

## Jak czytać jedno sprawdzenie

Każde sprawdzenie ma nagłówek: **kod** (np. `C1`), nazwa, **waga** i **czas**.

| Waga | Znaczy |
| --- | --- |
| **[krytyczne]** | porażka może zepsuć grę (rzut nie dociera, ruch nie jest liczony, rozprawa się nie kończy) - zrób przy sesji 0 |
| **[ważne]** | porażka psuje część zasad albo myli stół, ale da się grać dalej - zrób, jeśli jest czas |
| **[miłe]** | wygląd, wygoda, pomiar - zrób przy okazji albo w osobny wieczór |

Potem:

- **Kto i kiedy** - kto klika (GM, gracz A, B, C, drugi GM) i w którym momencie sesji.
- **Co zrobić** - kroki.
- **Co powinno być** - wynik, który znaczy "zaliczone".
- **Porażka** - co znaczy "nie zaliczone".
- **Co zapisać** - zrzut ekranu, linia z konsoli, liczba. Konsola to F12, zakładka *Console*.
- **Rozstrzyga** - identyfikatory z audytu w nawiasie kwadratowym. Pełny opis każdego jest w `audit/AUDIT-1.2.42.md`,
  sekcja 9.2, pod podanym numerem pozycji (`poz.`). "(częściowo)" znaczy, że sesja rozstrzyga tylko część - czego nie,
  mówi linia *Zostaje*. "(po wydaniu E..)" znaczy, że wiersz jest dopiero na otwartej gałęzi i dotyczy wersji, której
  stół jeszcze nie ma: zrób go dopiero po tym wydaniu.

## Zanim zaczniesz - zasady bezpieczeństwa

1. **Zrób kopię świata.** W Setup Foundry: *Duplicate World* (albo kopia na The Forge). Wszystko z bloku A5 i każde
   polecenie, które coś zapisuje, robisz **tylko na kopii**. `game.drpg.runTests({ tier: 2 })` otwiera incydenty, zabija
   postacie i resetuje sezony na własnych danych testowych - podręcznik GM-a mówi wprost: nigdy w świecie, w którym ktoś
   gra.
2. **Na świecie stołu tylko odczyty.** Bezpieczne: `game.drpg.runTests()` (tiery 0-1, nic nie zapisuje),
   `game.drpg.diagnose()`, `game.drpg.relayGuard()`, `game.drpg.a11y()`, `await game.drpg.fps({ toChat: false })`,
   `game.drpg.counters()`, `game.drpg.gmStoreStatus()`, `game.drpg.rollFlags()`, `game.drpg.sheetWrites()`.
3. **`game.drpg.perf()` zostawia ślad na czacie**: raport przychodzi do wołającego szeptem, czyli jako wiadomość w świecie
   (`audit/perf-baseline.json`, *sideEffects*). Na świecie stołu to nic groźnego, ale jeśli nie chcesz tej wiadomości,
   rób `perf()` na kopii. `fps({ toChat: false })` niczego nie zapisuje.
4. **Ustawienia "na próbę"** (`moveAudit` na "sendBack", wyłączanie modułów, Oddaj ustawienia Foundry) - tylko na kopii
   albo po sesji, i zawsze z powrotem.
5. **Dwa profile przeglądarki.** Do sprawdzeń "jako gracz" bez prawdziwego gracza wystarczy drugi profil przeglądarki
   (albo okno prywatne) z kontem gracza testowego. Jedno konto w dwóch kartach to osobny przypadek (J1) - nie rób tego
   przypadkiem.
6. **Zrzuty**: Win+Shift+S (Windows) albo Cmd+Shift+4 (macOS). Nazwij plik kodem sprawdzenia, np. `C1-gracz.png`.
7. **Rozmiar okna 1366x768 bez zmiany monitora**: F12, przycisk *Toggle device toolbar* (Ctrl+Shift+M), tryb
   *Responsive*, wpisz 1366 x 768. To nie jest to samo co prawdziwe okno (powiększenie i paski przeglądarki), więc przy
   sprawdzeniach "przy 1366x768" zapisz, czy był to prawdziwy ekran, czy tryb urządzenia.

## Kto jest potrzebny

| Rola | Kto | Do czego |
| --- | --- | --- |
| GM | właściciel (główny GM) | prawie wszystko |
| Gracz A, B, C | gracze sesji 0 | patrzą i mówią, co widzą; kilka razy proszeni o zrzut albo linię z konsoli |
| Drugi GM | jeśli jest (pełny Gamemaster albo Asystent GM-a) | tylko blok H |
| Ktoś z czytnikiem ekranu, tabletem, Firefoksem | jeśli jest | tylko blok K |

Gracze nie muszą znać konsoli. Gdy sprawdzenie prosi o linię z konsoli gracza, GM mówi, co wpisać, albo robi to sam na
drugim profilu przeglądarki.

## Plan czasu

| Blok | Co | Kiedy | Czas |
| --- | --- | --- | --- |
| A | Przygotowanie, GM sam | dzień przed albo godzinę przed sesją | 75-120 min (A5 na kopii: +45 min) |
| B | Gracze wchodzą | pierwsze 20 minut sesji | 20-30 min |
| C | Pierwszy dzień (Daily Life) | w trakcie gry | 60-90 min gry, z tego ok. 20 min celowo |
| D | Eclipse i morderstwo | w trakcie gry | 45-60 min gry, ok. 15 min celowo |
| E | Odkrycie ciała i śledztwo | w trakcie gry | 40-60 min gry, ok. 10 min celowo |
| F | Class Trial | w trakcie gry | 60-90 min gry, ok. 15 min celowo |
| G | Egzekucja i koniec rozdziału | w trakcie gry | 15-20 min |
| H | Drugi GM | jeśli jest, przy okazji bloków C-G | +30 min |
| J | Przypadki brzegowe | po rozprawie albo osobny wieczór | 30-45 min |
| Z | Odczyty na koniec sesji | na koniec | 10 min |
| I | Ekrany, motywy, rozmiary | osobny wieczór, GM sam z drugim profilem | 60-90 min |
| P | Wydajność i głos | w trakcie gry (pomiar) i na koniec | 20-30 min |
| K | Sprzęt i narzędzia spoza stołu | jeśli są | po 10-20 min |
| L | Lokalna bramka | tylko z piaskownicą v14 | ok. 60 min, bez ludzi |

---

## Blok A - przed sesją (GM sam)

Na świecie stołu, przed wejściem graczy. Wszystko w A1-A4 i A6-A7 tylko czyta albo otwiera okna. A5 robisz na kopii.

### A1 Wersje i czysta konsola [krytyczne] · 10 min · GM, potem jeden gracz

**Co zrobić:**
1. Zapisz wersje: Foundry (Setup, na dole), Daggerheart, Dice So Nice, avclient-livekit, Isometric Perspective
   (*Manage Modules* w świecie albo lista modułów na The Forge). Oczekiwane według ostatnich notatek: Foundry 14.370,
   Daggerheart 2.12.8, Dice So Nice 6.4.5.
2. Wyczyść pamięć podręczną przeglądarki (Ctrl+Shift+Delete, *obrazy i pliki w pamięci podręcznej*), otwórz F12 na
   zakładce *Network*, wejdź do świata. Zapisz czas od kliknięcia *Launch* do pojawienia się HUD-a modułu (zegar w
   rogu), liczbę plików `danganronpa-rpg` w *Network*, ich łączny rozmiar i czas ostatniego.
3. Zakładka *Console*: czy jest jakikolwiek czerwony błąd ze słowem `danganronpa-rpg`? To samo u jednego gracza po jego
   wejściu (blok B).

**Co powinno być:** moduł ładuje się bez czerwonego błędu u GM-a i u gracza.
**Porażka:** czerwony błąd z `danganronpa-rpg`, HUD się nie pojawia, wersje inne niż wyżej (wtedy zapisz je i daj znać -
część sprawdzeń zależy od wersji).
**Co zapisać:** wersje; czas ładowania; liczba i rozmiar plików; zrzut konsoli (także pustej).
**Rozstrzyga:** [LIVE-E30-08, LIVE-E41-01, LIVE-E76-01, LIVE-E75-05 (nie przy sesji 0, zob. niżej), LIVE-E75-04 (nie przy sesji 0, zob. niżej)]

Opis w AUDIT 9.2: poz. 32, 369, 475, 153, 152.

### A2 Strażnik przekaźnika i raport `diagnose()` [krytyczne] · 10 min · GM

**Co zrobić:** w konsoli GM-a, po świeżym wczytaniu świata:
1. `game.drpg.relayGuard()` - odczytaj `state`, `fingerprint`, `unreviewed`. Potem `typeof game.socket.prependAny`.
2. `game.drpg.diagnose()` - otwiera okno raportu. Odczytaj część *The contract with Foundry, Daggerheart and the modules*:
   liczby `ok`, `failed`, `unknown`, i każdy wiersz, który nie jest `ok`. Naciśnij **Kopiuj raport** i wklej do pliku
   tekstowego.
3. Otwórz kartę postaci dowolnego ucznia i jeszcze raz `game.drpg.diagnose()`: wiersz `sheet-anchors` powinien mówić
   "all 18 places found".
4. Arkusze stylów: wklej do konsoli
   `[...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).filter(r => r.href?.includes("danganronpa-rpg")).map(r => [r.href, r.layerName])`
   i `getComputedStyle(document.body).getPropertyValue("--drpg-window-max")`.
5. Powiadomienie o umowie w języku stołu (raz po angielsku, raz po polsku; język modułu w *Configure Settings*):
   `const m = await import("/modules/danganronpa-rpg/scripts/patches.mjs"); m.announceContract({ rows: [{ ...m.PATCHES.find(r => r.id === "door-controls"), probe: () => ({ present: false, ours: null }) }], told: { done: false } })`.
   To tylko pokazuje powiadomienie, niczego nie zapisuje.

**Co powinno być:** `state` "ok" (dopuszczalne "changed" albo "unnamed" z nazwanym wpisem); `unreviewed` puste;
w raporcie żaden `failed`, wiersze `relay-guard`, `roll-draw`, `roll-dialog-context`, `chat-content-visible`,
`chat-notify` są `ok`; arkusze modułu są w warstwie `modules`; powiadomienie z kroku 5 stoi, aż się je zamknie, i jest
całe w jednym języku.
**Porażka:** `state` "noApi", "notFound" albo "backstop" (wtedy rzuty i zmiany Daggerhearta od graczy mogą nie
przechodzić - powiedz od razu); jakikolwiek `failed`.
**Co zapisać:** wynik `relayGuard()` (skopiuj obiekt), plik z raportem, liczby ok/failed/unknown, zrzut powiadomienia.
**Rozstrzyga:** [AUDIT 9.2 poz. 19 (bez id), LIVE-E75-03, LIVE-E52-01, LIVE-E52-04, LIVE-E52-02 (częściowo), LIVE-E52-11, LIVE-E30-09, LIVE-E52-07]

Opis w AUDIT 9.2: poz. 151, B-E52-1, B-E52-4, B-E52-2, B-E52-11, 33, B-E52-7.

**Zostaje:**

  - LIVE-E52-02: Raport i dwa z czterech miejsc (czas powiadomienia, usunięcie wiadomości) przy sesji; pozostałe dwa wymagają celowego wywołania, opisanego w AUDIT.

### A3 Testy tierów 0-1 i odczyty stylu [krytyczne] · 10 min · GM

**Co zrobić:**
1. Ustaw moduł na *Polski* (*Configure Settings*, Danganronpa RPG, *Język*), przeładuj stronę.
2. `game.drpg.runTests()` - tiery 0-1, nic nie zapisuje, trwa kilka minut. Odczytaj cztery liczby na końcu i linie
   R1060 i R972.
3. Otwórz kartę ucznia; F12, *Elements*: atrybut `lang` korzenia karty. Spisz słowa karty, które zostały po angielsku.
4. `copy(JSON.stringify(game.drpg.styleSnapshot()))` - wynik jest w schowku; wklej do pliku `A3-style-<motyw>.json`.
   Raz w Stained Glass, raz w Monokuma Legacy.
5. `game.drpg.diagnoseStyles()` i `game.drpg.diagnoseWindows()` - co mówią o czcionkach.
6. Wróć na język, którym gra stół.

**Co powinno być:** `failed` 0; R1060 i R972 zielone; `lang` = `pl`; żadna czcionka "brakująca", która w rzeczywistości
się ładuje.
**Porażka:** `failed` większe niż 0 - zapisz nazwy testów. Skip sam w sobie nie jest porażką.
**Co zapisać:** cztery liczby (passed, failed, skipped, red), nazwy czerwonych testów, linia R1060, oba pliki JSON,
lista angielskich słów karty.
**Rozstrzyga:** [LIVE-E65-01, LIVE-E66-02, LIVE-E44-01, LIVE-E52-08]

Opis w AUDIT 9.2: poz. 361, 363, 377, B-E52-8.

### A4 Ustawienia modułu, Ustaw sezon i Kontrola przed sezonem [ważne] · 20 min · GM

**Co zrobić:**
1. *Configure Settings* > Danganronpa RPG: moduł ma jeden wiersz z przyciskiem **DRPG Settings**. Otwórz go: GM widzi
   siedem sekcji. Zmień język i naciśnij Zapisz - Foundry pyta raz o przeładowanie; Anuluj nic nie zmienia.
2. Przy 1366x768 w obu językach: każda nazwa ustawienia na jednej linii, kolumna etykiet jednej szerokości, zaznaczone
   pole i fokus w kolorze modułu, nie bursztynowe.
3. Panel GM-a > **Ustaw sezon**: otwiera się na górze, z kursorem w nazwie kampanii. **Otwórz** przy jednym wierszu
   (np. *Każdy ma Ultimate*) - otwarte okno stoi przed listą.
4. **Kontrola przed sezonem**: odczytaj procent "poza pokojami" (także w **Sprawdź pokoje**). Przy każdym wierszu
   Sprawdź pokoje naciśnij **Pokaż na mapie** - mapa przesuwa się i zaznacza granicę.
5. Pod Monokuma Legacy: w *Edytuj kampanię*, *Despair Flow* (zakładka Overflow) i *Ustaw sezon* przyciski - i +
   trzymają się min i max; zakładki mieszczą się w jednej linii.
6. **Oddaj ustawienia Foundry**: tylko sprawdź, że przycisk jest u GM-a (sekcja *Techniczne*), a u gracza go nie ma, i
   że otwiera okno z listą. **Nie naciskaj Oddaj je na świecie stołu** - pełne sprawdzenie jest w A5 na kopii.

**Co powinno być:** jak w krokach; procent "poza pokojami" na skończonej mapie poniżej 10.
**Porażka:** okno przewinięte na dół, ucięty tekst, okno otwarte pod listą, krzyżyk przy wierszu, który nie jest
wymagany.
**Co zapisać:** zrzuty Ustaw sezon i Kontroli przed sezonem w obu motywach; procent "poza pokojami" (przy skończonej
mapie i - jeśli jest - przy mapie z jednym pokojem nienarysowanym).
**Rozstrzyga:** [LIVE-E49-02, LIVE-E47-06, LIVE-E20-01, LIVE-E46-05, LIVE-E20-07, LIVE-E20-05, LIVE-E44-05, LIVE-E20-06]

Opis w AUDIT 9.2: poz. 469, 443, B-E20-1, 435, B-E20-7, B-E20-5, 381, B-E20-6.

### A5 Kopia świata: tier 2 i zapisy z konsoli [ważne] · 45-60 min · GM sam, na kopii

**Tylko na kopii świata.** Na świecie stołu nie.

**Co zrobić:**
1. Na kopii, jako GM: `game.drpg.runTests({ tier: 2 })`. Najpierw otwiera się okno z nazwą świata. Naciśnij od razu
   **Enter** - ma wybrać Anuluj (nic się nie dzieje). Potem jeszcze raz i *Uruchom*. Zapisz cztery liczby, nazwy
   pominiętych testów siatki (`tests-grid`) i czas całości.
2. Klucz `-=`: w konsoli na aktorze ucznia
   `const a = game.actors.find(x => x.type === "character"); await a.setFlag("world", "probe", { x: 1, y: 2 }); await a.update({ "flags.world.probe.-=x": null }); a.getFlag("world", "probe")`
   - zapisz, czy `x` zniknął, czy jest klucz `-=x`, czy jest ostrzeżenie w konsoli. Potem
   `await a.update({ "flags.world.-=probe": null }); a.flags.world`, i zastąpienie:
   `await a.setFlag("world", "probe", { x: 1 }); await a.update({ "flags.world.==probe": { z: 3 } }); a.getFlag("world", "probe")`
   (ma być samo `{ z: 3 }`). Na koniec `await a.unsetFlag("world", "probe")`.
3. Operatory: `foundry.data.operators.ForcedDeletion`, `typeof foundry.data.operators.ForcedDeletion?.create`,
   `typeof foundry.data.operators.ForcedReplacement?.create` i, jeśli taka nazwa istnieje w konsoli, `typeof _del`.
4. Haki przy zapisie: `Hooks.once("preUpdateActor", (d, c) => console.log("pre", JSON.stringify(c)))` i to samo z
   `updateActor`, potem `a.unsetFlag(...)` - zapisz, co dostaje hak.
5. Okna nieodwracalne: w każdym oknie, które kończy coś na stałe (śmierć postaci, ogłoszenie ciała, koniec rozdziału,
   wyrok, Sweep, usunięcie tabeli, usunięcie puli Despair, wyczyszczenie overflow, koniec morderstwa, Reset sezonu, Usuń
   projekt), naciśnij Enter zaraz po otwarciu. Ma wybrać Anuluj.
6. Reset sezonu z tokenami projektów i z wyborem "każdy do własnej sypialni", potem "wszyscy do jednego pokoju": żadnego
   tokenu projektu po resecie, tokeny obsady tam, gdzie wybrano.
7. Z konsoli: `game.drpg.killCharacter("literówka")` (ostrzeżenie z nazwą, nic się nie dzieje); usuń projekt bez opisu
   (Usuń - czy przechodzi); okno kitu z `close` (polecenie w AUDIT poz. 398).
8. **Oddaj ustawienia Foundry** > **Oddaj je**, przeładuj, sprawdź listę; **Przejmij je znowu**.
9. Dwa światy na jednym serwerze: po *Duplicate World* zapisz `game.world.id` w obu.

**Co powinno być:** tier 2 `failed` 0; Enter zawsze wybiera Anuluj; reset czysty.
**Porażka:** czerwony test tieru 2; Enter, który coś wykonuje; token projektu po resecie.
**Co zapisać:** cztery liczby tieru 2 i nazwy czerwonych; odpowiedzi z kroków 2-4 (skopiuj z konsoli); `game.world.id`
obu światów.
**Rozstrzyga:** [LIVE-E30-10, LIVE-E32-01, LIVE-E30-01, LIVE-E76-03, LIVE-E30-02, LIVE-E30-03, LIVE-E05-09, LIVE-E04-07, LIVE-E04-10 (częściowo), LIVE-E81-14, LIVE-E81-16, LIVE-E21-06, LIVE-E22-01, LIVE-E21-07, LIVE-E52-10, LIVE-E24-07, LIVE-E11-01, LIVE-E11-07, LIVE-E45-02]

Opis w AUDIT 9.2: poz. 34, 75, 25, 477, 26, 27, 61, 47, 50, 196, 198, 398, 390, 399, B-E52-10, 420, 154, 160, 425.

**Zostaje:**

  - LIVE-E04-10: Odczyt game.settings.storage.get("world") zrobimy; "świat zaktualizowany z v1.1.0" wymaga kopii takiego świata.

### A6 Ustawienia pokoi, przejścia, zdjęcia i realizacja [ważne] · 20 min · GM

**Co zrobić:**
1. *Ustawienia pokoi* na scenie szkoły, w obu motywach, przy 1366x768 i 1920x1080: każda karta ma stopkę (Zastosuj,
   Anuluj) na ekranie; kolumny stałej szerokości; licznik Search Tokenów w jednym wierszu; zakładka **Przejścia**:
   kolumny Rodzaj, Kształt, Pochodzenie zaraz po Pokoje, bez przewijania w bok.
2. Zakładka Przejścia: **+ Nowe przejście**, dwa kliknięcia na ścianie, uczeń, któremu GM je daje. Zrób tunel
   dwukierunkowy, jednokierunkowy i schody (jeśli scena ma piętra). Nakładka GM-a: pod kółkiem tunelu napis, dokąd
   prowadzi; obrys pokoju przerwany tam, gdzie przejście (przy powiększeniu 0.4-1).
3. Pokój z dwóch kawałków i Sąsiedzi: wpisz Sąsiadów i sprawdź w C1, czy Listen gracza idzie za listą.
4. Zdjęcia pokoi: na karcie Opis trzy zdjęcia - jedno ponad 8 MB albo ponad 4096 px, jedno małe, jedno, którego pliku
   nie ma. Pod dużym ostrzeżenie z rozmiarem, pod brakującym ostrzeżenie. Jedno zdjęcie z Assets Library The Forge.
   F12 > *Network*: kafelek pobiera zdjęcie tylko z tego serwera.
5. *Tabele przedmiotów* i okno *Dźwięk*, karta Efekty: **Wybierz**, **Test**, **Wyczyść** przy jednym wierszu.
6. Realizacja sprawy (mapa sprawy): **Podgląd realizacji**, wybór pokoju dla dwóch miejsc, **Uruchom realizację**.
   Każdy Key Remnant stoi w regionie swojego pokoju. **Cofnij realizację** usuwa tylko nieznalezione (sprawdź po E2, gdy
   gracz już coś znalazł).

**Co powinno być:** jak w krokach.
**Porażka:** ucięta stopka, przewijanie w bok, przejście bez przerwy w obrysie, zdjęcie pobierane z innego serwera, Key
Remnant poza swoim pokojem.
**Co zapisać:** zrzuty zakładki Przejścia i nakładki GM-a w obu motywach; zrzut panelu *Network* przy zdjęciu.
**Rozstrzyga:** [LIVE-E12-06, LIVE-E46-01, LIVE-E80-04, LIVE-E79-06, LIVE-E79-05, LIVE-H82-03, LIVE-H82-04, LIVE-E12-09, LIVE-E20-04, LIVE-E46-02, LIVE-E46-04, LIVE-E46-03, LIVE-E97-02, LIVE-E77-03, LIVE-E78-11]

Opis w AUDIT 9.2: poz. 168, 431, 266, 243, 242, 277, 278, 171, B-E20-4, 432, 434, 433, 483, 207, 233.

### A7 Okna modułu na ekranie [miłe] · 30 min · GM (można przenieść do bloku I)

**Co zrobić:** w obu motywach, przy 1366x768 i 1920x1080, po polsku i po angielsku, otwórz raz każde okno GM-a z panelu
(Ustawienia pokoi z zakładką Tajne przejścia, Zajrzyj do skrytek, Tabele przedmiotów, Uczniowie, Edytuj kampanię,
Despair Flow, Ustaw sezon, Dźwięk, Daj przedmiot, Daj Truth Bullet, projekty: Utwórz projekt, Edytuj projekt). Przy
każdym:
- stopka i jej przyciski na ekranie, przewija się tylko treść;
- żaden nagłówek, przycisk ani komórka nie są ucięte po polsku;
- podwójne kliknięcie paska tytułu zwija i rozwija okno;
- Escape zamyka okno bez odpowiedzi, Enter w polu tekstowym wciska przycisk główny;
- pole opisu projektu zajmuje szerokość formularza;
- *Despair Flow* (okno GM Team) pod Stained Glass: poświata ramy w kolorze stanu, nie czerwieni GM-a; zakładka Overflow:
  tabele zasad bez ucięć.
Potem raz z jasnym motywem Foundry (ustawienia rdzenia: interfejs jasny, aplikacje jasne, i odwrotnie): ramki *Foundry
tools* i *Map tools* czytelne.

**Co powinno być:** wszystko na ekranie i czytelne.
**Porażka:** ucięty przycisk, przewijanie całego okna, okno szersze niż ekran.
**Co zapisać:** zrzut każdego okna, które coś ucina (z motywem, językiem i rozmiarem w nazwie pliku).
**Rozstrzyga:** [LIVE-E21-01, LIVE-E21-09, LIVE-E41-02, LIVE-E46-07, LIVE-E47-10, LIVE-E44-08, LIVE-E44-09, LIVE-E24-11, LIVE-E47-07, LIVE-E24-06, LIVE-E22-06, LIVE-E46-06 (częściowo), LIVE-E93-03 (po wydaniu E93)]

Opis w AUDIT 9.2: poz. 387, 401, 370, 437, 447, 385, 386, 428, 444, 419, 397, 436.

**Zostaje:**

  - LIVE-E46-06: Wygląd zakładki Overflow sprawdza A7; przycisk naciśnięty przez drugiego GM-a - blok H.

---

## Blok B - gracze wchodzą

### B1 Pierwsze logowanie gracza [ważne] · 5 min · każdy gracz przy wejściu, GM patrzy

**Co zrobić:**
1. Gracz loguje się pierwszy raz (najlepiej konto, które jeszcze nie widziało świata). Patrzy: czy otwiera się dziennik
   powitalny Daggerheart (przy włączonym *Trzymaj okno powitalne Daggerheart zamknięte u wszystkich* nie powinien) i czy
   Foundry otwiera mu okno *User Configuration* (przy starcie ma się zamknąć samo; otwarte kliknięciem zostaje).
2. Konto nazwane jak wolny uczeń (np. inna wielkość liter albo bez polskich znaków): po pierwszym starcie ma tego ucznia
   jako postać.
3. Przy włączonym *Bez przeglądarki plików dla graczy*: kliknięcie portretu na karcie gracza nic nie otwiera, u GM-a
   otwiera przeglądarkę plików.
4. GM w konsoli, **zanim** gracz wejdzie:
   `Hooks.on("userConnected", (u, on) => console.log("userConnected", u.name, on, performance.now()))`. Zapisz, co i
   kiedy przyszło. (To samo zrób u jednego gracza, a potem przeładuj GM-a: co gracz dostaje najpierw.)

**Co powinno być:** jak w krokach; żadna postać nie trafia do złego konta.
**Porażka:** dziennik powitalny się otwiera mimo przełącznika; gracz ma postać innego gracza; gracz otwiera przeglądarkę
plików.
**Co zapisać:** linie `userConnected` z czasami; zrzut, jeśli coś się otworzyło.
**Rozstrzyga:** [LIVE-E79-09, LIVE-E79-10, LIVE-E79-11, LIVE-E79-12, LIVE-E04-12]

Opis w AUDIT 9.2: poz. 246, 247, 248, 249, 52.

### B2 Wygląd kości i Dice So Nice [ważne] · 10 min · GM i dwóch graczy

**Co zrobić:**
1. Każdy w swojej przeglądarce: `game.drpg.diagnoseDiceLook({ test: true })` (GM może też przez *Ustaw sezon* >
   *Kontrola przed sezonem* > *Wygląd kości* > *Otwórz wygląd kości*). Zapisz, czy wersje DSN i Daggerhearta, preset Hope i
   Despair zgadzają się z oknami ustawień tej osoby i czy rzut próbny wygląda tak, jak mówi jego wiersz.
2. U każdego: `game.users.getName("<nazwa gracza>").getFlag("dice-so-nice", "saved")` - przy wymuszonym wyglądzie ma być
   `{ appearance: true, sfx: true }`.
3. Gracz zmienia swój wygląd w oknie DSN - po chwili wraca wygląd GM-a i raz w sesji widzi "Your dice look is set by
   the GM.".
4. GM: w ustawieniach DSN widoczność na wszystkie kości (nie "Show only mine"); Monokuma GM-a stoi w pokoju gracza. Gracz
   rzuca akcję, statystykę z karty i rzut prywatny. U rzucającego: kości w wyglądzie GM-a, bez efektów specjalnych poza
   oznaczonymi przez GM-a jako globalne; w Stained Glass na karcie rzutu kość Nadziei złota, Rozpaczy różowa, cyfry
   czytelne. U GM-a: kości gracza tylko wtedy, gdy jego Monokuma stoi w tym pokoju. U postronnego (gracz w innym pokoju):
   żadnych kości prywatnego rzutu.
5. Pomiar (10 rzutów akcji i 10 statystyk z karty u gracza): potem w jego konsoli `game.drpg.perf()` i spisz mediany z
   wierszy "drawn for this browser, asked to dice started" i "asked to dice shown" (z "the answer in"). GM ocenia na oko,
   czy jego kości ruszają razem z kartą gracza albo przed nią.

**Co powinno być:** jeden wygląd kości przy stole; postronny nic nie widzi; start kości przed odpowiedzią GM-a.
**Porażka:** gracz ma własne kości albo efekty, które nie są globalne; postronny widzi kości prywatnego rzutu.
**Co zapisać:** wynik `diagnoseDiceLook` z każdej przeglądarki; mediany z `perf()`; zrzut karty rzutu w Stained Glass
(zwykłej i krytyka).
**Rozstrzyga:** [LIVE-E60-05, LIVE-E16-04, LIVE-E16-03, LIVE-E76-05, LIVE-E76-07, LIVE-E60-06 (częściowo), LIVE-E60-09, LIVE-H82-01, LIVE-H82-05, LIVE-H82-06, LIVE-E29-09, LIVE-E28-01, LIVE-E06-03, LIVE-E79-17]

Opis w AUDIT 9.2: poz. 372, 269, 270, 479, 481, 375, 376, 275, 279, 280, 118, 94, 69, 254.

**Zostaje:**

  - LIVE-E60-06: Wymaga Daggerhearta 2.9.x (stół ma 2.12.8); przy sesji sprawdzamy to samo zachowanie na wersji stołu.

### B3 Głos na starcie (avclient-livekit) [krytyczne] · 10 min · GM i dwóch graczy

**Co zrobić:**
1. Gracz, który miał "Use separate window for A/V", łączy się z głosem w oknie Foundry (bez okna Join i bez karty
   meet.livekit.io).
2. Przy włączonym *Voice tile instead of the camera dock*: dok kamer schowany u wszystkich, a mimo to innych słychać,
   także po F5. Przy wyłączonym: dok widoczny, a przyciski w rogu i kafelek powiadomień stoją nad jego górną krawędzią.
3. Kafel głosu: przejdź przez stany mikrofonu - włączony, naciśnij-aby-mówić, wyciszony przeze mnie, blokada GM-a (kłódka),
   bez połączenia. Słowo stanu ("Połączono", "Łączenie", "Rozłączono", "Zablokowano") stoi na wysokości przycisków.
4. Lista **Kogo słyszysz**: GM blokuje gracza z listy - mikrofon gracza przestaje nadawać u wszystkich; gracz ustawia
   głośność i *Wycisz u siebie* - zostają po F5.
5. Zębatka > sekcja *Głos*: urządzenia, tryb i klawisz zmieniają to samo, co ustawienia doku.
6. Pierwszy mówiący na pustym kafelku: portret pojawia się od razu (bez ćwierć sekundy czekania); zmiana na drugiego
   mówiącego czeka chwilę.
7. GM otwiera listę graczy przyciskiem komunikatora: lista nie zasłania kafla głosu.
8. W konsoli GM-a `game.drpg.diagnoseVoice()`: żadnego ostrzeżenia o sekrecie LiveKit dla serwera, którego używa stół
   (zapisz `game.settings.get("avclient-livekit", "serverType")`).

**Co powinno być:** każdy słyszy każdego w tym samym pokoju; blokada GM-a działa; nic nie zasłania kafla.
**Porażka:** ktoś nie słyszy po F5; blokada GM-a nie wycisza; okno Join się pojawia.
**Co zapisać:** zrzuty kafla w każdym stanie (oba motywy, 1920x1080 i 1366x768); wynik `diagnoseVoice()`.
**Rozstrzyga:** [LIVE-E19-06, LIVE-E19-07, LIVE-E78-02, LIVE-E78-03, LIVE-E78-04, LIVE-E52-03, LIVE-E05-11, LIVE-E44-04, LIVE-E79-21, LIVE-H84-03, LIVE-E79-20, LIVE-E19-10, LIVE-E50-06, LIVE-E78-10, LIVE-E92-01 (po wydaniu E92)]

Opis w AUDIT 9.2: poz. 281, 282, 224, 225, 226, B-E52-3, 63, 380, 258, 319, 257, 290, 351, 232.

### B4 Pierwszy rzut gracza dociera do GM-a [krytyczne] · 10 min · gracz A, GM, gracz B jako postronny

To najważniejsze sprawdzenie sesji: zgłoszenie z 14.10 (1.2.77) mówiło, że akcje z siatki kończyły się "That action
could not be completed. Tell the GM.".

**Co zrobić:**
1. GM połączony. Gracz A robi akcję z siatki (np. Search) i klika statystykę na karcie postaci.
2. GM ma wcześniej w konsoli: `game.drpg.relayGuard().refused` (zapisz przed i po).
3. Gracz A rzuca akcję z przewagą: karta i formuła pokazują d12, d12 i d6; nagłówek karty to postać gracza, nigdy GM.
4. Gracz A rzuca obronę z karty czatu akcji z obroną: karta jest oznaczona raz, z sumą i krytykiem.
5. Gracz A rzuca z wydaniem Hope: u GM-a Hope postaci spada raz.
6. Gracz A z 0 Nadziei klika w oknie rzutu doświadczenie bez Calla: przycisk Rzut gaśnie.
7. Gracz A klika akcję na karcie (np. Observe) przy włączonej blokadzie okna rzutu: okno jest całe, jak u GM-a, kontrolki
   zablokowane; sprawdź select trybu, pasek tytułu i chip Reaction w obu motywach.
8. Gracz B (inny pokój), w konsoli:
   `game.messages.contents.slice(-3).map(m => JSON.stringify(m.rolls?.[0]?.toJSON?.() ?? null).slice(0, 400))` - w
   rzucie modułu nie ma id, nazwy ani uuid aktora. Kropka zakładki Chat u B: zapisz, czy zapala się przy zasłoniętej
   karcie.
9. GM: z konsoli albo makra `game.drpg.publicRoll("2d6", { flavor: "test" })`, raz z zaznaczonym tokenem ucznia - każdy
   gracz czyta wynik, Dice So Nice też, a karta mówi imieniem GM-a, bez aktora i tokenu.

**Co powinno być:** rzut statystyki losuje przeglądarka GM-a i jest na czacie; w konsoli gracza nie ma "Could not
send ... to the GM"; `relayGuard().refused` bez `unknownSender`; odliczanie, które tyka rzut gracza, tyka raz.
**Porażka:** "That action could not be completed. Tell the GM."; brak rzutu; Hope nie spada albo spada dwa razy;
`unknownSender`.
**Co zapisać:** linia z konsoli gracza (także pusta); `relayGuard().refused` przed i po; zrzut karty rzutu u rzucającego,
u GM-a i u postronnego.
**Rozstrzyga:** [LIVE-E84-01, AUDIT 9.2 poz. 18 (bez id), LIVE-E76-04, LIVE-E28-12, LIVE-E29-10, LIVE-E28-14, LIVE-E28-09, LIVE-E76-02, LIVE-E33-10, LIVE-E06-02 (częściowo), LIVE-E06-04, LIVE-E33-03, LIVE-E29-07, LIVE-E16-01 (częściowo), LIVE-E60-08, LIVE-E16-02, LIVE-E28-04 (częściowo), LIVE-E29-08 (częściowo), LIVE-E28-02 (nie przy sesji 0, zob. niżej), LIVE-E33-04]

Opis w AUDIT 9.2: poz. 237, 478, 105, 119, 107, 102, 476, 134, 68, 70, 127, 116, 267, 374, 268, 97, 117, 95, 128.

**Zostaje:**

  - LIVE-E06-02: Sprawdzamy na Daggerheart stołu (2.12.8); porównanie z 2.6.5 wymaga drugiej instalacji.
  - LIVE-E16-01: Sprawdzamy na wersji stołu; porównanie z 2.10.5 wymaga drugiej instalacji.
  - LIVE-E28-04: Odcisk szwu na wersji stołu czyta relayGuard i diagnose (A2); porównanie 2.6.5 i 2.10.x wymaga dwóch instalacji.
  - LIVE-E29-08: Na wersji stołu tak; 2.6.5 wymaga drugiej instalacji.

---

## Blok C - pierwszy dzień (Daily Life)

Większość tego bloku to patrzenie w trakcie zwykłej gry. Poproś graczy na początku: "jeśli coś wygląda dziwnie, zrób
zrzut i powiedz godzinę".

### C1 Ruch: pierwsze przeciągnięcie do nowego pokoju [krytyczne] · 10 min · GM i gracz A, gracz B patrzy

**Co zrobić:**
1. GM przeciąga Monokumę, a gracz A swoją postać, myszą do innego pokoju - jeden ruch.
2. To samo przez kilka punktów trasy (przeciągnięcie z przystankami) i raz do pokoju, za który A nie może zapłacić.
3. Gracz B stoi w pokoju, do którego A wchodzi: patrzy, gdzie pojawia się token A.
4. Gracz A w konsoli przed przeciągnięciem z dwoma punktami pośrednimi:
   `Hooks.on("updateToken", d => console.log(d.movement?.pending?.waypoints?.length))` - zapisz, ile aktualizacji
   przychodzi i co pokazują.
5. Po Free Move gracz poprawia token przy drzwiach i o kilka pikseli przekracza granicę (traci akcję). GM w oknie
   *Uczniowie* klika **Refund last crossing**: token wraca, akcja wraca.
6. Postać dwóch graczy (współwłaściciel) przechodzi przez drzwi: na ekranie drugiego właściciela kafelek przechodzi do
   nowego pokoju po ok. 1,5 s; krok odrzucony nie pokazuje odrzuconego pokoju ani na chwilę.

**Co powinno być:** za pierwszym razem kafel pokoju pokazuje nowy pokój (nazwę, opis, zdjęcie), mgła odsłania go z
animacją, przejście jest naliczone raz; po odmowie kafel nigdy nie pokazuje pokoju, do którego postać nie weszła; u B
token A pojawia się na granicy, nie w starym pokoju.
**Porażka:** dopiero drugie przeciągnięcie jest liczone (zgłoszenie z 14.10); przejście liczone dwa razy; token za
ścianą.
**Co zapisać:** na oko albo ze stoperem: czas od puszczenia tokenu do kafla i do mgły u A, u drugiego właściciela i u
GM-a; liczba aktualizacji z kroku 4.
**Rozstrzyga:** [LIVE-E78-14, LIVE-E79-19, LIVE-E77-15, AUDIT 9.2 poz. 15 (bez id), AUDIT 7, punkt 7, LIVE-E89-03, AUDIT 9.2 poz. 22 (bez id), LIVE-E12-07, LIVE-E79-24 (częściowo), LIVE-E17-02, LIVE-E69-04 (po wydaniu E69), LIVE-E92-02 (po wydaniu E92), LIVE-E92-04 (po wydaniu E92)]

Opis w AUDIT 9.2: poz. 236, 256, 219, 344, 169, 261, 308.

**Zostaje:**

  - LIVE-E79-24: Liczenie aktualizacji przy zwykłym ruchu tak; tryb "sendBack" ustawia się tylko na próbie (moveAudit), więc druga połowa w bloku L albo na kopii.

### C2 Mgła, obrys pokoju, drzwi i płótno [ważne] · w trakcie gry, 10 min celowo · gracz A, GM

**Co zrobić:**
1. Gracz przechodzi szybko przez kilka drzwi pod rząd: żaden pokój, w którym nikt nie był, nie prześwituje.
2. Obrys pokoju gracza: poświata ma ten sam kolor co linia po zmianie pory dnia; przy zoomie 0,3, 1 i 3; w Stained Glass
   kolor pory dnia, w Legacy kość. Poświata przejścia przez ściany kończy się na pierwszej ścianie.
3. Mgła w spoczynku, po przesunięciu mapy i po zmianie rozmiaru okna wygląda tak samo; dryf rastra jest płynny.
4. Konsola GM-a, raz: `game.drpg.fogAnimations(false)`, potem `game.drpg.fogAnimations(true)`;
   `game.drpg.diagnoseFog()`, `game.drpg.whyBlack()`, `game.drpg.whatIsHere()`, `game.drpg.checkRegions()`,
   `game.drpg.fogPeek()` - zapisz, czy odpowiadają bez błędu.
5. Ikony drzwi: gracz widzi drzwi tylko tych pokoi, które mgła mu zostawia; żadnych tajnych drzwi Foundry; GM widzi
   wszystkie.
6. Zaznaczanie na płótnie (GM): token, kafel, rysunek, notatka, region - ramka w kolorze modułu; ikony drzwi, światła i
   dźwięku zostają widoczne.
7. Linijka ruchu gracza ma kolor obrysu pokoju (nie turkus Foundry). GM w *Ustawieniach sezonu* naciska **Ukryj** przy
   linijce ruchu graczy: stół nie widzi linijki gracza; **Pokaż** ją oddaje.
8. Gracz bez paska scen: T, R, F, ping i przeciąganie tokenu działają. Szablon z karty Daggerheart zostaje na mapie.
9. Region z "Display Scrolling Text": napis regionu pokazuje się; obok rana albo wydana Nadzieja - nad tokenem nie ma
   napisu Daggerheart (w Chromium i w Firefoksie, jeśli ktoś go ma).
10. Kliknięcie zdjęcia na kafelku pokoju: otwiera je w pełnym rozmiarze, bez przycisku pokazania graczom.

**Co powinno być:** jak w krokach.
**Porażka:** prześwitujący pokój; poświata w złym kolorze; widoczne tajne drzwi.
**Co zapisać:** zrzuty obrysu przy trzech zoomach w obu motywach; odpowiedzi poleceń z kroku 4.
**Rozstrzyga:** [LIVE-E34-01, LIVE-E17-06, LIVE-E49-04, LIVE-E88-02 (częściowo), LIVE-E88-06 (częściowo), LIVE-E51-02, LIVE-E51-03, LIVE-E12-05, LIVE-E52-05 (częściowo), LIVE-E52-06, LIVE-E51-05, LIVE-E80-02, LIVE-E77-11, LIVE-E77-16, LIVE-E77-04]

Opis w AUDIT 9.2: poz. 135, 306, 470, 325, 328, 356, 357, 167, B-E52-5, B-E52-6, 359, 264, 215, 220, 208.

**Zostaje:**

  - LIVE-E88-02: Wygląd "po" sprawdzamy przy sesji; zrzuty "przed" (1.2.88) wymagają starego wydania.
  - LIVE-E88-06: Wygląd "po" sprawdzamy przy sesji; zrzuty "przed" (1.2.88) wymagają starego wydania.
  - LIVE-E52-05: Drzwi tak; dwa piętra tylko na scenie testowej (K3).

### C3 Akcje, rzuty i Reroll [krytyczne] · w trakcie gry, 15 min celowo · gracz A, GM

**Co zrobić:**
1. **Search**: gracz robi Search w pokoju z tabelą pokoju (np. "Library - Tier 1"): przedmiot z tabeli pokoju, nigdy z
   poziomu wyższego niż zdobyty, karta mówi, co naprawdę wylosował. W oknie rzutu zmienia Eye na Hand: nagłówek karty i
   chip statystyki mówią Hand. GM w konsoli: `game.drpg.tokensLeft("<pokój>")`.
2. Search bez odpowiedzi GM-a przez 3 minuty (GM celowo nie klika): token pokoju wraca razem z akcją.
3. **Observe** (Ogólne) w pokoju bez śladu: karta GM-a w wątku gracza mówi, jak patrzył. **Palm**: tytuły okien obu rzutów
   "Palm - Shadow, przebij 15" i "Palm - Hand, przebij 10".
4. Okno akcji przy 1366x768: Observe mieści się bez przewijania; pole "Which statistic do you propose?" / "Która
   statystyka?" ma szerokość wiersza; odpoczynek, którego nie da się wziąć, mówi dlaczego.
5. **Reroll** (najważniejsze): prawdziwy Reroll gracza na Observe, Analyze, sprzątaniu, sabotażu, postępie projektu,
   śladzie i rzucie z wynikiem Despair (postać z przypisanym Monokumą). U GM-a żadnego "Refused a...", u gracza żadnego
   komunikatu "... nie została wykonana". Hope zapłacony raz, kości przepisane, stara karta przekreślona z linią "stara
   i nowa suma", Dice So Nice rzucającego pokazuje nowe kości.
6. Na własnym rzucie gracza w menu kontekstowym czatu nie ma pozycji Reroll; "Reroll action roll" i przycisk kości na
   karcie Daggerhearta przy rzucie losowanym przez GM-a niczego nie zmieniają.
7. Karta orzeczenia w zakładce Chat gracza nie ma linii ani przycisku tylko dla GM-a.
8. Liczba kliknięć: `game.drpg.traceClicks()` u gracza, potem Search na Eye, Search na innej statystyce i akcja Dynamic -
   policz kliknięcia od kafla akcji do rzutu. Porównaj z `audit/harness/flow-length.json`.
9. Loaded Die: w *Configure Dice* Foundry ustaw d12 na inną metodę (np. ręczne wpisywanie), gracz kupuje Loaded Die i
   rzuca akcję, którą GM nie losuje (opcjonalne; potem przywróć metodę).

**Co powinno być:** żadna akcja nie "znika"; każdy Reroll przechodzi raz.
**Porażka:** toast "klient GM-a odmówił"; Hope zapłacony dwa razy; Reroll bez nowych kości.
**Co zapisać:** zrzut przekreślonej karty Rerolla; każdy toast odmowy z godziną; liczby kliknięć.
**Rozstrzyga:** [AUDIT 7, punkt 1, AUDIT 7, punkt 2, LIVE-E14-01, LIVE-E29-15, LIVE-E68-05 (częściowo), LIVE-E51-01, LIVE-E07-11, LIVE-E29-11, LIVE-E16-05, LIVE-E68-04, LIVE-E31-01, AUDIT 9.2 poz. 21 (bez id), LIVE-E08-01, LIVE-E33-02 (częściowo), LIVE-E06-08, LIVE-E51-06, LIVE-E16-06, LIVE-E93-01 (po wydaniu E93)]

Opis w AUDIT 9.2: poz. 298, 124, 462, 355, 87, 120, 304, 461, 35, 89, 126, 74, 360, 305.

**Zostaje:**

  - LIVE-E68-05: Liczba kliknięć na 1.2.107 tak; porównanie z 1.2.103 wymaga starego wydania.
  - LIVE-E33-02: Na Daggerheart stołu tak; 2.6.5 wymaga drugiej instalacji.

### C4 Hope Calls, Despair, zegar i Monocub [ważne] · w trakcie gry · gracz A, gracz B, GM

**Co zrobić:**
1. A kupuje Call Experience ze zdaniem: karta w jego wątku mówi "Otwarta do HH:MM" (5 minut od wystawienia, godzina GM-a).
   GM naciska "Stosuje się": Hope schodzi raz, Call czeka na następny rzut A.
2. A pyta drugi raz i nikt nie odpowiada 5 minut: karta kończy się słowami "Nikt nie odpowiedział na czas - zapytaj
   jeszcze raz."; zgoda naciśnięta potem nic nie uzbraja.
3. A robi akcję, która zaczyna odliczanie Daggerhearta: u głównego GM-a toast "Odrzucono zmianę Daggerhearta od <gracz>:
   new countdowns (<nazwa>). Nic nie zostało zmienione."; drugi gracz bez błędu w konsoli.
4. Zamiana Despair w Hope: spadek puli ląduje przy następnej porze dnia na HUD-zie każdego; panel GM-a pokazuje dług.
5. W kapeluszu overflow zaznacz tylko "Despair", odpal, potem Fuel a Monocub: Hope bez zmian, pula spadła.
6. Gracz ustawia w pasku czatu tryb "Self Roll" i rzuca z wynikiem Despair: czy pula Monokumy drgnęła.
7. **Następna pora dnia**: runda gotowości - każdy gracz dostaje jedno okno z *Gotowe* i *Jeszcze chwila*, GM okno z
   listą graczy.
8. GM pauzuje grę na 10 minut i w trakcie pauzy przeładowuje swoją przeglądarkę: zegar pokazuje "Wstrzymano" w miejscu
   nazwy kampanii, wysokość zegara się nie zmienia; po wznowieniu linia minut rusza od tej samej liczby u GM-a i graczy.
9. Muzyka podąża za stanem gry: w konsoli `document.getElementById("drpg-hud").offsetHeight` przy ciszy, po starcie
   playlisty, po zmianie utworu - wysokość się nie zmienia.
10. Zegar serwera: w konsoli GM-a i gracza `game.time.serverTime` i `Date.now()` (zapisz obie); `game.drpg.gmStoreStatus()`
    u GM-a. Przy serii kliknięć pipów Despair gracz w konsoli: odstęp między zmianą ustawienia zegara a rozgłoszeniem GM-a
    (`Hooks.on("updateSetting", s => console.log(s.key, performance.now()))`).
11. Monocub: kafel Confusion (Monocub z 1 Hope ma go dostępnego bez mignięcia arkusza), okno wyboru celu, kości pokoju,
    zasłonięte karty; +1 Confusion w oknie rzutu Daggerhearta jest tylko do odczytu; Meddle odrzucony (cel w innym
    pokoju) nie wystawia karty.

**Co powinno być:** jak w krokach.
**Porażka:** Hope zapłacony bez zgody; odliczanie powstaje mimo toastu; zegar skacze po pauzie.
**Co zapisać:** zrzut karty Calla z godziną; odczyty zegara z kroku 10; wysokości z kroku 9.
**Rozstrzyga:** [LIVE-E18-01, LIVE-E29-12, LIVE-E05-07, AUDIT 7, punkt 10, AUDIT 7, punkt 3, LIVE-E37-02, LIVE-E23-09, LIVE-E17-01 (częściowo), LIVE-E23-02, LIVE-E04-01, LIVE-E90-01, LIVE-E17-11, LIVE-E37-05 (częściowo), LIVE-E33-09, LIVE-E45-04, LIVE-E33-06, LIVE-E28-10, LIVE-E75-01, LIVE-E75-02]

Opis w AUDIT 9.2: poz. 293, 121, 59, 364, 410, 307, 403, 41, 348, 316, 367, 133, 427, 130, 103, 149, 150.

**Zostaje:**

  - LIVE-E17-01: Pauza i przeładowanie w jednej sesji tak; "przez dwie sesje" wymaga drugiej sesji.
  - LIVE-E37-05: Pakiet przed zapisem zegara nie daje się wywołać celowo; przy sesji patrzymy na koniec każdego Eclipse u gracza i zapisujemy, czy coś się zdarzyło dwa razy.

### C5 Przedmioty i karta postaci [ważne] · w trakcie gry · gracz A, gracz B, GM

**Co zrobić:**
1. A ma 3 sztuki jednego przedmiotu (np. trzy Candy) i daje jedną B w tym samym pokoju: u A 2, u B 1; druga dołącza u B
   do pierwszej (jeden wpis, ilość 2).
2. A próbuje dać przedmiot B z innego pokoju: "Postać nie jest tam, gdzie trzeba."; w Eclipse: "Teraz nie da się tego
   zrobić.".
3. Plant na B z pełnymi kieszeniami: przedmiot zostaje u A, A czyta "{who} nie ma miejsca na {item}. Zostaje przy
   tobie.".
4. **Frisk** jawnie na uczniu drugiego gracza: B raz pozwala, raz odmawia, raz nie odpowiada; po odmowie A naciska
   **Zmuś** i rzuca Body.
5. Gracz usuwa przedmiot modułu na karcie Daggerhearta: GM dostaje kartę z **Cofnij**. Gracz daje przedmiot drużynie
   (karta drużyny): odrzucone na kliencie GM-a, GM wie o tym raz na sesję.
6. Blokada zasobów (*lockPlayerResources*) włączona: kropki Hope, Health i Sanity na karcie drużyny i paski HUD tokenu
   tylko do odczytu; wygląd arkusza z blokadą i bez.
7. Paski tokenu: nietknięty uczeń ma dwa pełne paski; po trafieniu mówią to samo co karta; inny gracz nie widzi paska
   Sanity; pola liczbowe HUD wyłączone. Dwóch klientów tego samego ucznia (kropki Daggerheart włączone i wyłączone)
   widzi ten sam zapas.
8. Arkusz tej samej uczennicy otwarty u właściciela, drugiego gracza i GM-a: właściciel trzy razy szybko wpisuje
   Zdrowie (blokada wyłączona), potem GM dwa razy - liczba zmienia się bez mignięcia, ta sama u wszystkich.
9. Gracz pisze w polu *Przeszłość*, a GM w tym czasie zmienia mu Hope: tekst i fokus zostają. Krój biografii czytelny
   przy suwaku 80, 100 i 140 %.
10. Klucze do sypialni: GM przeładowuje i od razu klika Zastosuj w *Ustawieniach pokoi* albo daje uczniowi klucz -
    każdy uczeń ma jeden klucz do swojej sypialni. Gracz otwiera własną skrytkę.
11. GM w konsoli raz w trakcie: `game.drpg.sheetWrites()` - powód zapisu gracza dochodzi do głównego GM-a.

**Co powinno być:** jak w krokach; żaden przedmiot nie ginie i nie mnoży się.
**Porażka:** dwa wpisy zamiast jednego z ilością 2; przedmiot znika przy Plant; gracz zmienia zasób mimo blokady.
**Co zapisać:** zrzuty kart postaci przed i po; komunikaty odmów.
**Rozstrzyga:** [LIVE-E35-01, LIVE-E35-02, LIVE-E14-02, LIVE-E29-04, LIVE-E28-08, LIVE-E29-02, AUDIT 9.2 poz. 24 (bez id), LIVE-E24-01, LIVE-E24-02, LIVE-E24-03, LIVE-E45-01, LIVE-E45-03, LIVE-E24-05, LIVE-E24-04, LIVE-H84-01, LIVE-E89-05 (częściowo), LIVE-E29-01, LIVE-E29-14, LIVE-E80-05]

Opis w AUDIT 9.2: poz. 295, 296, 297, 113, 101, 111, 414, 415, 416, 424, 426, 418, 417, 317, 347, 110, 123, 271.

**Zostaje:**

  - LIVE-E89-05: Skrytka sypialni przy sesji tak; raport pierwszego wczytania 1.2.91 już przebiegł na świecie stołu.

### C6 Projekty [ważne] · w trakcie gry · gracz A, GM

**Co zrobić:**
1. Gracz, który nie zna żadnego projektu, widzi zasobnik "Projekty" z wierszem "Na razie brak projektów.".
2. A proponuje jawny projekt z **Opisem** w dwóch linijkach, w pokoju, w którym jego postać nie była; puste pole i tekst
   ponad 1000 znaków zatrzymują **Zaproponuj**. GM zatwierdza (także w innym pokoju). Na przeglądarce A: wiersz w
   zasobniku, token z młotkiem na mapie, opis na karcie tokenu.
3. Kolor młotka: u GM-a i u graczy ten sam kolor (bursztyn w budowie, zieleń skończony) - właściciel widział białe u GM-a.
4. Zasobnik Countdowns/Projektów: - i + zmieniają pasek o 1, raz; minus ma glif Font Awesome, nie pusty kwadrat; nazwa i
   licznik w jednej linii przy co najmniej sześciu projektach.
5. Wkład gracza w projekt (Work on Project, z Hope): GM widzi zapłatę raz.
6. Gracz z uprawnieniem tworzenia tokenów przeciąga aktora projektu na mapę: następna synchronizacja GM-a usuwa go jako
   sierotę albo zgłasza jako duplikat.
7. Automatyka odliczań Daggerhearta i projekt: rzut GM-a, który przesuwa odliczania, w tej samej chwili co + przy
   projekcie - obie zmiany lądują.
8. Secret Passage jako projekt: okno *Zaproponuj projekt*, Rodzaj Secret Passage; GM w oknie zatwierdzenia naciska
   "Wskaż odcinek na ścianie" i klika dwa razy na planszy.

**Co powinno być:** jak w krokach.
**Porażka:** projekt niewidoczny u proponującego; - albo + liczone dwa razy; pusty kwadrat zamiast ikony.
**Co zapisać:** zrzut zasobnika u GM-a i u gracza; zrzut tokenu projektu u obu.
**Rozstrzyga:** [LIVE-E79-16, LIVE-H84-04, LIVE-H84-05, LIVE-E44-07, LIVE-E44-20, LIVE-E23-12, LIVE-E36-02, LIVE-E37-03, LIVE-E28-13, LIVE-E11-02, LIVE-E15-03, LIVE-E93-02 (po wydaniu E93)]

Opis w AUDIT 9.2: poz. 253, 320, 321, 383, 384, 413, 300, 366, 106, 155, 303.

### C7 Tajne przejścia, tunele i schody [ważne] · 10 min celowo · gracz A, gracz B, GM

**Co zrobić:**
1. Postać, która zna tajne przejście, przechodzi przez nie przeciągnięciem, linijką i klawiaturą; postać, która go nie
   zna, zatrzymuje się na ścianie każdą z tych dróg.
2. A i B w jednym pokoju; A klika **Pokaż tajne przejście** - B od razu przez nie przechodzi; karta jest w historii
   powiadomień u obu, GM-owie dostają szept.
3. GM przeciąga Monokumę przez otwarte tajne przejście (przechodzi), obok ściany (zatrzymuje się), potem ucznia, który go
   nie zna.
4. Tunel przyciskiem **Przejdź** na karcie, w obie strony; schody na inne piętro (jeśli są): token staje na wolnym polu
   przy drugim końcu, za cenę przejścia, raz. Przeciągnięcie tokenu zwykłym ruchem na znacznik końca tunelu (z włączonym
   *Szczegółowe logi w konsoli*): przechodzi na drugi koniec, raz, nie wraca.
5. Gracz puszcza w pół drogi przeciągany token (zwolnienie kontroli): token nie zostaje za ścianą.
6. Przejście z odbiorem "gdy wyjdzie z pokoju": współwłaściciel przeciąga postać do pokoju, na który go nie stać - po
   odmowie przejście zostaje.
7. Głos idzie za tunelem: A przechodzi tunelem do pokoju B; po kilku sekundach słyszą się, bez ruchu żetonu.
8. Karta ucznia, który zna przejście i ma Experience: lista *Known passages* i Experience pod Equipped mają to samo
   wcięcie (F12 > Elements, `getBoundingClientRect().left`).

**Co powinno być:** jak w krokach.
**Porażka:** postać przechodzi przez przejście, którego nie zna; tunel działa tylko w jedną stronę (zgłoszenie H81-01);
token za ścianą.
**Co zapisać:** przy jednostronności: na której scenie, jednym piętrze czy między dwoma i z czyjej przeglądarki
naciskano **Przejdź** (tego właściciel nie podał przy H81-01).
**Rozstrzyga:** [LIVE-E79-01, LIVE-E79-04, LIVE-E79-08, LIVE-E76-06, LIVE-E80-01, LIVE-H81-01, LIVE-H81-03, LIVE-E79-25, LIVE-E19-04, LIVE-H81-02]

Opis w AUDIT 9.2: poz. 238, 241, 245, 480, 263, 272, 274, 262, 286, 273.

### C8 Komunikator, powiadomienia i Safeword [ważne] · w trakcie gry · wszyscy

**Co zrobić:**
1. Gracz z otwartym komunikatorem przełącza się na inną kartę przeglądarki; GM pisze do niego: u gracza wyskakuje karta
   wiadomości, licznik pokazuje 1, a po powrocie wątek jest przeczytany. GM w konsoli:
   `game.drpg.openMessenger("<id gracza>")` i `ui.activeWindow === foundry.applications.instances.get("drpg-messenger-<id gracza>")`
   zaraz po otwarciu, po kliknięciu w okno, w inne okno i w płótno.
2. Gracz w konsoli: `game.messages.filter(m => m.getFlag("danganronpa-rpg","thread") && m.getFlag("danganronpa-rpg","thread") !== game.user.id).map(m => m.content)`
   - ma być pusta lista (nie widzi cudzych wątków).
3. Gracz przeładowuje stronę tuż po nowej karcie: obie karty są w historii ze znacznikiem i banerem nieprzeczytanych;
   inni ich nie mają.
4. Historia powiadomień: przy ponad 150 wpisach okno nie jest wyższe niż ekran, stopka zostaje; **Wyczyść** w jednej
   karcie przeglądarki nie wraca z drugiej; okno nie gra dźwięku.
5. Gracz usuwa własną wiadomość czatu: wpis karty zostaje w historii jako usunięty.
6. `ui.notifications.warn("test")` i `ui.notifications.error("<b>test</b>")` w konsoli: płytka pod pulami Despair, krój
   VT323; czy `<b>` jest pokazane jako tekst (escapowane), czy jako pogrubienie.
7. Kartka powiadomienia w Stained Glass wypełnia swoją szybę (1920x1080, 1366x768); w Legacy wygląda zwyczajnie.
8. **Safeword**: przycisk na karcie, skrót (Controls > Danganronpa RPG > "Safeword - stop the scene", przypisz klawisz i
   naciśnij bez otwartego arkusza) i `game.drpg.safeword()`. Zatrzymaj po prawej i domyślny, Anuluj po lewej. Karta
   safeworda pod szablonem Daggerhearta: baner w nagłówku, bez awatara. Gracz naciska, gdy GM przeładowuje (F5): po
   trzech sekundach karta jest u wszystkich.
9. Polski gracz, angielski GM: odmowa prośby gracza - komunikat po polsku u gracza, linia w logu GM-a po angielsku z
   nazwą gracza. Karty publiczne są w języku autora (to nie błąd).
10. GM przy zamkniętym oknie *Narzędzia Foundry*: Foundry pokazuje mu powiadomienia czatu.

**Co powinno być:** jak w krokach.
**Porażka:** gracz widzi cudzy wątek; karta znika po F5; safeword nie dochodzi.
**Co zapisać:** wynik z kroku 2 (także pusty); zrzut kroku 6; czas z kroku 8.
**Rozstrzyga:** [AUDIT 7, punkt 5, LIVE-E50-01, LIVE-E50-02, LIVE-E81-03, LIVE-E81-06, LIVE-E81-09, LIVE-E81-12, LIVE-E44-03, LIVE-E44-06, LIVE-E79-18, LIVE-E18-03, LIVE-E18-04, LIVE-E21-04, LIVE-E77-06, LIVE-E81-22, LIVE-E23-08, AUDIT 9.2 poz. 23 (bez id), LIVE-E06-05, LIVE-E22-04, AUDIT 7, punkt 8 (częściowo), AUDIT 9.2 poz. 17 (bez id), LIVE-E31-06, AUDIT 7, punkt 14]

Opis w AUDIT 9.2: poz. 349, 350, 185, 188, 191, 194, 379, 382, 255, 292, 291, 392, 210, 204, 409, 71, 395, 40.

**Zostaje:**

  - AUDIT7-08: Safeword na arkuszu i czat tak; "świeży świat na 1.2.43" to inna wersja.

### C9 Dźwięk i muzyka [miłe] · 5 min · gracz, GM

**Co zrobić:**
1. W oknie *Dźwięk* modułu suwak Muzyka na 50, potem pasek Playlisty Foundry: jego suwak pokazuje to samo
   (`game.settings.get("core", "globalPlaylistVolume")`, moduł zapisuje 0,3536); przesuń suwak Foundry i wróć do modułu.
2. Slot Krytyk z plikiem: akcja z krytykiem (np. Free Critical), potem z wynikiem Hope, potem krytyk przy *Reduced motion*.
3. Ograniczenie ruchu w systemie operacyjnym (bez ruszania okna Wygląd): nic modułu nie rusza się w kółko.

**Co powinno być:** suwaki zgodne; krytyk ma swój dźwięk i cięcie powiadomienia; przy ograniczonym ruchu nic nie pulsuje.
**Co zapisać:** odczyty suwaków; co z rdzenia Foundry nadal się animuje pod Legacy.
**Rozstrzyga:** [LIVE-E50-03, LIVE-E48-02, LIVE-E23-11]

Opis w AUDIT 9.2: poz. 352, 474, 412.

---

## Blok D - Eclipse i morderstwo

Bloki D-G zależą od tego, czy sesja 0 dojdzie do morderstwa i rozprawy. Jeśli nie dojdzie, zostają na następną sesję
albo na próbę z graczami na kopii świata - wtedy wpisz w wynikach "nie doszło", nie "nie zaliczone".

### D1 Eclipse [ważne] · w trakcie gry · wszyscy

**Co zrobić:**
1. GM zaczyna Eclipse. Każdy gracz wychodzi z głosu (nikt go nie słyszy, on nikogo), nie widzi karty "Voice disconnected"
   i nie łączy się sam przez kilka minut; GM-owie są w jednym kanale.
2. Przejście w Eclipse: karta głównego GM-a pojawia się w logu przechodzącego, u innych graczy nie. Token przeciągnięty
   jednym ruchem przez dwa pokoje: karta nazywa właściwy pokój.
3. Pasek statusu gracza przy 1366x768: w Night Eclipse wiersz Move to jedna pełna stopa z podpowiedzią *place anywhere*;
   u Monocuba *Placement only*; u martwego ucznia jeden wiersz stanu.
4. GM w trakcie Eclipse przełącza widok na drugą scenę z pokojami (jeśli świat ma dwie): zgłoszone morderstwa są
   rozstrzygane, zgromadzenie ląduje na scenie ciała.
5. Postronny podczas incydentu (gracz C, którego uczeń nie siedzi w incydencie): runda gotowości i podsumowanie pory
   dnia przychodzą do niego normalnie; GM przesuwa zegar w trakcie incydentu - u C linia pory dnia na HUD-zie i karta
   Motive zostają takie, jak przy otwarciu; C przeładowuje przeglądarkę i to samo.
6. Mastermind z jawnym projektem w pokoju, w którym jego postać nie stała: gracz Masterminda widzi token i wiersz w
   zasobniku.

**Co powinno być:** jak w krokach.
**Porażka:** gracz słyszy kogoś w Eclipse; karta przejścia u niewłaściwej osoby; zegar u postronnego się przestawia.
**Co zapisać:** zrzut paska statusu; czy ktoś widział "Voice disconnected".
**Rozstrzyga:** [LIVE-E19-08, LIVE-E05-06, LIVE-E17-09, LIVE-E12-01, LIVE-E37-06, AUDIT 7, punkt 9, LIVE-E17-07, LIVE-E05-13, LIVE-E17-08]

Opis w AUDIT 9.2: poz. 288, 58, 314, 163, 368, 312, 65, 313.

### D2 Otwarcie morderstwa i walka [krytyczne] · w trakcie gry · zabójca, ofiara, postronny, GM

**Co zrobić:**
1. W Eclipse gracz deklaruje Direct Murder: okno pyta "Which statistic do you propose?" z Body zaznaczonym; gracz wybiera
   Hand. Karta GM-ów ma trzy przyciski: "Allow: Hand (+n)", "Change to: Body (+n)" i "Refuse".
2. Ofiara, gdy zabójca rzuca na otwarcie: nie widzi czerwonej kurtyny, nie słyszy muzyki morderstwa, nie ma karty
   zdarzenia. Nieudane otwarcie nie zostawia jej niczego; udane daje jej wszystko naraz, a szept nazywa zabójcę.
3. W nocy okno rzutu otwarcia ma zablokowany chip przewagi u zabójcy (u ofiary pułapki - niekorzyści); w dzień żadnego.
4. Okno Morderstwo na polskim kliencie (dwie kolumny formularza) i otwarte z karty pułapki (ofiara wybrana).
5. Tracker GM-a: przy otwarciu (czeka na rzut), w trakcie tury i w Stage 6 ta sama szerokość; pasek tury nazywa stronę,
   która działa; "Poproś o rzut otwarcia ponownie" działa; ostrzeżenie o nieudanym otwarciu.
6. Panel GM-a w Eclipse z incydentem: kafel Morderstwo czynny i otwiera tracker; kafel wyłączony ma przerywaną ramkę i
   podaje powód.
7. Kafel walki u graczy: "Crisis actions" albo "Fight back", koszt, kolor; poza turą przyciemniony z podpowiedzią. Wiersz
   akcji kryzysowej rozwija fakty, przycisk mówi "Roll it"; select Statistic Daggerhearta zablokowany na wyborze GM-a.
8. Muzyka: utwór morderstwa gra na kanale Music, ten sam u zabójcy, ofiary i GM-a, u gracza spoza incydentu żaden; po
   końcu wraca muzyka pokoju. Gracz przeładowuje w trakcie incydentu: suwak Music stoi tam, gdzie stał przed incydentem.
9. Głos: ofiara wychodzi z głosu pokoju w chwili zabójstwa, nie przy odkryciu.
10. Ofiara czyta ten sam Health i Sanity na karcie, w panelu zdarzeń i na tokenie; zabójca w panelu tylko Health ofiary;
    postronny nic.
11. Uczestnik incydentu przed akcją kryzysu wyciąga token z pokoju: token wraca, gracz czyta zasadę.
12. Prywatna karta gracza w walce (np. użyty przedmiot): u postronnego autorem jest GM.
13. Gracz postronny w konsoli w trakcie incydentu:
    `game.messages.contents.filter(m => m.flags["danganronpa-rpg"]?.secret).map(m => [m.speaker.alias, m.whisper])`.

**Co powinno być:** ofiara i postronny nie dowiadują się niczego przed czasem; walka idzie tura po turze.
**Porażka:** ofiara widzi kurtynę przed udanym otwarciem; postronny słyszy muzykę morderstwa albo widzi tajne karty;
walka staje.
**Co zapisać:** wynik kroku 13; zrzut trackera w trzech stanach (szerokość w px); co słyszał każdy z trzech graczy.
**Rozstrzyga:** [LIVE-E68-01, LIVE-E06-01, LIVE-E07-01, LIVE-E07-12, LIVE-E07-08, LIVE-E34-02, LIVE-E47-02, LIVE-E47-03, LIVE-E07-09, LIVE-E19-03, LIVE-E50-05, LIVE-E19-02, LIVE-E05-04, AUDIT 7, punkt 4, LIVE-E24-08, LIVE-E07-05, LIVE-E28-15, LIVE-E17-04]

Opis w AUDIT 9.2: poz. 458, 67, 77, 88, 84, 136, 439, 440, 85, 285, 354, 284, 56, 421, 81, 108, 310.

### D3 Rzuty w walce: Breakdown, Resolve, broń i Reroll [ważne] · w trakcie walki · zabójca, ofiara, GM

**Co zrobić:**
1. Uczeń wpada w Breakdown i Wounded: na tokenie nikt nie widzi ikony Breakdown ani Wounded (także po przeładowaniu i
   przesunięciu tokenu); oba stany są na arkuszu.
2. Uczeń w Breakdown robi rzut publiczny: inny gracz widzi kość **Disadvantage** i wynik, nigdzie słowa Breakdown;
   właściciel i GM widzą przyczynę.
3. Hope Call Resolve: schodzą 2 Hope, nie 3, GM nie dostaje karty; przy następnym rzucie z kilkoma statystykami gracz
   wybiera sam.
4. Linia obrażeń: w drugiej osobie na czacie i w popupie ofiary, w trzeciej u zabójcy i GM-a.
5. Despair z nożem Tier 1: obrażenia Tier 1, nóż złamany dopiero po ciosie; Reroll oddaje wytrzymałość.
6. Reroll kryzysowego Strike i krytycznego Strike: karty i kości rzucającego.
7. (Tylko jeśli fabuła da dwóch Blackened) zdrada z kafelka w Stage 6.

**Co powinno być:** jak w krokach.
**Porażka:** ikona stanu na tokenie; słowo Breakdown u innego gracza; 3 Hope zamiast 2.
**Co zapisać:** zrzut tokenu i arkusza w Breakdown z trzech kont.
**Rozstrzyga:** [LIVE-E95-05, LIVE-E24-09, LIVE-E24-10, LIVE-E68-02, LIVE-E07-04, LIVE-E07-03, LIVE-E33-08, LIVE-E07-02 (częściowo)]

Opis w AUDIT 9.2: poz. 457, 422, 423, 459, 80, 79, 132, 78.

**Zostaje:**

  - LIVE-E07-02: Wymaga dwóch Blackened w jednym rozdziale; przy zwykłej sesji tylko wtedy, gdy fabuła tak się ułoży.

### D4 Pułapka i pośrednie morderstwo [ważne] · jeśli fabuła tego użyje · zabójca, ofiara, GM

**Co zrobić:**
1. A proponuje projekt z zaznaczonym *Indirect murder*; GM naciska Approve i zapisuje wyzwalacz "Somebody enters the
   room"; B wchodzi do pokoju.
2. Pułapka się odpala: ekran GM-a - czy jest popup, dźwięk i przyciski w logu.
3. Ofiara gra turę po turze, z drenażem 2, nikt nie naciska Pass.
4. Pokwitowanie pułapki i karta przeróbki są tylko w wątku zabójcy i GM-a; przycisk Plant na pokwitowaniu działa.

**Co powinno być:** jak w krokach.
**Porażka:** pokwitowanie u kogoś trzeciego; walka czeka na Pass.
**Co zapisać:** zrzut ekranu GM-a przy odpaleniu.
**Rozstrzyga:** [LIVE-E07-06, AUDIT 7, punkt 6, LIVE-E06-06, LIVE-E15-01]

Opis w AUDIT 9.2: poz. 82, 72, 301.

### D5 Stage 6: sprzątanie, ciało i łup [ważne] · w trakcie gry · zabójca, świadek, GM

**Co zrobić:**
1. Take from the Body: uczeń sam przy ciele zabiera dwie rzeczy jednym Take - jeden rzut Hand, bez rzutu Shadow i bez
   kart; Remnant leży przy kaflu ciała. Potem ze świadkiem i ze wspólnikiem.
2. Zabójca przenosi ciało (Move the body). Gracz w konsoli przed odkryciem:
   `canvas.scene.tiles.contents.filter(t => t.flags?.["danganronpa-rpg"]?.bodyOf).length` - ma być 0. GM: kafel idzie za
   tokenem raz na ruch.
3. Rękawiczki odłożone po sprzątaniu pękają przy odkryciu ciała, przy którym sprzątały.
4. Przy ujawnieniu śmierci gracz, który wziął coś z ciała przed odkryciem, widzi token śladu łupu z nazwą i obrazkiem
   swojego nowego bulletu.
5. (Po wydaniu E64) Move the Body z wyborem pokoju dwa dalej, raz z krytykiem, raz bez.

**Co powinno być:** jak w krokach; przed odkryciem gracz nie ma żadnego kafla ciała.
**Porażka:** kafel ciała u gracza przed odkryciem; rzut Shadow przy samotnym Take.
**Co zapisać:** wynik kroku 2 (liczba).
**Rozstrzyga:** [LIVE-E68-03, LIVE-E63-02, LIVE-E63-04, LIVE-E05-14, LIVE-E07-07, LIVE-E64-01 (po wydaniu E64)]

Opis w AUDIT 9.2: poz. 460, 464, 466, 66, 83.

---

## Blok E - odkrycie ciała i śledztwo

### E1 Odkrycie ciała [krytyczne] · w trakcie gry · dwóch graczy, GM (drugi GM, jeśli jest)

**Przed odkryciem** (GM mówi graczom, co wkleić; każdy w swojej konsoli):
`Hooks.on("drpgBodyAnnounced", p => console.log("E95", performance.now(), p.writer, typeof p.waitUntil, JSON.stringify(p.victimIds)))`;
u głównego GM-a także `Hooks.on("createChatMessage", m => console.log("E95 card", performance.now()))`.

**Co zrobić:**
1. Dwóch uczniów wchodzi do pokoju z ciałem: jedna karta, jeden wpis; kamera każdego gracza przesuwa się na jego token.
2. Strzałka Eclipse na HUD-zie jest przygaszona i podaje powód; słowa o czekaniu stoją obok kafelków akcji (kafelki nie są
   przygaszone).
3. Znacznik śmierci pojawia się dopiero przy ujawnieniu; kafel ciała: obrazek tokenu, znak śmierci na środku, podpis
   "{name}'s body" u GM-a po angielsku i po polsku u polskiego gracza. Zamordowany uczeń, który zostaje Monocubem: GM
   ukrywa kafel jego ciała, gracz w konsoli
   `canvas.scene.tiles.contents.filter(t => t.flags?.["danganronpa-rpg"]?.bodyOf).map(t => [t.id, t.hidden])`.
4. Token śladu zachowuje neutralną nazwę i obrazek; znalazca widzi nazwę i obrazek swojego bulletu, GM te z wiersza
   sprawy.
5. Głos: zmarły słychać w pokoju, w którym leży, do końca incydentu; potem przechodzi do kanału umarłych (także po F5
   głównego GM-a).
6. GM zmienia ikonę śmierci w ustawieniach Automation Daggerhearta i zabija ucznia (na kopii albo w fabule): nowy
   znacznik ma ikonę GM-a.
7. *Edytuj kampanię* przy zwołanym zgromadzeniu: czas cofnięty, nikt nie jest wzywany, karta odwołania widoczna.
8. Podwojony token: przed i zaraz po rozpoczęciu śledztwa w konsoli GM-a
   `game.scenes.contents.flatMap(s => s.tokens.contents.filter(t => t.actor?.type === "character").map(t => [s.name, t.name, t._stats?.createdBy]))`
   - żadna postać nie ma dwóch tokenów na jednej scenie.

**Co powinno być:** u głównego GM-a jeden wpis `drpgBodyAnnounced` z `writer` true i `waitUntil` funkcją, przed kartą
zbiórki; u każdego innego dokładnie jeden z `writer` false; jedna karta.
**Porażka:** dwie karty; brak wpisu u kogoś; podwojony token.
**Co zapisać:** wszystkie linie "E95" z czasami z każdej przeglądarki; zrzut kafla ciała u GM-a i u gracza.
**Rozstrzyga:** [LIVE-E11-03, LIVE-E11-04, LIVE-E05-03, LIVE-E05-05, LIVE-E95-01, LIVE-E95-04, LIVE-E63-01, LIVE-E24-13, LIVE-E19-05, LIVE-E05-01, LIVE-E11-05, LIVE-E51-04, LIVE-E95-03]

Opis w AUDIT 9.2: poz. 156, 157, 55, 57, 455, 454, 463, 430, 287, 53, 158, 358, 456.

### E2 Śledztwo: Observe, Analyze, mapa sprawy [ważne] · w trakcie gry · gracze, GM

**Co zrobić:**
1. Panel *Investigation* na Mapie i na Tabeli, każda zakładka, w obu motywach (Legacy z czcionką pikselową) przy 1366x768
   i 1920x1080: rama, nagłówek i stopka stoją w tym samym miejscu przy każdym przełączeniu; tabele nie szersze niż
   okno; przycisk Postaw i jego okno; linia "kiedy i co" śladu czytelna.
2. Gracz robi Observe, którego znalezisko czeka na okno opisu GM-a, i zanim GM je zamknie, ta sama postać robi drugie
   Observe: drugie nie celuje w ten sam ślad.
3. Ślad z autorem ustawionym przez GM-a; gracz w konsoli: w tokenie, przedmiotach i wiadomościach nie ma `leftBy`,
   `sourceName` ani `sourceActor`; na karcie śladu gracza nie ma autora.
4. Menu Tamper (Reshape a Trace), okno krytyka: czerwone wiersze i przyciski stoją tylko przy drodze przez GM-a. Najedź
   myszą i przejdź Tabem po stopce okna Analyze/Tamper. Pod Legacy wybrany czerwony wiersz (Ask for a hint) zachowuje
   czerwoną krawędź.
5. Przejście na scenę Class Trial i z powrotem: ikony akcji na śladach i nazwy wracają bez przeładowania.
6. Okno *Sprawa* > **Zrób kopię** zapisuje plik; **Przywróć z pliku** go czyta (Chrome/Chromium; inne przeglądarki - K2).
7. Karta wyboru Observe, gdy okno głównego GM-a jest ukryte: popup i dźwięk u drugiego GM-a (jeśli jest).

**Co powinno być:** jak w krokach.
**Porażka:** gracz widzi autora śladu; dwa Observe w ten sam ślad; okno przewija się w bok.
**Co zapisać:** zrzuty panelu Investigation (mapa i tabela) w obu motywach; plik kopii sprawy (zachowaj).
**Rozstrzyga:** [LIVE-E09-04, LIVE-E47-09, LIVE-E97-01, LIVE-E97-05, LIVE-H84-02, LIVE-E49-07, LIVE-E22-02, LIVE-E22-03, LIVE-E22-05, LIVE-E04-05 (częściowo), LIVE-E09-03]

Opis w AUDIT 9.2: poz. 140, 446, 482, 486, 318, 472, 391, 394, 396, 45, 139.

**Zostaje:**

  - LIVE-E04-05: Chrome/Chromium przy sesji; Firefox i aplikacja desktopowa tylko, jeśli ktoś przy stole ich używa (K2).

---

## Blok F - Class Trial

### F1 Wejście do sali rozpraw [krytyczne] · początek rozprawy · wszyscy

**Co zrobić:**
1. GM: **Zacznij Class Trial**. Wszyscy przenoszą się do sali; Isometric Perspective rysuje salę; tokeny zaznaczone na
   karcie Sceny są odkryte; kości rzutu w sali widać u każdego.
2. Jeden gracz przeładowuje stronę w chwili aktywacji sali: gdzie ląduje (ma trafić do sali po pierwszym narysowaniu).
3. Token straconego ucznia ma w sali nakładkę zmarłego. Uczeń bez tokenu w sali: moduł robi token przy otwarciu.
   Zrobione tokeny mają wygląd tych ze szkoły (obrazek, rozmiar) i się nie obracają.
4. Jeden pokój głosowy na rozprawę: żywi, zmarli, Monocub i GM słyszą się; po rozprawie każdy wraca do swojego pokoju.
5. Zmarły gracz przy wejściu w rozprawę przestaje nadawać bez przeładowania. Ten gracz w konsoli:
   `game.user.update({ "permissions.BROADCAST_AUDIO": true })` - serwer ma odrzucić (zapisz komunikat), mikrofon zostaje
   wyłączony.
6. Gracz próbuje w konsoli zmienić `hidden` własnego tokenu w sali (HUD albo `canvas.tokens.controlled[0].document.update({ hidden: true })`)
   i zapisać flagę sceny sali (`canvas.scene.setFlag("danganronpa-rpg", "liveProbe", 1)` - nieszkodliwy klucz, ta sama
   zasada co `trialSeats`): oba odrzucone albo cofnięte. Gdyby flaga się zapisała, GM ją zdejmuje:
   `canvas.scene.unsetFlag("danganronpa-rpg", "liveProbe")`.
7. Kafelek pokoju każdego gracza pokazuje nazwę, zdjęcie i opis sali (z karty Sceny). Karta Sceny widoczna dla GM-a w obu
   motywach, ukryta dla graczy; nawigacja scen i pasek makr ukryte.
8. GM: `game.drpg.perf()` (na kopii, jeśli nie chcesz szeptu) zaraz po wejściu - ile kosztuje zrobienie ok. 8 tokenów;
   czy gracze widzą tokeny przed narysowaniem sali.
9. (Po wydaniu E61) wejście do Rozprawy w obu motywach: kafle wysuwają się zza krawędzi; mikrofon pod sekwencją działa.

**Co powinno być:** cały stół w sali bez ręcznej pomocy; nikt nie zostaje w szkole.
**Porażka:** gracz zostaje na starej scenie; brakujący token; zmarły nadal mówi.
**Co zapisać:** gdzie wylądował gracz z kroku 2; komunikat serwera z kroku 5; zrzut sali u GM-a i u gracza.
**Rozstrzyga:** [LIVE-E13-01, LIVE-E13-02, LIVE-E13-03, LIVE-E13-04, LIVE-E13-05, LIVE-E13-06, LIVE-E13-08, LIVE-E13-09, LIVE-E79-13, LIVE-E79-14, LIVE-E81-15, LIVE-E81-18, LIVE-E70-04, LIVE-E70-05, LIVE-E61-01 (po wydaniu E61), LIVE-E61-08 (po wydaniu E61), LIVE-E73-03 (po wydaniu E73), LIVE-E92-03 (po wydaniu E92)]

Opis w AUDIT 9.2: poz. 172, 173, 174, 175, 176, 177, 179, 180, 250, 251, 197, 200, 332, 333.

### F2 Debata, Objection i tryby [ważne] · w trakcie rozprawy · wszyscy

**Co zrobić:**
1. Debata, **Wyślij karty**; drugi gracz łączy się dopiero teraz i dostaje kartę; obaj głosują.
2. Pasek GM-a na konsoli Class Trial przy 1366x768: siedem przycisków (Skip, -30 s, +30 s, Overrule, End this mode, Back
   to the debate, Re-point) w jednym rzędzie, nie przesuwa się przy zmianie trybu; wyszarzony pokazuje powód. Stopka
   konsoli przerysowuje się na miejscu, ta sama wysokość w każdym stanie.
3. Zegar: gracz z zegarem systemowym przestawionym o minutę widzi sekundy debaty najwyżej o jedną różne od GM-owych.
4. GM przełącza się na inną kartę przeglądarki na 2 minuty w trakcie Objection i repliki: Objection przechodzi w replikę,
   replika zamyka głos na każdym ekranie; zapisz opóźnienie w sekundach.
5. OBJECTION! z LiveKit: gracz mówi, inny naciska OBJECTION! na HUD-zie - po ilu milisekundach przycisk podaje mówiącego i
   czy Objection trafia w niego. W wierszu zegara gracza nazwa trybu i OBJECTION! (dłoń na przycisku w Legacy). Poza
   rozprawą trzeci przycisk kafla głosu szary: "Objection tylko w trakcie Class Trial.".
6. Karta Objection nad każdym oknem, dopóki nie zostanie kliknięta; dwie sticky karty pod Stained Glass i trzecia
   (odmowa) wypiera najstarszą, nie znika.
7. *Ujawnij* przy Key Remnancie z *Brakujące Key Remnanty* i od razu Enter: okno się zamyka, nikt nie dostaje kopii.
8. Present: gracz przedstawia przeanalizowany Truth Bullet raz bez *Pokaż z wynikiem mojego Analyze*, raz z nim - karta na
   każdym ekranie pokazuje tylko to, co wybrał.
9. Panic Round po 15 s z GM-em w tle: o ile sekund po zerze zmienił się mówca. Closing Argument: każdy gracz dostaje raz
   okno "Podsumuję?" (Enter = Nie ja).
10. W Stained Glass przyciski *Zamknij i policz* i *Zacznij Final Trial* bez ustawionego Masterminda są wyraźnie szare.
11. Na koniec `game.drpg.a11y()` u jednego gracza w trakcie debaty - zapisz, co zgłasza.
12. (Po wydaniu E73, E99) strefy sali i Straw Poll, Logic Dive, schemat sprawy obok konsoli.

**Co powinno być:** debata idzie bez ręcznej pomocy; każdy ma swoją kartę.
**Porażka:** spóźniony gracz bez karty; replika nie zamyka głosu; Enter wysyła kopię.
**Co zapisać:** sekundy z kroku 4 i 9; milisekundy z kroku 5; zrzut konsoli w każdym trybie; wynik `a11y()`.
**Rozstrzyga:** [LIVE-E10-01, LIVE-E70-01, LIVE-E70-03, LIVE-E10-05, LIVE-E79-22, LIVE-E79-23, LIVE-E70-12, LIVE-E47-01, LIVE-E47-11, LIVE-E10-03, AUDIT 9.2 poz. 16 (bez id), AUDIT 7, punkt 12, LIVE-E70-10, LIVE-E70-11, LIVE-E70-08 (częściowo), LIVE-E70-09, LIVE-E70-07 (nie przy sesji 0, zob. niżej), LIVE-E73-02 (po wydaniu E73), LIVE-E73-05 (po wydaniu E73), LIVE-E99-01 (po wydaniu E99)]

Opis w AUDIT 9.2: poz. 142, 331, 335, 146, 259, 260, 342, 438, 452, 144, 340, 341, 338, 339, 337.

**Zostaje:**

  - LIVE-E70-08: Przy 12 uczestnikach wariant 10 s nie wystąpi przy mniejszym stole; wariant 15 s tak.

### F3 Głosowanie, werdykt i Level Up [krytyczne] · koniec rozprawy · wszyscy

**Co zrobić:**
1. GM przeładuje (F5) w trakcie głosowania: konsola pokazuje ten sam licznik oddanych kart.
2. **Zamknij i policz**: okno werdyktu otwiera się na oskarżonym. W oknie werdyktu z fokusem na liście, potem na samym
   oknie, **Enter anuluje** i nikt nie ginie.
3. Każdy gracz ma jedną kartę werdyktu; jedno okno Level Upów klasy, "Wszyscy: wybierają gracze".
4. W oknie Level Upów wiersze na "Wybieram ja": Enter naciska "Przyznaj" i każdy wiersz dostaje to, co w nim wybrano.
5. Gracz otwiera swój Level Up z arkusza i klika arkusz: okno nie chowa się pod arkuszem. Anuluj po lewej, Zastosuj po
   prawej; nic nie ucięte po polsku.
6. Dźwięk Level Upu na maszynie właściciela.

**Co powinno być:** Enter w werdykcie nigdy nikogo nie zabija; jedno okno Level Upu na postać.
**Porażka:** licznik po F5 inny; Enter wykonuje werdykt; dwa okna Level Upu.
**Co zapisać:** liczniki kart w każdej przeglądarce po F5 GM-a; zrzut okna werdyktu i Level Upu.
**Rozstrzyga:** [LIVE-E10-02, LIVE-E05-08 (częściowo), LIVE-E10-06, LIVE-E10-07, LIVE-E21-05]

Opis w AUDIT 9.2: poz. 143, 60, 147, 148, 393.

**Zostaje:**

  - LIVE-E05-08: Trafny werdykt po błędnym tylko, jeśli fabuła tak się ułoży; okno i dźwięk Level Upu sprawdzamy przy każdym werdykcie.

---

## Blok G - egzekucja i koniec rozdziału

### G1 Egzekucja i powrót do szkoły [krytyczne] · po werdykcie · GM, wszyscy patrzą

**Co zrobić:**
1. Werdykt skazuje żyjącego ucznia. GM naciska **Zakończ Class Trial** (End the trial) i wybiera pokój w szkole - to
   jedyny krok GM-a.
2. Skazany ginie, zanim stół opuści salę (jego token w sali dostaje nakładkę zmarłego); wszyscy widzą kartę
   "EGZEKUCJA" / "THE EXECUTION"; właściciel skazanego dostaje prywatną notkę; do wybranego pokoju idą tylko żywi.
3. Z Isometric Perspective: żyjący lądują w losowych miejscach wewnątrz wybranego pokoju, przyciągnięci do siatki, nikt
   nie płaci, bez karty ciała.
4. Uczeń żywy, odznaczony w obsadzie, stoi w szkole: zostaje tam, gdzie stał.
5. Kafel ciała straconego pojawia się i znika; koniec rozprawy zabiera każdy kafel ciała.
6. Po usunięciu tokenów modułu z sali karty czatu i arkusze Daggerhearta, które je wskazują, dalej działają (otwórz jedną
   starą kartę rzutu z sali).

**Co powinno być:** stół z powrotem w szkole, bez ręcznej naprawy niczyjego widoku i bez ręcznie przesuniętego tokenu.
**Porażka:** ktoś zostaje w sali; skazany idzie do szkoły; kafel ciała zostaje.
**Co zapisać:** zrzut karty egzekucji; zrzut szkoły po powrocie u GM-a i u jednego gracza.
**Rozstrzyga:** [LIVE-E70-06, LIVE-E13-07, LIVE-E13-10, LIVE-E81-20, LIVE-E63-03, LIVE-E81-17]

Opis w AUDIT 9.2: poz. 336, 178, 181, 202, 465, 199.

### G2 Koniec rozdziału [ważne] · po egzekucji · GM

**Co zrobić:**
1. **Zakończ rozdział**: zapisz liczby w oknie; które Faint i Final da się przeanalizować w następnym rozdziale; ile
   okno czeka.
2. Wyłączone pole (ujawnienie, gdy nie ma czego ujawnić) jest przygaszone w obu motywach; ostrzeżenie o Truth Bulletach
   bez typu z imionami trzymających czyta się obok pól.
3. Postać bierze Short Rest w porze dnia, w której kończy się rozdział; w nowym rozdziale, w tym samym dniu i porze, może
   go wziąć znowu.
4. Cała ścieżka śledztwa z jednym GM-em (Observe, Analyze, Tamper, koniec rozdziału) - zapisz, czy coś wymagało ręcznej
   poprawki.

**Co powinno być:** jak w krokach.
**Porażka:** okno końca rozdziału wisi; odpoczynek zablokowany w nowym rozdziale.
**Co zapisać:** zrzut okna końca rozdziału z liczbami.
**Rozstrzyga:** [LIVE-E09-05, LIVE-E11-08, LIVE-E17-10 (częściowo), LIVE-E09-01 (częściowo)]

Opis w AUDIT 9.2: poz. 141, 161, 315, 137.

**Zostaje:**

  - LIVE-E17-10: Odpoczynek przez koniec rozdziału tak; "odpoczynek sprzed aktualizacji" dotyczy świata sprzed tamtej wersji.
  - LIVE-E09-01: Observe, Analyze, Tamper i koniec rozdziału z jednym GM-em w E2 i G2; część z drugim GM-em w H1.

---

## Blok H - drugi GM (jeśli jest)

### H1 Dwóch GM-ów przy jednym stole [ważne] · przy okazji bloków C-G · główny GM i drugi GM

Drugi GM to najlepiej osobne konto Gamemastera, a raz konto Asystenta GM-a. Większość kroków to "zróbcie to samo
naraz" - umówcie się na głos ("trzy, dwa, jeden, klik").

**Co zrobić:**
1. Dołączenie: czas od wejścia drugiego GM-a do `game.drpg.gmStoreStatus()` pokazującego nawodniony magazyn; wielkość
   sekcji śladów.
2. Obaj klikają naraz: *Przyznaj wszystkie* (Hope i Despair przyznane raz), *Cofnij* na jednej karcie (jeden zapis),
   **Wyczyść overflow** (drugi GM najpierw dostaje pytanie, potem overflow jest zerowany u wszystkich), zmiana jednego
   projektu w Project Managerze i + w zasobniku (wszystko ląduje raz), **Uruchom realizację** sprawy w tej samej sekundzie
   (Key Remnanty powstają raz).
3. Pulpit Investigation otwarty u obu, jeden zatwierdza przeróbkę śladu, obaj zapisują: oznaczenia pól i komunikat
   *savedOver*. Okno *Sprawa*: drugi GM zmienia notatkę i wiersz planu, potem **Przywróć z pliku** pokazuje podgląd.
4. Z przeglądarki GM-a, który nie jest główny: **Zakończ rozdział** i **Znaleziono ciało** nie otwierają okna i mówią,
   kogo poprosić; Reset sezonu: odmowa z nazwą głównego GM-a. Pytanie o realizację przy Znaleziono ciało otwiera się
   tylko u głównego GM-a, po karcie zbiórki, raz w rozdziale.
5. Zmiana głównego: główny GM zamyka przeglądarkę w trakcie rzutu gracza, w trakcie Rerolla, w trakcie głosowania - drugi
   GM zostaje głównym, rozstrzygnięcie dochodzi, karta wysłana w tym czasie zostaje zapisana, werdykt da się wcisnąć u
   nowego głównego.
6. Incydent: Pass albo Close u drugiego GM-a, gdy główny rozstrzyga akcję; drugi GM ponawia prośbę o rzut otwarcia.
7. Overrule w trakcie Objection - raz główny, raz drugi GM: debata wraca z czasem z chwili Objection, koszt zostaje.
8. Asystent GM-a: `game.user.update({ role: 4 })` z jego konsoli ma być odrzucone przez serwer; zapis ustawienia świata
   modułu przechodzi. Gdyby rola się zmieniła, główny GM przywraca ją w *Manage Players*. Gdy Asystent jest jedynym GM-em, gracz kupuje Call Experience, a GM1 naciska F5 przed odpowiedzią:
   po powrocie jedna karta.
9. Muzyka: drugi GM zmienia playlistę obecnego stanu w oknie *Dźwięk* - po ilu sekundach muzyka zmienia się u wszystkich.
10. Despair przy dwóch GM-ach: jeden ciągle rzuca uczniami (+1), drugi płaci Calle - porównaj pasek z sumą. W trakcie
    Eclipse gracze przestawiają tokeny, GM klika pipy, Asystent zmienia pasek: każdy klik odpowiada od razu.
11. Karta głównego GM-a w tle (inna karta przeglądarki): ile czeka losowanie rzutu gracza.
12. GM naciska kafelek panelu dokładnie wtedy, gdy akcja gracza zapisuje Despair albo zegar: okno otwiera się raz.
13. (Po wydaniu E99) Asystent GM wysyła podsumowanie; dwóch GM-ów zaznacza wnioski naraz.

**Co powinno być:** każda wspólna decyzja zapisana dokładnie raz; nic nie przepada przy zmianie głównego.
**Porażka:** coś przyznane dwa razy; utracona karta przy zmianie głównego; okno otwarte u niegłównego GM-a.
**Co zapisać:** wynik `gmStoreStatus()` u obu; przy każdej porażce: kto kliknął, o której, co zostało zapisane.
**Rozstrzyga:** [LIVE-E04-02, LIVE-E09-02, LIVE-E10-04, LIVE-E28-06, LIVE-E28-11, LIVE-E29-05, LIVE-E28-16, LIVE-E08-03, LIVE-E07-10, LIVE-E11-09, LIVE-E36-01, LIVE-H84-06, LIVE-E50-04, LIVE-E47-04, LIVE-E70-02, LIVE-E97-04, LIVE-E97-03, LIVE-E30-04, LIVE-E18-02, LIVE-E17-05, LIVE-E04-09, LIVE-E28-07, AUDIT 7, punkt 11, LIVE-E44-02, LIVE-E99-04 (po wydaniu E99), LIVE-E99-05 (po wydaniu E99)]

Opis w AUDIT 9.2: poz. 42, 138, 145, 99, 104, 114, 109, 91, 86, 162, 299, 322, 353, 441, 334, 485, 484, 29, 294, 311, 49, 100, 378.

---

## Blok J - przypadki brzegowe (na koniec albo osobny wieczór)

Te sprawdzenia celowo coś psują: zamykają kartę GM-a, przeładowują w złym momencie, próbują zapisów z konsoli gracza.
Rób je po rozprawie albo na osobnej próbie, najlepiej na kopii świata, z graczami, którzy wiedzą, że to próba.

### J1 GM wychodzi, przeładowuje albo traci sieć [krytyczne] · 30 min · GM, gracz A, gracz B

**Co zrobić** (po każdym kroku zapisz, co widzi gracz i co widzi GM po powrocie):
1. A prosi o sabotaż; GM zamyka kartę przeglądarki przed odpowiedzią. U A jeden komunikat "Klient GM-a nie odpowiedział na
   czas." (po ok. 8 s); GM wraca przed zegarem - prośba ponawiana raz.
2. A robi Search, a GM w tym czasie wychodzi albo przeładowuje: co A widzi do 30 s; akcja i jej cena wracają.
3. Żaden GM nie jest połączony: A próbuje akcji (odrzucona przed zapłatą), rzuca rzut reakcji (karta ze znacznikiem "bez
   świadka"), zmienia coś na karcie, pisze notatkę. GM wraca: karta takich rzutów z **Grant all** / **Grant none**, karta
   "Zmiany na kartach postaci zrobione, gdy żaden GM nie patrzył", notatka dochodzi.
4. Przeładowanie GM-a w trakcie Rerolla gracza - na różnych etapach (od razu po kliknięciu, w trakcie kości, w trakcie
   płacenia Hope): Hope i pierwszy rzut wracają albo GM dostaje kartę do rozstrzygnięcia.
5. GM traci sieć na kilka sekund (wyłącz Wi-Fi) i wraca bez przeładowania: czy zapisy z przerwy dochodzą.
6. Gracz zamyka kartę: u GM-a w konsoli `Hooks.on("userConnected", (u, on) => console.log(u.name, on, u.active))`. GM
   zmienia graczowi rolę: czy gracz zostaje wylogowany.
7. Otwarte morderstwo, GM zmienia przeglądarkę (inny komputer albo profil): kontrola zdrowia ostrzega, **Przywróć** oddaje
   obsadę i incydent da się dokończyć (także przez "Wpisz obsadę ręcznie").
8. Werdykt: gdy otwiera się okno Level Upu klasy, GM zamyka kartę i otwiera świat - konsola rozprawy pokazuje *Werdykt
   zatrzymał się na: ...* i **Dokończ werdykt**; każdy ocalały dostaje jeden Level Up.
9. Jedno konto w dwóch kartach jednej przeglądarki: ślady zapisywane w obu kartach - żaden nie ginie.
10. Rzut gracza w pierwszych sekundach nowego głównego GM-a: czeka do 16 s albo zostaje odrzucony z komunikatem.
11. Wymazanie śladu przerzucone Rerollem: ślad wraca pod swoim id.
12. *Reduced motion* włączone: wiersz panelu GM-a i krok *Ustaw sezon*, które oddają okno, wracają bez sekundowej pauzy.
13. Sześć sabotaży naraz (kilku graczy klika jednocześnie): każde potwierdzenie przychodzi.
14. (Po wydaniu E73) przeładowanie GM-a w połowie pytania Logic Dive.

**Co powinno być:** nic nie przepada w ciszy: albo wraca, albo gracz i GM dostają komunikat.
**Porażka:** akcja zapłacona i niewykonana bez komunikatu; Hope stracony; incydent, którego nie da się dokończyć.
**Co zapisać:** przy każdej porażce: krok, godzina, co gracz widział, zrzut konsoli GM-a.
**Rozstrzyga:** [LIVE-E31-03, LIVE-E28-05, LIVE-E47-05, LIVE-E29-06, LIVE-E05-10, LIVE-E33-07, LIVE-E08-02, LIVE-E04-04, LIVE-E30-05, LIVE-E29-13, LIVE-E04-08, LIVE-E42-02, LIVE-E31-02, LIVE-E04-11, LIVE-E31-05, LIVE-E08-04, LIVE-E73-04 (po wydaniu E73)]

Opis w AUDIT 9.2: poz. 37, 98, 442, 115, 62, 131, 90, 44, 30, 122, 48, 371, 36, 51, 39, 92.

### J2 Gracz próbuje z konsoli [ważne] · 15 min · gracz testowy (drugi profil), GM

Na kopii świata albo z graczem, który wie, że to próba. Każda próba ma być odrzucona albo cofnięta, a GM ma się o niej
dowiedzieć.

**Co zrobić:**
1. Gracz zapisuje `permissions.BROADCAST_AUDIO` innego użytkownika:
   `game.users.getName("<inny gracz>").update({ "permissions.BROADCAST_AUDIO": false })`. Zablokowany przez GM-a gracz
   próbuje zdjąć blokadę ze swojej konsoli i mówić: czy ktoś go słyszy.
2. Gracz tworzy region albo zmienia nazwę regionu (Regions w narzędziach sceny albo
   `canvas.scene.createEmbeddedDocuments("Region", [{ name: "x" }])`).
3. Gracz przepisuje kości własnego rzutu z konsoli i rerollem kości na karcie Daggerhearta: wracają do tych, które padły,
   GM-owie dostają wiadomość.
4. Gracz otwiera albo zamyka sekretne drzwi Foundry: główny GM przywraca stan.
5. Okno *Uczniowie* z połączonym graczem p1: **Rola** na Monokuma pyta (domyślnie Anuluj); flaga roli zapisana z konsoli
   p1 wraca na miejsce.
6. Okno właścicieli: na głównym GM-ie `Hooks.once("updateActor", (a, c, o) => console.log("updateActor", o.noHook))`, potem
   "All Players: Owner" w *Configure Ownership*; u GM-a, który używał okna,
   `Hooks.once("closeDocumentOwnershipConfig", app => console.log("close", app?.document?.name))`. Wynik: `ownership.default`
   wraca do OBSERVER.

**Co powinno być:** każda próba odrzucona albo cofnięta; w `game.drpg.sheetWrites()` u GM-a wiersz z nazwą gracza.
**Porażka:** zapis zostaje; GM o niczym nie wie.
**Co zapisać:** komunikat serwera przy każdej próbie; `game.drpg.sheetWrites()` u GM-a po wszystkich.
**Rozstrzyga:** [LIVE-E78-06, LIVE-E12-04, LIVE-E08-05, AUDIT 9.2 poz. 20 (bez id), LIVE-E80-03, LIVE-E47-08]

Opis w AUDIT 9.2: poz. 228, 166, 93, 265, 445.

---

## Blok Z - odczyty na koniec sesji

### Z1 Co zostało w zapisach GM-ów [ważne] · 10 min · GM (i jeden gracz)

**Co zrobić:** zanim ktokolwiek zamknie przeglądarkę, w konsoli głównego GM-a:
1. `game.drpg.rollFlags()` - lista rzutów z oznaczeniem. Każdy wiersz to albo prawdziwa próba z konsoli (J2), albo
   fałszywy alarm - zapisz każdy.
2. `game.drpg.sheetWrites()` - żadnego fałszywego cofnięcia ani karty (Rest, przedmiot, Level Up, Call, Reroll, zwroty).
   Ile wierszy `listed` zostawił wieczór.
3. `game.drpg.passages.audit()` - przy `moveAudit` na "log" (domyślnie): ani jednego wiersza dla ruchu zgodnego z zasadami,
   `dropped` 0.
4. `game.drpg.gmStoreStatus()` - bajty każdego klucza i suma modułu w pamięci przeglądarki, czas jednego zapisu.
5. `game.drpg.relayGuard().refused` - lista odrzuconych zmian Daggerhearta.

**Co powinno być:** puste albo tylko z prób z J2.
**Porażka:** wiersz po zwykłej, uczciwej akcji (fałszywy alarm) - to najważniejsza informacja zwrotna z tej sesji.
**Co zapisać:** skopiuj wynik każdego polecenia do pliku `Z1-<data>.txt` (`copy(game.drpg.rollFlags())` itd.).
**Rozstrzyga:** [LIVE-E29-03, LIVE-E79-02, LIVE-E04-03, LIVE-E28-03]

Opis w AUDIT 9.2: poz. 112, 239, 43, 96.

---

## Blok I - ekrany, motywy i rozmiary (osobny wieczór)

GM sam, z drugim profilem przeglądarki jako gracz. Cały blok to zrzuty ekranu; porównuj z tym, co właściciel zatwierdził
na makietach. Nie trzeba robić wszystkiego - wybierz rozmiar ekranu, na którym gra stół.

### I1 Kurtyna, róg i okna Foundry [miłe] · 45 min · GM i drugi profil

**Co zrobić:** w obu motywach, po polsku i po angielsku, jako GM i jako gracz:
1. Zmiana pokoju, opisu i zdjęcia bez ponownego cięcia kurtyny; zegar bez bloku pokoju; kafelek pod zegarem albo obok
   powiadomień. Zdjęcie pokoju pod każdym oknem Foundry przeciągniętym na kafelek.
2. Okna *Narzędzia Foundry* i *Narzędzia mapy*: paleta Regions, pasek boczny rozwinięty i zwinięty, popout, menu
   kontekstowe - w całości widoczne. Strzałka paska bocznego zwęża okno do samych kart. Przy Monokuma Legacy z czcionką
   pikselową tekst paska ma krój modułu, a ikony Font Awesome zostają ikonami.
3. Przycisk nad podręcznikiem: białe kowadło, nie logo Foundry ani Forge.
4. GM pisze w czacie przy otwartym oknie *Narzędzia Foundry* i zmienia rozmiar okna przeglądarki: tekst i fokus zostają.
   Escape na pustym ekranie zamyka oba okna; Shift+C otwiera Narzędzia Foundry z fokusem w czacie.
5. Kolor stanu (Investigation, Evening) na kafelku, ustawieniach, podręczniku i przycisku Narzędzi, nie na komunikatorze.
6. Przełącznik okien Foundry wyłączony i przeładowanie: pasek boczny tam, gdzie stawia go Foundry; potem z powrotem.
   Czat GM-a przy wyłączonym przełączniku leży nad przyciskami.
7. Przez całą sesję pod Stained Glass: trzy przyciski w prawym dolnym rogu nigdy się nie prostują; pasek "Still to act" i
   obrócone bloki stoją w miejscu na bezczynnym ekranie.
8. Panel zdarzeń: karta safewordu, incydentu, Class Trial i dwie naraz - ten sam rozmiar, treść przewija się w środku.
9. Okno, na które gra czeka (rzut, Observe), zostaje nad arkuszem po kliknięciu arkusza.
10. Puls szkła wygląda jak przed E88 (nagranie ekranu); krawędzie kafli Panelu GM w Stained Glass nie migoczą, gdy na
    scenie coś się rusza.
11. Lista graczy Foundry pod Legacy (1541x1020 i 1366x768): czy w lewym dolnym rogu zostaje pasek.
12. Zrzuty pokazane właścicielowi do akceptacji wyglądu (D31, AM-1).

**Co powinno być:** jak w krokach.
**Porażka:** kurtyna tnie się od nowa przy zwykłej zmianie; coś zasłania przyciski Foundry; prostujący się przycisk.
**Co zapisać:** zrzuty z motywem, językiem, rozmiarem i rolą w nazwie pliku.
**Rozstrzyga:** [LIVE-E81-04, LIVE-E77-01, LIVE-E78-01, LIVE-E77-02, LIVE-E77-05, LIVE-E77-07, LIVE-E77-08, LIVE-E77-14, LIVE-E77-17, LIVE-E77-18, LIVE-E78-12, LIVE-E78-13, LIVE-E77-09, LIVE-E77-10, LIVE-E79-15, LIVE-E23-04, LIVE-E23-05, LIVE-E23-06, LIVE-E23-10, LIVE-E89-04, LIVE-E88-08]

Opis w AUDIT 9.2: poz. 186, 205, 223, 206, 209, 211, 212, 218, 221, 222, 234, 235, 213, 214, 252, 405, 406, 407, 411, 345, 330.

### I2 Układ przy różnych rozmiarach i powiększeniu [miłe] · 30 min · GM i drugi profil

**Co zrobić:**
1. Macierz róg + kafelek powiadomień (pusty, jedna karta, dwie, "+N", przewijany, z nieprzeczytanymi, fokus z klawiatury)
   przy 1920x1080 i 1366x768 (inne rozmiary tylko trybem urządzenia). Przycisk historii pod Legacy stoi pod zegarem bez
   kart i nad oknem przeciągniętym na górę; zmiana motywu w trakcie sesji przestawia go.
2. Miejsca okien zapisane przy 1080p, otwarte przy 1366x768: oba okna w całości na ekranie; zapisane miejsce wraca.
3. Chromium przy 1366x768 i 1280x720, powiększenie przeglądarki 80, 100, 120 % (Ctrl +/-): przycisk Stop na karcie,
   stopki karty, Ustaw sezon i Level Up w całości. Suwak skali modułu 80 i 120 %: okno o podanej szerokości nie skacze.
4. Przy 1024x768 i 820x1180: plansza pod stosem widoczna i grywalna; u gracza pasek stanu i Projects przed pulami Despair.
   `#players` przy 1200x800 i 1024x768 jako jedna linia.
5. Siatka akcji w karcie postaci z nowymi nazwami: 2 motywy x 2 języki x 1366x768, 1024x768, 820x1180 = 12 zrzutów.
6. Polski: kafelki arkusza, HUD, pasek statusu, panel, okno Look przy 1080p i 900p; F12 > *Network*: czy
   `*-LatinExt.woff2` się ładuje.
7. Kafle panelu GM-a jednej wysokości w Daily Life, w Eclipse z incydentem i bez.
8. Ekran dotykowy (jeśli jest): stuknięcie w przycisk historii otwiera okno i nie zamyka karty; pole trafienia 44 px.

**Co powinno być:** nic ucięte, nic poza ekranem.
**Co zapisać:** zrzuty; przy każdym ucięciu - rozmiar, powiększenie, motyw.
**Rozstrzyga:** [LIVE-E81-02 (częściowo), LIVE-E81-05, LIVE-E77-12, LIVE-E77-13 (częściowo), LIVE-E23-03, LIVE-E23-07, LIVE-E24-12, LIVE-E49-01, LIVE-E49-05, LIVE-E21-08, AUDIT 7, punkt 13, LIVE-E66-01, LIVE-E81-07]

Opis w AUDIT 9.2: poz. 184, 187, 216, 217, 404, 408, 429, 468, 471, 400, 362, 189.

**Zostaje:**

  - LIVE-E81-02: Rozmiary stołu (1920x1080, 1366x768) tak; 1024x768, 820x1180, telefony i 640x360 tylko przez narzędzia przeglądarki, a telefony właściciel skreślił 11.11.
  - LIVE-E77-13: Legacy na biurku tak; plan telefonu właściciel skreślił (11.11, runda M Q2).

---

## Blok P - wydajność i głos

### P1 Liczba klatek i praca modułu [ważne] · 20 min · GM i najsłabszy komputer gracza

Przepis jest w podręczniku GM-a, sekcja 20, "Gdy stół laguje". W skrócie:

**Co zrobić:**
1. Zapisz przeglądarkę, czy rysuje na karcie graficznej (`chrome://gpu`, "Canvas: Hardware accelerated"), rozmiar ekranu,
   powiększenie, *Performance Mode* i *Maximum Framerate* Foundry, motyw, liczbę graczy, tokenów i Remnantów.
2. Wszyscy stoją; jeden gracz sam w pokoju pod mgłą: `await game.drpg.perf()` (szept na czat), potem
   `await game.drpg.fps({ toChat: false })` - na komputerze GM-a i na najsłabszym komputerze gracza, w obu motywach.
3. Gracz przeciąga własny token przez pokój i do następnego; w tym czasie `await game.drpg.fps({ seconds: 5 })` u
   przeciągającego, u patrzącego gracza i u GM-a. Przed i po: `game.drpg.counters({ reset: true })` i
   `game.drpg.counters()` - zapisz `refreshToken.*`, `visibility.applyAll.tokens`, `visibility.sightRefresh`,
   `visibility.myRooms.walk`.
4. GM zmienia Despair (pip i Reroll), zegar i zapis ledgera z otwartymi arkuszami (jeden zminimalizowany):
   `counters()` przed i po u gracza.
5. Przejście kurtyny: `fps({ toChat: false })` raz w spoczynku i raz ze zmianą fazy (Daily Life -> Investigation) i pory
   dnia w trakcie pomiaru.
6. Przy największej liczbie Remnantów (jeśli świat ma ok. 60): `fps()` przy otwartym panelu Investigation.
7. Gdy laguje: `await game.drpg.whySlow()` w trakcie ruchu innego gracza przez trzy pokoje.

**Co powinno być:** liczby zapisane; nie ma tu progu zaliczenia, to pomiar.
**Co zapisać:** cały tekst wypisany przez `perf()` i `fps()` z każdego komputera, z motywem w nazwie pliku.
**Rozstrzyga:** [LIVE-E88-01, LIVE-E88-04 (częściowo), LIVE-E88-07, LIVE-E88-05, LIVE-E89-01 (częściowo), LIVE-E89-02, LIVE-E33-05 (częściowo), LIVE-E23-01, LIVE-E97-06 (częściowo)]

Opis w AUDIT 9.2: poz. 323, 327, 329, 324, 346, 343, 129, 402, 487.

**Zostaje:**

  - LIVE-E88-04: Pomiar na wydaniu stołu tak; "przed E88" wymaga wydania 1.2.85-1.2.88.
  - LIVE-E89-01: Pomiar na 1.2.107 tak; porównanie 1.2.90 z 1.2.91 wymaga starych wydań.
  - LIVE-E33-05: perf() przy stole tak; pełna metoda (world-manifest.mjs i perf-baseline.mjs --run na kopii) wymaga kopii świata i Node przy stole.
  - LIVE-E97-06: Część "60 Remnantów" (fps przy otwartym panelu) tak, gdy świat tyle ma; czytnik ekranu w K1.

### P2 Zerwania głosu [ważne] · w trakcie gry · GM i jeden gracz

**Co zrobić:**
1. GM i jeden gracz włączają *Szczegółowe logi w konsoli* (ustawienie klienta) i konsolę na *Verbose*. Proximity Voice
   Chat wyłączony na czas próby.
2. Po każdym zerwaniu dźwięku: skopiuj każdą linię "Voice:" z godziną i zapisz, czy ktoś przechodził przez drzwi, stał w
   przejściu, czy trwał Eclipse, czy to samo konto było otwarte w drugim oknie.
3. Przejście przez drzwi do nowego pokoju: jeden pokój głosowy na przejście (linie Debug u gracza i u GM-a).
4. Celowe zerwanie (sieć wyłączona na kilka sekund u gracza): jedna karta "Voice disconnected", która zostaje w historii,
   żadnego toastu "Disconnected from LiveKit"; przeglądarka łączy się sama po 1, 5 i 15 s; kafel przechodzi w stan bez
   połączenia i wraca.

**Co powinno być:** po zerwaniu głos wraca sam.
**Porażka:** gracz musi przeładować, żeby wrócić do głosu.
**Co zapisać:** linie "Voice:" z godzinami.
**Rozstrzyga:** [LIVE-E88-03, LIVE-H82-02, LIVE-E19-01, LIVE-E78-07]

Opis w AUDIT 9.2: poz. 326, 276, 283, 229.

---

## Blok K - sprzęt i narzędzia spoza zwykłego stołu (jeśli są)

### K1 Czytnik ekranu [miłe] · 20 min · ktoś z NVDA (Firefox) albo VoiceOver (Safari)

**Co zrobić:** najpierw `game.drpg.a11y()` w konsoli (lista tego, czego czytnik nie przeczyta). Potem z czytnikiem: nowa
karta powiadomienia (czytnik czyta kartę bez nazwy przycisku historii); Class Trial się zaczyna, zmienia się treść panelu
Eventu, Event się kończy; mapa sprawy: Tab do mapy, strzałki między węzłami, każdy węzeł czytany z rodzajem, nazwą, stanem
i "x z y".
**Co zapisać:** wynik `a11y()`; co czytnik powiedział (nagranie albo notatka).
**Rozstrzyga:** [LIVE-E81-08, LIVE-E48-06]

Opis w AUDIT 9.2: poz. 190, 473.

### K2 Inne przeglądarki, wtyczki i klawiatura ekranowa [miłe] · 20 min

**Co zrobić:**
1. Dark Reader w Chrome i Firefoksie: powiadomienie o przyciemnianiu pojawia się, gdy Dark Reader jest nazwany.
2. Pełna pamięć strony w Firefoksie (i Safari, jeśli ktoś go używa): jaki błąd rzuca przeglądarka przy zapisie prywatnej
   karty (nazwa, kod).
3. Tablet: pole tekstowe wysuwa klawiaturę - czy zmieniają się klasy `drpg-short` i `drpg-stacked` na body
   (`document.body.className`); `({ api: Boolean(navigator.virtualKeyboard), overlays: navigator.virtualKeyboard?.overlaysContent ?? null, h: innerHeight })`
   przed i po wysunięciu.
**Rozstrzyga:** [LIVE-E52-09, LIVE-E81-21, LIVE-E21-02, LIVE-E21-03, LIVE-E78-05 (nie przy sesji 0, zob. niżej)]

Opis w AUDIT 9.2: poz. B-E52-9, 203, 388, 389, 227.

### K3 Scena testowa z dwoma piętrami [ważne] · 30 min · GM i gracz testowy, na kopii

Szkoła właściciela ma jedno piętro, więc to tylko na scenie testowej (Levels v14).

**Co zrobić:**
1. Mgła rysuje jedno piętro; wejście po schodach kosztuje jedno przejście jak drzwi, zmiana piętra na klatce schodowej nic;
   zamknięty pokój na drugim piętrze jest odrzucany.
2. Konsola GM-a: jakie `levels` dostaje nowy region, jaki `level` token upuszczony na mapę; kafel położony ręcznie:
   `canvas.scene.tiles.contents.map(t => [t.x, t.y, t.width, t.height, t.elevation, t.level, t.levels])`.
3. Gracz z konsoli przenosi swój token na wyższe piętro do zamkniętego pokoju: GM odsyła go tam, skąd przyszedł.
4. Tajne przejście na dwóch piętrach i z Isometric Perspective.
5. (Po wydaniu E61) przekrój pięter.
**Rozstrzyga:** [LIVE-E12-02, LIVE-E12-03, LIVE-E17-03, LIVE-E79-03, LIVE-E95-02, LIVE-E61-06 (po wydaniu E61)]

Opis w AUDIT 9.2: poz. 164, 165, 309, 240, 453.

### K4 Moduły towarzyszące wyłączone [miłe] · 20 min · na kopii

**Co zrobić:**
1. Świat z wyłączonym avclient-livekit, potem z odinstalowanym Isometric Perspective: moduł nazywa brak ("zainstalowany,
   ale wyłączony" / "nie zainstalowany") w oknie GM-a i u gracza.
2. Świat z wyłączonym Dice So Nice: okno wymagań podaje powód w języku stołu; w konsoli brak błędu z danganronpa-rpg; rzut
   gracza ma dźwięk i kartę u rzucającego, statystyka z arkusza czytelna tylko dla niego.
3. Proximity Voice Chat włączony i nieskonfigurowany: `game.drpg.diagnoseVoice()` i `game.drpg.voicePlan()` zaczynają od
   "Proximity Voice Chat is also active."; głośności wyzerowane odległością.
4. avclient-livekit w osobnym oknie (*useExternalAV*), jeśli da się go włączyć: przycisk mikrofonu z kropką i "Głos jest w
   osobnym oknie".
5. Moduł dodający własny zestaw kolorów kości: `game.drpg.diagnoseDiceLook()` nie zgłasza go jako brakującego u GM-a,
   który go używa.
**Rozstrzyga:** [LIVE-E13-11, LIVE-E19-09, LIVE-E78-08, LIVE-E78-09, LIVE-E20-02, LIVE-E60-07]

Opis w AUDIT 9.2: poz. 182, 289, 230, 231, B-E20-2, 373.

---

## Blok L - lokalna bramka (opcjonalnie, tylko z piaskownicą v14)

### L1 `npm run gate:local` [ważne] · ok. 60 min bez ludzi · ktoś z piaskownicą Foundry v14 pod :30099

Ostatni zapis bramki (`audit/gate/local-gate.json`, 1.2.107, 12.11.2026) ma wszystkie osiem części "not-run" z powodem
`no-server`: `live-stained-glass`, `live-monokuma-legacy`, `live-world-diff`, `sandbox-14-quiet`, `sandbox-60-ledger`,
`sandbox-81-render-budget`, `sandbox-83-roll-integrity`, `sandbox-84-viewports`. Werdykt "incomplete".

**Co zrobić** (pełny opis: `audit/gate/README.md`):
1. Piaskownica Foundry v14 pod `http://localhost:30099` z kopią świata, której nazwa pasuje do `/(gate|copy|qa)/i`, i z
   kontami GM, PlayerOne, PlayerTwo, PlayerThree bez haseł.
2. `cd audit/harness && npm ci`, potem `DRPG_SANDBOX_WORLD=drpg-qa-gate npm run gate:local` na commicie wydania.
   `--dry-run` najpierw sprawdza piaskownicę i wypisuje części bez uruchamiania.
3. Plik, który bramka zapisze, commituje się osobnym commitem na wierzchu (nie amend). **Agent nie pisze pliku waiver** -
   to decyzja właściciela.
4. Przy okazji, na tej samej piaskownicy: scenariusz 83 z prawdziwym oknem rzutu, 17-assistant (sekcje B i C), 81-render-budget
   z prawdziwymi kartami, R294/R295 (historia powiadomień przez prawdziwe `cleanHTML`), sondy scenariusza 30, tryb
   `moveAudit` "sendBack" (dopiero gdy Z1 pokazał zero fałszywych wierszy), Breach the Wall (E15) i
   `node audit/glass-sweep.mjs` (22 rozmiary w Chromium, bez Foundry).

**Co powinno być:** `local-gate.json` z werdyktem "passed".
**Co zapisać:** plik `local-gate.json` i `audit/gate/evidence/` (zapisuje je sam runner).
**Rozstrzyga:** [LIVE-E33-01, LIVE-E30-06, LIVE-E37-01, LIVE-E81-01, LIVE-E81-10, LIVE-E81-11, LIVE-E79-07, LIVE-E15-02, LIVE-E81-13, LIVE-E73-01 (po wydaniu E73)]

Opis w AUDIT 9.2: poz. 125, 31, 365, 183, 192, 193, 244, 302, 195.

---

## Czego sesja 0 nie rozstrzyga

Te wiersze nie mają sprawdzenia w pakiecie albo mają je tylko na innej wersji lub innym świecie. Każdy jest w
`coverage.json` z powodem.

| Id | Pozycja | Dlaczego nie przy sesji 0 |
| --- | --- | --- |
| LIVE-E75-05 | 153 | Wersja zastąpiona: stół jest na Foundry 14.370 i Daggerheart 2.12.8, a ten wiersz pyta o 14.369 z 2.10.11; jego treść powtarza LIVE-E76-01. |
| LIVE-E75-04 | 152 | Dotyczy Daggerhearta starszego niż 2.10.10; stół ma 2.12.8. Do zrobienia tylko na świecie ze starszą wersją. |
| LIVE-E28-02 | 95 | Stół gra z Dice So Nice; wiersz pyta o stół bez niego. Do zrobienia na kopii świata z wyłączonym Dice So Nice (razem z LIVE-E20-02, blok K4). |
| LIVE-E70-07 | 337 | Wymaga stołu 14-15 osób; sesja 0 ma mniej. |
| LIVE-E78-05 | 227 | Właściciel zrezygnował z telefonów (11.11.2026, runda M Q2); kafel głosu na prawdziwym telefonie nie jest celem. |
| LIVE-E04-06 | 46 | Próba aktualizacji na kopii świata sprzed 1.2.63; świat stołu jest już po tej aktualizacji. Potrzebna kopia sprzed niej. |
| LIVE-E05-02 | 54 | Klauzule 1.2.64 na kopii świata sprzed nich; świat stołu już je przeszedł. |
| LIVE-E05-12 | 64 | Klauzula 1.2.64 na tokenie z flagą w delcie; świat stołu już ją przeszedł. |
| LIVE-E06-07 | 73 | Klauzula starych kart na kopii świata sprzed niej; już przebiegła. |
| LIVE-E11-06 | 159 | Pierwsze wczytanie świata sprzed 1.2.73; już przebiegło. |
| LIVE-E12-08 | 170 | Migracja pokoi na kopii świata sprzed niej; już przebiegła. |
| LIVE-E30-07 | 28 | migrateRemnants na kopii świata sprzed ledgera śladów (DRPG_FIXTURES); świat stołu jest po nim. |
| LIVE-E32-02 | 76 | Incydent w toku przez aktualizację do 1.2.66; ta aktualizacja już minęła. |
| LIVE-E63-05 | 467 | Świat 1.2.104 w środku rozdziału aktualizowany do 1.2.105; ta aktualizacja już minęła. |
| LIVE-E81-19 | 201 | Świat z 1.2.74 z dwoma GM-ami; ta aktualizacja już minęła. |
| LIVE-E20-03 | B-E20-3 | Osoba, która nie zna modułu, na nowym świecie; właściciel zna moduł, a świat stołu nie jest nowy. Można dać to nowej osobie poza sesją. |
| LIVE-E31-04 | 38 | Wolny serwer z odpowiedzią po 5 i 10 s; zwykły serwer na Forge tego nie odtworzy, a celowe spowolnienie nie należy do sesji z graczami. |
| AUDIT 9.2 poz. 448 (bez id) | - | Zapis rundy poprawek E47-FA..FD i jej przyjęcia, nie check przy stole; to, co z niej zostało do sprawdzenia, jest w LIVE-E47-11. |
| AUDIT 9.2 poz. 449 (bez id) | - | Zapis przeniesienia do E98 (nagłówki Legacy w tabeli Remnants), nie check przy stole. |
| AUDIT 9.2 poz. 450 (bez id) | - | Zapis zatwierdzenia podpisów Observe, nie check przy stole. |
| AUDIT 9.2 poz. 451 (bez id) | - | Zapis decyzji o mapie sprawy (E97-E99), nie check przy stole. |

## Wiersze z otwartych gałęzi (zrób po ich wydaniu)

Te identyfikatory są na gałęziach, które jeszcze nie weszły do `main`. Opisują wersję, której stół nie ma. Każdy jest
przypisany do sprawdzenia, przy którym warto go zrobić, gdy wydanie wyjdzie.

| Id | Gałąź | Etap | Sprawdzenie |
| --- | --- | --- | --- |
| LIVE-E61-01 | `claude/e61-62` | E61 | F1 |
| LIVE-E61-06 | `claude/e61-62` | E61 | K3 |
| LIVE-E61-08 | `claude/e61-62` | E61 | F1 |
| LIVE-E64-01 | `claude/e64` | E64 | D5 |
| LIVE-E69-04 | `claude/e93` | E69 | C1 |
| LIVE-E73-01 | `claude/e73` | E73 | L1 |
| LIVE-E73-02 | `claude/e73` | E73 | F2 |
| LIVE-E73-03 | `claude/e73` | E73 | F1 |
| LIVE-E73-04 | `claude/e73` | E73 | J1 |
| LIVE-E73-05 | `claude/e73` | E73 | F2 |
| LIVE-E92-01 | `claude/e92` | E92 | B3 |
| LIVE-E92-02 | `claude/e92` | E92 | C1 |
| LIVE-E92-03 | `claude/e92` | E92 | F1 |
| LIVE-E92-04 | `claude/e92` | E92 | C1 |
| LIVE-E93-01 | `claude/e93` | E93 | C3 |
| LIVE-E93-02 | `claude/e93` | E93 | C6 |
| LIVE-E93-03 | `claude/e93` | E93 | A7 |
| LIVE-E99-01 | `claude/e97-98` | E99 | F2 |
| LIVE-E99-04 | `claude/e97-98` | E99 | H1 |
| LIVE-E99-05 | `claude/e97-98` | E99 | H1 |
