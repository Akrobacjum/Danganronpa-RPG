# Linia T5 (motives-trialprice) - raport

Linia T5 poprawek przed wydaniem 1.2.130 (droga do 2.0, D2-27): D2-22 (kolejność ceny w Class Trial), D2-23+D2-24 (cele
graczy, SPEC-MOTIVES.md), INV-08 i TRIAL-09. Etap E135 w `tools/stages.json`. Gałąź `claude/v2-t5` z
`claude/dazzling-bohr-juuh4g` (31d5812). Pisane 27-28.11.2026. Bez pull requesta, bez wydania, bez Forge.

## 1. Podsumowanie

| | |
| --- | --- |
| Początek | 31d5812 (`docs(v2): line specs T1-T5 ...`) |
| Koniec (kod) | 0d6a81e - uzupełnienie po raporcie (28.11.2026, prośba koordynatora): "Motives: the GM's windows, the
Level Up after a verdict, the Personal tab and the pass's sound measured ..." po 8028f21; raport w commicie po nim |
| Commity linii | 4ac0149 (C0), 612c09e (D2-22), f7232e0 (INV-08), 7954f47 (TRIAL-09), 0432888 (M1-M12), b7619b9 (poprawka INV-08), 87f684b (fikstura kopii zapasowej `motives`, zdanie 5.1), 8028f21 (raport), 0d6a81e (uzupełnienie: testy M7-M10, dwie poprawki okien i kart, poprawka 76 G, R9352), raport po uzupełnieniu |
| Tiery 0-1 na bazie | `run-tests: 2053 passed, 0 failed, 16 skipped, 0 red`, 536,5 s (31d5812, 4 rdzenie tej sesji) |
| Tiery 0-1 na końcu | `run-tests: 2081 passed, 0 failed, 16 skipped, 0 red`, 532,6 s (drzewo uzupełnienia, 28.11.2026; 2096 testów; wcześniej 2080 na 0432888) |
| Ostatnie `npm test` | sekcja 1a |
| CI na ostatnim pushu z kodem | **zielone**: d14faf2, run 46116592803 (28.11.2026) - lint/check/gate, 8 shardów suite, 8 kubełków scenariuszy (b6 z 76-passages zielony), verdict; `suite-merge: 8 shard(s) of 8 file(s), 1868 tier-2 tests in the list; 3978 passed, 0 failed, 27 skipped, 0 red: green`; crlf pominięte. Ten wpis to commit po nim (sam raport) |

Liczba "passed" to liczba testów, które zaliczył runner, a "tests ran" liczy też kontrole runnera: 2096 testów tierów
0-1 uruchomionych na końcu (2076 na TRIAL-09). `skip-baseline.json` bez zmian (16 pominięć, te same).

### 1a. Ostatnie `npm test` (audit/harness)

Uzgodnione z koordynatorem 28.11.2026: pełne `npm test` się tu nie mieści (pomiar niżej), więc za pełny bieg linii uchodzi
zielone CI (8 shardów, scenariusze, verdict) na ostatnim pushu - numer runu i sha w ostatniej wiadomości linii i w
sekcji 1b. Na drzewie uzupełnienia lokalnie: tiery 0-1 jak w tabeli; tier 2 `--only "E135 "` 22 passed, 0 failed;
71-sheet 50/50, 33-bridge-paths 93/95 (2 expected red), 61-gmstore-case 118/118, 76-passages 118/119 (1 expected red);
`npm run quick` zielone.

Wcześniej (b7619b9):

Pełnego `npm test` nie mam. Bieg na b7619b9 (28.11.2026, 4 rdzenie): lint, check (26 części) i self-test gate zielone;
suite `01-runtests` (tiery 0-2 w jednym procesie) przerwany przez limit harnessu po 6480 s (`timed out after 6480 s`,
SIGKILL), bez żadnego FAIL w logu, zanim doszedł do testów tej linii (ostatnie w logu to tier 2 E44/E22); potem 9
scenariuszy zielonych (00-boot ... 12-social), aż mój zewnętrzny `timeout 7000` zakończył całość (kod 124). Na tej
maszynie monolityczny tier 2 nie mieści się w limicie; CI dzieli suite na 8 shardów i jest jedynym pełnym biegiem
suite tej linii (sekcja 1b). Cztery liczby z ostatniego pełnego biegu tierów 0-1 tutaj: `2080 passed, 0 failed, 16
skipped, 0 red` (0432888).

### 1b. CI

Ostatni zakończony bieg CI przed raportem: b7619b9 (run 46082639954) - **czerwony**, każde zadanie:

| Zadanie | Wynik |
| --- | --- |
| lint, check, gate | zielone |
| plan | zielone |
| suite 1/8, 2/8, 3/8, 4/8, 6/8, 7/8, 8/8 | zielone |
| suite 5/8 | **czerwone**: tier 2 "Back up the case, then Restore, brings every store back: these stores are backed up and this test has no fixture for them: motives" - naprawione w 87f684b (lokalnie `--only`: 7 passed, 0 failed) |
| scenarios b1 (61, 70, 87, 96), b2 (30, 68, 81, 94), b3 (83, 20, 50, 67, 79, 93, 75), b4 (41, 19, 40, 65, 78, 92, 73), b5, b7, b8 | zielone |
| scenarios b6 (74, 13, 18, 34, 63, 76, 91, 99) | **czerwone**: 76-passages G (drugi GM z pustą przeglądarką; rekord głównego GM-a z `knows: []` przy pierwszym odczycie) - patrz niżej |
| verdict | czerwone (bo powyższe) |
| crlf | pominięte (jak zawsze na tej gałęzi) |

