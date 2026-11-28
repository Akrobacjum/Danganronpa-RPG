# Linia T2c - raport (narzędzia GM-a, okno Uczniowie, rzuty prywatne, komunikator)

Napisane 28.11.2026 na `claude/v2-t2c`. T2c to część linii T2 (`docs/dev/v2/LINE-T2.md`), wydzielona przez koordynatora:
dziewięć pozycji EXP-GM-01, EXP-GM-17, EXP-GM-06, EXP-GM-07, EXP-GM-14, EXP-GM-16, CALLS-15, INV-10, EXP-PL-09.
Specyfikacja, metoda i zasady plików wspólnych - LINE-T2.md (sekcje 2, 3, 4.2), jak dla T2. Format - sekcja 5.

## 1. Podsumowanie

| | |
| --- | --- |
| Baza (czubek `claude/v2-t2` w chwili startu) | `0d3d4f2` (T2 EXP-PL-12, CALLS-09, DAY-07) |
| Koniec gałęzi (ostatni commit kodu) | `b2d5dd8`; raport: commit po nim |
| Commity | 7 (dziewięć pozycji: dwie grupy po dwie) + raport = 8 |
| Wynik bazowy tierów 0-1 (`0d3d4f2`, czyste drzewo w osobnym worktree) | `run-tests: 2077 passed, 0 failed, 16 skipped, 0 red`, 2092 testów, 613 s |
| Wynik końcowy tierów 0-1 (szybka bramka ostatniego commita kodu: `0a12758`+edits, czyli drzewo `b2d5dd8`) | `run-tests: 2085 passed, 0 failed, 16 skipped, 0 red`, 2100 testów, 570 s |
| `npm run quick` na bazie | zielone (lint 460 plików, check 26 części, gate 62/62) |
| CI na ostatnim pushu kodu (`b2d5dd8`, run 691) | czerwone przez jedno zadanie: lint/check/gate, plan zielone; suite 1/8-8/8 zielone, `suite-merge`: "8 shard(s) of 8 file(s), 1866 tier-2 tests in the list; 3980 passed, 0 failed, 27 skipped, 0 red: green"; scenarios b1-b3, b5-b8 zielone; **scenarios b4 czerwone** (65-season LC5, niestabilne, sekcja niżej); `verdict` czerwone tylko przez scenariusze ("quick success, scenarios failure, suite success"). Run commita raportu - w odpowiedzi dla koordynatora |
| CI bazy (`0d3d4f2`, run 664) | zielone (wszystkie zadania) |

Pełne `npm test` lokalnie się nie mieści (ustalenie koordynatora); za pełny bieg uznajemy CI. Każdy commit ma w wiadomości
linię szybkiej bramki (`QUICK GREEN at ...`: lint/check/gate, prose, tiery 0-1, własne i powiązane testy tier 2,
scenariusze, które nazywają zmienioną regułę).

**CI po drodze.** Trzy runy na commitach kodu tej gałęzi, każdy z jednym czerwonym zadaniem. Za każdym razem był to inny
test i żaden nie leży w pliku, który ta linia zmienia. Każdy z nich był też zielony na tym samym drzewie `b2d5dd8`:
R809 i LC5 lokalnie, a E40-T5 w shardzie 4 runu CI 691 (lokalnie na `b2d5dd8` był raz czerwony, jak w runie 677):

