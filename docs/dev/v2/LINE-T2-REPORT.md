# Linia T2 - raport (rulings-bridge-secondgm, gałąź `claude/v2-t2`)

Napisane 28.11.2026 według sekcji 5 `docs/dev/v2/LINE-T2.md`. Źródła: wiadomości commitów `31d5812..a5b4ea0` (każda niesie
odczyt czerwony, zielony, testy, sekcje podręczników, mutanty i linię QUICK - cytaty poniżej są z nich), notatki grup
G01-G11, G18-G21, FIX-G1..FIX-G3, BASELINE, CI, COORDINATOR i przegląd końcowy (REVIEW.json: soczewki correctness, goal,
security, każde znalezisko z werdyktem sceptyka). Gdzie notatka i commit się różnią, obowiązuje commit i jest to
powiedziane przy pozycji. Niczego, co tu stoi, nie uruchomiono na prawdziwym Foundry ani przy stole: wszystko jest z
kodu, z harnessu headless (jsdom) i z CI.

---

## 0. Zakres po podziale linii (ważne przed czytaniem tabeli)

Koordynator podzielił linię T2 28.11.2026 o 04:18Z. Wiadomość dotarła do tej sesji z opóźnieniem, odczytana o 09:39Z;
wcześniej, około 08:55Z, odczytano na żywo jego STOP dla DAY-01. Linie T2b i T2c wystartowały od `0d3d4f2a` (05:50Z).

| Linia | Pozycje |
| --- | --- |
| **T2 (ta gałąź)** | PRIM-03, PRIM-01, PRIM-02, CALLS-06, CALLS-02, CALLS-01, EXP-GM-05, CALLS-12, CALLS-14, CALLS-05, CALLS-03, EXP-PL-12, CALLS-09, DAY-07, CALLS-04, CALLS-07, PRIM-04, PRIM-08, PRIM-09; do tego CALLS-15 i INV-10 (commit `f0e0735`, zrobiony tutaj, zanim spóźniona wiadomość doszła) |
| T2b | DAY-01, DAY-02, EXP-GM-13, DAY-06, DAY-05, DAY-10, DAY-09 |
| T2c | EXP-GM-01, EXP-GM-17, EXP-GM-06, EXP-GM-07, EXP-GM-14, EXP-GM-16, CALLS-15, INV-10, EXP-PL-09 |

- **CALLS-15 i INV-10 są zrobione dwa razy:** tutaj jako `f0e0735` i w T2c jako `1e76847` (na `origin/claude/v2-t2c`,
  ten sam zakres plików: player-handbook 14 EN i PL oraz `docs/handbook-facts.player-handbook.en.json`). Koordynator
  zostawia jeden przy scaleniu. Druga połowa INV-10 - ten sam błąd w gm-handbook 6.3 - jest tylko tutaj, w `a5b4ea0`
  (T2-GOAL-02 z przeglądu); `1e76847` podręcznika GM-a nie dotyka.
- **DAY-01** zaczęto tutaj (grupa G12) i zatrzymano na słowo koordynatora przed commitem. Praca leży w `git stash` tej
  sesji jako `stash@{0}` ("G12 DAY-01 work-in-progress, stopped on coordinator's word (DAY-01 belongs to T2b)", 21 plików,
  +505/-79), nigdy niepushowana, nietknięta.
- Kolejność scalania podana przez koordynatora 04:18Z: T4, T2, T2b, T2c, T1, T3, T5.

---

## 1. Podsumowanie

| Co | Wartość |
| --- | --- |
| Początek | `31d5812` (`31d58123aae1c43654382937b4575869c99feb98`) |
| Koniec (przed raportem) | `a5b4ea0` (`a5b4ea04d47a2fc0cc2e3d4ca8c036df1d354df0`); commit z tym raportem jest ostatni na gałęzi |
| Commity | 19 w `31d5812..a5b4ea0` (15 commitów pozycji, wiersz etapu, 3 poprawki z przeglądu końcowego) + ten raport |
| Zmiana | 48 plików, +5065/-259 (`git diff --stat 31d5812..a5b4ea0`) |
| Bazowo, tiery 0-1 przy `31d5812` | `run-tests: 2053 passed, 0 failed, 16 skipped, 0 red`, 2068 testów, 626,9 s wall (10m27s real, ten kontener, 4 rdzenie); `npm run quick` zielone (lint 22,2 s, 457 plików, 0 problemów; check 26 części, 105,3 s; gate 62/62, 3,5 s) |
| Na końcu, tiery 0-1 przy `a5b4ea0` (z rundą poprawek) | `2091 passed, 0 failed, 16 skipped, 0 red`, 2106 testów, 659,1 s wall (z wiadomości commitu FIX-G3, uruchomione na `57cb32d`+zmiany, czyli drzewie `a5b4ea0`) |
| Różnica | +38 testów tieru 1 (38 nowych numerów R), skipped bez zmian (16), `skip-baseline.json` bez zmian |
| Pełny `npm test` | **nie uruchomiony w tej chmurze** - patrz niżej |

**Pełny `npm test`.** Koordynator napisał (wiadomość z 02:45Z, odczytana 09:39Z), że pełny `npm test` nie mieści się w
tej chmurze (01-runtests ponad limit 6480 s, zmierzone przez linię T5) i że za pełny przebieg liczy się zielone CI na
ostatnim pushu. Każdy commit przeszedł bramkę QUICK z sekcji 3 specyfikacji (lint, check, gate, prose, pełne tiery 0-1,
własne i powiązane testy tieru 2, scenariusze dotkniętych dróg) - linie QUICK są w wiadomościach commitów.

### Wynik CI na ostatnim pushu

<!-- CI -->

Ostatni push to commit z tym raportem (drzewo `a5b4ea0` plus ten plik). Jego przebieg `ci.yml` nie może stać w nim
samym: wynik (każde zadanie: lint/check/gate, plan, 8 kubełków scenariuszy, 8 shardów, verdict) podaje końcowa wiadomość
sesji koordynatorowi. Przebiegi `b096c6b`, `b8a1997`, `57cb32d` i `a5b4ea0`, czekające w kolejce za innymi liniami,
zostały anulowane po pushu raportu: przebieg commitu z raportem obejmuje ich całe drzewo (raport zmienia tylko ten plik).

Znane w chwili pisania (`ci.yml`, zdarzenie push, `gh run list --branch claude/v2-t2`, 28.11.2026 ok. 12:08Z):

| Commit | Przebieg | Wynik |
| --- | --- | --- |
| 8bd6278 | 46075757587 | success |
| 361aaf1 | 46080132868 | success |
| 2ecf4f6 | 46083000075 | success |
| 7832a4d | 46085970617 | success |
| 9fbf34c | 46096324637 | success |
| 42f0cee | 46099162687 | **failure** - tylko shard suite 4/8, test S16-02 (sekcja 1.1) |
| 0f9bbe1 | 46103017753 | success |
| 577c96f | 46106851481 | success |
| 0d3d4f2 | 46113099058 | success |
| a7901b8 | 46117330849 | success |
| f0e0735 | 46119734612 | success |
| da50eca | 46124601853 | success |
| 9e59a4e | 46126631757 | success |
| a37561c | 46128498987 | success |
| b096c6b | 46130306131 | w kolejce |
| b8a1997 | 46130697234 | w kolejce |
| 603b5bf | 46135538133 | w toku |
| 57cb32d | 46138071558 | w kolejce |
| a5b4ea0 | 46142796619 | w kolejce |

### 1.1 S16-02 - test niestabilny

Test tieru 2 "an Assistant GM's switch of the table's dice look is put back, heard or written with no hook, and the GM
is told once (S16-02)":

