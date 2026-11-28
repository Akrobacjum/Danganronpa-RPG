# Linia T4 (voice-ui-text-infra) - raport

Specyfikacja: `docs/dev/v2/LINE-T4.md`. Gałąź `claude/v2-t4`, od `claude/dazzling-bohr-juuh4g` na `31d5812`. Etap
E134 w `tools/stages.json` (`"with": "E83"`). Kod, komentarze i nazwy testów po angielsku, jak w repozytorium; ten
raport po polsku. Wszystko, co niżej nazywam "zmierzonym", zmierzono headless (harness jsdom w `audit/harness`), chyba
że napisano inaczej. Na Forge ani w świecie kampanii nie uruchomiono niczego (brak adresu i kont w tej sesji).

## 1. Podsumowanie

| Co | Wartość |
| --- | --- |
| Początek | `31d5812` (czubek `claude/dazzling-bohr-juuh4g` przy starcie linii) |
| Koniec przed raportem | `29084b1` (poprawka FORGE-06 po CI); raport to commit następny |
| Commity linii (bez raportu) | 31 (`git log --oneline 31d5812..29084b1`) |
| Wynik bazowy, tiery 0-1, `31d5812` | `run-tests: 2053 passed, 0 failed, 16 skipped, 0 red`, 493 s (pod obciążeniem agentów pomocniczych) |
| Wynik końcowy, tiery 0-1, `3a6c595` | `run-tests: 2081 passed, 0 failed, 16 skipped, 0 red`, 446 s (29084b1 zmienia tylko `panToGathered` i R9227; R9227 i scenariusz 65 przebiegnięte osobno) |
| Końcowe `npm test` w `audit/harness`, `29084b1` | `run-all: RED`: lint green (459 plików, 0 problemów), check green (26 części), gate green (62/62), scenarios green (53/53; razem 2657/2671 kontroli, 14 expected red, 0 failed; 4570 s), suite RED - "timed out after 6480 s, no results file (exit SIGKILL)": cały suite w jednym procesie nie mieści się w limicie run-all w tym kontenerze (do chwili ucięcia w logu 0 FAIL). Dlatego suite przebiegnięty jak w CI, w 8 shardach i `suite-merge.mjs`: `suite-merge: 8 shard(s) of 8 file(s), 1857 tier-2 tests in the list; 3966 passed, 1 failed, 27 skipped, 0 red: RED`. Shard 1 (tiery 0-1 z częściami A i B): `2086 passed, 0 failed, 16 skipped, 0 red` (2523 s); shardy 2-8 zielone poza 4. Jedyna porażka (shard 4): tier 2 "an ask whose card is gone ends nothing when its time runs out (E40-T5)" - measured `{"yes":["clockBeat.patch"]}`: w oknie testu wypadł takt zegara (hud-elapsed.mjs). Ten sam test sam, trzy razy: `7 passed, 0 failed, 0 skipped, 0 red` za każdym razem; shard 4 w CI na tym samym sha zielony. Zależny od czasu, nie od zmian linii (sekcja 10) |
| CI na ostatnim pushu przed raportem | run 46092601969 na `29084b1`: success - "lint, check, gate", "plan", "scenarios b1".."b8", "suite 1/8".."8/8", "verdict" (merge shardów zielony) - każde success; "crlf lint, check, gate" i "crlf suite" skipped (tylko na dispatch). Wcześniej czerwone: run 46078109875 na `76289b7` (scenarios b4: 65-season B1b, U0) - przyczyna FORGE-06, poprawiona w 29084b1 |

Pominięte testy (16) to dokładnie te z `audit/harness/skip-baseline.json` (bez zmian w tym pliku).

Mutanty (po jednym na pozycję z nową logiką, każdy uruchomiony i cofnięty `git checkout`): D2-13 (bramka bez
przyrostka przedwydania), PANEL-01 (naprawa bez pytania), FORGE-01 (odmowa hostingu poza Forge), EXP-PL-01 (kursor
zdejmowany tylko graczom), EXP-GM-08 (zmarli w odbiorcach pokoju), VOICE-03 (wyłączenie bez pytania), EXP-GM-09 (GM
liczony jako konto bez ucznia) - każdy zabity: test pozycji czerwony (R9245, R9248, R9223, R9220, R9254, R9251,
R9256). Wcześniejszych pozycji (sprzed tej części sesji) mutantami osobno nie sprawdzałem.

## 2. Tabela pozycji

Status "zrobione" znaczy: zmiana w commicie, test czerwony przed nią i zielony po (cytat czerwonego odczytu jest w
wiadomości commita), albo - gdy czerwone jest tylko na v14 - wiersz F3 jako odczyt czerwony.