| Run | sha | Czerwone | Odczyt CI | Lokalnie |
| --- | --- | --- | --- | --- |
| 677 | `23786c2` | `suite 4/8`: "an ask whose card is gone ends nothing when its time runs out (E40-T5)" (test T2) | ucięty w logu; shard 4 zielony w runach 688 (`0a12758`) i 691 (`b2d5dd8`) | shard 4 na `b2d5dd8`: raz czerwony, ten sam test, `measured {"dynamic":[],"held":["clockBeat.patch"],"yes":[]}`; shard 4 na `0d3d4f2` (worktree): zielony, 271/271; ten sam test sam (`--only`): 7/7 zielony |
| 688 | `0a12758` | `suite 1/8`, część A2 (tiery 0-1 w trakcie Class Trial): R809 (dock kamer, enforced.mjs) | ucięty w logu (300 znaków) | shard 1 na `b2d5dd8`: zielony, 22/22 części, 2090 passed, 0 failed, 16 skipped, 2334 s |
| 691 | `b2d5dd8` | `scenarios b4`: 65-season LC5 (rysowania HUD-u w jednym End of chapter, granica 3) | `gm 3, p1 4, p2 ?, p3 ?` rysowań HUD-u (log ucina resztę) | 65-season dwa razy na `b2d5dd8`: zielony, 2 rysowania na każdej przeglądarce (jak odczyt scenariusza z 21.11) |

Co wiem o przyczynach (pomiar, nie przypuszczenie, tam, gdzie to zaznaczone):
- **E40-T5:** zmierzone. Dodatkowy zapis to `clockBeat.patch`. Jedyny, kto go pisze, to `beatClock` (hud-elapsed.mjs),
  wołany z `setInterval` co `CLOCK_BEAT_MS` = 60 s (hud.mjs, `ready`). Test liczy każdy odczyt i zapis magazynów GM-a w
  oknie `run` + `settle(300)`, więc czerwienieje, gdy uderzenie zegara wypadnie w tym oknie. Moja gałąź nie zmienia
  hud.mjs, hud-elapsed.mjs, gm-stores.mjs ani bibliotek harnessu (`git diff --name-only 0d3d4f2 b2d5dd8`). Testy
  przed E40-T5 w shardzie 4 są te same na obu drzewach (mój jedyny test w tym shardzie stoi na pozycji 266, E40-T5 na
  95), suma ich czasów: 245,6 s u mnie, 247,3 s na bazie. Na tym samym drzewie `b2d5dd8` shard 4 był raz czerwony
  (lokalnie) i raz zielony (CI 691); na `0a12758` zielony (CI 688). Wniosek: wynik zależy od tego, gdzie wypada
  60-sekundowe uderzenie zegara, a nie od drzewa. Ile razy na sto czerwienieje, nie zmierzyłem. Testu nie zmieniałem (jest T2/E40). Propozycja dla autora: w oknie liczenia pominąć
  `clockBeat` albo zatrzymać uderzenie (np. `game.paused`) na czas testu.
- **R809 w A2:** nie zmierzone. Test opiera się na zegarach (zapis po 100 ms, odczyt po 150 ms). Shard 1 trwa na CI
  2135-2459 s (runy 664, 677, 688), na GM-ie maxRSS ok. 2,6 GB. Moja gałąź nie zmienia enforced.mjs. Lokalnie zielony.
- **65-season LC5:** nie zmierzone. Okno liczenia obejmuje `settle(1500)` i każde rysowanie HUD-u w tym czasie.
  Między runem 688 (b4 zielone) a 691 doszło tylko EXP-PL-09 (messenger-app.mjs, settings.mjs). Jego zapis
  (`setPrivateNote`) rusza dopiero przy pisaniu w polu Moje notatki, a 65-season nie otwiera komunikatora.

**Zapisane jako niestabilne** (ustalenie koordynatora, 28.11.2026): E40-T5 (run 677), R809 w części A2 (run 688),
65-season LC5 (run 691). Nie są zastane na bazie, bo na bazie żaden nie był czerwony (run 664 zielony, shard 4 na
`0d3d4f2` lokalnie zielony). Nie ma też pomiaru, który by je wiązał z tą linią: każdy był zielony na `b2d5dd8` (wyżej), a w
żadnej z ich dróg nie ma pliku, który ta linia zmieniła. Warto je sprawdzić na runie scalenia.

## 2. Tabela pozycji

