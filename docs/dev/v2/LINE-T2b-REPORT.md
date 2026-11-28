# Linia T2b - zegar i dzień (część T2): raport

Napisane 28.11.2026 na `claude/v2-t2b`. Linia T2b to część linii T2 (`docs/dev/v2/LINE-T2.md`), wydzielona przez
koordynatora: pozycje DAY-01, DAY-02, EXP-GM-13, DAY-06, DAY-05, DAY-10, DAY-09. Specyfikacją są wiersze tych pozycji w
sekcji 2 LINE-T2.md (z 2.4 dla DAY-01), metoda z sekcji 3, zasady plików wspólnych z 4.2 i format raportu z sekcji 5.
Wszystko poza tymi siedmioma pozycjami należy do T2, T2c i pozostałych linii i nie jest tu raportowane jako zrobione.

## 1. Podsumowanie

| Co | Wartość |
| --- | --- |
| Baza (czubek `claude/v2-t2` w chwili startu) | `0d3d4f2a7cc5ed03692cad97826f4726f9aeab1b` |
| Koniec kodu | `ef2ac91` (DAY-09); po nim raport i jedna poprawka testu E40-T5 (zob. 1.1 i 6.10) |
| Commity | 8: sześć z kodem (jeden na pozycję albo grupę DAY-02+EXP-GM-13), raport, poprawka E40-T5 razem z wynikami CI |
| Tiery 0-1 na bazie | `run-tests: 2077 passed, 0 failed, 16 skipped, 0 red` (2092 testy, 493,3 s) |
| Tiery 0-1 na końcu kodu | `run-tests: 2089 passed, 0 failed, 16 skipped, 0 red` (2104 testy, 521,2 s, drzewo `20353d9` + zmiany DAY-09, zatwierdzone jako `ef2ac91`) |
| `npm run quick` | zielone przed każdym commitem (dwa razy najpierw czerwone, opisane w commitach: `registry` bez `--write` i R173/R472, poprawione) |
| Pełne `npm test` lokalnie | nie uruchomione (koordynator: nie mieści się w limicie); w zamian tiery 0-1, własne i powiązane testy tier 2, scenariusze 69, 97, 33, 30 |
| CI | zob. 1.1 |
| Mutanty | 10, wszystkie zabite (sekcja 3.4) |

### 1.1 CI

Każdy push uruchamia `ci.yml` (8 shardów, kubełki scenariuszy, `verdict`). Kolejka runnerów była w tej sesji długa
(równolegle pracowały inne linie), więc runy czekały po kilkadziesiąt minut.

| Run | Commit | Wynik |
| --- | --- | --- |
| 669 (46116736832) | `7016da4` DAY-01 | success: lint/check/gate, plan, 8 kubełków scenariuszy, 8 shardów, `verdict` |
| 673 (46118224148) | `3d367da` DAY-02, EXP-GM-13 | success |
| 675 (46119951668) | `2686b68` DAY-06 | success (zadania odczytane po kolei: lint/check/gate, plan, b1-b8, suite 1/8-8/8 zielone; crlf pominięte; `verdict` zielony) |
| 678 (46121033138) | `0d73f94` DAY-05 | success |
| 680 (46122489622) | `20353d9` DAY-10 | success: lint/check/gate, plan, b1-b8, suite 1/8-8/8, `verdict` (oba kroki: "The shards together are the whole suite", "Every job green") |
| 681 (46124276971) | `ef2ac91` DAY-09 | **failure**: lint/check/gate, plan, b1-b8 i suite 1-3/8, 5-8/8 zielone; **suite 4/8 czerwony**: 271 passed, 1 failed - E40-T5 "an ask whose card is gone ends nothing when its time runs out"; `verdict` czerwony przez ten shard ("The shards together are the whole suite") |
| 683 (46124731864) | `d9d19db` raport (kod jak w `ef2ac91`) | success: ten sam kod co 681, suite 4/8 zielony |