| ID | status | commit | testy (R i tier 2) | sekcje podręczników | uwagi |
| --- | --- | --- | --- | --- | --- |
| EXP-PL-01 | zrobione | b81e3e4 | R9220, R9221, R9222; tier 2 "E134 EXP-PL-01 - the checklist takes every role's pointer and the players' pings off and leaves the rest of the permissions as they were" | GM 1 (krok 2), 1.6, 2 (tabela), 22.2 | kursor: każda rola, wymagany; nowy wiersz `pings` (Gracz, Zaufany gracz), wymagany, z Pokaż; `rulers` wymagany z Pokaż (pytanie 9.1); czerwone: "season-setup.mjs has no hideAllCursors - the cursor row takes the GMs' alone"; LIVE-E134-06 |
| EXP-PL-04 | zrobione (tylko pomiar) | ec8d4b0 | Forge s7-look faza `fog-leak` (`DRPG_S7_FOG=1`) | - | moduł bez zmian (`fog.mjs`, `visibility.mjs` tylko czytane); not run: needs Forge; decyzja po pomiarze (pytanie 9.2) |
| FORGE-01 | zrobione | acccea4 (+6c7e64b dla s3) | R9223, R9224, R9225; scenariusz 34 zielony | GM 3, 20.3 | "host" po odmowie Forge, ostrzeżenie raz na sesję, bez dalszych prób; karta pustego planera; karta "Zapisz sprawę do pliku" przy nowej sesji; czerwone: "case-copy.mjs has no hostRefusal or forgetCopySession - the host's refusal is not told apart"; LIVE-E134-05 |
| FORGE-03 | zrobione (tekst) | 3a6c595 | bez testu (tekst) | GM 1.1, gracz 17.17 | "Error connecting to LiveKit Server" to klient głosu; Napraw głos |
| FORGE-08 | zrobione (bez zdania, jak w specyfikacji) | 3a6c595 | - | - | błędy ikon offline bez skutku dla gracza (strona i tak się przeładowuje) |
| FORGE-10 | zrobione (tekst) | 3a6c595 | bez testu (tekst) | GM 1.1, gracz 17.17 | Chromium 146 lub nowszy albo aktualny Firefox - za specyfikacją, nie czytane w źródle Foundry |
| FORGE-04 | zrobione | 7d620c3 (+6c7e64b dla s3) | R9226; Forge s3-disconnects faza A "FORGE-04: P1's voice tile says the server is lost..." | gracz 16, 17.17; GM 20.3 | czerwone: "voice-tile.mjs has no watchServerConnection - a disconnect changes nothing on the tile"; LIVE-E134-04 |
| FORGE-05 | zrobione | 2f21882 | Forge s5/s6 (kontrola "end: every move to a reachable room arrived or was refused with words") | - | not run: needs Forge; kształt `ignoreWalls` nie czytany w v14 |
| D2-25 | zrobione (z FORGE-05) | 2f21882 | jak FORGE-05 | - | sypialnie poza pokojami scenariuszy |
| FORGE-06 | zrobione | 62189a5, 29084b1 (poprawka) | R9227; scenariusz 65 | - | pierwsza wersja strażnika widoku odpuszczała też na planszy harnessu (app bez widoku) - CI czerwone w 65-season B1b i U0 od 62189a5 do 3a6c595, poprawione w 29084b1; `fallbackGather` z `pan: false`, `panToGathered` bez widoku nie przesuwa; błąd `CameraViews._configureRenderParts` nie ma drogi w module (R9228 nie powstał) - zostanie na Forge |
| FORGE-07 | zrobione | 0ecf611 | R9229 | - | podgląd w dwóch liniach i cały w podpowiedzi |
| FORGE-09a | bez pracy | - | - | - | świat właściciela (schowek "Marie's Room" i in.) |
| FORGE-09c | zrobione | 8e15c35 | R9230, R9260; R7791, R1459, R1489 przepisane | - | `DUMP_RULES` 3 nowe wiersze (sekcja 4); `I18N_PROTO` w shimie; LIVE-E134-01 |
| FORGE-09e | zrobione | 0ad892a | 23 testy - sekcja 3 | - | klasa (b): żadna, R9231-R9239 nieużyte; audit/forge/suite.mjs komunikat 600 -> 8000 znaków |
| R505 | zrobione | 95e9d22 | R505 | - | liczenie w `.drpg-room-window-body`; headless czerwonego się nie da; R9240 nie powstał |
| R111 | zrobione | 8ff21ef, ee03431 (+202bc89 dla s7) | R9241, R9242 | - | `handbookBox`, klasa `drpg-own-height`; czerwone: "handbooks.mjs has no handbookBox" |
| R4721 | zrobione (z R111) | 8ff21ef | R9242 | - | wysokość okna podręczników |
| R6602 | zrobione (z R111) | 8ff21ef | R9242 | - | przewijanie/skok w oknie podręczników; przyczyna w kaskadzie, nie w kodzie skoku (kształt R9242 inny niż w specyfikacji) |
| R8273 | zrobione | 47995f2 | R9243 | - | czerwone: measured ["KeyR","KeyR","KeyR","KeyR",null]; LIVE-E134-03 |
| R7931 | zrobione (test) | 77693c3 | R7931 | - | headless czerwonego się nie da; moduł nie pisze imienia ukrytego (odczyt kodu); R9244 nie powstał; LIVE-E134-02 |
| R296 | zrobione (test) | ca2694e | R296 | - | liczy grane przez okno, nie muzykę stołu |
| D2-13 | zrobione | 0bd699f | R9245, R9246; tier 2 "E134 D2-13 - a 1.9 build in a world without qa in its name migrates nothing and says so" | GM 1.5, 20.5 | `force` nie omija bramki (pytanie 9.4) |
| F3PC2-S1-STATE | zrobione | ace772e | Forge s1a/s1b | - | not run: needs Forge |
| F3PC2-S8-CLEANUP | zrobione | 3b34efd | Forge s8 (`DRPG_S8_RELOAD=1`) | - | not run: needs Forge |
| F3PC2-S8-CURVE | zrobione (pomiar) | 3b34efd | Forge s8 (warunki przebiegu na każdym poziomie) | - | not run: needs Forge |
| CALLS-18 | zrobione | af186b5 | R9247 | - | `hopeAlreadyFull` jako rodzina liczby mnogiej; czerwone: measured {"said":"Their Hope is already at maximum."...} |
| PANEL-01 | zrobione | 740749c | R9248, R9249; tier 2 "E134 PANEL-01 - a repair pressed from Diagnostics asks first and runs the console's function" | GM 3, 20.3 | okno Naprawy, 11 wierszy, każdy istniejąca funkcja `game.drpg`; czerwone: "repair-window.mjs has no REPAIRS, runRepair, repairState, repairsHtml or wireRepairs - Diagnostics has no repairs" |
| VOICE-02 | zrobione | a5f9e11 | R9250; scenariusz 75 zielony | - | kolejka stosuje tylko najnowszy pokój |
| VOICE-03 | zrobione | 3e561c9 | R9251 | GM 3 (tabela), 9.5 | kafelek "Wszyscy w jednym pokoju głosu"; czerwone: "no repair-window.mjs with toggleVoiceRooms, voiceRoomsRefusal and voiceRoomsLabelKey - Diagnostics has no voice rooms tile" |
| VOICE-04 | zrobione | 76289b7 | R9252, R9253; tier 2 "E134 VOICE-04 - a GM unblocks a player's microphone from the Students window..." | GM 9.5 | kolumna Mikrofon w oknie Uczniowie |
| EXP-GM-08 | zrobione | 485c98c | R9254, R9255; tier 2 "E134 EXP-GM-08 - Monokuma's announcement to a room reaches that room's students and nobody else"; scenariusz 72 zielony | GM 3 (tabela), 8 | `announce.mjs`, `game.drpg.announce`; czerwone: "no announce.mjs with roomRecipients - Monokuma cannot announce to a room" |
| EXP-GM-09 | zrobione | 8bf43d5 | R9256, R9257, R9258 | GM 1.4, 2 (tabela) | wiersze `players` i `tokens`; karta kont z `gmPopup`; czerwone: "season-setup.mjs has no unplayedAccounts - the checklist has no players row" |
| CTL-34 | bez zmiany kodu (już rozwiązane) | f8ee5a2 | istniejący tier 2 "Room setup shows the button that removes a room's picture only over a picture" | - | od 1.2.122 components.css ukrywa przycisk bez obrazka; poprawiony tylko nieaktualny komentarz; numer właściwy to CTL-47 (sekcja 7) |
| CTL-60 | jak CTL-34 | f8ee5a2 | jak CTL-34 | - | TRIAGE-3 przypisał ten numer temu przyciskowi błędnie (sekcja 7) |