| ID | status | commit | testy (R i tier 2) | sekcje podręczników | uwagi |
| --- | --- | --- | --- | --- | --- |
| EXP-GM-01 | zrobione | `23786c2` | R9060, R9061; `E132 T2c EXP-GM-01 - a GM sees who is connected in the panel and in Students` | GM 3 (EN, PL) | Czerwone na `0d3d4f2`: R9060/R9061 bez funkcji i kolumny; tier 2 "measured {anyConnected: false, panel: false, ...}". Lista w panelu pod linią Główny GM; kolumna Połączenie podaje każdego gracza-właściciela (współwłaściciele, D078). `#players` dalej ukryte (CSS bez zmian). |
| EXP-GM-17 | zrobione | `23786c2` | R9062 (i R9061 dla nagłówków) | GM 3 (EN, PL) | Czerwone: brak `waitingEntry`. `waitingCards()` z sygnaturą ze specyfikacji 4.2, `waitingCard` konsoli z niej korzysta. Panel bez nowych kolumn (nie mieszczą się bez przesunięcia układu). |
| EXP-GM-06 | zrobione | `6a8bfae` | R9063; `E132 T2c EXP-GM-06 - a GM grants an action above the maximum from Students` | GM 5 (EN, PL) | Czerwone na `23786c2`: brak eksportu; tier 2 "measured {after: [0, null, true], before: [0, false, null]}". Reason "gmRuling" (jak `setActions`). |
| EXP-GM-07 | zrobione | `8c60a48` (znak w Osi czasu: `5753579`) | R9064; `E132 T2c EXP-GM-07 - an action a GM runs for a student says so on its card` | GM 6.3 (EN, PL) | Czerwone na `6a8bfae`: brak funkcji; tier 2 "measured {flag: false, forged: null, line: null, roll: false}". Znak ustawiany w `rollTrait` na przeglądarce GM-a dla postaci gracza; czytany tylko z karty napisanej przez GM-a. |
| EXP-GM-14 | zrobione | `0a12758` | R9065; `E132 T2c EXP-GM-14 - the other GM is told of a Truth Bullet given, a state changed, a pool corrected` | GM 6.3 (EN, PL) | Czerwone na `5753579`: brak `tellOtherGms` ("the module has no road to tell the other GMs - nothing to measure"). `despair.mjs` - plik spoza listy (sekcja 6). |
| EXP-GM-16 | zrobione | `5753579` | R9066; `E132 T2c EXP-GM-16 - a player's action roll lands in the GMs' Timeline` | GM 6.3 (EN, PL) | Czerwone na `8c60a48`: brak `rollEntry`; tier 2 "measured {corner: 0, entry: null, gone: true}". Tylko wpis w Osi czasu, bez karty w rogu (domyślne ze specyfikacji; pytanie w sekcji 8). |
| CALLS-15 | zrobione; przy scaleniu wersja T2 (sekcja 9) | `1e76847` | bez testu (tekst podręcznika) | gracz 14 (PL; EN był zgodny) | Nic do bycia czerwonym. Cytat PL to teraz tekst karty `DRPG.Bridge.settledUnconfirmed`; fakt s14.p5.f9 poprawiony. T2 zrobiła to samo w `f0e0735`. |
| INV-10 | zrobione; przy scaleniu wersja T2 (sekcja 9) | `1e76847` | bez testu (tekst) | gracz 14 (EN, PL) | Odczyt kodu: czas ma karta Skup wzrok (`askObserveByCard`, `expires`), Zbadaj punkt zainteresowania (`ruleObserve` -> `callGm` bez `expires`) nie. Fakt s14.p5.f1 poprawiony. T2 zrobiła to samo w `f0e0735`. |
| EXP-PL-09 | zrobione | `b2d5dd8` | R9067; `E132 T2c EXP-PL-09 - a player's private note is kept on this browser and reaches no GM` | gracz 14 (EN, PL) | Czerwone na `0a12758`: brak `privateNotesShown`; tier 2 "the window has no My notes builder - nothing to measure". Zasięg `client` (domyślne; pytanie w sekcji 8). |