**Czerwień 681, zmierzona.** E40-T5 liczy każdy odczyt i zapis magazynu GM-ów w ok. 0,3 s okna wygaśnięcia
prośby, której karty już nie ma. W 681 zmierzył `yes: ["clockBeat.patch"]`: bicie głównego GM-a (hud.mjs, interwał
`CLOCK_BEAT_MS` = 60 s; jedyny zapisujący to hud-elapsed.mjs `beatClock`, odczyt 28.11.2026) wypadło w tym oknie.
To nie zapis wygaśnięcia. Lokalnie: shard 4/8 na `ef2ac91` raz czerwony z tym samym pomiarem (785,8 s, 271/1), a 683 na
tym samym kodzie zielony - zależność od czasu, nie od kodu DAY-09 (żadna z dróg DAY-09 nie pisze bicia; `ownBarricadeHere`
czyta `barricadeStore` tylko przy rysowaniu wierszy Infiltrate w zabarykadowanym pokoju). Poprawka testu - sekcja 6.10.
Po niej: E40-T5 sam zielony, mutant (bez wczesnego powrotu `endExpired` w call-gm.mjs) zabity, shard 4/8 lokalnie
zielony (794,9 s, 272 passed, 0 failed). Run CI na commicie z poprawką podaje ostatnia wiadomość sesji.

## 2. Tabela pozycji

| ID | Status | Commit | Testy (R i tier 2) | Sekcje podręczników | Uwagi |
| --- | --- | --- | --- | --- | --- |
| DAY-01 | zrobione | `7016da4` | R9037, R9038; `E132 T2b DAY-01`; scenariusz 97 DAY1 | GM 4 (l. 354), GM 12.3 (l. 1123, jedno zdanie) | Czerwone R9037 na `0d3d4f2`: `outside: [clock.mjs, eclipse.mjs, gm-campaign.mjs, season-setup.mjs]`, `store: null`. Tier 2: "gm-stores.mjs has no setMorningLine". 97 DAY1 (kod schowany): `day1Wrote: false`, 66/67. |
| DAY-02 | zrobione | `3d367da` | R9039, R9040; `E132 T2b DAY-02` | GM 4 (l. 313) | Czerwone na `7016da4`: "clock.mjs has no rewindRefusalOf", "clock.mjs has no rewindQuestion", "hud.mjs has no pressRewind". |
| EXP-GM-13 | zrobione | `3d367da` | R9041, R9042; `E132 T2b EXP-GM-13` | GM 3 (l. 279) | Czerwone tier 2 na `7016da4` (worktree, `DRPG_REPO`): `{"asked":[false,false,false,false,false,true],"cancel":[false,true],"yes":[false,true]}` - Zastosuj zapisał oba wiersze bez pytania. |
| DAY-06 | zrobione | `2686b68` | R9043, R9044; `E132 T2b DAY-06`; R472 (tier 0, zmieniony) | GM 12.4 (l. 1132, jedno zdanie) | Czerwone na `3d367da`: R9043 `{"code":false,"read":"refused",...}`; tier 2 `{"general":1,"line":false,"said":0}`. |
| DAY-05 | zrobione | `0d73f94` | R9045; `E132 T2b DAY-05` | gracza 3 (Search Tokens, l. 245) | Czerwone na `2686b68`: R9045 przegrany wyścig jako `pickedClean`, `refund: false`; tier 2 `[[-1,1,false],[1,1,false]]`. Zasada zwrotu po rzucie zmierzona inaczej niż w specyfikacji - sekcja 6. |
| DAY-10 | zrobione | `20353d9` | R9046; `E132 T2b DAY-10`; scenariusz 33 A28 | brak (zachowanie nie było opisane) | Czerwone na `0d73f94`: R9046 `{"asks":false,"op":null,"run":false}`; tier 2 "nothing was carried out: no such write of the counters"; 33 A28 `{"back":{"primary":false,"n":null},"after":1}`. Kształt inny niż w specyfikacji - sekcja 6. |
| DAY-09 | zrobione | `ef2ac91` | R9047, R9048; `E132 T2b DAY-09` | gracza 4 (Shut the Door, l. 428), GM 9.1 (l. 749, jedno zdanie) | Czerwone na `20353d9`: "action-listen.mjs has no barricadeShutWhy"; R9048 `{"code":false,"read":"refused","run":false}`; tier 2 `{"refused":"cannotNow","theirs":[true,false]}`. Nowy kod odmowy zamiast `barricaded` - sekcja 6. |