## 3. FORGE-09e - 23 testy

Klasy: (a) test mierzy imitację harnessu albo stały czas, a nie obietnicę - test poprawiony, obietnica ta sama; (b)
prawdziwe przesunięcie w module - żadne; (c) bez dowodu na żadną stronę - test bez zmiany wyniku, komunikat ma teraz
odczyt, który rozstrzygnie Forge (biegacz ucinał go do 600 znaków).

| test | co mierzy | klasa | co zmieniono | co pokaże Forge |
| --- | --- | --- | --- | --- |
| R508 | kafelek pokoju i zegar w swoich pudełkach | a | pomiar wyprostowany jak w module (`#drpg-glass-rotation` wyłączony, `transform: none`) | 265 px zamiast 292 (292 = 265 obrócone o ok. 4,4 stopnia) |
| R3705 | wejście rozprawy gra w swoim czasie | a | `scene: "none"`; `playTrialEntry` zamiast `onPhaseChanged`; `until` | przejdzie, jeśli przyczyną była bramka sceny sali |
| R4420 | sekwencja planszy | a | `scene: "none"` | jak R3705 |
| R6850 | sekwencja | a | `scene: "none"` | jak R3705 |
| R5381 | sekwencja | a | `scene: "none"` | jak R3705 |
| R5380 | okna mieszczą się na ekranie | a | tylko wyrenderowane aplikacje z ramką (`hasFrame`) | przejdzie, jeśli łapał pasek boczny/hotbar |
| R3985 | ścieżki `clip-path` kurtyny | a | oczekiwane przez element-sondę (pisownia Blink, hipoteza) | przejdzie albo wypisze odczytane ścieżki |
| R7973 | lista powiadomień trzyma miejsce czytelnika | a | 40 starszych wpisów, `focus({ preventScroll: true })`, `until` | przejdzie albo wypisze przewinięcie |
| R7974 | przerysowanie regionu | a | `until` zamiast 450 ms | przejdzie |
| R3463 | takt zegara | a | czeka na okno do 5 s | przejdzie |
| R1387 | wiersze zegara | a | porównanie po rodzaju, nie stanie (`paused`, `past-first`, `past-second`) | przejdzie we wstrzymanym świecie |
| R1458 | przewinięcie karty | a | atrapa na stronie z wysokością | przejdzie |
| R1524 | przewinięcie okna | a | atrapa z wysokością 200 px nad 1200 px treści | przejdzie |
| R1353 | przytrzymanie okna w ekranie | a + c | część przytrzymania: `innerHeight - wysokość - 8`; część `fits` bez zmiany | część a przejdzie; część c - odczyt |
| R543 | portret w pudełku | c | komunikat: pierwszy punkt, punkt panelu, left/top, transform, róg kurtyny | odczyt przesunięcia 29 px rozstrzygnie |
| R1400 | geometria | c | bez zmiany | odczyt w pełnym komunikacie |
| R474 | geometria | c | bez zmiany | jak wyżej |
| R476 | geometria | c | bez zmiany | jak wyżej |
| R512 | geometria | c | bez zmiany | jak wyżej |
| R299 | czas | c | bez zmiany | jak wyżej |
| R8545 | czas/odświeżanie | c | bez zmiany | jak wyżej |
| R1455 | odczyt arkusza | c | bez zmiany | jak wyżej |
| R1471 | odczyt arkusza | c | bez zmiany | jak wyżej |