`expectedRed` - żaden.

## 3. Testy dodane i zmienione

**Nowe, tier 1 (R z zakresu zarezerwowanego dla tych wierszy w LINE-T2.md 2):** R9060, R9061, R9062, R9063, R9064, R9065,
R9066, R9067 - na końcu `scripts/tests-tier1.mjs` w bloku `// T2c gm-tools-messenger (split from T2)`. Nadmiar
R9105-R9119 - nieużyty. `node tools/registry.mjs --write` po każdym commicie (registry zielone); `tools/registry.mjs` bez
zmian.

**Nowe, tier 2 (na końcu `scripts/tests-tier2.mjs`, ten sam blok):**
`E132 T2c EXP-GM-01 - ...`, `E132 T2c EXP-GM-06 - ...`, `E132 T2c EXP-GM-07 - ...`, `E132 T2c EXP-GM-16 - ...`,
`E132 T2c EXP-GM-14 - ...`, `E132 T2c EXP-PL-09 - ...`.

**Zmienione istniejące (bo mierzą to, co commit zmienia; wymienione w commitach):**
- R2080 (tier 1, `23786c2`): nagłówki okna Uczniowie + Pokój, Czeka, Połączenie.
- R66 (tier 0, `23786c2`): kształt `watch` okna Uczniowie dopuszcza `tokens: true` (dalej bez filtra `settings`).
- tier 2 "the GM panel opens on the roster, and each student's row reads what the sheet reads ..." (`23786c2`): "first"
  pomija nową listę, tak jak pomija linię Główny GM.
- R472 (tier 0, `0a12758`): spis dróg powiadomień dostaje wiersz `FLAG popup.mjs#onCreateChatMessage#TOLD_GMS`.
- R4672 (tier 0, `b2d5dd8`): spis pól tekstowych - messenger-app.mjs 4 zamiast 3 (Moje notatki).

**Poprawki własnych testów przed commitem (zapisane w commitach):** R9062 ciął metodę klasy `fnSource` (tylko funkcje
najwyższego poziomu) - teraz `bodyOf`; R9061 miał przypadek NPC, którego tabela nie rysuje (grupowanie po roli) -
teraz odczyt źródła; tier 2 EXP-GM-14 czytał flagi z kopii nadawcy, której secret.mjs nie pokazuje autorowi
(`authorHold`) - teraz z pakietów słów; R9067 ciął `setPrivateNote` przez całą klasę za nim - teraz do własnej klamry.

Scenariusze: bez zmian. `audit/harness/skip-baseline.json`: bez zmian (16 pominięć jak na bazie).

## 4. Kontrole Forge do końcowego sprawdzenia (D2-15)

Nic nie uruchamiałem na Forge (ustalenie koordynatora). Scenariusze `audit/forge` - nie edytowane, więc bez lint/check.

| Kontrola | Pozycja | Oczekiwanie na kandydacie |
| --- | --- | --- |
| `s2-second-gm` J1 (oba GM-y) | EXP-GM-01 | przejdzie: `uiProbe` otwiera panel GM-a i okno Uczniowie, a `connectionShown` przyjmuje element `[data-drpg-connected]` w oknie modułu - oba okna go rysują (lista w panelu, komórki Połączenie). Odczyt kodu kitu (`audit/forge/page-kit.mjs`), nie pomiar. |
| EXP-GM-17, -06, -07, -14, -16, CALLS-15, INV-10, EXP-PL-09 | - | brak kontroli Forge (LINE-T2.md 2: "Brak kontroli Forge"); nic tego nie mierzy na Forge. |

## 5. Zmienione sekcje podręczników i klucze językowe