## 3. Testy dodane i zmienione

### 3.1 Nowe testy tier 1 (R9037-R9048, wszystkie z rezerwacji sekcji 2 LINE-T2.md)

Wszystkie w bloku `// T2b day-clock (split from T2)` na końcu `scripts/tests-tier1.mjs`, za blokiem T2.

| R | Pozycja | Co mierzy |
| --- | --- | --- |
| R9037 | DAY-01 | żaden plik poza migrate.mjs nie czyta `morningLineDraft` (settings.mjs tylko rejestruje); wiersz magazynu; drogi zapisu i odczytu |
| R9038 | DAY-01 | `morningDraftLift` (czysta), krok `morningLineToStore` od 1.2.130 za `bodyTilesUnseen`, odczyt wsteczny, hak na każdym GM-ie |
| R9039 | DAY-02 | `rewindRefusalOf`: Eclipse, incydent przed Stage 6, Stage 6; jedna reguła z Następną porą dnia; odmowa przed `cancelGather`; strzałka czyta regułę |
| R9040 | DAY-02 | `rewindQuestion` na czterech zegarach; naciśnięcie pyta przed cofnięciem |
| R9041 | EXP-GM-13 | `confirmUndo`: tak, Anuluj, zamknięcie; stopka (Anuluj domyślne); lista skutków escapowana |
| R9042 | EXP-GM-13 | `revivesAsked`, `reviveQuestion`; Zastosuj pyta przed zapisem; to, co zapisuje `reviveCharacter` |
| R9043 | DAY-06 | kod `roundOpen` po kodach E74, tekst czytany jako on, pierwszy pasujący wzorzec jest jego |
| R9044 | DAY-06 | `roundOpenLine` dla innego GM-a, własnej rundy i braku; jeden komunikat; linia Dalej |
| R9045 | DAY-05 | `unclaimedOutcome` z `sawFree`; `sawFree` czytane przed rzutem; droga zwrotu |
| R9046 | DAY-10 | wiersz `searchTokens.gmWrite` przyjmuje op "giveBack", strażnik odmawia graczowi, `giveBack` pyta głównego |
| R9047 | DAY-09 | `barricadeShutWhy` (brak, cudza, własna), czytana po liczbie drzwi; czytelnik flagi i magazynu; `performShut` zapamiętuje własną |
| R9048 | DAY-09 | kod `barricadeStands`, wzorzec, tekst odmowy, ciało z ogólnym tekstem |

Numery z nadmiaru R9090-R9104 nie były potrzebne.

### 3.2 Nowe testy tier 2 (blok `// T2b day-clock (split from T2)` na końcu `scripts/tests-tier2.mjs`)

`E132 T2b DAY-01`, `E132 T2b DAY-02`, `E132 T2b EXP-GM-13`, `E132 T2b DAY-06`, `E132 T2b DAY-05`, `E132 T2b DAY-10`,
`E132 T2b DAY-09` (pełne nazwy w pliku).

### 3.3 Zmienione istniejące testy i scenariusze (zachowanie, które mierzą, się zmieniło)

| Test | Powód |
| --- | --- |
| R3720, R5891, R4475 (tier 1) | ich odczyty źródła wskazywały zapis/czyszczenie ustawienia klienta; teraz drogę przez magazyn; R3720 i R4475 zmieniły też fragment nazwy |
| E101-T12 (tier 2) | czytał i odtwarzał `morningLineDraft`; teraz magazyn; nazwa mówiła `morningLineDraft` |
| E110 day boards A (tier 2) | pisał i czytał szkic; teraz magazyn; nazwa mówiła "the GM's draft" |
| R472 (tier 0) | spis dróg powiadomień: wiersz `gm-bridge.mjs#requestReadyOpen` przeszedł na `boundary.mjs#sayOpenRefusal` |
| 69-day-boards | zapis zdania przez `game.drpg.setMorningLine`, odtworzenie magazynu |
| 97-two-gms | nowa faza DAY1 na końcu (gm2 pisze, gm przesuwa zegar) |
| 33-bridge-paths | nowa faza A28 za A27 z T2 (Asystent GM oddaje token przez głównego) |
| E40-T5 (tier 2, nie mój) | pomija tylko `clockBeat.patch` (bicie, które tyka samo), jak tests-kit.mjs `SELF_TICKING` (fix-113s, R6094); wszystko inne liczy dalej - sekcja 6.10 |