## 4. Testy dodane i zmienione

**Nowe numery R (tier 1):** R9220, R9221, R9222 (EXP-PL-01); R9223, R9224, R9225 (FORGE-01); R9226 (FORGE-04);
R9227 (FORGE-06); R9229 (FORGE-07); R9230 (FORGE-09c, purity); R9241, R9242 (R111); R9243 (R8273); R9245, R9246
(D2-13); R9247 (CALLS-18); R9248, R9249 (PANEL-01); R9250 (VOICE-02); R9251 (VOICE-03); R9252, R9253 (VOICE-04);
R9254, R9255 (EXP-GM-08); R9256, R9257, R9258 (EXP-GM-09); R9260 (FORGE-09c, R1066). Nieużyte z zakresu linii: R9228
(brak drogi modułu dla błędu doku), R9231-R9239 (FORGE-09e bez klasy b), R9240 (R505 bez wycieku), R9244 (R7931 bez
błędu modułu), R9259 (CTL-34 bez zmiany kodu; numer nigdy nie wszedł do commita, więc bez wiersza w rejestrze).

**Tier 2 (nazwy):** "E134 D2-13 - ...", "E134 VOICE-04 - ...", "E134 PANEL-01 - ...", "E134 EXP-GM-08 - ...",
"E134 EXP-PL-01 - ...".

**Zmienione istniejące testy, z powodem:**
- R7791, R1459, R1489 (FORGE-09c): rzucały na v14 przez nadpisanie pól tylko do odczytu - atrapy przez `standIn` /
  `Object.create`.
- R7931, R296, R505, R8273 (pozycje o tych numerach): mierzyły harness zamiast obietnicy.
- 23 testy FORGE-09e (sekcja 3).
- R534 (census dróg kafelka głosu), R2080 (nagłówki okna Uczniowie): kolumna Mikrofon.
- R2063 (lista kafelków panelu): nowe kafelki `voiceRooms`, `repairs` w Diagnostyce i `announce` w Teraz.
- R1357: CSS nie może nazywać okna przeniesionego na kit - klasa `drpg-own-height` zamiast `.drpg-handbook`.
- R601 (rulers wymagany), R1501 (funkcja `rolesSharingCursor`), R603 (tytuł wiersza bez "(optional)"): EXP-PL-01.
- R580 (user-match.mjs "żadnej flagi"): pomija dosłownie flagi karty `gmPopup`, każda inna flaga dalej czerwona.
- R3510 (cenzus kart): `announce.mjs` built 2; wiersz `user-match.mjs` zniknął (poster przez parametr).
- R472 (cenzus dróg powiadomień): wiersz `SURFACE case-copy.mjs#showCaseCard`.
- R4672 (textarea): `announce.mjs`; R4200: `announce.mjs` w `open-cost.mjs` `WARM_IMPORTS.gm`; R1560:
  `tools/api-surface.json` `announce: function`.