**Podręcznik GM-a (EN i PL):** 3 (linia Gracze w panelu; kolumny Pokój, Czeka, Połączenie w oknie Uczniowie), 5 (akapit
o +1 ponad maksimum), 6.3 (trzy zdania w akapicie Osi czasu: wpis rzutu gracza, "Rzucił GM", powiadomienia dla
pozostałych GM-ów). `docs/handbook-facts.gm-handbook.en.json` - nie regenerowany (decyzja właściciela z 16.11.2026).

**Podręcznik gracza (EN i PL):** 14 - akapit "A question you wait on" (CALLS-15: cytat PL; INV-10: Skup wzrok ma czas,
Zbadaj punkt zainteresowania nie) i akapit Notatki (EXP-PL-09: zdania o Moich notatkach dopisane na końcu akapitu, bez
nowego akapitu - nowy przesuwał linie 509 faktów). Akapitu EXP-PL-12 (T2) nie ruszałem. Fakty
`docs/handbook-facts.player-handbook.en.json`: s14.p5.f1, s14.p5.f9.

**Klucze (EN i PL, na końcu obiektów):**
- `DRPG.Panel` (przestrzeń T2): connectedHeading, connectedTooltip, plays, noCharacter, connected, notConnected,
  roomColumn, waitingColumn, waitingColumnTooltip, waitingCount (EN one/other, PL one/few/many/other), connectionColumn,
  ownerConnection, grantAction, grantedAction.
- `DRPG.Messenger.gm` (komunikator): rollKind, rollTitle, rollResult, rollResultWay, told { title, bullet, states,
  stateOf, pool }.
- **Cudze przestrzenie:** `DRPG.Rolls.rolledByGm`; `DRPG.Note.privateTab`, `privateTabTooltip`, `privateIntro`,
  `privatePlaceholder`, `privateSaved`.
Placeholdery tylko te, które zna `check text` (T15): `{character}` i `{way}` zamienione na `{actor}` i `{result}`.

## 6. Pliki spoza listy i odstępstwa od specyfikacji

**Pliki spoza listy LINE-T2.md dla tych pozycji:**
- `scripts/despair.mjs` - jedna funkcja `correctPool` w drodze ręcznej korekty puli (pipy i +/- paska), wymieniona w
  specyfikacji EXP-GM-14; `hopeAlreadyFull` (T4) - inna funkcja.
- `scripts/action-report.mjs` - flagi kart wyniku (`rolledByGmFlag`, `rollTotalFlag`) dla EXP-GM-07/-16 (karty wyniku
  akcji powstają tu, nie w action-pipeline.mjs).
- `scripts/settings.mjs` - `SETTINGS.privateNotes` i jego `register` obok dźwięku komunikatora (EXP-PL-09; plik z listy
  4.2).
- `scripts/tests-tier0.mjs` - R66, R472, R4672 (sekcja 3).
- `styles/danganronpa.css` - blok na końcu (`2.0 line T2c ...`).
- `bridge-table.mjs` - nietknięty (0 linii).

**Odstępstwa:**
- CALLS-15: specyfikacja każe zamienić `{name}` na "GM"; cytat PL ma "...", jak cytat EN i zdanie T2 (EXP-PL-12) w tym
  samym akapicie. T2 w `f0e0735` wybrała "GM" (sekcja 9).
- EXP-GM-01: kolumna Połączenie podaje wszystkich graczy-właścicieli, nie "właściciela" - spis `ownerOf` (R3812) słusznie
  odrzucił jedno imię dla ucznia z współwłaścicielami.
- EXP-GM-07: znak ustawiany w `rollTrait` (miejsce startu rzutu akcji na przeglądarce, która ją prowadzi), nie w
  `performAction`. Karty wyniku spoza `rollCardFlags`/`report` (Stage 6, akcja w incydencie) nie mają znaku - zapisane w
  komentarzu `rolledByGmHere`. Znak w Osi czasu przyszedł z wpisem EXP-GM-16 (`5753579`).