`audit/harness/skip-baseline.json`: bez zmian.

### 3.4 Mutanty (kopia drzewa przy `ef2ac91`, `DRPG_REPO`)

| Mutant | Wynik | Zabity przez |
| --- | --- | --- |
| M1 odmowa barykady znowu "that cannot be done now" | KILLED | R9048, E132 T2b DAY-09 |
| M2 na GM-ie barykada zawsze "własna" | KILLED | E132 T2b DAY-09 |
| M3 `sawFree` pomijane | KILLED | R9045, E132 T2b DAY-05 |
| M4 cofnięcie nie czyta incydentu | KILLED | R9039, E132 T2b DAY-02 |
| M5 Żyje bez pytania | KILLED | R9042, E132 T2b EXP-GM-13 |
| M6 domyślny przycisk pytania na "tak" | KILLED | R9041 |
| M7 zdanie poranka znowu z ustawienia klienta | KILLED | R9037, E132 T2b DAY-01 |
| M8 `roundOpen` mówione ogólnie | KILLED | R9044, E132 T2b DAY-06 |
| M9 oddanie tokenu zostaje na drugim GM-ie | KILLED | R9046 |
| M10 (na drzewie roboczym po 6.10) `endExpired` bez wczesnego powrotu dla karty, której nie ma | KILLED | E40-T5 (1 failed) |

## 4. Kontrole Forge do końcowego sprawdzenia (D2-15)

Nic nie było uruchamiane na Forge (brak adresu i kont). Scenariusze `audit/forge` zmienione tylko w zapisie zdania
poranka: `node --check` i lint przechodzą.

| Kontrola | Pozycja | Oczekiwanie na kandydacie |
| --- | --- | --- |
| `s2-second-gm` I1 | DAY-01 | przejdzie: zdanie pisze sec przez `game.drpg.setMorningLine` (na buildzie bez API - stare ustawienie klienta), prim przesuwa zegar, zdanie jest na zegarze każdej strony. Scenariusz 97 DAY1 mierzy to samo w harness na dwóch GM-ach. |
| `s1a-day-murder` "DAY-01" | DAY-01 | przejdzie: GM1 pisze zdanie przez API, GM2 otwiera poranne Eclipse, P2 widzi zdanie |
| `s4-two-gms-at-once` C3 | DAY-06 | przejdzie: odmowa nazywa GM-a z rekordu rundy (`roundOpenLine`), kontrola szuka imienia prim w powiadomieniach sec |
| DAY-02, EXP-GM-13, DAY-05, DAY-10, DAY-09 | - | brak kontroli Forge (tak w tabeli specyfikacji); mierzone tylko w harness |

Zmiana w zapisie s2 I i s1a: odczyt i zapis zdania przez `game.drpg.morningLine()` / `setMorningLine()`, z powrotem
do `morningLineDraft`, gdy API nie ma (żeby te same skrypty dało się puścić na 1.2.129); teksty kontroli bez zmian.

## 5. Podręczniki i klucze językowe

### 5.1 Sekcje podręczników (PL i EN w tych samych commitach)

| Podręcznik | Sekcja | Pozycja | Uwaga |
| --- | --- | --- | --- |
| GM | 3 (okno Uczniowie, l. 279) | EXP-GM-13 | sekcja T2 |
| GM | 4 (Zegar, l. 313 i 354) | DAY-02, DAY-01 | sekcja T2 |
| GM | 9.1 (l. 749) | DAY-09 | poza sekcjami linii: zdanie mówiło, że cudza barykada odmawia po rzucie |
| GM | 12.3 (l. 1123) | DAY-01 | poza sekcjami linii: zdanie mówiło, że zdanie wraca "do szkicu" |
| GM | 12.4 (l. 1132) | DAY-06 | poza sekcjami linii: tam opisane są odmowy rundy gotowości |
| gracza | 3 (Search Tokens, l. 245) | DAY-05 | sekcja T2 |
| gracza | 4 (Shut the Door, l. 428) | DAY-09 | sekcja T2 |