- tests-glyphs.mjs: wiersze `gm.voiceRooms`, `gm.repairs`, `gm.announce` (ELEMENTS i LEGACY_ICONS).

**`skip-baseline.json`:** bez zmian.

**`DUMP_RULES` (tests-kit.mjs, FORGE-09c), każdy z `until` i `why`:** `client:core.rtcClientSettings` bez
`hideDock` i `users.*.popout` (zapisy stołu w doku kamer); `client:danganronpa-rpg.rtcDockBefore` pominięty (stan doku
zapisywany przez moduł przy wstrzymaniu); `Playlist.*.sounds.*` z `stripWhen` `{ field: "playing", parent:
"ownMusic" }` (muzyka GM-a grająca w świecie). Pomiar: na Forge przebieg tier 0/1 kończył się "tier 0/1 changed
something" na tych ścieżkach, a żaden test tier 0/1 ich nie pisze (odczyt testów, commit 8e15c35).

**Shim harnessu:** `audit/harness/client-entry.mjs` `I18N_PROTO` z dziedziczonym, tylko do odczytu `format`
(jak na v14), notatka w README harnessu.

## 5. Kontrole Forge do końcowego sprawdzenia (D2-15)

Nic z poniższego nie było uruchomione w tej sesji (not run: needs Forge). Oczekiwania z odczytu kodu i wierszy F3.

| Kontrola | Oczekiwane na kandydacie |
| --- | --- |
| `s6-soak` "no error from the module on gm1", `s8-load` "no new error from the module" (FORGE-01) | przejdą: odmowa uploadu Forge to teraz jedno `warn`, nie `error` przy każdym zapisie |
| `s7-look` komunikator GM-a "no text overflows its box" (FORGE-07) | przejdzie w obu rozmiarach |
| `s7-look` faza `fog-leak` (EXP-PL-04), `DRPG_S7_FOG=1` | tylko pomiar: zrzuty `p1-<size>-fogleak-<n>-<change>-before|after.png`, kontrola "the phase ran and put everything back" |
| `s7-look` okno podręczników (R111) | czerwone na 1.2.129 przy 1920x1080, zielone z `handbookBox` w obu rozmiarach |
| `s5-voice` VOICE-02 | jedno przypisanie na ruch, bez przeskoków przez stare pokoje |
| `s5`/`s6` ruchy (FORGE-05) | "every move to a reachable room arrived or was refused with words"; kształt `ignoreWalls` do potwierdzenia przy pierwszym przebiegu |
| `s3-disconnects` FORGE-04 | przejdzie: kafelek głosu mówi "No connection to the game server" w ~6 s po odcięciu |
| `s3-disconnects` D1 | zostaje czerwone do PRIM-02 (T2), teraz z właściwego powodu (teksty FORGE-01 pominięte) |
| `suite.mjs` (FORGE-09c/e, R505, R111, R4721, R6602, R8273, R7931, R296) | klasa a i rzucające przejdą; klasa c pokaże pełny odczyt (komunikat do 8000 znaków) |
| S8 trzeci przebieg z warunkami | `DRPG_FULL_RENDER=1`, bez przeładowania; warunki przebiegu zapisane na każdym poziomie, `DRPG_S8_WARMUP_MS` (domyślnie 30 s) |
| S8 sprzątanie | `DRPG_S8_RELOAD=1`: przeładowanie po 5 usunięciach, "cleanup after a reload leaves nothing tagged" |
| S1a/S1b przygotowanie świata | `startFromKnownWorld`; `DRPG_S1_CHAPTER` odmawia innego rozdziału; świat `drpg-qa-forge` albo świeża kopia |
| `doctor` (S0) | czerwone powiadomienie Foundry o Chromium nie jest błędem modułu |
| bramka D2-13 | świat `drpg-qa-forge` ma "qa" w nazwie, więc migracje biegną |

Zmienne środowiskowe nowe w tej linii: `DRPG_S1_CHAPTER`, `DRPG_S8_RELOAD`, `DRPG_S8_WARMUP_MS`, `DRPG_S7_FOG`
(audit/forge/README.md).

## 6. Zmienione sekcje podręczników i klucze językowe