- EXP-GM-14: Daj = Truth Bullet (`giveBulletNow`); przedmioty i Kill z okna Uczniowie nie powiadamiają (specyfikacja
  wymienia trzy drogi). Pula: powiadomienie po 1,5 s ciszy na pipach (pięć kliknięć = jedna karta) - wybór, nie pomiar.
  Że karta trafia do historii powiadomień drugiego GM-a i do jego Osi czasu, wynika z reguły `gmPopup` w
  `onCreateChatMessage`; zmierzone jest wysłanie (pakiety słów do drugiego GM-a), nie odbiór na drugiej przeglądarce.
- EXP-GM-17: `waitingCards()` zwraca `kind` jako nagłówek karty (słowa), `text` jako cytat gracza; `actorId` z kilku
  źródeł (znacznik prośby, `data-by`/`data-actor`/`data-killer` przycisków, imię na karcie, postać gracza) - żadne nie
  jest na każdej karcie. Licznik w nawigacji (`waitingCount`) liczy dalej karty `gmAsk` - nie ruszany.
- EXP-PL-09: tekst intro mówi "na tym komputerze, w tej przeglądarce" - to fakt potrzebny graczowi (gdzie leży jego
  tekst), nie opis działania modułu.

**Przy scalaniu (próbne scalenie `b2d5dd8` do czubka `claude/v2-t2` `b8a1997`, 28.11.2026, osobny worktree).**
Konflikty i jak je rozwiązałem na próbę:

| Plik | Konflikt | Rozwiązanie na próbę |
| --- | --- | --- |
| `docs/handbooks/player-handbook.en.md`, `.pl.md` (linia 1010), `docs/handbook-facts.player-handbook.en.json` (s14.p5) | CALLS-15/INV-10 po obu stronach (sekcja 9) | strona T2 |
| `docs/handbooks/gm-handbook.en.md`, `.pl.md` (sekcja 3, akapit `scripts/gm-panel.mjs`, linia 238) | T2 dopisała na końcu zdanie o sprawdzeniu sprawy na przeglądarce innego GM-a, ja wstawiłem *Players* / *Gracze* przed "then, since 1.2.128, the roster" | linia T2 z moją wstawką *Players* w tym miejscu |
| `scripts/tests-tier1.mjs`, `scripts/tests-tier2.mjs` (koniec tablicy) | obie linie dopisały testy na końcu | oba bloki: najpierw T2, potem `    }],` i blok `// T2c gm-tools-messenger (split from T2)` |
| `docs/dev/R-REGISTRY.md` | plik generowany | `node tools/registry.mjs --write` |

Bez konfliktu scaliły się: lang/en.json, lang/pl.json, gm-panel.mjs, messenger-app.mjs, tests-tier0.mjs. Po rozwiązaniu:
`node tools/check.mjs` 26/26 zielone (text, parity, prose, registry, stamps także osobno), `node --check` obu plików
tierów OK. Tierów i scenariuszy na próbnym scaleniu nie uruchamiałem. Scalenia T4 i T2b przed T2c mogą dać inne
konflikty, tych nie widzę.

Miejsca, na które patrzeć przy scalaniu:
- **gm-students.mjs (kolumny Uczniów):** moje trzy kolumny (Pokój, Czeka, Połączenie) stoją po kolumnie "do":
  nagłówki w `whereAndWhoColumns(L)` (rozwinięte na końcu listy kolumn w `aliveTableHtml`), komórki w
  `whereAndWhoCells(...)` (rozwinięte na końcu wiersza żyjącego), puste w `WHERE_AND_WHO_EMPTY` (wiersz `otherRow`).
  Mikrofon T4, a po nim Motywy T5, wchodzą po nich, w tych trzech miejscach. `keepLive` okna obserwuje teraz
  `actors`, `tokens`, haki komunikatora i `userConnected` oraz `offerStore`. Jeśli T4/T5 dopisują swoje haki, to do tej
  samej listy (R66 w tier 0 sprawdza jej kształt). Przycisk +1 (EXP-GM-06) jest w komórce Akcje (`aboveMaximumHtml`),
  podpięty przez `wireAliveRow(..., "data-drpg-grant-action", ...)`. `applyAliveStates` kończy się wywołaniem
  `tellOtherGms`.