Fakty: `docs/handbook-facts.gm-handbook.en.json` s4.p23.f5, s12.p18.f9 (zmienione), s3.p23.f5, s4.p11.f6, s4.p11.f7
(nowe); `docs/handbook-facts.player-handbook.en.json` s3.p25.f10 (nowy), s4.p43.f11 (zmieniony).

### 5.2 Nowe klucze (EN i PL, każdy na końcu swojego obiektu)

- `DRPG.Clock` (T2b): morningLineShared, morningLineSharedBy, rewindDuringIncident, rewindAskTitle, rewindAskIntro,
  rewindAskTime, rewindAskDay, rewindAskTakeBack, rewindAskClockOnly, rewindAskYes.
- `DRPG.Panel` (T2): reviveAskTitle, reviveAskIntro, reviveAskYes, reviveFxMark, reviveFxSpectator, reviveFxMonocub,
  reviveFxUnfound, reviveFxVoice, reviveFxBullets, nextReadyBy.
- `DRPG.Bridge.why` (T2): roundOpen, barricadeStands.
- `DRPG.SearchTokens` (T2): lostRace.
- `DRPG.Infiltrate.shut` (T2, na końcu obiektu): whyBarricaded.
- **Cudze przestrzenie:** `DRPG.Ready` (otherRoundOpen, ownRoundOpen), `DRPG.Case.store` (morningLine - R173 wymaga
  nazwy każdego magazynu w oknach sprawy).

Istniejących kluczy nie zmieniono. `DRPG.Hud` nie dostał nowego klucza (sekcja 6).

## 6. Pliki spoza listy i odstępstwa od specyfikacji

**Pliki spoza list wierszy specyfikacji:**

- `scripts/undo-confirm.mjs` (nowy, wymieniony w 4.2), `scripts/action-doors.mjs` (DAY-09: zapamiętanie własnej
  barykady po udanym Shut the Door), `scripts/doors-gm.mjs` (DAY-09, w liście wiersza), `scripts/search-tokens.mjs`
  (DAY-10, w liście), `scripts/tests-tier0.mjs` (R472), `tools/api-surface.json` (dwie nowe funkcje `game.drpg`),
  `docs/handbook-facts.*.json`, `docs/dev/R-REGISTRY.md` (wygenerowany).
- `scripts/bridge-asks.mjs` (DAY-06: `requestReadyOpen` z `sayRefused: false`; plik T2 ma 1496 linii, poniżej 1500).

**Odstępstwa od kształtu specyfikacji (z powodem):**

1. DAY-01, magazyn bez kopii zapasowej sprawy (`backup: false`), grupa resetu "clock": zdanie jest na jeden poranek;
   kopia przywróciłaby zdanie na dzień już rozegrany, a zgubione zdanie wpisuje się od nowa.
2. DAY-01, migracja: runner przechodzi kroki tylko na głównym GM-ie, a szkic drugiego GM-a jest w jego przeglądarce.
   Ten sam `liftMorningDraft` biegnie więc też na każdym GM-ie po nawodnieniu magazynów (`openGmStores`). Zapis ze
   zwykłym stemplem, nie słabym: wyczyszczone zdanie ("") ma prawdziwy stempel, pod którym słaby zapis by zniknął.
3. DAY-01, Edytuj kampanię i Season setup piszą zdanie tylko, gdy pole zmieniono (`morningLineTyped`); inaczej
   Zastosuj bez zmian nadpisywałoby nowsze zdanie drugiego GM-a słowami narysowanymi w oknie.
4. DAY-02, podpowiedź przyciemnionej strzałki to `DRPG.Clock.rewindDuringIncident` (słowa samej odmowy), nie nowy
   klucz `DRPG.Hud` - tak jak strzałka Eclipse mówi słowa swojej odmowy.