**Podręcznik GM-a (PL i EN):** 1 (krok 2: nazwa przycisku), 1.1 (akapit o przeglądarce), 1.4 (karta kont w rogu),
1.5 i 20.5 (bramka D2-13), 1.6 (kursory, linijka, pingi), 2 (tabela: kursory, linijka wymagana, pingi, konta graczy,
tokeny), 3 (tabela kafelków: Teraz i Diagnostyka; akapity Naprawy i Sprawa), 8 (akapit "Ogłoszenia Monokumy" na końcu
sekcji), 9.5 (Wszyscy w jednym pokoju głosu; kolumna Mikrofon), 20.3 (tabela Napraw - `setMotive(null)` zostaje;
akapit o kopii sprawy na Forge; akapit o utracie sieci), 22.2 (wiersze listy kontrolnej). **Podręcznik gracza (PL i
EN):** 16 (kafelek głosu bez połączenia), 17.17 (przeglądarka, sieć). `docs/handbook-facts.player-handbook.en.json`
przemapowany przy FORGE-04 (te same teksty jednostek).

**Własne przestrzenie:** `DRPG.Repair` (VOICE-03, PANEL-01), `DRPG.Announce` (EXP-GM-08), `DRPG.Despair.hopeAlreadyFull`
(CALLS-18; zmieniony na rodzinę liczby mnogiej).

**Cudze przestrzenie (dopisane na końcu albo zmienione, bo zmieniło się znaczenie wiersza):**
- `DRPG.Voice` (T1): `trialMuteLeft` zmieniony (VOICE-04, jak w specyfikacji); nowe `micColumn`, `micBlock`,
  `micUnblock`, `micNoVoice` (VOICE-04), `serverLost` (FORGE-04).
- `DRPG.Migrate`: `testBuild`, `noVersion` (D2-13).
- `DRPG.Case.copy`: `refused.host`, `sources`, `tileNoCopy`, `card.empty.*`, `card.file.*` (FORGE-01); **usunięty**
  `emptyHere` (jego jedyny czytelnik zastąpiony kartą; `check keys` był czerwony).
- `DRPG.Season`: zmienione wartości `cursorButton`, `step.cursor`, `step.rulers`, `hint.cursor`, `hint.rulers`
  (EXP-PL-01); nowe `step.pings`, `hint.pings`, `hidePings`, `showPings`, `fixedPings`, `undonePings` (EXP-PL-01),
  `step.players`, `hint.players`, `step.tokens`, `hint.tokens`, `noSchoolScene` (EXP-GM-09).
- `DRPG.Users.match.title` (EXP-GM-09).
- `DRPG.Vault`: nic (CTL-34 bez zmiany kodu).

## 7. Pliki spoza listy i odstępstwa od specyfikacji

- **VOICE-03, napisy PL:** zgodnie ze specyfikacją "pokoju głosu" / "pokoje głosu", choć podręcznik i reszta
  pl.json mówią "pokój głosowy" (pytanie 9.9).
- **FORGE-01:** (1) karta pustego planera i karta "Zapisz sprawę do pliku" to lokalne karty w rogu (`showPopup`,
  `sticky`), nie szepnięta karta czatu z `gmPopup` - nie tworzą dokumentu czatu i nie idą do innych GM-ów; (2) koniec
  sesji czytany z istniejącego haka `drpgTimeOfDayChanged` (`summary.rolledOver`), więc `clock.mjs` bez zmian; (3)
  `forgeAsset` czyta `ForgeVTT` dalej sam, nie przez nową `onTheForge`: R546 uruchamia źródło `forgeAsset` w świeżym
  realm, gdzie pomocnika nie ma - więc `onTheForge` nie jest "jedynym czytelnikiem", jak chciała specyfikacja; (4)
  `gm-panel.mjs` importuje `case-copy.mjs` statycznie (podtytuł kafelka; R161 zielony); (5) nowa część scenariusza 34
  z odmową shimu FilePickera - nie zrobiona (testy R9223-R9225 przez `SEAL_DEPS`).
- **PANEL-01:** okno w nowym `scripts/repair-window.mjs` (jak proponowano); `migrate` i `refreshMusic` wyszarzone
  poza głównym GM-em; `finishChapterEnd`, `resetTokens`, `unhide` idą swoją drogą do głównego.
- **EXP-GM-08:** wpisy `announce.mjs` w `open-cost.mjs` (R4200) i `tools/api-surface.json` (R1560) - poza listą
  plików, wymagane przez cenzusy.
- **EXP-PL-01:** `docs/dev/text-batch-B15.json` - fakt wiersza kursora wskazywał `gmRolesSharingCursor`, którego już
  nie ma (`check text`); poprawiony fakt i nazwa funkcji.