- **`waitingCards()` (messenger-gm.mjs):** eksport, sygnatura `{ messageId, actorId, userId, kind, text }` ze
  specyfikacji 4.2. Pod nim `waitingEntry(message)` (jedna karta albo null). `waitingCard` konsoli zaczyna się od
  `if (!waitingEntry(message)) return null;`. T3 podpina się do `waitingCards()`.
- **bridge-table.mjs:** nietknięty, 0 linii dopisanych.
- **Podręcznik gracza 14:** konflikt jak wyżej. Moje zdania o Moich notatkach (EXP-PL-09) są na końcu akapitu Notatki
  (linia 1014 przed scaleniem) i scaliły się bez konfliktu. Akapitu EXP-PL-12 (T2) nie ruszałem.
- **gm-items.mjs `giveBulletNow`:** T3 zmienia tę funkcję (kilku uczniów). Moje wywołanie `tellOtherGms` stoi w osobnej
  linii po komunikacie "gave".
- **despair.mjs:** pipy i +/- paska wołają `correctPool` zamiast `adjustDespair`. `hopeAlreadyFull` (T4) jest w innej funkcji.

## 7. Tekst do notatek wydania 1.2.130

EN:
- The GM panel lists every player account and whether it is connected; the Students window has Room, Waiting (cards
  about the student that wait for a GM) and Connection columns.
- Students: **+1** gives a living student one action above the maximum until the time of day ends.
- An action a GM rolls for a player's student says "Rolled by GM (name)." on its card and notice.
- A player's action roll is an entry in the GMs' Timeline (no notice in the corner).
- The other GMs get a notice when a GM gives a Truth Bullet, changes a student's state with Apply, or corrects a
  Despair pool by hand.
- Players have **My notes** in their messenger: notes for themselves, kept in this browser only.
- Player handbook 14: the unconfirmed-answer quote and the Observe card that shows a time are corrected.

PL:
- Panel GM-a pokazuje każde konto gracza i to, czy jest połączone; okno Uczniowie ma kolumny Pokój, Czeka (karty o
  uczniu czekające na GM-a) i Połączenie.
- Uczniowie: **+1** daje żyjącemu uczniowi jedną akcję ponad maksimum do końca pory dnia.
- Akcja, którą GM rzuca za ucznia gracza, mówi na karcie i w powiadomieniu "Rzucił GM (imię).".
- Rzut akcji gracza jest wpisem w Osi czasu GM-ów (bez powiadomienia w rogu).
- Pozostali GM-owie dostają powiadomienie, gdy GM daje Truth Bullet, zmienia stan ucznia przez Zastosuj albo ręcznie
  poprawia pulę Despair.
- Gracze mają w komunikatorze **Moje notatki**: notatki dla siebie, tylko w tej przeglądarce.
- Podręcznik gracza 14: poprawiony cytat odpowiedzi bez potwierdzenia i karta Observe, która ma czas.

## 8. Pytania do właściciela (z domyślnym zachowaniem, na którym linia pracowała)

1. **EXP-PL-09:** Moje notatki w tej przeglądarce (ustawienie `client`, domyślnie) czy na serwerze świata (`user`: idą za
   graczem na inny komputer, ale GM z dostępem do danych świata może je odczytać)? Domyślnie: ta przeglądarka.