5. DAY-05: specyfikacja mówi, że zwrot po rzucie oddaje cenę "tylko tam, gdzie pozwala `mayRefundAfterRoll` - np. bez
   Hope z rzutu". Zmierzone: `ROLL_REFUNDS.afterRoll` w config.mjs to "always" (odczyt 28.11.2026), więc akcja wraca
   zawsze, a Hope z rzutu zostaje. Test tier 2 czyta tryb i był najpierw czerwony właśnie na tym. Kopalni Hope z tego
   nie ma: pokój widziany jako pusty jest odrzucany przed ceną, więc ta gałąź wymaga cudzego zajęcia w tej samej chwili.
6. DAY-06: nowy tekst odmowy "another kind of readiness round is open", bo stary "another readiness round is open"
   łapie wcześniejszy wzorzec (`cannotNow`), a wygrywa pierwszy. Stary wiersz wzorca został na miejscu.
7. DAY-10: zamiast nowej akcji mostu - nowy op "giveBack" w istniejącym wierszu tylko dla GM-ów `searchTokens.gmWrite`
   (ten sam, którym drugi GM wydaje token, op "spend"). Wydanie drugiego GM-a nie ma wpisu w księdze `handedOut`,
   więc `returnToken` nie pasuje; ten sam wiersz daje to samo zaufanie bez nowego wiersza tabeli.
8. DAY-09: nowy kod `barricadeStands` zamiast istniejącego `barricaded`, którego słowa to "The door does not give."
   (odmowa wejścia drzwiami) - dla Shut the Door byłyby nieprawdą. Dana, którą zna tylko właściciel postaci: pamięć tej
   przeglądarki o własnym udanym Shut the Door (na GM-ie autor z magazynu). Po przeładowaniu pamięć znika i wiersz
   autora jest wyszarzony, dopóki barykada nie zniknie (pytanie do właściciela niżej).
9. R9043 najpierw sprawdzał "ostatni kod" i "ostatni wzorzec"; mój własny kod DAY-09 to złamał. Teraz sprawdza "po
   kodach E74" i "pierwszy pasujący wzorzec jest jego" - ta sama obietnica, odporna na kody dopisane przez T1 i T5.
10. E40-T5 (test E40, nie tej linii) zmieniony po czerwieni CI 681 (sekcja 1.1): jego okno liczyło też zapis bicia
    głównego GM-a, które tyka samo co 60 s, cokolwiek robi test. Test pomija teraz dokładnie `clockBeat.patch` (po nazwie
    magazynu, z `must`, że nazwa jest) - tak jak zestaw `SELF_TICKING` w tests-kit.mjs od fix-113s i R6094 pomija to samo
    bicie w obserwacji zapisów. Odczyt magazynu bicia i każdy inny odczyt i zapis liczą się nadal; obietnica testu
    (wygaśnięcie nie czyta ani nie pisze magazynu) się nie zmienia, a mutant M10 pokazuje, że test dalej ją łapie. To nie
    osłabienie: bicie nie należy do wygaśnięcia, a jego jedynym zapisującym jest interwał hud.mjs. Jeśli właściciel woli
    zatrzymywać bicie na czas okna zamiast je pomijać, trzeba by wystawić uchwyt interwału (dziś anonimowy `setInterval`).

**Poprawka do wiadomości commita `ef2ac91`:** napisałem tam, że 2 oczekiwane czerwone scenariusza 30 to "the door.shut
forgeries". To nieprawda: to `foundry-secret-door-type` i `foundry-masked-token-actor`, ograniczenia Foundry, te same
co na bazie. Historii nie przepisywałem.

## 7. Tekst do notatek wydania 1.2.130

EN:

- The next morning's line is one for all the GMs: Edit campaign shows the same line on every GM's browser and who
  changed it last, and the start-of-day board uses it whichever GM moves the clock; it is emptied once used. A GM's old
  draft from 1.2.129 is moved into it once.
- The HUD's left chevron asks before it steps the clock back, saying from which time of day to which, whether the day
  goes back, and whether the actions, Search Tokens and seals come back. It is refused inside an incident before
  Stage 6, as Next time of day is.