Bieg na 0432888 (run 46081284676): czerwone b1 i b4 (regresja INV-08), b6 (76-passages G), suite 3/8 (grid XI07 -
"a betrayal declared in the Eclipse after Night opens the next morning: ... PlayerTwo's copy names the killer Aiko
Hoshino, the model's null") i suite 5/8 (fikstura `motives`). XI07 był zielony w suite 3/8 na b7619b9 - w tej linii nie
sprawdzałem jego przyczyny.

**76-passages G - to jest regresja tej linii** (ustalone w uzupełnieniu, 28.11.2026; wcześniejszy akapit nazywał to
niestabilnością i tylko podejrzewał magazyn `motives` - za mało zmierzone):

| Drzewo | Biegi 76 (lokalnie, 4 rdzenie) | G czerwone |
| --- | --- | --- |
| baza 31d5812, własny harness | 6 | 0 |
| baza 31d5812, sonda czasu (harness tej gałęzi) | 2 | 0 |
| b7619b9 | 8 | 2 |
| 8028f21 + testy uzupełnienia, sonda czasu | 1 | 1 |
| po poprawce, sonda czasu | 6 | 1 (bieg #3, puszczony równolegle z moim biegiem R9352 - gm2 potrzebował wtedy 191 ms na odczyt, który zwykle trwa 0-1 ms) |
| CI | 0432888, b7619b9, 8028f21 | 3 z 3 |

Sonda (kopia 76 z odczytem rekordu głównego GM-a, potem czekająca, aż pojawi się nadanie): na moim kodzie przejście
gm2 jest już w rekordzie głównego, ale bez nadania (`knowsAtIds: 0`), a nadanie przychodzi 10 ms później; na bazie
nadanie jest już na miejscu. Przyczyna z mojej strony: przy podłączeniu drugiego GM-a główny zapisuje raz każdy z 71
magazynów GM-ów (scalenie jego sekcji; zmierzone sondą: po jednym `clientSettingChanged` na magazyn), a zapis magazynu
`motives` jako jedyny przerysowywał otwarte karty (`drpgMotivesChanged` -> 120 ms później render) - na głównym, w chwili,
gdy dochodzą pierwsze zapisy gm2. Poprawka (motives.mjs `registerMotives`): hak tylko, gdy zmieniło się to, co ta
przeglądarka trzyma; sonda podłączenia: `drpgMotivesChanged` 1 -> 0; R9352 (czerwony na 8028f21: `[1,2]`, zielony po).
Zostaje sam wyścig scenariusza: odczyt czeka (`until`) na identyfikatory, a nie na nadanie, które sprawdza - pod
obciążeniem nadal może przegrać (bieg #3 wyżej). Scenariusza linii przejść nie zmieniałem (nie osłabiam testu i to nie
mój plik); propozycja dla właściciela 76: czekać w `records` także na `access` przejścia, z tym samym limitem `until`.
Wynik CI po poprawce (d14faf2, run 46116592803): b6 zielony, całe CI zielone. Jeden zielony bieg CI nie dowodzi, że
wyścig zniknął (lokalnie po poprawce 5 z 6); dowodzi, że moja część przyczyny nie jest już czerwona za każdym razem.

**grid XI07**: osobno (`--tier 2 --only "grid XI07"`) zielony 3 z 3 na bazie 31d5812 i 3 z 3 na tej gałęzi; w CI czerwony
raz (0432888, suite 3/8, w otoczeniu innych testów shardu), zielony w każdym następnym biegu. Nie odtworzyłem go, więc
nie umiem powiedzieć, czy to ta linia.

CI dla 87f684b i raportu (8028f21, run 46098380715): wszystko zielone poza scenarios b6 (76-passages G) i przez to
verdict. Wynik po uzupełnieniu: sekcja 1.

Uwaga o CI w trakcie: CI na f7232e0 (INV-08), 7954f47 (TRIAL-09) i 0432888 (cele) było czerwone w dwóch kubełkach
scenariuszy (b1: 61-gmstore-case M4; b4: 40-flow) - regresja INV-08, opisana w 2 (INV-08) i naprawiona w b7619b9. Moja
metoda tego nie złapała przed pushem: przed commitem INV-08 uruchomiłem tylko 62-investigation, a nie 61 i 40, a test
R9327 miał zły przypadek sukcesu. D2-22 (612c09e) - CI zielone w całości.

## 2. Tabela pozycji

| ID | status | commit | testy (R i tier 2) | sekcje podręczników | uwagi |
| --- | --- | --- | --- | --- | --- |
| D2-22 | zrobione | 612c09e | R9320, R9321, R9322; tier 2 "E135 D2-22 - a refused Objection gives back the Sanity it took ..." | GM 14, 15, 22; gracz 12; broszura PL/EN | czerwone na 4ac0149: R9320 measured `{"objection":[["action",false,null],["hope",false,null],...]}` (Hope drugie); zielone po |
| INV-08 | zrobione (z poprawką) | f7232e0, b7619b9 | R9327, R9328; tier 2 "E135 INV-08 - an Analyze the GMs refuse as not analysable now gives its price back ..." i "E135 INV-08 - an Analyze of a bullet gone before the GM read it gives its price back (nothing was carried out)" | - (zachowanie zwrotu bez zmiany tekstu) | czerwone na 612c09e: R9327 "action-analyze.mjs has no refusedBeforeScoring", tier 2 measured `{"day":[[2,2,1],[1,2,1]],...}`. f7232e0 oddawało też cenę udanego Analyze gracza (przez sieć `{ ok: true, value: null }`); b7619b9: reguła czyta drogę odpowiedzi (`local`); R9327 czerwony na regule f7232e0 (mutant), zielony po; 61-gmstore-case 118/118, 40-flow 90/90 |
| TRIAL-09 | zrobione | 7954f47 | R9329, R9330, R9331; tier 2 "E135 TRIAL-09 - an Objection that lapsed while no GM listened gives back what it cost, once, ..." | GM 15; gracz 12; broszura PL/EN | czerwone na f7232e0+testy: R9329/R9331 "trial.mjs has no lapseRefundDue/lapseRefundOf", tier 2 "trial.mjs keeps no listening mark"; zielone po; 18-trial 94/94, 63-class-trial 79/79 |
| D2-23+D2-24 | zrobione (części niżej) | 0432888 | R9333-R9351; 10 testów tier 2 "E135 MOTIVES-..." | GM 4, 6.2, 8.1, 15, 16.2, 17, 20.3, 22; gracz 5.1, 6, 16 | jeden commit na M1-M12 (sekcja 6) |
| M1 rekord i tajność | zrobione | 0432888 | R9333, R9334, R190 (fikstury); tier 2 "E135 MOTIVES-M1 - a player's browser holds its own motives and nobody else's" | GM 8.1 | czerwone na 7954f47: R9334 "motives.mjs has no copyRowsFor", M1 "motives.mjs has no setMotiveOnPrimary"; mutant (bez filtra właściciela) zabity przez R9334 i M1 |
| M2 Monokuma Motive - rekord | zrobione | 0432888 | R9335, R9336, R9350; tier 2 "E135 MOTIVES-M2 - a hidden Monokuma Motive reaches the players as unknown"; "a motive counts down ..." (rozszerzony o brak terminu) | GM 4, 6.2; gracz 6, 16 | czerwone: R9336 "rules.mjs has no deadlineOf", R9350 measured `[[null,null,null],false,...]` |
| M3 Despair Call | zrobione | 0432888 | R9337, R9338, R1520; tier 2 "E135 MOTIVES-M3 - a Monokuma Motive is set, changed with the last one passed, and withdrawn as failed" | GM 6.2 | czerwone: R9338 measured `[6,"Motive",false,false]`; koszt 6 bez zmian (8.2) |
| M4 nadawanie | zrobione | 0432888 | R9339; tier 2 "E135 MOTIVES-M4 - a GM sets a student's motives through the primary and the owner alone is told ..."; 30-security, 33-bridge-paths A-MOTIVES | GM 8.1 | tier 2 M4 przez `requestMotiveSet` na kliencie głównego GM-a (tier 2 ma jednego GM-a); drugi GM to 33 (Asystent GM) |
| M5 nagroda | zrobione | 0432888 | R9340; tier 2 "E135 MOTIVES-M5 - a passed motive gives 3 Hope up to the maximum and says what landed"; 33 A-MOTIVES (landed 3) | GM 6.2, 8.1; gracz 5.1 | 83-roll-integrity w `npm test` |
| M6 zgłoszenie i decyzja | zrobione | 0432888 | R9341, R9342; tier 2 "E135 MOTIVES-M6 - a player reports a motive, a GM passes it, ..." i "E135 MOTIVES-M6 - a refused report tells the player why and lets them report again"; 30-security, 33 | GM 8.1; gracz 5.1 | przycisk "Odmów" zamiast "Odrzuć" (glosariusz, sekcja 6) |
| M7 interfejs GM-a | zrobione (po uzupełnieniu) | 0432888, uzupełnienie | R9343, R2080, R2063; tier 2 "E135 MOTIVES-M7 - the GM sets and passes a motive from the Students window and from the panel, and both redraw" | GM 8.1 | test dopisany po raporcie (prośba koordynatora): **czerwony na 8028f21** - komórka "Cele" w oknie Uczniowie stała na "P: brak" po zapisie i po zgłoszeniu (`keepLive` okna nie słuchał żadnej zmiany celów; zmieniała się dopiero przy zaliczeniu, bo Hope pisze aktora). Poprawka: `drpgMotivesChanged` w `watch.hooks` okna (gm-students.mjs, plik T2 - sekcja 6); zielony po. Mutanty: bez tej poprawki i bez przerysowania przeglądu - oba zabite |
| M8 prywatny dźwięk | zrobione (po uzupełnieniu) | 0432888, uzupełnienie | R9344; scenariusz 71-sheet L6 (licznik przekazań do `AudioHelper.play`, jak w 79-death-sounds) | GM 17 | nie w tierze 2: tier 2 biegnie na jednej przeglądarce GM-a, a pomiar "u p1, nie u p2 i nie u GM-a" wymaga trzech - zrobione w scenariuszu, który specyfikacja M10 wskazuje (71-sheet). L6: `motivePassed` przekazany raz na p1, 0 na gm i p2; mutant "dźwięk do wszystkich" zabity |
| M9 Level Up po Class Trial | zrobione (po uzupełnieniu) | 0432888, uzupełnienie | R9345, R9346, R1252, R1036; tier 2 "E135 MOTIVES-M9 - a chapter with no motives adds no window to the verdict" i "E135 MOTIVES-M9 - after a correct verdict the GM gives the motive Level Up to the pre-ticked and to one ticked by hand, once" | GM 15 | nowy test: pełny `applyVerdict` (poprawny), okno celów z P zaznaczonym z rekordu i H zaznaczonym ręcznie; potem stan GM-a, który odszedł w kroku celów (zapis rekordu z `motivesGiven: [P]`, Level Up H cofnięty) i `finishVerdict`. Zmierzone: Level Upy [2, 2, 1, 1], `motivesGiven` [P, H], etap "done", okno Dokończ bez P. Zielony od razu (funkcja była); mutanty: bez filtra `given`, bez wstępnego zaznaczenia, bez zapisu `motivesGiven` - wszystkie zabite |
| M10 zakładka Personal | zrobione (po uzupełnieniu) | 0432888, 87f684b, uzupełnienie | R9347, R9348; scenariusz 71-sheet L2-L5 | gracz 5.1 | nie w tierze 2 (jak M8: potrzebne przeglądarki dwóch graczy). L: karty otwarte przed zapisem celów, czytane bez ponownego otwarcia. **Czerwony na 8028f21**: karty na gm i p1 nie przerysowały się po zapisie (`refreshSheets` chodzi po `ui.windows` i `foundry.applications.instances`, a karta harnessu stoi w `actor.apps`); poprawka: przerysowanie przez `sheetsFor(actor)`, drogą znaku śmierci (motives-ui.mjs `redrawMotiveSheets`). L3 czyta kartę Aiko u p2 przy włączonej anonimowości kart i przy wyłączonej (sekcja 3, mutanty) |
| M11 panel, reset, opcjonalność | zrobione | 0432888 | R9349, R9350, R1254, R1255, R1256, R1258; tier 2 "E135 MOTIVES-M11 - the next chapter reads none of the last one's motives, ..."; E42-T6/T8/T13 | GM 16.2, 22 | reset z drugiego GM-a przez `season.reset` (T3) nie zmierzony - sanitizer T3 nie istnieje na tej gałęzi (sekcja 6) |
| M12 migracja | zrobione | 0432888 | R9351; tier 2 "E135 MOTIVES-M12 - a world with the old motive in force tells the GMs what it said once, ..." | GM 20.3, 22 | `api.mjs` `motive`/`setMotive` zostały (przekierowane na Monokuma Motive), nowe `game.drpg.motives` |

Odczyty czerwone celów: wszystkie 19 R i 10 tier 2 uruchomione na 7954f47 z nowymi plikami testów (kopia robocza):
`run-tests: 6 passed, 29 failed` (6 passed to kontrole końca tieru 2), każdy nowy test FAIL z komunikatem "nie ma
części" albo zmierzonym starym kształtem.

## 3. Testy dodane i zmienione

**Dodane, tier 1:** R9320, R9321, R9322 (D2-22); R9327, R9328 (INV-08); R9329, R9330, R9331 (TRIAL-09); R9333-R9351
(cele); R9352 (uzupełnienie: zapis magazynu bez zmiany treści nie przerysowuje nic - 76 G, sekcja 1b). Wolne z
zakresu: R9323-R9326, R9332, R9353-R9419. Rejestr: `node tools/registry.mjs --write --stage E135`.

**Dodane, tier 2:** "E135 D2-22 - a refused Objection gives back the Sanity it took ...", dwa "E135 INV-08 - ...",
"E135 TRIAL-09 - ...", "E135 MOTIVES-M1", "-M2", "-M3", "-M4", "-M5", "-M6" (dwa), "-M9", "-M11", "-M12".

**Dodane po raporcie (prośba koordynatora z 28.11.2026):** tier 2 "E135 MOTIVES-M7 - ..." i "E135 MOTIVES-M9 - after
a correct verdict ..."; scenariusz 71-sheet, część L (L1-L6: zakładka Personal na gm, p1 i p2, z anonimowością kart
włączoną i wyłączoną, oraz dźwięk zaliczenia). Bez nowych numerów R (testy tieru 2 mają nazwy; scenariusz ma litery).

**Dodane w scenariuszach:** 30-security - "SECURITY: a player's console cannot write a motive, pass one or report another
player's student's ..." (sfałszowane `motive.set`, `motive.rule`, `motive.report`); 33-bridge-paths - "A-MOTIVES: the
Assistant GM writes a student's motive on the primary, its player reports it done, and the Assistant passes it ..."
(nazwa A-MOTIVES, bo A24 i A25 są zajęte). `tests-flows.mjs`: przepływ `motives` (status covered, 1.2.130).

**Zmienione (z powodu nowego kształtu):**
- tier 2 "Back up the case, then Restore, brings every store back": fikstura magazynu `motives` (87f684b).
- D2-22: tier 1 "the three prices are one table", R1155, R8772; tier 2 "a price walks action, then Sanity, then Hope,
  and then stops" (przemianowany), "payPrice writes one field ...", "1.2.128 S0-PALM ..." (przemianowany), E51-T18,
  "a GM's give or take of Hope ...".
- TRIAL-09: tier 2 "a pending Objection with no Truth Bullet in thirty seconds ..." i "an Objection's card is one card on
  the table ..." przypinają `noteListening(1)` (po świeżym starcie zwrot byłby należny); R3510 (trial.mjs line 11 -> 12).
- Stary motyw i nowe cele: tier 0 R1036, R1252, R1254, R1256, R2035, R3510, R3420, R4672; tier 1 R190, R1520,
  R1255, R1258, R1404, R2080, R2063; tier 2 "a motive counts down a time of day at a time, and a rewind gives it back",
  "E20-T5 ...", "E51-T20 ...", trzy "E17-T10 ...", "E42-T6 ...", "E42-T8 ...", "E42-T13 ...", "1.2.122 REFR-22 ..."
  (Wycofaj pyta o zaliczenie - odpowiedź "Nie" jak GM), `SETTINGS.motive` -> `SETTINGS.monokumaMotive` w odtwarzaniu.
- INV-08 (b7619b9): R9327 - każdy przypadek na obu drogach odpowiedzi.
- Usunięte: żadne. R356, R1156, R1110 bez zmian i zielone.

**Mutanty** (kopia drzewa `/tmp/.../wt` na danym commicie, jeden na raz, przywrócone):

| Mutant | Zabity przez |
| --- | --- |
| INV-08: warunek zwrotu przy odmowie odwrócony | R9327 (tier 2 INV-08 nie) |
| M1: `copyRowsFor` bez filtra własnych postaci | R9334 i "E135 MOTIVES-M1" |
| TRIAL-09: `lapseRefundOf` bez `!row.refunded` | R9331 ("E135 TRIAL-09" nie: po wygaśnięciu karta i paragon znikają, więc drugi zwrot i tak nic nie znajduje) |
| INV-08 reguła f7232e0 (null przez sieć = odmowa) | R9327 po poprawce |
| M7: okno Uczniowie bez `drpgMotivesChanged` w `watch` (stan 8028f21) | "E135 MOTIVES-M7" |
| M7: przegląd celów bez przerysowania na `drpgMotivesChanged` | "E135 MOTIVES-M7" |
| M9: `verdictMotivesStep` bez filtra `given` | "E135 MOTIVES-M9 - after ..." (P wraca do okna Dokończ zaznaczony; drugiego Level Upu nie dostaje, bo `runAdvancementBatch` i tak pomija `given` - dwie warstwy) |
| M9: okno bez wstępnego zaznaczenia z rekordu | "E135 MOTIVES-M9 - after ..." |
| M9: `onGiven` nie zapisuje `motivesGiven` | "E135 MOTIVES-M9 - after ..." (brak zapisu rekordu z jednym nadanym) |
| M8: `playSfxForUsers` do wszystkich użytkowników | 71-sheet L6 |
| 76 G: `drpgMotivesChanged` na każdy zapis magazynu (stan 8028f21) | R9352 (`[1,2]` zamiast `[0,1]`) |
| M10: sekcja celów na dole zakładki | 71-sheet L2, L4 |
| M10: brak przerysowania otwartych kart | 71-sheet L2, L4, L5 |
| M10: wyciek do innego gracza - `motivesFor` bez wyboru własnych postaci, `receiveMotives` bez `isOwner`, zakładka bez bramki właściciela (trzy zmiany naraz) | 71-sheet L3, ale **dopiero po dodaniu odczytu z wyłączoną anonimowością**: przy włączonej (domyślnej) `redactSheet` (anonymity.mjs) czyści zakładki widza i pierwsza wersja L3 przeszła z tym mutantem. Każda z trzech warstw osobno trzyma pozostałe, więc pojedynczy mutant jednej z nich (np. tylko zakładki) przeżywa L3 - to zamierzona obrona warstwowa, nie luka testu; filtr kopii osobno mierzą R9334 i "E135 MOTIVES-M1" |

## 4. Kontrole Forge do końcowego sprawdzenia (D2-15)

Żadna obecna kontrola Forge (audit/forge, nie czytane w tej linii poza listą w specyfikacji) nie mierzy tych pozycji -
nie sprawdzałem tego na Forge (brak adresu i kont). Spodziewane po s1b: faza werdyktu bez nowego okna (s1b nie nadaje
celów, więc krok `motives` pisze tylko linię "No motives this chapter" / "Brak celów w tym rozdziale."). Propozycje dla
T4 albo koordynatora:
1. s1b po otwarciu rozprawy: Objection i Analyze z 0 akcji płacą Sanity, nie Hope (D2-22).
2. s3: Objection wygasłe przy przeładowaniu jedynego GM-a oddaje cenę raz (TRIAL-09).
3. s2: cel nadany przez GM2, zgłoszony przez P1, zaliczony przez GM1; w konsoli P2 nic z jego treści
   (`game.settings`, flagi, czat, kopia `mineMotives`).
4. s1b z nadanymi celami: okno "Kto zrealizował wszystkie cele?" po werdykcie, z wyjaśnieniem w wierszu.
5. Analyze gracza w Class Trial i w Daily Life płaci cenę i jej nie odzyskuje przy sukcesie (regresja b7619b9).

## 5. Zmienione sekcje podręczników i klucze

**Podręcznik GM-a (EN i PL, te same miejsca):**
- 4 (sekcja T2): punkt 4 listy granicy ("ticks the Monokuma Motive's deadline down by one, when it has one") i akapit o
  terminie w incydencie (słowo "motive" -> "Monokuma Motive", dwa miejsca). Zmiana minimalna.
- 6.2: wiersz tabeli "Monokuma Motive" i akapit Monokuma Motive (zastępuje akapit Motive).
- 8.1 (nowa): "The players' motives: Monokuma Motive, Personal Motive and Relationship Motive" / "Cele graczy: ...",
  na końcu sekcji 8 (akapitu T4 "Ogłoszenia Monokumy" nie ma na tej gałęzi - 8.1 stoi po tabeli Masterminda).
- 14 i 15 (D2-22, TRIAL-09): zdanie o cenie Analyze; zdanie ceny w Class Trial; wyjątek TRIAL-09 przy "cena nie wraca";
  15, akapit "The Level Ups": jedno zdanie o oknie celów po werdykcie.
- 16.2: wiersz "The board" (Monokuma Motive), jedno zdanie na końcu akapitu grup (*The players' motives*), akapit
  znaczników sezonu.
- 17: wiersz **Chat** (Monokuma Motive i *Your motive passed*).
- 20.3: "Repairs" - `setMotive(null)` z odpowiedzią o zaliczeniu i `game.drpg.motives`.
- 22: 22.6 "Sources" (`MOTIVE`, `MOTIVES`), `PRICE_CHAINS.analyze` (D2-22), "Season stamps".

**Podręcznik gracza (EN i PL):** 5.1 (nowa) "Motives and the Personal tab" / "Cele i zakładka Personal"; 6 - wiersz
Despair Calls (sekcja T1); 12 - ceny Palm, Analyze, Objection i zwrot TRIAL-09; 16 - opis panelu zdarzeń (sekcja T4).
**Broszura gracza (EN i PL):** dwa zdania o kolejności ceny (D2-22) i zdanie o zwrocie (TRIAL-09) - nie było ich na
liście linii, mówiły starą kolejność.

**Fakty:** `docs/handbook-facts.player-handbook.en.json` - fakty s6.r14 (Monokuma Motive) i s16.p6.f2; miejsca (linie)
1762 faktów przeliczone po wstawieniu 5.1 (`place` z `split`, identyfikatory bez zmian); fakty D2-22 (s12.p1.f11/f12,
s12.p5.f8, broszura s7.p5.f7). `docs/handbook-facts.gm-handbook.en.json` (nieregenerowany z decyzji właściciela
16.11.2026, nie sprawdzany): 20 faktów o motywie przepisanych (s4.p7, s4.p9, s6.r24, s6.p9, s16.p18, s17.r11, s22.p57,
s22.p165) i fakty D2-22.

**Klucze (lang/en.json i lang/pl.json, zawsze oba):**
- `DRPG.Motive.*` przepisany (Monokuma Motive), 28 nowych kluczy (m.in. `hiddenNote`, `reveal`, `revealedNote`,
  `withdrawnPassed`, `withdrawnFailed`, `oldGone`, `oldLeft`, `tip.*`), 15 zmienionych, usunięty `orElse`; `withdrawn`
  zostawiony (tekst zatwierdzony w pilocie), `migrated` zostawiony (stare światy).
- `DRPG.Motives.*` nowy (74 klucze z rodzinami liczby mnogiej; PL z `.few`/`.many`).
- Cudze przestrzenie, dopisane na końcu obiektu: `DRPG.Bridge.what.motive.set/.report/.rule` (T2),
  `DRPG.Calls.motiveSetOpen` (T2), `DRPG.Vote.verdictSteps.motives` (T3), `DRPG.Settings.motivesEnabled.name/.hint`
  (T4), `DRPG.Case.store.motives`. Zmieniony cudzy: `DRPG.Calls.motiveSet` (wyjątek ze specyfikacji, M3).
  `DRPG.Season.group.motive` zastąpiony `DRPG.Season.group.motives`.
- D2-22: nowy `DRPG.Price.will.hopeAfterSanity`, usunięty `DRPG.Price.will.stressAfterHope`, zmienione
  `DRPG.Price.nothingLeft.objection/.analyze/.palm`. TRIAL-09: nowy `DRPG.Price.refundNoGm`.
- Proza `config.mjs`: `DESPAIR_CALLS.motive` (label "Monokuma Motive", effect), `SFX_EVENTS.motive`,
  `SFX_EVENTS.motivePassed` (nowe). `node tools/check.mjs prose`: 549/549.
- Glosariusz: trzy wpisy `monokuma-motive`, `personal-motive`, `relationship-motive` (stage E135, `open`, nic nie
  zabraniają). `tools/pl-reviewed.json`: stemple kluczy celów (163) i D2-22 (7).

## 6. Pliki spoza listy, odstępstwa, co sprawdzić po przebazowaniu

- **Jeden commit na M1-M12** zamiast commita na część: części dzielą motives.mjs, motives-ui.mjs, lang i testy, a
  podręczniki muszą wejść z zachowaniem. Odczyty czerwone i zielone są dla wszystkich części razem (sekcja 2).
- **bridge-table.mjs** ma 1750 linii (sufit właściciela): trzy wiersze akcji `motive.*` po jednym w linii, importy
  dopisane do istniejących linii, roszczenia (`claims`) w tej samej linii. Każda kolejna linia T2 w tym pliku przekroczy
  sufit - koordynator musi o tym wiedzieć przy scalaniu.
- **verdict.mjs**: krok `motives` to trzy linie; ciało (`verdictMotivesStep`) w motives-ui.mjs, bo verdict.mjs przekroczył
  1500 linii (`check lengths`). Po przebazowaniu na T3: sprawdzić krok przy `verdict.skip` i `finishRoute` T3.
- **INV-08**: zwrot także przy `noGm` (krok wykraczający poza listę specyfikacji; nic nie wysłano). Po b7619b9 reguła
  zależy od drogi odpowiedzi (`local`), bo `handleAnalyzeResolve` nie odpowiada `reply` przy sukcesie.
- **Przycisk "Odmów"/"Refuse"** zamiast "Odrzuć" ze specyfikacji: glosariusz (`refuse`, DA18) zabrania "Odrzuć" w UI.
  Stan "odrzucony" zostaje w zdaniach.
- **Kafelek "Cele"** dopisany na końcu listy `now` panelu GM-a (`motivesTile`), nie "na końcu tablicy sekcji" -
  `PANEL_SECTIONS` T4 nie ma tu takiej tablicy; po przebazowaniu na T4: kafelek za kafelkami T4.
- **Kolumna Cele** dopisana po wszystkich kolumnach (`motivesColumnOf` przed `aliveTableHtml`); po przebazowaniu na T2 i
  T4 sprawdzić, że stoi za kolumnami T2 i mikrofonem T4.
- **Krok migracji `oldMotiveGone`** na końcu `CLAUSES`; bramka D2-13 T4 nie istnieje na tej gałęzi - po przebazowaniu
  sprawdzić kolejność (krok T2, potem T5).
- **Reset sezonu przez `season.reset` T3**: grupa `motives` jest w `RESET_GROUPS` (season-exceptions.mjs) - jeśli T3 ma
  literał grup, dopisać `motives`.
- **Pliki spoza listy w specyfikacji:** `scripts/sync.mjs` (wiersz `monokumaMotive`), `scripts/settings-window.mjs`
  (`motivesEnabled` w sekcji zasad), `scripts/module.mjs` (rejestracje), `scripts/api.mjs`, `tools/api-surface.json`,
  `docs/dev/text-batch-B12.json`, `B15.json`, `B16.json` (fakty nazywające funkcje), broszura gracza,
  `scripts/tests-flows.mjs`.
- **Registry:** `node tools/registry.mjs --write` stemplował nowe wiersze etapem E39 (pierwszym nieodesłanym w
  stages.json); użyłem `--stage E135`.
- **gm-students.mjs (plik T2)**: w uzupełnieniu dopisany `"drpgMotivesChanged"` do `watch.hooks` w `keepLive` okna
  Uczniowie (jedna pozycja listy i dwa wiersze komentarza, nie na końcu pliku) - bez tego kolumna Cele nie przerysowuje
  się (M7). Po przebazowaniu na T2 sprawdzić, że lista `hooks` T2 ma tę pozycję.
- **Przerysowanie kart po zmianie celów** idzie od uzupełnienia przez `sheetsFor(actor)` (`actor.apps`), nie przez
  clock.mjs `refreshSheets`; zakładam, że przy stole karta Daggerheart (ApplicationV2) jest w `document.apps`, jak przy
  znaku śmierci (sheet.mjs `redrawDeathMarks`) - nie zmierzone na v14 w tej linii.
- **Przegląd celów** zdejmuje swój `Hooks.on("drpgMotivesChanged")` przy pierwszej zmianie po zamknięciu okna (wcześniej
  słuchacz zostawał na zawsze).
- **Gniazdo `motives.mine`** wysyła kopię `{ recipients: [userId] }`, jak lockpick-gm.mjs i gm-store.mjs - to samo
  założenie o serwerze Foundry, nie zmierzone na v14 w tej linii.

## 7. Tekst do notatek wydania 1.2.130

EN:
> **Class Trial prices.** An Objection, an Analyze and a Palm in a Class Trial now cost an action, then 1 Sanity, then
> 1 Hope. An Analyze refused before it was scored gives its price back, and an Objection that lapsed because no GM
> could hear its Truth Bullet gives back what it cost.
> **The players' motives.** The Despair Call Motive is now the **Monokuma Motive**: what the class is to do together,
> optionally hidden, with a deadline and a penalty or without; a pass gives every living student 3 Hope. Each living
> student can also have a private **Personal Motive** and **Relationship Motive**, written by the GM and seen only by
> the GMs and that student's player, on the sheet's new **Personal** tab. The player reports one done, a GM passes it
> (3 Hope) or refuses it, and after the verdict the GM gives 1 Level Up to each student who did every motive of the
> chapter. A Motive from before 1.2.130 is cleared, and the GMs are told what it said. The motives can be switched off
> in the settings (Players' motives).

PL:
> **Ceny w Class Trial.** Objection, Analyze i Palm w Class Trial kosztują teraz akcję, potem 1 Sanity, potem 1 Hope.
> Analyze odrzucone przed policzeniem oddaje cenę, a Objection, które wygasło, bo żaden GM nie mógł przyjąć Truth
> Bulletu, oddaje to, co kosztowało.
> **Cele graczy.** Despair Call Motive to teraz **Monokuma Motive**: co klasa ma zrobić razem, opcjonalnie ukryty, z
> terminem i karą albo bez; zaliczenie daje każdemu żywemu uczniowi 3 Hope. Każdy żywy uczeń może też mieć prywatny
> **Personal Motive** i **Relationship Motive**, wpisywane przez GM-a i widoczne tylko dla GM-ów i gracza tego ucznia,
> w nowej zakładce **Personal** arkusza. Gracz zgłasza realizację, GM zalicza (3 Hope) albo odmawia, a po werdykcie GM
> daje 1 Level Up każdemu, kto zrealizował wszystkie cele rozdziału. Motive sprzed 1.2.130 zostaje wyczyszczony, a GM-owie
> dostają jego treść. Cele można wyłączyć w ustawieniach (Cele graczy).

## 8. Pytania do właściciela

Każde z zachowaniem, na którym linia pracowała.

1. **D2-22, ostatni znacznik Sanity (Breakdown) przed Hope?** Pracowałem na: tak, dosłownie akcja, potem Sanity, na
   końcu Hope; Hope dopiero przy pełnym Sanity; okno ostrzega o Breakdown (`lastSanity`).
2. **Koszt Despair Calla Monokuma Motive:** 6, jak dotąd.
3. **Uczeń bez nadanego Personal albo Relationship Motive:** nie jest kompletem; wiersz niezaznaczony, wyjaśnienie
   mówi "brak".
4. **Monokuma Motive trwający przy werdykcie:** liczony jako niezaliczony (wpis `running` w odczycie), chyba że GM
   wcześniej go zamknie.
5. **3 Hope pod zaciemnieniem Overflow, które blokuje Hope:** nagroda idzie jako zapis GM-a (`gmRuling`); karta i
   szept mówią, ile naprawdę doszło (`landed`), ale **nie mówią dlaczego** 0 - nie sprawdziłem, czy zaciemnienie blokuje
   zapis GM-a. Do decyzji: czy karta ma to mówić wprost.
6. **Final Trial:** bez okna celów.
7. **Ustawienie "Cele graczy":** domyślnie włączone; wyłączone chowa kolumnę, kafelek (wyłączony z powodem), całą
   sekcję celów zakładki Personal (także Monokuma Motive w zakładce - widać go w panelu zdarzeń) i krok werdyktu (linia
   "brak celów"). Despair Call Monokuma Motive działa niezależnie. Przy włączonym i bez nadanych celów zakładka pokazuje
   Monokuma Motive i zdanie "GM nie nadał ci jeszcze celów w tym rozdziale".
8. **Odrzucone zgłoszenie:** gracz może zgłosić ponownie.
9. **TRIAL-09:** zwrot przy każdej przerwie słuchania głównego GM-a w czasie wyboru (ready, powrót gniazda, nowy
   primary), raz na kartę.
10. **M12:** stary motyw w mocy nie przechodzi jako Monokuma Motive; GM-owie dostają jego treść szeptem; bez przycisku
    "nadaj jako Monokuma Motive".
11. **Inne:**
    1. "Odmów" zamiast "Odrzuć" na przycisku decyzji GM-a (glosariusz DA18) - czy tak?
    2. INV-08 oddaje cenę także przy `noGm` (GM zniknął między sprawdzeniem a wysłaniem; nic nie wysłano) - czy tak?
    3. `game.drpg.motive`/`setMotive` zostały jako nazwy Monokuma Motive (zamiast usunięcia) - czy usunąć w 2.0?
    4. Zakładka przy wyłączonych celach dalej nazywa się "Personal", bez sekcji celów - czy wracać wtedy do "Biography"?

## 9. Znalezione poza zakresem

- **`bridge-runs-acts.mjs` `handleAnalyzeResolve`** nie odpowiada `reply` przy rozstrzygnięciu, więc gracz dostaje
  `{ ok: true, value: null }` za sukces - a na kliencie GM-a null znaczy "brak bulletu". Ta dwuznaczność dała regresję
  INV-08 (naprawioną w action-analyze.mjs). Lepiej, żeby przebieg odpowiadał `{ reply: result }` (plik T1/T2).
- **13 stempli w `tools/pl-reviewed.json`** kluczy, których nie ma w lang/pl.json (`DRPG.Items.takeFrom`,
  `DRPG.Messenger.rosterTitle`, `DRPG.Panel.clearFaint`, `DRPG.Panel.faintCleared.*`, `DRPG.Panel.faintConfirm.*`,
  `DRPG.Panel.faintConfirmNote`, `DRPG.Panel.faintNone`): `stale-pl --stamp` je usuwa przy każdym uruchomieniu;
  przywracałem je ręcznie, nie są tej linii.
- **76-passages G** (scenariusz linii przejść): odczyt rekordu głównego GM-a czeka tylko na identyfikatory, nie na
  nadanie. Moja część przyczyny poprawiona (sekcja 1b); wyścig w odczycie zostaje - propozycja dla właściciela scenariusza
  w 1b.
- **grid XI07** czerwony raz w CI (0432888, suite 3/8); osobno zielony 3/3 na bazie i 3/3 tutaj - nie odtworzony.
- **Test tier 2 "E135 TRIAL-09"** nie zabija mutanta bez `refunded` (sekcja 3) - drugi zwrot sprawdza R9331.
- **`docs/handbook-facts.gm-handbook.en.json`** ma stare numery linii (decyzja właściciela z 16.11.2026: nie
  regenerowany); fakty przepisałem treścią, miejsca zostawiłem.
- **R1028** nietknięty (D2-22) - mierzy co innego niż kolejność.