- **CTL-34+CTL-60:** właściwy numer przycisku "Usuń obrazek" to **CTL-47** w `F2-controls.md` (sonda C[34]);
  TRIAGE-3 podał CTL-34 i CTL-60, które w F2 są innymi kontrolkami (Give/take items "Item" i przełącznik Map w
  Investigation, oba "już wybrany"). Przycisk jest ukryty bez obrazka od 1.2.122 (components.css, r121-R-11), więc
  wyszarzenie nie zmienia niczego widocznego; wersja z `disabled` zepsuła istniejący test tier 2 (kliknięcie przed
  obserwatorem mutacji) i została cofnięta.
- **R111:** kształt R9242 inny niż w specyfikacji (przyczyna w kaskadzie CSS, nie w kodzie skoku).
- **Glify:** trzy nowe rysunki glass w `tools/glyphs.json` (`voice-rooms`, `repairs`, `announce`) narysowane przez
  linię, nie przez rundy rysunków - czekają na spojrzenie właściciela; `announce` nie mógł użyć megafonu `horn`
  (R3338: dwie funkcje, dwa rysunki).

**Uwagi dla linii scalanych po T4:**
- **T2:** okno Uczniowie ma kolumnę Mikrofon (ostatnia; `MIC_COLUMN`, `micCellHtml`, `wireMicCells` w
  gm-students.mjs). `gm-panel.mjs`: kafelki T4 stoją na końcu `fixes` (`voiceRooms`, `repairs`) i `now`
  (`announce`); region kafelków patrzy też na `voiceEnabled`. Lista kontrolna: wiersze `players`, `tokens` po `cast`,
  `pings` po `rulers`; `cursor` i `rulers` wymagane - linia Dalej na nie czeka.
- **T2 i T5:** bramka D2-13 stoi na wejściu `migrate1_2_0` i w `runMigrationOnLoad`; kroki dopisane na końcu `CLAUSES`
  przechodzą przez nią.
- **T3:** kafelki `voiceRooms` i `repairs` stoją po `caseWindow`, za `voiceReset`, który jest bez zmian.
- **T1:** `voice.mjs` bez zmian w tej linii; zmienione `voice-client.mjs` (`assignmentQueue`) i `voice-tile.mjs`
  (`watchServerConnection`, `micCellState`, `pushToTalkKey`).
- **T5:** podręcznik GM-a 8 - akapit ogłoszeń stoi na końcu sekcji, przed miejscem na podsekcję motywów.

## 8. Tekst do notatek wydania 1.2.130

EN:
- The GM panel's Diagnostics has a **Repairs** window: the console's repairs, each asking first and saying what it
  did, and a tile that puts everybody in one voice room when LiveKit cannot keep up.
- **Monokuma's announcements**: to the whole school, to the students standing in one room, or to one student.
- The Season checklist now hides every cursor and the players' pings, and checks that every player plays a student and
  every living student has a token on the school's scene.
- On The Forge, a refused upload of the case's copy is said once, and the GM is asked to save the case to a file.
- The voice tile says when the game server is lost; the Students window can block or unblock a player's microphone in
  any room.

PL:
- Diagnostyka panelu GM-a ma okno **Naprawy**: naprawy z konsoli, każda najpierw pyta i mówi, co zrobiła, oraz kafelek,
  który przenosi wszystkich do jednego pokoju głosu, gdy LiveKit nie nadąża.
- **Ogłoszenia Monokumy**: do całej szkoły, do uczniów stojących w jednym pokoju albo do jednego ucznia.
- Lista kontrolna sezonu ukrywa teraz każdy kursor i pingi graczy oraz sprawdza, czy każdy gracz gra uczniem, a każdy
  żywy uczeń ma token na scenie szkoły.
- Na The Forge odmowa zapisu kopii sprawy jest mówiona raz, a GM dostaje prośbę o zapis sprawy do pliku.
- Kafelek głosu mówi, gdy serwer gry jest niedostępny; okno Uczniowie blokuje i odblokowuje mikrofon gracza w każdym
  pokoju.

## 9. Pytania do właściciela (z domyślnym zachowaniem, na którym linia pracowała)

1. **EXP-PL-01:** czy kursor, pingi i linijka graczy mają być wymagane (krzyżyk) czy zalecane? Domyślnie: wszystkie
   trzy wymagane, linijka i pingi z **Pokaż**. Czy GM-owie mają mieć kursor? Domyślnie: nie (naprawa zdejmuje go
   każdej roli).
2. **EXP-PL-04:** po pomiarze S7 - czy kafelki GM-a i ikony drzwi w odwiedzonych pokojach mają być zakrywane? Domyślnie:
   bez zmiany `fog.mjs`/`visibility.mjs` do decyzji.
3. **FORGE-01:** wynik próby w kampanii z kontami Forge (Diagnostyka, Sprawa, "Zapisz kopię teraz" na każdym GM-ie);
   czy przy odmowie zapisywać przez bibliotekę plików właściciela (źródło forgevtt)? Domyślnie: nie, tylko komunikat i
   plik.