- Setting a dead student to Alive in the Students window asks first and lists what the revival does; Cancel writes
  none of the window's changes.
- A GM pressing the clock while another GM's readiness question of another kind is open is told whose question it is
  and how to join or end it; the panel's Next line names that GM.
- A Search that loses the room's last Search Token to another player at the same moment gives its action back.
- A second GM's Search for something specific whose card was not posted gives the room's Search Token back.
- Shut the Door is grayed before it costs anything where a barricade already stands, and a barricade put up during the
  roll is named as the reason.

PL:

- Zdanie na następny poranek jest jedno dla wszystkich GM-ów: Edytuj kampanię pokazuje to samo zdanie u każdego GM-a i
  kto zmienił je ostatnio, a plansza początku dnia używa go, którykolwiek GM przesuwa zegar; po użyciu jest czyszczone.
  Stary szkic GM-a z 1.2.129 przechodzi do niego raz.
- Lewa strzałka HUD pyta przed cofnięciem zegara: z jakiej pory na jaką, czy wraca dzień i czy wracają akcje, Search
  Tokeny i pieczęcie. W incydencie przed Stage 6 jest odrzucana tak jak Następna pora dnia.
- Ustawienie zmarłego ucznia na Żyje w oknie Uczniowie najpierw pyta i wymienia, co zrobi przywrócenie; Anuluj nie
  zapisuje żadnej zmiany z okna.
- GM, który naciska zegar, gdy inny GM pyta graczy w rundzie innego rodzaju, dowiaduje się, czyja to runda i jak do niej
  dołączyć albo ją zakończyć; linia Dalej w panelu nazywa tego GM-a.
- Search, któremu ostatni Search Token pokoju zabrał w tej samej chwili inny gracz, oddaje akcję.
- Search drugiego GM-a "coś konkretnego", którego karta nie została wysłana, oddaje Search Token pokoju.
- Shut the Door jest wyszarzony, zanim cokolwiek kosztuje, gdy w pokoju stoi już barykada, a barykada postawiona w czasie
  rzutu jest podana jako powód odmowy.

## 8. Pytania do właściciela (z zachowaniem, na którym linia pracowała)

1. **DAY-09:** autor barykady po przeładowaniu strony ma wiersz Shut the Door wyszarzony nad własną barykadą (pamięć
   jest tylko w tej przeglądarce). Czy autor ma móc postawić ją ponownie także po przeładowaniu (to wymaga kopii gracza
   z magazynu barykad, jak mgła), czy wystarczy obecne zachowanie? Domyślnie: obecne.
2. **DAY-05:** `ROLL_REFUNDS.afterRoll` jest "always", więc akcja oddana po rzucie wraca także przy Hope z rzutu, a Hope
   zostaje. Specyfikacja zakładała regułę "bez Hope". Czy tak ma zostać? Domyślnie: tak (to nie jest decyzja tej linii).
3. **DAY-01:** zdanie poranka nie wchodzi do kopii zapasowej sprawy. Czy ma wchodzić? Domyślnie: nie.
4. **DAY-02:** pytanie przed cofnięciem jest tylko na strzałce HUD; API i konsola cofają bez pytania (jak dotąd), ale z
   bramką incydentu. Czy API ma też pytać? Domyślnie: nie.

## 9. Znalezione poza zakresem (bez poprawiania)

- `scripts/price.mjs` `mayRefundAfterRoll` (T5) czyta `roll.withHope` i `roll.isCritical` z obiektów, które
  `rollTrait` oddaje jako konfigurację rzutu; komentarz nad `dualityOf` (action-pipeline.mjs) mówi, że ta konfiguracja
  nie ma `withHope`, tylko `result.duality`. Przy trybie "always" to nic nie zmienia; przy innym trybie rzut z Hope
  byłby liczony jak bez Hope. Nie zmierzone poza tym odczytem.
- `DRPG.Bridge.why.barricaded` ("The door does not give.") nie ma w `REASON_PATTERNS` żadnego wzorca (movement.mjs
  mówi swoje słowa); kod istnieje dla odmowy wejścia, nie dla Shut the Door.