- Raz czerwony w CI: `42f0cee`, shard 4/8, odczyt "an Assistant's switch of the table's dice look stood, heard or
  written with no hook, or the GM was told more than once (before: [the GM's look on the player, both swit..." (ucięty
  w logu).
- Zielony na następnych pushach (`0f9bbe1`, `577c96f` i dalej do `a37561c`).
- Lokalnie, sam (`--tier 2 --only`): 3/3 przy `b096c6b`, 3/3 na kopii `31d5812` (`DRPG_REPO`), 3/3 przy `a5b4ea0`.
- Nie ma przebiegu CI dla `31d5812` (jego commit ma `[skip ci]`), więc nie da się powiedzieć, czy na bazie w CI też by
  padł. Podejrzenie z notatek (Asystent GM-a i gotowość głównego, czyli czas z PRIM-03) **nie jest zmierzone**.
- Testu nie osłabiono.

---

## 2. Tabela pozycji (35 ID)

Status "zrobione" znaczy: commit, test czerwony przed zmianą i zielony po niej, odczyt czerwony zacytowany z commitu.
Numery R to tier 1, "E132 ..." to tier 2.

| ID | Status | Commit | Testy (R i tier 2) | Sekcje podręczników | Uwagi (czerwony odczyt z commitu) |
| --- | --- | --- | --- | --- | --- |
| PRIM-03 | zrobione | `8bd6278`; poprawka `603b5bf` (T2-COR-01) | R9052, R9053, R9054, R9055, R9068, R9069, R9119; E132 PRIM-03 (dwa testy: przeładowanie; gniazdo wraca bez przeładowania); 97-two-gms A3b | GM 6.3 "The primary GM" EN i PL | R9052: "expected [A, B, null, A], measured [A, A, A, A]"; E132: `{"loading":["back",false],"changes":[]...}`; 97 A3b na kopii 31d5812: "every watcher tookGmEarly 1, readGm2 false". Poprawka: R9119 `{"sent":"missing","steps":"missing","wired":[false,0,false,false]}`. Rozjazd zmierzony: 97 - 8 z 1128 okien po 100 ms, 33 - 0 z 1993. Kształt inny niż w specyfikacji: własna przeglądarka nie jest główną przed `ready` (nie przed `registerGmBridge`) |
| PRIM-01 | zrobione | `361aaf1`; tekst `a5b4ea0` (T2-GOAL-06) | R9049; E132 PRIM-02 czyta linię; 97 PRIM1-PRIM3 | GM 3, GM 20.7 EN i PL | R9049: `{"first":false,"live":false,"other":null,"own":null,"redraw":false}`. Linia stoi nad listą uczniów (S0-GMLIST) - pytanie do właściciela (sekcja 8) |
| PRIM-02 | zrobione | `361aaf1` | R9050, R9051; E132 PRIM-02; 97 PRIM1-PRIM3 | GM 6.3 "The primary GM", GM 20.7 EN i PL | E132 PRIM-02: `{"after":{"handBack":0,"line":null,"nowYou":0},"loading":{"line":null,"notices":0},"ready":{"handBack":0,"line":null,"nowYou":0}}`; R9050 częściowo zielony już na `8bd6278` (obserwator z PRIM-03), czerwony na braku `Hooks.on("updateUser"`. Reguła wyboru bez zmian - D2-29 (sekcja 8) |
| CALLS-06 | zrobione | `2ecf4f6` | R9034 | GM 6.3 EN i PL | R9034 twoReloads `[1,1,1,0,0,0]` (czwarte 0: drugi powrót głównego nie zapytany); zielony `[1,1,1,1,1,0]`. Brak testu tieru 2 (specyfikacja nie wymienia); żaden scenariusz nie robi dwóch przeładowań głównego w czasie jednej prośby |
| CALLS-02 | zrobione | `7832a4d` | R9025; E132 CALLS-02 | GM 6.3 EN i PL | E132: `{"endedFreed":false,"endedHeld":false,"freed":[],"held":[false,"busy",true],...}` - własne zajęcie tego GM-a odrzucane jako "busy" przez niego samego. Dodatkowa straż `since` (wiersz z tego wczytania zostaje) - poza "Musi" |
| CALLS-01 | zrobione | `9fbf34c`; poprawki `603b5bf` (T2-COR-03), `57cb32d` (T2-COR-02, T2-GOAL-01) | R9020, R9021, R9022, R9070, R9115, R9117, R9118; E132 CALLS-01 (dwa: przejęcie; były główny zapomina zajęcia); 97 TAKE1-TAKE3; 33 A26; 30-security (sfałszowany `card.takenOver`) | GM 6.3 "Taking a card over" EN i PL | R9020: "threw: A.onCardTakenOver is not a function"; E132: `{"kept":[null,null],"left":2,"row":["other",true],"signBefore":null}`; 97 TAKE1-3 FAIL. `claimHoldMs` 120 s wybrane, nie zmierzone (LIVE-E132-01). Odrzucanie decyzji: gdy inny GM trzyma kartę, nie `!== by` (kształt inny, powód w sekcji 6) |
| EXP-GM-05 | zrobione | `9fbf34c`; `57cb32d` (T2-GOAL-05) | R9023, R9116; E132 CALLS-01 czyta znak | GM 6.3 EN i PL | R9023: `other: {"by":null,"line":null,"take":null}`. Od `57cb32d` Przejmij na karcie trzyma zajęcie (tylko "takeover", bez "drop"), jak 2.1 pkt 4; R9116 czerwony `card: [true,["takeover","drop"]]` |
| CALLS-12 | zrobione | `9fbf34c`; `57cb32d` (T2-COR-02) | R9024, R9117 | GM 6.3 EN i PL | R9024: `{"said":[],"raised":0}`; R9117 (własne zajęcie, które wygasło na głównym): `ranOut {"out":["settled"],"steps":["take","done"],"worked":true,"said":[]}`, `raised 0` |
| CALLS-14 | zrobione | `42f0cee`; `57cb32d` (T2-GOAL-04) | R9036, R9114; E132 CALLS-14; 97 P2 | brak zmian (GM 6.3 już to mówił, przeczytane) | R9036: `{"approveCall":["The player was no longer waiting.",null],"handed":[false,false],"refuseDynamic":["The player was no longer waiting.",null]}`; R9114 `settled: [[null,0],[null,0]]`. Test "A11" ze specyfikacji nie istnieje (A11 to wiersz sceny w F1-calls.md), więc nowy E132 |
| CALLS-05 | zrobione | `0f9bbe1` | R9033; E132 CALLS-05 | GM 6.3, gracz 14 EN i PL | R9033: `{"exported":false,"pick":["Answered by GM.",null,"body"],"sent":[["bridge.done",["USERP10000000000"],"body"]]}`; E132: każda linia "Answered by GM." od wyboru. Druga droga (pokwitowanie przed linią) - poza specyfikacją, zmierzona kartą B |
| CALLS-03 | zrobione | `577c96f` | R9026, R9027; E132 CALLS-03 | GM 6.3, gracz 14 EN i PL | E132: `{"first":null,"opened":[["","eye"],["","eye"],["","eye"]]}`; R9026 `{"A":[null,null],"B":[null,null],...,"own":null}`. Teksty zmienione przez lint T25 (sekcja 6); okna kryzysowe T1 bez `keep` |
| EXP-PL-12 | zrobione | `0d3d4f2` (jeden wiersz z CALLS-09 i DAY-07); `57cb32d` (T2-COR-05), `a5b4ea0` (SEC-T2-01, SEC-T2-02) | R9028, R9029, R9030, R9113; E132 EXP-PL-12; 33 A27; 30-security (trzy przypadki) | gracz 14, GM 6.3 EN i PL | E132: `"up":false` na drogach Call, Dynamic i statystyki (brak Wycofaj), statystyka "still waiting"; R9030 `{"answer":null,"cancel":[null,null,null],"module":false,"sentUnder":false,"states":[],...}`. Stan "GM czyta twoją prośbę." bez imienia GM-a |
| CALLS-09 | zrobione | `0d3d4f2` | jak EXP-PL-12 (R9029 - strażnik `ask.withdraw`) | jak EXP-PL-12 | R9029: "the source no longer declares a top-level function withdrawnOnPrimary()". Wycofanie nic nie oddaje, bo żadna z trzech dróg nie płaci przed decyzją (przeczytane w kodzie, w commicie) |
| DAY-07 | zrobione | `0d3d4f2` | jak EXP-PL-12 (R9028 - czas i Wycofaj na okienku czekania) | jak EXP-PL-12 | R9028: `{"drawn":[false,false,null,null,null],"pressed":[],"roads":[false x9],"state":[null,null],"waitingFor":null}` |
| CALLS-04 | zrobione | `a7901b8` | R9031, R9032; E132 CALLS-04; 30-security (`bridge.playerReady` od p2) | gracz 14, GM 6.3 EN i PL | E132: `{"after":true,"fromGm":false,"left":null,"reloaded":{"buttons":true,"held":true,"lines":[],"settled":false,"sign":[false,false]},...}`. Nowy pakiet `bridge.playerReady` (nie wiersz `BRIDGE_ACTIONS`, sekcja 6) |
| CALLS-07 | zrobione | `b096c6b` | R9035; E132 CALLS-07 | GM 8 (tylko akapit Ask for Hope) EN i PL | E132: `{"empty":{"hope":0,"oldLine":true,"open":true,"settled":false,"settledLine":false,"told":false},"gmBlock":false,"paid":{...}}`; R9035 `{"card":"missing","order":[false,false,false],"refusal":[false,false,"missing"]}`. `{pool}` to nazwa puli, nie liczba (pytanie Q-CALLS-07-1) |
| PRIM-04 | zrobione | `da50eca` | R9056, R9057; 61-gmstore-case Z2b, Z3b | GM 3 EN i PL | R9056: `{"quiet":null,"wired":[false,false,true]}`; R9057 `{"runs":null,"wired":[false,false]}`; 61 Z2b na kopii: `{"primary":false,"warning":false,"missing":[],"dialogs":0}`, 118/120. Ciche ponowne sprawdzenie zdejmuje ramkę także u drugiego GM-a - ponad słowa specyfikacji. T2-COR-04 z przeglądu uznany przez sceptyka za nierealny (zgodne ze specyfikacją) |
| PRIM-08 | zrobione | `9e59a4e` | R9058; 97 FLOG1 | GM 20.7 EN i PL | R9058: `{"cases":["missing","missing","missing"],"here":"missing","wired":[false,false,false]}`; 97 FLOG1 na kopii: `"hint":null` u gm2 i gm, 66/67. Klucz w cudzej przestrzeni `DRPG.Failures.elsewhere` |
| PRIM-09 | zrobione | `a37561c`; `a5b4ea0` (T2-GOAL-03: LIVE i komentarz) | R9059; E132 PRIM-09 | GM 19 EN i PL (dwa miejsca) | E132: `{"after":true,"card":{"cards":1,"mine":true,"paused":false},"primary":[true,false],"running":true}`. Czy v14 przy dwóch `togglePause(true)` zostaje w pauzie - niezmierzone, LIVE-E132-22 |
| CALLS-15 | zrobione (tekst) | `f0e0735` | brak testu (tekst podręcznika, LINE-T2 3.2) | gracz 14 EN i PL; fakty s14.p5.f8, f9 | Cytat trudności to teraz `DRPG.Bridge.settledUnconfirmed` z {name} jako "GM". To samo zrobione w T2c (`1e76847`) - jeden zostaje przy scaleniu |
| INV-10 | zrobione (tekst) | `f0e0735`; `a5b4ea0` (T2-GOAL-02, GM 6.3) | brak testu (tekst; odczyt kodu w commicie) | gracz 14 EN i PL; GM 6.3 EN i PL; fakty gracz s14.p5.f1, f11, GM s6.p15.f1 | Czas ma Observe ze Skup wzrok (`askObserveByCard`, `TIMING.rulingMs`); Zbadaj punkt zainteresowania (`observeAnything`) bez czasu. GM 1.4 (linia 104) zostaje ze starym zdaniem - poza sekcjami T2 (sekcja 9) |
| DAY-01 | nie zrobione tutaj - przeniesione do T2b | - | - | - | Zaczęte (G12), zatrzymane na STOP koordynatora (ok. 08:55Z) przed commitem; praca w `stash@{0}`, niepushowana, nietknięta. Forge `s2-second-gm` I1 i `s1a-day-murder` "DAY-01" należą do T2b |
| DAY-02 | nie zrobione tutaj - przeniesione do T2b | - | - | - | - |
| EXP-GM-13 | nie zrobione tutaj - przeniesione do T2b | - | - | - | - |
| DAY-06 | nie zrobione tutaj - przeniesione do T2b | - | - | - | - |
| DAY-05 | nie zrobione tutaj - przeniesione do T2b | - | - | - | - |
| DAY-10 | nie zrobione tutaj - przeniesione do T2b | - | - | - | - |
| DAY-09 | nie zrobione tutaj - przeniesione do T2b | - | - | - | - |
| EXP-GM-01 | nie zrobione tutaj - przeniesione do T2c | - | - | - | - |
| EXP-GM-17 | nie zrobione tutaj - przeniesione do T2c | - | - | - | - |
| EXP-GM-06 | nie zrobione tutaj - przeniesione do T2c | - | - | - | - |
| EXP-GM-07 | nie zrobione tutaj - przeniesione do T2c | - | - | - | - |
| EXP-GM-14 | nie zrobione tutaj - przeniesione do T2c | - | - | - | - |
| EXP-GM-16 | nie zrobione tutaj - przeniesione do T2c | - | - | - | - |
| EXP-PL-09 | nie zrobione tutaj - przeniesione do T2c | - | - | - | - |

Żadnego `expectedRed` linia nie dodała.

### 2.1 Runda poprawek z przeglądu końcowego

Przegląd (REVIEW.json) miał trzy soczewki. Wynik każdego znaleziska:

| Znalezisko | Waga | Pozycja | Werdykt sceptyka | Wynik |
| --- | --- | --- | --- | --- |
| T2-COR-01 | major | PRIM-03 | realne | naprawione `603b5bf` (`gmSocketBack`, plus straż kolejności `gmConnectSeen`/`markGmReady(id, { away })` ponad znalezisko) |
| T2-COR-02 | minor | CALLS-01, CALLS-12 | realne | naprawione `57cb32d` (`raiseRunningClaim`) |
| T2-COR-03 | minor | PRIM-03, CALLS-01 | realne | naprawione `603b5bf` (`forgetClaimsOnPrimaryMove`) |
| T2-COR-04 | minor | PRIM-04 | **nierealne** (zgodne ze specyfikacją i podręcznikiem; co najwyżej wąski wyścig) | bez zmiany |
| T2-COR-05 | minor | EXP-PL-12 | realne | naprawione `57cb32d` (`settledWithdrawn` w `CARD_LINES`) |
| T2-GOAL-01 | minor | CALLS-01 | realne | naprawione `57cb32d` (przejęcie zamyka tylko okna kitu) |
| T2-GOAL-02 | minor | INV-10 | realne | naprawione `a5b4ea0` (GM 6.3) |
| T2-GOAL-03 | minor | PRIM-09 | realne (luka w zapisie, nie w działaniu) | naprawione `a5b4ea0` (LIVE-E132-22, komentarz) |
| T2-GOAL-04 | minor | EXP-PL-12, CALLS-14 | realne | naprawione `57cb32d` (powiadomienie przed powrotem) |
| T2-GOAL-05 | nit | EXP-GM-05 | (nit, bez werdyktu) | wyrównane do 2.1 pkt 4 w `57cb32d` |
| T2-GOAL-06 | nit | PRIM-01 | (nit) | naprawione `a5b4ea0` (przecinek oksfordzki EN) |
| SEC-T2-01 | nit | EXP-PL-12 | (nit) | naprawione `a5b4ea0` (30-security: `userId` ofiary) |
| SEC-T2-02 | nit | EXP-PL-12, CALLS-01 | (nit) | **połowa**: `ask.state` w 30-security zrobione w `a5b4ea0`; sfałszowany `card.takenOver` od GM-a, który nie jest główny (`ag`), w 33-bridge-paths - nie zrobione (sekcja 9) |

Mutanty rundy: FIX-G1 5/5, FIX-G2 6/6, FIX-G3 2/2 zabite (scenariusz 30 w całości na kopiach).

---

## 3. Testy dodane i zmienione

### 3.1 Numery R (rzeczywiste)

`git grep -ho '"R9[01][0-9][0-9]' HEAD -- scripts/ | sort -u`: 38 numerów, wszystkie w tierze 1, w bloku
`// T2 rulings-bridge-secondgm`. R9020-R9036 i R9049-R9059 to numery zarezerwowane przez tabelę specyfikacji;
R9068-R9070 wzięto z wolnego zakresu przed podziałem (koordynator podał później dodatkowe R9071-R9089 - **żadnego z
nich nie użyto**); runda poprawek wzięła R9113-R9119 od góry zakresu (R9113 też, nie tylko R9114-R9119). Numery
R9037-R9048 i R9060-R9067 (wiersze T2b i T2c) nie są użyte na tej gałęzi. `docs/dev/R-REGISTRY.md` wygenerowany; po
R9118/R9119 mówi "Next free R9120" - T2b/T2c regenerują przy scaleniu.

| R | Pozycja | Test (początek nazwy) |
| --- | --- | --- |
| R9020 | CALLS-01 | a card another GM's claim holds can be taken over, and the old holder's end writes nothing |
| R9021 | CALLS-01 | a claim runs out (`claimRanOut`, `TIMING.claimHoldMs`) |
| R9022 | CALLS-01 | a decision from a window another GM's take-over closed is refused on the primary |
| R9023 | EXP-GM-05 | every GM's copy of a card says who is ruling on it |
| R9024 | CALLS-12 | a GM who presses the other copy of a card whose window that GM has open is told so |
| R9025 | CALLS-02 | a GM's own claim left by its reload is let go at its ready |
| R9026 | CALLS-03 | the GM's difficulty window says how long the player still waits |
| R9027 | CALLS-03 | a Dynamic description no GM answered is offered again |
| R9028 | DAY-07, EXP-PL-12 | a player's waiting card says how long the request stays open and offers Withdraw |
| R9029 | CALLS-09 | `ask.withdraw` ends only the sender's own ask |
| R9030 | EXP-PL-12 | an ask's state is taken only from the primary GM, by Foundry's sender ... and Withdraw ends the wait with nothing said |
| R9031 | CALLS-04 | a player who leaves with asks held is signed on their cards for the GMs alone |
| R9032 | CALLS-04 | a player's browser that has loaded tells the GMs, and the primary ends only that sender's asks held from before |
| R9033 | CALLS-05 | a statistic's pick says it is not confirmed until its asker's receipt |
| R9034 | CALLS-06 | a primary GM's reload during one request is one of its three asks again, not two |
| R9035 | CALLS-07 | a Monocub's Ask for Hope says to the GMs whose pool Give pays from ... |
| R9036 | CALLS-14 | a ruling on an ask the primary no longer holds ends its card as an ask that ran out ... |
| R9049 | PRIM-01 | the GM panel names the primary GM |
| R9050 | PRIM-02 | the primary's observer tells a change once and a reading that did not move not at all |
| R9051 | PRIM-02 | a change of the primary is told to the GMs alone |
| R9052 | PRIM-03 | the primary is a GM whose world has loaded |
| R9053 | PRIM-03 | a GM this browser found connected when it loaded counts as ready ... |
| R9054 | PRIM-03 | with no full Gamemaster ready the primary is an Assistant GM who is ready ... |
| R9055 | PRIM-03 | a GM seen connecting counts as loading for `TIMING.gmReadyWaitMs` at most ... |
| R9056 | PRIM-04 | on a GM who is not the primary the case's health check runs quietly |
| R9057 | PRIM-04 | a GM who becomes the primary runs the primary's whole check |
| R9058 | PRIM-08 | the Debug log of a GM who is not the primary says above its rows where the rest is |
| R9059 | PRIM-09 | a safeword card pauses the game on every GM's browser that sees it while the game runs ... |
| R9068 | PRIM-03 (wolny zakres) | the voice re-plans on the browser that has just become the primary |
| R9069 | PRIM-03 (wolny zakres) | a GM who leaves while this browser still counts it as loading was not the primary to leave |
| R9070 | CALLS-01 (wolny zakres) | a press on a card another GM holds asks whether to take it over |
| R9113 | T2-COR-05 (EXP-PL-12) | a card ended by its player's withdrawal reads in each reader's own language |
| R9114 | T2-GOAL-04 (CALLS-14) | a GM who rules from a window on an ask whose card has ended meanwhile is told nothing was sent |
| R9115 | T2-GOAL-01 (CALLS-01) | a take-over closes the windows the claim's ruling opened, not every window this GM opened meanwhile |
| R9116 | T2-GOAL-05 (EXP-GM-05) | the card's own Take over keeps the claim for the GM who pressed it ... |
| R9117 | T2-COR-02 (CALLS-12) | a GM whose claim of a card already runs here is told so on a second press ... |
| R9118 | T2-COR-03 (CALLS-01) | a GM who stops being the primary forgets the claims it held as the primary |
| R9119 | T2-COR-01 (PRIM-03) | a GM whose socket comes back without a reload says again that its world has loaded ... |

### 3.2 Tier 2 (13 testów, bez numerów, blok na końcu `tests-tier2.mjs`)

- `E132 PRIM-03 - while the reloading primary loads, the other GM answers for the table`
- `E132 PRIM-02 - the GM who takes the table over is told, and so is the one who hands it back`
- `E132 CALLS-02 - the only GM's own claim left by a reload is let go at ready`
- `E132 CALLS-01 - a card held open by one GM is taken over by another and ruled once`
- `E132 CALLS-14 - the player was no longer waiting is the GMs' note`
- `E132 CALLS-05 - a statistic's pick says unconfirmed until the player's receipt`
- `E132 CALLS-03 - a Dynamic description that ran out is offered again`
- `E132 EXP-PL-12 - a player sees a GM ruling, the time left, and withdraws for free`
- `E132 CALLS-04 - a player's reload ends their old asks' cards`
- `E132 PRIM-09 - a safeword pauses the game on a GM who is not the primary`
- `E132 CALLS-07 - a Give on a Monocub's Ask for Hope from a GM whose pool can spend nothing is refused with the pool's name and the card stays open; ...`
- `E132 PRIM-03 - a GM whose socket comes back without a reload is the primary again at its word, not at the bound` (FIX-G1)
- `E132 CALLS-01 - a GM who stops being the primary forgets the claims it held as the primary` (FIX-G1)

Bez testu tieru 2 (świadomie): CALLS-06 (specyfikacja nie wymienia; R9034 prowadzi `createWaiter` na atrapach), PRIM-04 i
PRIM-08 (zamiast tego scenariusze 61 i 97), CALLS-15 i INV-10 (tekst).

### 3.3 Zmienione istniejące testy (każdy, bo zmienia się to, co mierzy, albo kształt kodu, który czyta)

| Test | Commit | Zmiana i powód |
| --- | --- | --- |
| tier 0 R472 | `361aaf1` | wiersz spisu `SURFACE gm-bridge.mjs#tellPrimaryChange` (nowa droga powiadomień); bez niego `unclassified` |
| tier 2 "the GM panel opens on the roster ..." (S0-GMLIST, E129) | `361aaf1` | `first` pomija `.drpg-gmp-primary` jak ramkę ostrzeżenia; bez tego `first: false` na czterech odczytach |
| tier 1 R841 | `2ecf4f6` | regex `resendOnGmReady\(\)` -> `resendOnGmReady\(` (wywołanie podaje odchodzącego); mierzy to samo |
| tier 0 R1b | `9fbf34c`, `0d3d4f2`, `a7901b8`, `603b5bf` | przypięcie słuchaczy gm-bridge.mjs 5 -> 6 (`onCardTakenOver`) -> 7 (`onPlayerReady`) -> 8 (`"connect"`) i teksty wyjątków (bridge-guards.mjs słucha też `ask.state`) |
| tier 2 "two clicks on one card ... (E18 C3)" | `9fbf34c` | pierwsze oczekiwane powiadomienie to `DRPG.Bridge.claimOwnOpen` (CALLS-12) |
| 61-gmstore-case CL2 | `9fbf34c` | przegrany GM jest pytany o przejęcie (headless: Anuluj) zamiast "busy"; `clickCL` czyta pytanie z `__dialogLog` |
| tier 1 R8281 | `42f0cee` | `.settled === format(settledGone)` -> `.settled?.key === "DRPG.Bridge.settledExpired"` |
| tier 1 R9027 | `0d3d4f2` | regex `requestDynamicDifficulty(request[^;]*);` (wywołanie podaje id prośby) |
| tier 0 R3865 (lista NEEDS_NONE w tests-tier0.mjs) | `0d3d4f2` | `ask.withdraw` dopisane, jak `ruling.expired` |
| `tests-flows.mjs` | `0d3d4f2`, `a7901b8` | flow `hope-call` nazywa `ask.withdraw`; teksty FLOW_EXEMPT (bridge-guards: stan prośby; gm-bridge: playerReady) |
| tier 1 R9068, R9032 | `603b5bf` | regex `markGmReady(senderId[,)]` (wywołanie niesie `{ away }`); R9032 czyta `if (game.user.isGM) sayGmReady(); else tellGmsPlayerReady();` |
| tier 1 R9020, R9024 | `57cb32d` | okno zajęcia w atrapie ma klasy kitu, jak okno każdej decyzji |
| tier 1 R9070 | `57cb32d` | Przejmij na karcie: kroki `["takeover"]`, bez "drop"; tytuł |

### 3.4 Scenariusze harness

- **97-two-gms:** A3b (PRIM-03; w `361aaf1` obserwatorzy czytają też we własnych hookach, `readNow`, bo opóźnienie pollingu
  164 ms dawało fałszywe "tookGmEarly"), faza PRIM (PRIM1-PRIM3), faza TAKE (TAKE1-TAKE3), P2 (CALLS-14), faza FLOG
  (FLOG1, PRIM-08). Ostatni odczyt 67/67.
- **33-bridge-paths:** A26 (legalna droga "takeover"), A27 (legalne wycofanie). Ostatni odczyt 94/96, 2 oczekiwane
  czerwone (foundry-cub-purse, foundry-barricade-flag), jak przed linią.
- **30-security**, bloki `// 2.0 line T2` na końcu: sfałszowany `card.takenOver` od p1; sfałszowane `ask.withdraw`
  wskazujące prośbę p1; `bridge.playerReady` od p2 z `userId` p1; SEC-T2-01 (`userId` ofiary w `ask.withdraw`); SEC-T2-02
  (sfałszowany `ask.state`). Ostatni odczyt 314/316, 2 oczekiwane czerwone (foundry-secret-door-type,
  foundry-masked-token-actor).
- **61-gmstore-case:** CL2 zmienione (wyżej), Z2b i Z3b dodane (PRIM-04). Ostatni odczyt 120/120 (`da50eca`).
- Scenariusze 17 i 62 uruchomione przy PRIM-03 (17 47/47, 62 62/62) i 17 przy PRIM-02 (47/47); w rundzie poprawek nie
  (FIX-G1 uruchomił 97 i 33, jak prosił koordynator).

### 3.5 `audit/harness/skip-baseline.json`

Bez zmian (`git diff --stat 31d5812..HEAD -- audit/harness/skip-baseline.json` puste). Skipped 16 na początku i na końcu.

---

## 4. Kontrole Forge do końcowego sprawdzenia (D2-15)

Nie uruchomione (Forge nie biegnie w chmurze). Oczekiwania to zapisy grup przy commitach, nie pomiary.

| Scenariusz | Kontrola | Pozycja | Oczekiwanie na kandydacie |
| --- | --- | --- | --- |
| `s2-second-gm` | B1 | CALLS-01 | przejdzie: naciśnięcie zajętej karty otwiera pytanie bez tytułu, kit naciska `take`, przejęcie zamyka okno trudności głównego (okno kitu, więc zamyka się także po T2-GOAL-01), u drugiego GM-a otwiera się okno trudności |
| `s2-second-gm` | B2 | CALLS-01 | przejdzie: karta rozstrzygnięta raz, wiersz drugiego GM-a |
| `s2-second-gm` | C1 | CALLS-03 | przejdzie: każde okno trudności drugiego GM-a otwarte z karty P1 ma `[data-drpg-expires]` i m:ss; własne okno Dynamic GM-a nie ma czasu, ale C1 go nie czyta |
| `s2-second-gm` | C2 | CALLS-03 | przejdzie wariantem "next Dynamic window holds the words": prośba P1 wygasa (słowa zachowane), spóźniona decyzja kończy się w `askNotHeld` (`late.value` null), następne okno Dynamic P1 zaczyna się od tagu |
| `s2-second-gm` | J2 | PRIM-01 | przejdzie (oba GM-y): element o własnym tekście "Primary GM: GM1" (< 160 znaków) |
| `s3-disconnects` | B1 | CALLS-04 | przejdzie (dziś czerwone): `bridge.playerReady` p3 kończy kartę po jego wczytaniu |
| `s3-disconnects` | B2 | CALLS-04 | przejdzie, przez `marked.settled` |
| `s3-disconnects` | B3 | CALLS-04 | przejdzie: nowa prośba ma nowe id i przychodzi po pakiecie |
| `s3-disconnects` | B4 | CALLS-04 | oczekiwane przejście, **nieudowodnione**: czyta róg p3 po przeładowaniu; headless nie sprawdzono, czy coś w rogu pochodzi jeszcze ze starej karty |
| `s3-disconnects` | C1 | PRIM-03 | przejdzie: gm2 zostaje głównym przez całe przeładowanie GM1 (próg 3 s jest scenariusza) |
| `s3-disconnects` | C2 | CALLS-02 | bez zmian (przechodziło przez `releaseClaimsOf` u drugiego GM-a; dodatkowy "drop" przeładowanego GM-a nic nie znajduje) |
| `s3-disconnects` | C3 | PRIM-03, CALLS-06 (pośrednio) | przejdzie / bez zmian: jedno przeładowanie zużywa teraz 1 z 3 ponowień zamiast 2 z 3, oba w budżecie; różnicę widać dopiero przy drugim przeładowaniu w jednym zegarze, którego scenariusz nie robi |
| `s3-disconnects` | D1 | PRIM-02 | przejdzie: gm2 dostaje "You are now the primary GM ..." w 20 s (obserwator przy `userConnected(false)`), filtr `unrelated` D1 go nie odrzuca |
| `s3-disconnects` | D2 | PRIM-01 | przejdzie: linia panelu gm2 "Primary GM: GM2 (you)" |
| `s3-disconnects` | D5 | CALLS-02 | przejdzie: karta nie mówi już w imieniu samego GM-a, że on ją rozstrzyga, po wczytaniu jego świata |
| `s3-disconnects` | F1 | PRIM-02 | **zostaje czerwona z decyzji, nie w oczekiwaniu**: F1 oczekuje, że rola zostanie u przejmującego, a D2-29 mówi, że wraca do pierwszego GM-a, z powiadomieniem |
| `s4-two-gms-at-once` | A | CALLS-01 (bez regresji) | bez regresji: pytanie przegranego GM-a zamyka się samo, gdy zwycięzca zapisze wiersz, i nie rysuje okna trudności; powiadomienie "busy" już się nie pokazuje (A tylko notuje słowa) |
| `s4-two-gms-at-once` | E1 | CALLS-01 (bez regresji) | nie przeczytane szczegółowo: reguła `{ title: "", press: ["yes"], once: true }` na drugim GM-ie nie naciska `take`, więc pytanie o przejęcie zostanie anulowane albo zamknie się samo; oczekiwanie bez regresji, nieudowodnione |
| `s5-voice` | "primary leaves" | PRIM-03 | przejdzie: okno powinno czytać gm2 jako głównego i słuchającego |
| `s5-voice` | "primary returns" | PRIM-02 | notatka; zmienia się tylko powiadomienie u GM2 |

Należą do T2b, nie tutaj: `s2-second-gm` I1 i `s1a-day-murder` "DAY-01" (zapis zdania poranka przez nowe API).

---

## 5. Zmienione sekcje podręczników i klucze językowe

### 5.1 Podręcznik GM-a (EN i PL, w tych samych commitach)

| Sekcja | Commity |
| --- | --- |
| 3 Panel GM-a (pierwsza linia bloku stanu; kiedy biegnie sprawdzenie sprawy) | `361aaf1` (PRIM-01), `da50eca` (PRIM-04) |
| 6.3 Rulings, cards and the messenger / Decyzje, karty i komunikator | `8bd6278`, `361aaf1`, `2ecf4f6`, `7832a4d`, `9fbf34c`, `0f9bbe1`, `577c96f`, `0d3d4f2`, `a7901b8`, `603b5bf`, `57cb32d`, `a5b4ea0` |
| 8 (tylko pozycja Ask for Hope, linia 675) | `b096c6b` (CALLS-07) |
| 19 Safeword (pozycja 1 i zdanie w akapicie po liście) | `a37561c` (PRIM-09) |
| 20.7 (wiersz "A Despair Call or a ruling did nothing") | `361aaf1` (PRIM-02), `9e59a4e` (PRIM-08) |

`docs/handbook-facts.gm-handbook.en.json`: s3.p1.f17-f21 dodane; s6.p15.f1 poprawione; s6.p16.f8, s6.p18.f2 przepisane;
s6.p18.f8-f12 dodane; s8.p25.f8-f9 dodane; s19.p2.f2, s19.p5.f9, s19.p5.f10 przepisane, s19.p2.f3 dodane; s20.r48.f3
przepisane, s20.r48.f5-f7 dodane.

### 5.2 Podręcznik gracza (EN i PL)

| Sekcja | Commity |
| --- | --- |
| 14 Komunikator i prośby o decyzję (akapit "A question you wait on" / "Pytanie, na które czekasz", linia 1010) | `0f9bbe1`, `577c96f`, `0d3d4f2`, `a7901b8`, `f0e0735` |

Zdania dopisano do istniejącego akapitu, bo nowy akapit przenumerowuje jednostki handbook-facts i zapala `check text`
(G09). `docs/handbook-facts.player-handbook.en.json`: s14.p5.f1, f8, f9, f10 przepisane, s14.p5.f11 dodane.

### 5.3 Klucze językowe (lang/en.json i lang/pl.json, te same w obu)

| Przestrzeń | Klucze | Czyja |
| --- | --- | --- |
| `DRPG.Bridge` | nowe: `claimedBy`, `takeOver`, `takeOverTitle`, `takeOverAsk`, `claimTakenOver`, `claimOwnOpen`, `takeOverTooltip`, `takeOverNowTooltip`, `timeLeft`, `timeUp`, `withdraw`, `withdrawTooltip`, `withdrawn`, `askRuling`, `waitLeft`, `settledWithdrawn`, `askerLeft`, `settledReloaded`; `what["card.takenOver"]`, `what["ask.withdraw"]`, `what["ask.state"]`, `what["bridge.playerReady"]`; **zmieniony istniejący**: `askNotHeld` (`57cb32d`, słowa nazywają wycofanie) | T2 |
| `DRPG.Panel` | nowe: `primaryGm`, `primaryGmYou`, `primaryGmTooltip`, `primaryTitle`, `primaryNowYou`, `primaryNow`, `primaryBack` (`primaryGmTooltip` i `primaryNowYou` EN poprawione w `a5b4ea0`) | T2 |
| `DRPG.Monocub` | nowe: `askFromYourPool`, `askPoolEmpty` | T2 |
| **`DRPG.Failures`** | **nowy: `elsewhere`, na końcu obiektu** (PRIM-08, `9e59a4e`) | **cudza przestrzeń** |

Innych cudzych przestrzeni (`DRPG.Ready`, `DRPG.Note`, `DRPG.Rolls`) linia nie dotknęła; żadnego istniejącego klucza
cudzej przestrzeni nie zmieniono, żadnego klucza nie usunięto (porównanie spłaszczonych plików 31d5812 i HEAD).

---

## 6. Pliki spoza listy i kształt inny niż w specyfikacji

### 6.1 Pliki spoza list wierszy

| Plik | Commit | Dlaczego |
| --- | --- | --- |
| `scripts/card-takeover.mjs` (nowy, 206 linii) | `9fbf34c`, `57cb32d` | połowa przejęcia po stronie przeglądarki GM-a; w bridge-asks.mjs dawała 1595 linii, ponad 1500 podziału (`check lengths`), a dopisanie pliku do LENGTHS_ACCEPTED to decyzja właściciela |
| `scripts/pick-receipt.mjs` (nowy, 91 linii) | `0f9bbe1` | pokwitowanie wyboru statystyki; w call-gm.mjs dawało 1539 linii |
| `scripts/ask-withdraw.mjs` (nowy, 245 linii) | `0d3d4f2`, `a7901b8` | Wycofaj, stan prośby, znak odejścia i przeładowanie gracza; call-gm.mjs i bridge-asks.mjs przy 1493 i 1494 z 1500 |
| `scripts/secret.mjs` | `a7901b8`, `57cb32d` | `CARD_LINES`: `settledReloaded`, `settledWithdrawn` (każdy czytelnik w swoim języku) |
| `scripts/module.mjs` | `da50eca` | tylko komentarz rejestracji ("the primary only") |
| `scripts/bridge-runs-acts.mjs` | `0d3d4f2` | `handleAskWithdraw` (uruchomienie nowej akcji mostu) |
| `scripts/open-cost.mjs` | `0d3d4f2` | ask-withdraw.mjs w `WARM_IMPORTS.everyone` (R4200) |
| `scripts/action-menus.mjs`, `action-search.mjs`, `action-tail.mjs`, `action-project.mjs` | `577c96f` | `traitFieldHtml` `keep` i po jednym `keep:` w oknach z polem notatki (CALLS-03) |
| `scripts/bridge-wire.mjs` | `9fbf34c`, `0d3d4f2`, `a7901b8` | nazwy `card.takenOver`, `ask.withdraw`, `ask.state`, `bridge.playerReady` (lista specyfikacji ma tylko `ask.withdraw`) |
| `scripts/tests-tier0.mjs`, `scripts/tests-flows.mjs` | wiele | R472, R1b, flow i FLOW_EXEMPT (sekcja 3.3) |
| `audit/harness/scenarios/30-security.mjs` | `9fbf34c`, `0d3d4f2`, `a7901b8`, `a5b4ea0` | przypadki fałszerstw (dozwolone w 4.2 dla `ask.withdraw`; tu także `card.takenOver`, `bridge.playerReady`, `ask.state`) |
| `audit/harness/scenarios/33-bridge-paths.mjs` | `9fbf34c`, `0d3d4f2` | A26, A27 (33 jest na liście 4.2 jako plik T2) |
| `audit/harness/scenarios/61-gmstore-case.mjs` | `9fbf34c`, `da50eca` | CL2 zmienione, Z2b/Z3b dodane |
| `audit/AUDIT-1.2.42.md` 9.2 | `9fbf34c`, `603b5bf`, `a5b4ea0` | pozycje 948, 949, 950 (LIVE-E132-01, -21, -22) |
| `docs/handbook-facts.gm-handbook.en.json`, `docs/handbook-facts.player-handbook.en.json` | wiele | fakty, które przestały być prawdą, i nowe |
| `docs/dev/R-REGISTRY.md` | wiele | generowany |
| `tools/stages.json` | `b8a1997` | wiersz etapu E132: `{"id": "E132", "planned": "1.2.130", "with": "E83", "version": null, "shipped": null, "touches": ["sockets", "rolls"], "drills": []}`, zaraz po E83, przed E26 |

Plików z list wierszy, których nie trzeba było ruszać: action-dynamic.mjs dla CALLS-01 (okno zamknięte odpowiada null),
gm-stores.mjs dla CALLS-02 (wystarczył `ruledCardStore`), messenger-app.mjs dla CALLS-04 (znak w bloku `.drpg-gm-only`).

**`scripts/bridge-table.mjs`:** `git diff --stat 31d5812..HEAD -- scripts/bridge-table.mjs` = 21 zmienionych linii,
+12/-9, netto +3; 1746 linii na `31d5812`, 1749 na tej gałęzi (sufit 1750). Według wiadomości koordynatora T5 ma ten
plik na 1750; prosta suma dałaby 1753, ale to arytmetyka, nie zmierzone scalenie. Niczego tu nie przeniesiono.

### 6.2 Kształt inny niż w specyfikacji (każdy w commicie)

- **PRIM-03:** własna przeglądarka nie jest główną przed swoim `ready` (`game.ready`), nie "przed `registerGmBridge`" -
  kroki tylko-dla-głównego hooka `ready` biegną przed `registerGmBridge` w tym samym dispatchu i nigdy nie są
  pytane ponownie. Obserwator `notePrimary` (`drpgPrimaryChanged`) dodany już tutaj, nie w PRIM-02, bo wisi na nim hook
  głosu. Gracze też znakują gotowość GM-ów (rejestr jest każdej przeglądarki). Pozostaje: między `ready` tego GM-a a
  dotarciem jego `bridge.gmReady` do pozostałych obaj GM-owie mogą chwilę brać rolę - niezmierzone przy stole.
- **PRIM-02:** PL "Nie zamykaj tej karty" w formie twierdzącej ("Zostaw tę kartę przeglądarki otwartą."); `primaryBack`
  bez "znowu"/"again". Powiadomienie nieprzyklejone (rola przy przeładowaniu przechodzi dwa razy w minucie).
- **CALLS-06:** inny GM `bridge.gmReady`, gdy stoi znak, kosztuje budżet i zostawia znak - specyfikacja nic nie mówi,
  R9034 `otherReady` to trzyma.
- **CALLS-02:** straż `since` i zajęcie trzymane w pamięci zawężają "każdy własny wiersz pending" do wierszy sprzed tego
  wczytania; przegląd kart (`sweepAskCards`) biegnie po zwolnieniu, czekając najwyżej `TIMING.gmStoreOpenMs` (wybrane,
  nie zmierzone).
- **CALLS-01:** decyzja przez głównego odrzucana, gdy kartę trzyma inny GM (pamięć albo wiersz, niewygasłe), a nie przy
  `claimsInProgress.get(id) !== by`: ścisłe `!==` odrzuciłoby istniejące testy wołające `answerHopeCall`/`answerDynamic`
  bez zajęcia i własne wygasłe zajęcie. Reguły bez głównego: lokalny znak (`claimLostHere`) - jedno podejście dla
  `ruleSetDifficulty`, `ruleReply` i efektu przedmiotu. Observe odpowiada "takenOver", nie "gone". Pytanie zamyka się
  samo, gdy wiersz przestaje mówić, że trzyma go tamten GM (dla s4 A). Polskie teksty bez form rodzajowych ("Tę kartę
  przejmuje GM {gm}."). Od `57cb32d` przejęcie zamyka tylko okna kitu (`drpgWindow`).
- **EXP-GM-05:** w `9fbf34c` Przejmij na karcie robiło "takeover" i od razu "drop"; od `57cb32d` (T2-GOAL-05) tylko
  "takeover" i karta trzymana dla naciskającego, jak 2.1 pkt 4. Znana różnica: zegar 120 s liczy się od przejęcia.
  Notatka G05 opisuje stary kształt - obowiązuje commit `57cb32d`.
- **CALLS-14:** `settled` i `gmNote` jako obiekty klucza (`{ key }`), nie sformatowany tekst - forma `endExpired`.
- **CALLS-05:** druga droga (pokwitowanie przed linią) z `drpgSecretStored`; czas `TIMING.ackMs` wybrany, nie zmierzony
  dla tej drogi.
- **CALLS-03:** "{time} left." / "Zostało {time}." nie przechodzi lintu T25 (bareLeft, PL7), więc "Time to rule: {time}."
  / "Czas na decyzję: {time}."; linia bez klasy (R294); słowa czyści każda odpowiedź GM-a, także Odmowa.
- **EXP-PL-12 / CALLS-09 / DAY-07:** linia karty "Request withdrawn." / "Prośba wycofana." zamiast "Gracz wycofał
  prośbę."; "The request stays open for {time}." / "Prośba czeka jeszcze {time}."; "You keep everything it would have
  cost." / "Zachowujesz wszystko, co by kosztowała." zamiast "Nic nie zostało wydane."; `requestId` tworzy
  `showWaiting`; Observe nie da się wycofać (karta T3); wycofana karta kończy się od razu, także pod zajęciem.
- **CALLS-04:** znak w słowach karty w bloku `.drpg-gm-only`, pisany w języku i zegarze głównego, nie meta-klucz rysowany
  przez messenger-app.mjs; `bridge.playerReady` to nie wiersz `BRIDGE_ACTIONS` (sygnał wczytania jak `bridge.gmReady`,
  nikt na niego nie czeka; tabela mostu przy 1749 z 1750), zaufanie: `senderId` Foundry w `askerReloadedOnPrimary`.
- **CALLS-07:** `{pool}` to etykieta puli (`poolLabel`), nie liczba; "jest pusta" -> "nie ma Despair do oddania"; dopisane
  "Karta zostaje otwarta".
- **PRIM-04:** ciche ponowne sprawdzenie (C-m15/CASE-72) nie pyta już o głównego, więc ramka drugiego GM-a też schodzi po
  scaleniu; hook Mastermind zostaje tylko u głównego.
- **PRIM-08:** apozycja ", {name}." jako drugie zdanie ("The primary GM is {name}." / "Głównym GM-em jest {name}.").
- **PRIM-09:** w GM 19 zmieniono dwa miejsca, nie jedno zdanie - oba przestały być prawdą.
- **CALLS-15:** zdanie o statystyce w tym samym akapicie cytuje ten sam klucz tak samo ("GM").

---

## 7. Tekst do notatek wydania 1.2.130

Tylko pozycje T2. Każde zdanie z commitu w nawiasie kwadratowym (do usunięcia przy wklejaniu).

### EN

**A primary GM's reload no longer leaves the table without a primary** (E132, line T2). The primary is now a GM whose
world has loaded: while the primary GM reloads, the other GM stays the primary until the reloaded browser has finished
loading, so the table's automation keeps running; before, nobody ran it for those seconds [8bd6278]. A GM whose connection
drops and comes back without a reload is the primary again as soon as it is back [603b5bf]. The GM panel names the
primary GM at the top ("Primary GM: name", "(you)" on that GM's screen), and when the role moves each GM gets a notice;
players see nothing [361aaf1]. The role still goes back to the first GM when that GM returns (the owner's decision
D2-29). A second GM's case check now runs quietly and shows the panel's red box without the window; a GM who becomes the
primary gets the whole check [da50eca]. A second GM's Debug log says the rest is in the primary GM's log and names that
GM [9e59a4e]. A safeword pauses the game on every GM's browser that sees its card, not only on the primary GM's
[a37561c].

**Rulings two GMs share.** A card another GM is ruling on says so on every GM's copy, with Take over; pressing an answer
on such a card asks first, with Cancel as the default, and the other GM's window closes. A claim runs out by itself after
2 minutes, a chosen time, not one measured at a table [9fbf34c, 57cb32d]. A GM whose browser reloads with a ruling's
window open no longer keeps the card for good [7832a4d]. A primary GM's reload counts as one of the three times a
player's browser asks again, not two [2ecf4f6].

**What the player sees while waiting.** A player waiting on a GM for a Call, a Dynamic Action or a statistic sees how
long the request stays open, reads "A GM is reading your request." while a GM has its card, and can withdraw it: nothing
is spent, and the card ends "Request withdrawn." for everyone, in each reader's language [0d3d4f2, 57cb32d]. A
player's reload ends their waiting request's card at once ("The page was reloaded, so this request is no longer
waiting. You can ask again."), and the GMs see on the card when its player disconnected [a7901b8]. A ruling on a card
the player no longer waits on ends it "Nobody answered in time. You can ask again." for the player; "The player was no
longer waiting." is the GMs' note alone [42f0cee]. The GM's difficulty window counts down ("Time to rule: 2:06."), and a
Dynamic Action, Search, Tail or project that got no GM's answer offers the player's words again in the next window
[577c96f]. A statistic's pick says it is unconfirmed until the player's browser confirms it [0f9bbe1]. A Monocub's Ask
for Hope tells the GMs whose pool Give pays from, and a GM whose pool has no Despair to give is told so, with the pool's
name [b096c6b]. The player handbook's messenger section quotes the card's real unconfirmed line, and both handbooks say
the timed Observe is Focus your gaze [f0e0735, a5b4ea0].

### PL

**Przeładowanie głównego GM-a nie zostawia już stołu bez głównego** (E132, linia T2). Głównym jest teraz GM, którego
świat się wczytał: gdy główny GM przeładowuje stronę, drugi GM zostaje głównym, aż przeładowana przeglądarka skończy
wczytywanie, więc automatyka stołu działa dalej; dotąd przez te sekundy nikt jej nie prowadził [8bd6278]. GM, któremu połączenie zerwie się
i wróci bez przeładowania, jest znowu głównym, gdy tylko wróci [603b5bf]. Panel GM-a pokazuje na górze, kto jest
głównym GM-em („Główny GM: imię”, „(ty)” na jego ekranie), a gdy rola przechodzi, każdy GM dostaje powiadomienie; gracze
nie widzą nic [361aaf1]. Rola nadal wraca do pierwszego GM-a, gdy ten wróci (decyzja właściciela D2-29). Sprawdzenie
sprawy u drugiego GM-a biegnie teraz po cichu i pokazuje czerwoną ramkę panelu bez okna; GM, który zostaje głównym,
dostaje pełne sprawdzenie [da50eca]. Dziennik debugowania drugiego GM-a mówi, że reszta jest w dzienniku głównego GM-a,
i podaje, kto nim jest [9e59a4e]. Safeword zatrzymuje grę w przeglądarce każdego GM-a, który zobaczy kartę, a nie tylko
głównego [a37561c].

**Decyzje, które dzielą dwaj GM-owie.** Karta, którą rozstrzyga inny GM, mówi to na każdej kopii u GM-ów i ma Przejmij;
naciśnięcie odpowiedzi na takiej karcie najpierw pyta, z Anuluj jako domyślnym, a okno drugiego GM-a się zamyka. Zajęcie
kończy się samo po 2 minutach - to czas wybrany, nie zmierzony przy stole [9fbf34c, 57cb32d]. GM, któremu przeglądarka
przeładuje się z otwartym oknem decyzji, nie trzyma już tej karty na zawsze [7832a4d]. Przeładowanie głównego GM-a
liczy się jako jedno z trzech ponownych pytań przeglądarki gracza, nie dwa [2ecf4f6].

**Co gracz widzi, czekając.** Gracz czekający na GM-a z Callem, Dynamic Action albo statystyką widzi, jak długo prośba
jest otwarta, czyta „GM czyta twoją prośbę.”, gdy GM ma jej kartę, i może ją wycofać: nic nie jest wydawane, a karta
kończy się u wszystkich słowami „Prośba wycofana.”, każdemu w jego języku [0d3d4f2, 57cb32d]. Przeładowanie strony przez
gracza kończy kartę jego prośby od razu („Po przeładowaniu strony ta prośba już nie czeka. Możesz zapytać jeszcze
raz.”), a GM-owie widzą na karcie, kiedy jej gracz się rozłączył [a7901b8]. Decyzja na karcie, na którą gracz już nie
czeka, kończy ją u gracza słowami „Nikt nie odpowiedział na czas. Możesz zapytać jeszcze raz.”; „Gracz już nie czekał.”
widzą tylko GM-owie [42f0cee]. Okno trudności GM-a odlicza czas („Czas na decyzję: 2:06.”), a Dynamic Action, Search,
Tail czy projekt bez odpowiedzi GM-a podsuwa słowa gracza w następnym oknie [577c96f]. Wybór statystyki mówi, że nie ma
potwierdzenia, dopóki przeglądarka gracza go nie potwierdzi [0f9bbe1]. Karta Ask for Hope Monocuba mówi GM-om, z czyjej
puli płaci Daj, a GM, którego pula nie ma Despair do oddania, dostaje komunikat z nazwą puli [b096c6b]. Rozdział o
komunikatorze w podręczniku gracza cytuje prawdziwe zdanie karty bez potwierdzenia, a oba podręczniki mówią, że czas ma
Observe ze Skup wzrok [f0e0735, a5b4ea0].

---

## 8. Pytania do właściciela (z domyślnym zachowaniem, na którym linia pracowała)

Z listy specyfikacji:

| Pytanie | Stan | Domyślnie |
| --- | --- | --- |
| PRIM-02: czy rola głównego ma zostawać u GM-a, który ją przejął? | **odpowiedziane**: D2-29 w `docs/dev/v2/DECISIONS.md` na `claude/dazzling-bohr-juuh4g` przy `200ea1f` ("T2 - rola głównego GM-a wraca do pierwszego GM-a, z powiadomieniem"), przekazane przez koordynatora 27.11.2026 20:59Z | wraca, z powiadomieniem; `s3-disconnects` F1 zostaje czerwone z decyzji, nie w oczekiwaniu |
| CALLS-01: czas samoczynnego zwolnienia zajęcia i czy przejęcie ma pytać | otwarte | 120 s (`TIMING.claimHoldMs`, wybrane, LIVE-E132-01); pyta, Anuluj domyślny |
| EXP-PL-09: notatki prywatne w przeglądarce czy na serwerze | przeniesione do T2c | - |
| EXP-GM-16: czy wynik rzutu gracza ma wyskakiwać kartą w rogu GM-a | przeniesione do T2c | - |
| EXP-PL-12: czy stan "GM czyta twoją prośbę" ma nazywać GM-a | otwarte | nie (pakiet nie niesie imienia) |

Zapisane przez grupy:

| Pozycja | Pytanie | Domyślnie |
| --- | --- | --- |
| PRIM-01 | Linia głównego GM-a stoi nad listą uczniów, którą właściciel chciał na górze panelu (S0-GMLIST). Nad czy pod? | nad (jedna linia; "na górze bloku stanu" specyfikacji), ramka ostrzeżenia nad obiema |
| PRIM-02 | GM wczytujący świat nie dostaje powiadomienia (pierwszy odczyt), nawet gdy do tej chwili rolę trzymał drugi GM. | nic nie mówić (samotny GM czytałby to przy każdym wczytaniu); mówi to linia panelu |
| EXP-GM-05 / CALLS-01 | Czy Przejmij na karcie ma trzymać zajęcie dla naciskającego? (G05) | od `57cb32d` trzyma (kształt 2.1 pkt 4); powrót do starego kształtu to dwie linie `takeOverFromCard` i R9070/R9116 |
| CALLS-03 Q1 | Czy Odmowa GM-a na Dynamic Action też ma zachować słowa, żeby gracz mógł je przeformułować? | nie: każda odpowiedź GM-a czyści, zachowuje tylko prośba bez odpowiedzi |
| CALLS-03 Q2 | Czy okna akcji kryzysowych (action-murder.mjs, T1) mają podsuwać zachowaną notatkę i statystykę? | nie w T2; `askGms` zachowuje słowa, podanie ich wymaga `keep: { kind: "crisis", key }` w wywołaniach T1 |
| EXP-PL-12 / CALLS-03 | Czy wycofana prośba ma zachować słowa na następne okno? | tak, jak prośba bez odpowiedzi |
| CALLS-04 | Użytkownik z dwiema otwartymi przeglądarkami: wczytanie drugiej kończy czekające prośby pierwszej (karty "przeładowano"), pierwsza czeka dalej do swojego zegara. | nie rozróżniane |
| CALLS-04 | Czy znak "rozłączenie o ..." ma znikać, gdy gracz wróci bez przeładowania? | zostaje (drugie zdanie to warunek) |
| CALLS-05 | Decyzje na domyślnym (G07 nie zapisał ich jako pytań): (a) "Approved automatically." zaworu bez zmian; (b) Odmowa na karcie statystyki mówi "Declined" od razu, jak Call | jak wyżej |
| PRIM-04 | GM, który przejmuje stół, dostaje okno przy każdym przejęciu, dopóki jego kopia jest niekompletna - więc przy każdym przeładowaniu głównego (por. T2-COR-04, uznane za nierealne jako zgodne ze specyfikacją). | tak, jak mówi specyfikacja ("pełne sprawdzenie głównego") |
| PRIM-04 | Okno sprawdzenia otwarte u GM-a, który przestaje być głównym, zostaje otwarte, a jego Keep/Clear Mastermind dalej działa stamtąd. | bez zmian (rzadkie; specyfikacja milczy) |
| PRIM-08 | Bez żadnego głównego (żaden świat GM-a jeszcze nie wczytany) dziennik nic nie mówi. | nic (nie ma kogo nazwać) |
| CALLS-07 (Q-CALLS-07-1) | `{pool}` w `askPoolEmpty` to nazwa puli czy liczba? | nazwa (`poolLabel`, jak `askGiven`); liczba byłaby zawsze 0, gdy linia się pokazuje |
| CALLS-01 (G05) | bridge-asks.mjs ponad 1500 linii nie jest w LENGTHS_ACCEPTED; dopisanie to decyzja właściciela. | kod w nowych plikach (card-takeover.mjs, pick-receipt.mjs, ask-withdraw.mjs) zamiast dopisania |

Grupy G01, G03, G04, G06, G11, G20, FIX-G1 i FIX-G3 nie zapisały pytań.

---

## 9. Znalezione poza zakresem (bez poprawiania)

1. **`.claude/rules/code.md` - nieaktualne liczby i brakujące wiersze** (plik reguł, nie edytowany):
   - wiersz `scripts/gm-bridge.mjs`: "five `game.socket.on`" - teraz 8 (`grep -c game.socket.on` = 8); "3 names of its
     own" - G02 liczyło już 8 po PRIM-02, potem doszły `tellGmsPlayerReady`, `onPlayerReady`, `gmSocketBack`,
     `forgetClaimsOnPrimaryMove`; zasada fasady "New bridge code goes into the file of its role below, never here" jest
     przekroczona przez samą specyfikację (obserwator w gm-bridge.mjs).
   - `scripts/call-gm.mjs`: "23 names exported" (G05: 27; potem `heldAskOf`, `heldAskMaps`, `askCardExpiry`).
   - `scripts/bridge-asks.mjs`: "95 names exported" (98 po `askCardClaim`; potem `requestAskWithdraw`).
   - `scripts/gm-panel.mjs`: "14 names of its own" (G19: 18).
   - `scripts/utils.mjs`: liczby nieaktualne (FIX-G1: `gmConnectSeen`, `markGmReady(id, { away })`).
   - Brak wierszy dla nowych `scripts/card-takeover.mjs`, `scripts/ask-withdraw.mjs`, `scripts/pick-receipt.mjs`.
   - Dla orientacji, `grep -c '^export'` na końcu linii: gm-bridge.mjs 18, call-gm.mjs 30, bridge-asks.mjs 99,
     gm-panel.mjs 20 - to liczba linii z `export`, nie liczba nazw w regule.
2. **gm-handbook 1.2, linia 71 (EN i PL)** i fakt s1.p17.f12: "the connected full Gamemaster with the lowest user id" -
   bez "ready" (sekcja 1 nie jest T2).
3. **gm-handbook 1.4, linia 104 (EN i PL)** i fakt s1.p31.f3: "an Observe aimed at a point of interest" - ten sam błąd
   co INV-10 (sekcja 1 nie jest T2). Fakt broszury gracza s5.p1.f5 ("an Observe of a point of interest") nie
   przeczytany ponownie z kodem.
4. **gm-handbook 14.8** ("When the primary GM opens a world ... a health check names what is missing") i **22** ("The
   health check runs when the primary GM's browser opens the world") - po PRIM-04 niepełne, nie fałszywe; dla
   koordynatora albo T3/T4.
5. **handbook-facts - problemy sprzed linii:** s8.p10.f9 ("microphone is off"), s8.p10.f11 ("Go back to your room"),
   s8.p12.f9, s8.p12.f10 - słowa kluczowe już nie stoją w podręczniku; nieaktualne miejsca "line N" w faktach s3, s8,
   s19, s20; G02: plik ma wiele starszych problemów miejsc i słów, których nie trzyma żaden check.
6. **gm-stores.mjs `runHealthCheck` - wyścig sprzed linii:** dwa wywołania naraz (np. sprawdzenie przy wczytaniu i hook
   Mastermind) przechodzą przez `healthOpen`, zanim któreś go ustawi (ustawiane po `await gmStoreHealth()`), więc mogą
   otworzyć dwa okna. Hook przejęcia z PRIM-04 omija wyścig ze sprawdzeniem przy wczytaniu (`checkedAtLoad`), nie z
   hookiem Mastermind.
7. **action-murder.mjs / murder-rules.mjs (T1):** okna akcji kryzysowych nie przekazują `keep` do `traitFieldHtml`, więc
   zachowanych słów (CALLS-03) nie podsuwają.
8. **Harness nie umie zerwać gniazda klienta, który zostaje** (`cluster.mjs` `disconnect` kończy klienta, `userActivity`
   tylko przy połączeniu i rozłączeniu): żaden scenariusz nie mierzy powrotu gniazda bez przeładowania przez szynę.
   `dropSocket(who, ms)` w cluster.mjs i client-entry.mjs by to umożliwił - nie dodane (wspólny plik harnessu).
9. **Podręcznik gracza, akapit safeword** (sekcja 15 PL / linia 1218 EN): "A GM whose page was still loading then has to
   pause the game by hand" - dalej prawdziwe, nie sekcja T2.
10. **Druga połowa SEC-T2-02 otwarta:** sfałszowany `card.takenOver` od GM-a, który nie jest główny (`ag`), przy otwartym
    oknie zajęcia - wymaga 33-bridge-paths (30-security nie ma drugiego GM-a); dziś trzyma to tylko R9020 z atrapami
    nadawców.
11. **Granice CALLS-01 nazwane w kodzie/notatkach, niezałatane:**
    - zajęcie, które wygasa przy wciąż otwartym oknie GM-a: karta wolna, jej koniec biegnie, ale okno zostaje i nikt
      temu GM-owi nie mówi; Odpowiedź napisana po "Nobody answered in time" nadal się wysyła (tak samo jak wcześniej
      dla GM-a, który wyszedł) - pytanie do LIVE-E132-01;
    - okno pytania kitu otwarte przez GM-a gdzie indziej w czasie zajęcia jest trzymane z zajęciem i zamykane przy
      przejęciu (żadne zajęcie nie zapisuje, które okno jest jego).
12. **Pomiary niezrobione, bez id LIVE** (zapisane w notatkach): kolejność zdarzeń szybkiego F5 na Forge (CALLS-02);
    czas hydratacji `ruledCardStore` przy stole; kolejność ostatniego pakietu starej strony i pierwszego nowej po
    przeładowaniu na v14; czy v14 woła `userConnected(false)` przy krótkiej przerwie sieci; czy v14 pozwala jednemu
    użytkownikowi na dwie przeglądarki (CALLS-04); czy v14 podaje `options.isFirstRender` dla DialogV2 (CALLS-01);
    dwa przeładowania głównego w czasie jednego Calla z drugim GM-em (CALLS-06); jak długo dwie przeglądarki trzymają
    rolę przy `ready` powracającego (PRIM-03); proponowana kontrola CALLS-07 przy stole (drugi GM z pulą 0 naciska Daj).

LIVE dodane przez linię do `audit/AUDIT-1.2.42.md` 9.2: **LIVE-E132-01** (pozycja 948, jak długo okno decyzji stoi
otwarte; `TIMING.claimHoldMs`), **LIVE-E132-21** (949, powrót gniazda bez przeładowania na v14, kolejność
`userConnected(true)` i `bridge.gmReady`, linia panelu w sekundę, przerwa 10 s), **LIVE-E132-22** (950, dwa GM-y
pauzują na tę samą kartę safeword). Numery LIVE-E132-02..20 nie są użyte w tej linii. `TIMING.gmReadyWaitMs` (90 s)
cytuje istniejące LIVE-E04-12, bez nowego id.