4. **D2-13:** czy `force: true` z konsoli i z okna Naprawy może obejść bramkę w świecie bez "qa"? Domyślnie: nie. Czy
   przyrostek przedwydania (`-`) to build testowy? Domyślnie: tak. Czy inne zapisy przy wczytaniu też mają czekać?
   Domyślnie: nie czekają. Kroki `ready` w module.mjs poza migracją, które z nazwy mogą pisać do świata przy wczytaniu
   (odczytane tylko z nazw kroków `safely(...)`, nie sprawdzone krok po kroku, czy i co piszą): "the GM stores"
   (przejęcie starych kluczy), "the Remnant ledger", "the case health check", "the case's server copy" (plik na
   serwerze, nie dane świata), "Truth Bullets", "the Mastermind", "project secrecy", "projects' proposers", "bedroom
   keys", "the Remnant actor", "item table wording". Do przeczytania przed decyzją.
5. **EXP-GM-08:** czy ogłoszenie pokoju dostają Widzowie w tym pokoju i Monocuby? Domyślnie: tylko żywi uczniowie w
   pokoju (bez Widzów i zmarłych, więc bez Monocubów) i GM-owie. Czy ogłoszenie szkoły ma dźwięk? Domyślnie: bez
   własnego dźwięku (karta publiczna jak inne).
6. **VOICE-04:** czy kontrolka mikrofonu ma być też w panelu GM-a? Domyślnie: tylko okno Uczniowie.
7. **PANEL-01:** czy `resetAllActions` ma być w oknie Naprawy? Domyślnie: tak, na końcu, z ostrzeżeniem, że nie
   przesuwa zegara.
8. **EXP-GM-09:** czy konto gracza, którego postacią jest Widz, ma się liczyć jako "gra"? Domyślnie: tak (Widz to rola,
   nie brak postaci).
9. **VOICE-03:** "pokoju głosu" (jak w specyfikacji) czy "pokoju głosowym" (jak w podręczniku i reszcie pl.json)?
   Domyślnie: jak w specyfikacji.
10. **Glify:** trzy nowe rysunki (`voice-rooms`, `repairs`, `announce`) do akceptacji.
11. **FORGE-05/S1/S8 (z agenta audit/forge):** czy S1 ma domyślnie odmawiać innego rozdziału; czy S8 ma usuwać wyniki
    innych przebiegów (`otherRuns` - dziś tylko liczone); czy usuwanie dodatkowych tokenów drogą Foundry (bez drogi
    modułu) jest w porządku.

## 10. Znalezione poza zakresem

- **FORGE-06, błąd `CameraViews._configureRenderParts`** ("reading 'settings'"): kod Foundry (`cameras.mjs`), gdy
  LiveKit wymienia użytkownika, którego Foundry nie liczy już jako aktywnego (S1b odcina GM1 - hipoteza); moduł nie woła
  `ui.webrtc.render`, każdy odczyt AVSettings w module ma `?.`. Zostanie na Forge.
- **Tokeny "QA s8" usunięte między przebiegami:** w `scripts/` nic nie usuwa zwykłych tokenów NPC na scenie z pokojami.
  Hipotezy: ręczne sprzątanie właściciela 25.11 albo Foundry usunął tokeny niepołączone przy usunięciu aktora bazowego
  "QA s8 NPC". Nie moduł według odczytu kodu.
- **`game.drpg` nie ma otwieracza podręczników** (S7 klika `#drpg-book-launcher`).
- **S8 wybiera najgłębszy pokój, nawet sypialnię; krok "pre" S1a nadmiarowy; ledger mgły `sameInstance`** (odczyt
  agenta audit/forge, bez poprawiania).
- **GM handbook facts** (`docs/handbook-facts.gm-handbook.*.json`) były nieaktualne już na `31d5812`; `check text`
  ich nie egzekwuje, więc linia ich nie przemapowywała.
- **Test tier 2 "an ask whose card is gone ends nothing when its time runs out (E40-T5)"** zależy od czasu: liczy zapisy
  magazynów w oknie i łapie takt zegara (`clockBeat.patch`, hud-elapsed.mjs `beatClock`), jeśli wypadnie w tym oknie
  (raz w lokalnym shardzie 4 na 29084b1; sam 3/3 zielony, w CI zielony). Do uodpornienia przez właściciela testu
  (pominięcie zapisu taktu zegara w odczycie), poza T4.
- **`npm test` w jednym procesie** nie mieści suite'u w limicie run-all (6480 s) w tym kontenerze (4 rdzenie): suite
  ucięty po 6480 s bez porażki w logu; CI dzieli go na 8 shardów. Liczba "38m13s" w CLAUDE.md jest stara.
- **R1501/R603/R601** trzymały stare reguły listy kontrolnej (kursor tylko GM-ów, linijka opcjonalna) - poprawione w
  b81e3e4 jako część EXP-PL-01, nie jako osobny błąd.