2. **EXP-GM-16:** czy wynik rzutu gracza ma też wyskakiwać kartą w rogu GM-a? Domyślnie: tylko wpis w Osi czasu.
3. **EXP-GM-14:** czy powiadamiać też o danym przedmiocie, o śmierci przez Kill w oknie Uczniowie i o korekcie puli w
   oknie Despair Flow? Domyślnie: tylko trzy drogi ze specyfikacji (Truth Bullet, Zastosuj, pasek Despair).
4. **EXP-GM-07:** czy znak "Rzucił GM" ma być też na kartach Stage 6 i akcji w incydencie? Domyślnie: karty wyniku akcji
   z `rollCardFlags` i `report`.

## 9. Znalezione poza zakresem

- **Podwójna praca CALLS-15/INV-10.** T2 (`claude/v2-t2`, `f0e0735`, grupa G11) zrobiła te same dwie pozycje w tym samym
  akapicie podręcznika gracza 14 (EN i PL, linia 1010) i w faktach s14.p5. Koordynator napisał, że przy scaleniu weźmie
  moją wersję. **Mój tekst potrzebuje wtedy rzeczy od T2**, bo cały akapit to jedna linia i konflikt obejmuje całą linię:
  - zdania o przeładowaniu z commita T2 `a7901b8` (CALLS-04, nie moja pozycja): "Since 1.2.130, if you reload the page
    while you wait, your request ends: the card ends for everyone with \"The page was reloaded, ...\"" (PL: "Od 1.2.130,
    jeśli przeładujesz stronę ..."). Moja linia ma jeszcze stare "the card still ends at its time", które od CALLS-04
    jest nieprawdą. To samo dotyczy faktu s14.p5.f10.
  - "GM" w miejscu `{name}` w obu cytatach (różnica i potwierdzenie odbioru): tego wymaga specyfikacja CALLS-15, a ja
    zostawiłem "..." (sekcja 6).
  - nowy fakt s14.p5.f11 (Zbadaj punkt zainteresowania bez czasu) i słowo kluczowe "Focus your gaze" w s14.p5.f1.

  Porównałem obie wersje słowo w słowo (`git diff --word-diff`). Tekst T2 ma wszystko, co ma mój. Moje zdanie o Zbadaj
  punkt zainteresowania mówi to samo innymi słowami ("Observe's question for the GM, has no such time: its card waits
  until a GM rules on it"). **Ustalone z koordynatorem (28.11.2026): w tych plikach przy scaleniu bierze stronę T2, a mój `1e76847` pomija** (zmienia tylko te trzy
  pliki). Próbne scalenie (sekcja 6, "Przy scalaniu") rozwiązane w ten sposób daje `node tools/check.mjs` 26/26 zielone.
- **E40-T5 (test T2/E40, tests-tier2.mjs) liczy uderzenie zegara głównego GM-a** (sekcja 1): `clockBeat.patch` z
  `beatClock` (co 60 s) trafia czasem w okno liczenia. Test zależy od czasu. Nie poprawiałem go.
- **R809 (tier 1) i 65-season LC5** zależą od zegarów i od obciążenia maszyny (sekcja 1). Na CI czerwone po razie,
  lokalnie zielone.
- **`waitingCount` (messenger-gm.mjs)**: znaczek Osi czasu w nawigacji liczy karty `gmAsk`, a lista "Czeka na decyzję"
  karty z przyciskiem decyzji - te dwie liczby mogą się różnić (karta `gmAsk` bez przycisków albo karta z przyciskami
  bez `gmAsk`). Nie zmieniałem.
- **Cięcie `topLevelFunction` w tests-kit.mjs** kończy się na funkcji albo `const`, nie na klasie: funkcja tuż przed
  klasą obejmuje w cięciu całą klasę. Spis podpowiedzi (R4754) na tym polega (`openMessenger` "rysuje" kontrolki klasy
  `DrpgMessengerApp`). Kruche przy dopisywaniu funkcji przed klasą - stąd moje funkcje na końcu messenger-app.mjs.
