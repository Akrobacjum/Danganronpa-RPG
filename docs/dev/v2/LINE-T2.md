# Linia T2 - rozstrzygnięcia, most, główny i drugi GM (specyfikacja dla sesji w chmurze)

Napisane 27.11.2026 na `claude/dazzling-bohr-juuh4g` (kod 1.2.129). Decyzja D2-27: poprawki robią osobne sesje w chmurze,
po jednej na linię (T1-T5), Claude Opus 5.5, wysiłek high, ultracode; koordynator scala je i wydaje jako 1.2.130.
Ta linia: **T2, `rulings-bridge-secondgm`**. Jedna sesja wdraża ją sama na gałęzi **`claude/v2-t2`** odgałęzionej od
`claude/dazzling-bohr-juuh4g`. Ten plik i repozytorium to wszystko, co dostaje.

Przeczytaj najpierw: `CLAUDE.md`, `.claude/rules/code.md`, `.claude/rules/trust-model.md`, `.claude/rules/tests.md`,
`docs/dev/METHOD.md`, `docs/text-style.md`, `docs/glossary.json`. Źródła pozycji (pełny opis, dowód `plik:linia`,
uzasadnienie): `docs/dev/v2/F1-calls.md`, `F1-daily.md`, `F1-infra.md`, `F1-blind-gm.md`, `F1-blind-player.md`,
`F1-investigation.md`, `F1-verify.md`, `TRIAGE-3.md`, pomiary `F3-forge-PC-2.md`; rejestr decyzji `DECISIONS.md`
(D2-07: rekomendacje triage przyjęte, kolumna "Twoja uwaga" przy pozycjach tej linii jest pusta, więc żadnego wyjątku).
Numery linii w dokumentach F1 są z 1.2.128 - szukaj po nazwach funkcji, nie po numerach.

---

## 1. Cel i zakres

**Cel.** Stół 2 GM-ów i 4 graczy na Forge ma działać tak, jak rozsądnie oczekuje GM i gracz: karta decyzji, którą jeden GM
zostawił otwartą, da się przejąć i nie blokuje nikogo w nieskończoność; gracz widzi, że GM czyta jego prośbę, ile zostało
czasu, i może ją wycofać; wiadomo, kto jest głównym GM-em, kiedy rola przechodzi i że w czasie przeładowania głównego
ktoś zawsze słucha; zdanie na poranek i zegar zachowują się tak samo, który GM by go nie przesuwał; okno Uczniowie i panel
GM-a mówią, kto jest połączony, gdzie stoi i czy czeka na GM-a.

**W zakresie (33 wiersze tabeli w sekcji 2, 35 identyfikatorów):** CALLS-01, CALLS-02, CALLS-03, CALLS-04, CALLS-05,
CALLS-06, CALLS-07, CALLS-12, CALLS-14, CALLS-15, DAY-01, DAY-02, DAY-05, DAY-06, DAY-09, DAY-10,
EXP-PL-12+CALLS-09+DAY-07 (jeden wiersz), INV-10, PRIM-01, PRIM-02, PRIM-03, PRIM-04, PRIM-08, PRIM-09, EXP-GM-01,
EXP-GM-05, EXP-GM-06, EXP-GM-07, EXP-GM-13, EXP-GM-14, EXP-GM-16, EXP-GM-17, EXP-PL-09.

Pozycje spoza pola `area` przydzielone tej linii w planie nakładania się (żeby jedną funkcję edytowała jedna linia):
DAY-02 i EXP-GM-13 (strzałka HUD, `clock.mjs`, `boundary.mjs` razem z DAY-06; jedno wzorcowe potwierdzenie cofnięcia),
EXP-GM-01, EXP-GM-06, EXP-GM-17 (okno Uczniowie i lista w panelu to roster), EXP-GM-14 i EXP-GM-16 (razem z EXP-GM-07),
EXP-PL-09, CALLS-15 i INV-10 (sekcja 14 podręcznika gracza i `messenger-app.mjs` są T2).

**Poza zakresem - nie ruszasz, nawet jeśli widzisz błąd (zapisz go w raporcie, sekcja 5):**

| Linia | Co ma (według planu nakładania się) | Twoja granica |
| --- | --- | --- |
| T1 murder-death-eclipse | Murder, Mask, Veil, Hide, Eclipse, Body, Spectator, ruch w Eclipse; MURDER-01..14 poza MURDER-07 (T3), DAY-03, DAY-04, EXP-PL-02, EXP-PL-06, EXP-PL-07, EXP-PL-10, EXP-GM-02, D2-06..D2-12, INV-06 | `eclipse.mjs` zmieniasz tylko w jednym miejscu, gdzie Eclipse czyta zdanie poranka (DAY-01); `visibility.mjs` nie ruszasz; w `gm-bridge.mjs` T1 dopisze hook rozłączenia uczestnika incydentu - zostaw mu na to miejsce, nie przebudowuj hooka `userConnected` bardziej, niż wymagają CALLS-02/04 i PRIM-02/03 |
| T3 investigation-trial-chapter | Investigation, Observe, Analyze, Remnant, Truth Bullet, Trial, Vote, Chapter; TRIAL-01..08, PRIM-05, PRIM-06, PRIM-07 (+VOICE-09, MURDER-07 w bloku przekaźników E128), INV-01, INV-02, INV-07, INV-12, EXP-GM-03, EXP-GM-04, EXP-GM-10, EXP-GM-11, EXP-PL-11, EXP-PL-13, EXP-PL-17 | wpisy reguł `chapter.end`, `verdict.finish`, `season.reset`, `keys.charge`, ścieżka `observe.resolve/analyze.resolve` w `bridge-asks.mjs`, `bridge-runs-records.mjs` w całości, karta Observe na punkt (`observe.mjs`) - nie twoje; `gm-items.mjs` Daj zmienia T3 (wybór kilku uczniów), ty dopisujesz tylko jedno wywołanie powiadomienia (EXP-GM-14) |
| T4 voice-ui-text-infra-tests | FORGE-*, VOICE-02..07, PANEL-01, EXP-GM-08, EXP-GM-09, EXP-PL-01, EXP-PL-04 (pomiar), D2-13 w `migrate.mjs`, CALLS-18, testy pod v14 (R7791, R1459, R1489, R1066, R1487, R7931, R296, R505, R111, R4721, R6602, R8273, FORGE-09e) | kafelki Diagnostyki w `gm-panel.mjs` (`buildSections`), przestrzeń `DRPG.Despair` i `DRPG.Settings`, `voice.mjs` poza jednym hookiem z PRIM-03, scenariusze Forge poza dwoma miejscami zapisu zdania poranka (DAY-01) |
| T5 trial-motives (D2-22, D2-23) | kolejność ceny, nowy system celów (SPEC-MOTIVES.md), INV-08, TRIAL-09, przestrzenie `DRPG.Price`, `DRPG.Motives`, Monokuma i Events w części motywu | `price.mjs`, `frisk.mjs`, `palm.mjs`, `action-analyze.mjs`, wiersz Motive w handbooku GM-a 6 (519, 527), `rules.mjs untickMotive` w `rewindTimeOfDay` - zostaje, jak jest |
| nikt | VOICE-01 (D2-26: bez zmian), FORGE-09a (świat właściciela) | - |

Nie edytujesz `module.json` ani numeru wersji. Nie robisz `tools/stages.mjs ship`. Nie piszesz pliku zwolnienia (waiver)
i nie wypełniasz pola zwolnienia. Nigdy nie pushujesz na `main` ani na `claude/dazzling-bohr-juuh4g`; push tylko na
`claude/v2-t2` (CI biegnie na `claude/**`). Nie otwierasz PR-a, chyba że koordynator o to poprosi.

---

## 2. Tabela pozycji

Kolumna "Co 2.0 ma robić" zaczyna się od cytatu zatwierdzonej rekomendacji (pole "todo" triage, przyjęte decyzją D2-07),
po nim konkretny kształt, na którym ta linia ma pracować. Kształt jest wiążący tam, gdzie tak napisano ("musi"); gdzie
napisano "proponowane", możesz go zmienić, jeśli kod pokaże lepszą drogę, i zapisujesz to w commicie i w raporcie.
Testy: numery R z zakresu linii (sekcja 4), test tier 2 nazwany `E132 <ID> - <obietnica>` (tier 2 nie ma numerów R).
Kontrole Forge (`audit/forge/scenarios/*.mjs`) nie biegną w chmurze - są pomiarem końcowego sprawdzenia (D2-15); ta
linia ma sprawić, żeby po scaleniu przeszły, i wymienia je w raporcie. "Brak kontroli Forge" znaczy, że żaden scenariusz
tego nie mierzy, i tak to zapisujesz, nie zaokrąglasz.

| ID | Co się dzieje dziś (1.2.129) | Co 2.0 ma robić | Jak to sprawdzić (czerwone najpierw; Forge) | Pliki |
| --- | --- | --- | --- | --- |
| CALLS-01 (major) | `claimCard` (bridge-asks.mjs) bierze kartę krokiem "take" w `claimOnPrimary` (call-gm.mjs); wiersz `pending` w `ruledCardStore` trzyma kartę, dopóki okno decyzji GM-a A (np. `askDynamicDifficulty`) jest otwarte - bez limitu. GM B dostaje tylko `DRPG.Bridge.claimBusy`. S2 B: 150 s takich odmów, potem "Nikt nie odpowiedział na czas". | „Przycisk Przejmij dla drugiego GM-a na zajętej karcie i samoczynne zwolnienie zajęcia po czasie.” Kształt w 2.1. W skrócie: naciśnięcie zajętej karty przez innego GM-a pyta "Przejąć?" (Anuluj domyślny, przycisk `data-action="take"`), Przejmij na karcie robi to samo; nowy krok `takeover` w `claimOnPrimary`; zajęcie starsze niż `TIMING.claimHoldMs` jest wolne; okno poprzedniego posiadacza zamyka się i nie może już niczego rozstrzygnąć. | Tier 1: R9020 (`claimOnPrimary` - takeover przekazuje zajęcie, "done"/"drop" starego posiadacza nic nie zapisują), R9021 (zajęcie po `claimHoldMs` jest wolne dla "take", `underClaim` fałsz), R9022 (decyzja starego posiadacza odrzucona na głównym w `dynamicOnPrimary`/`yesOnPrimary`/`observePickOnPrimary` po przejęciu). Tier 2: `E132 CALLS-01 - a card held open by one GM is taken over by another and ruled once`. Scenariusz harness: nowa faza na końcu `97-two-gms.mjs` (gm i gm2). Forge: `s2-second-gm` B1, B2; bez regresji `s4-two-gms-at-once` A i E1. | call-gm.mjs, bridge-asks.mjs, messenger-app.mjs, gm-bridge.mjs, bridge-table.mjs (`card.claim`: `step` dostaje `"takeover"`), config.mjs (`TIMING.claimHoldMs` na końcu `TIMING`), action-dynamic.mjs, lang, gm-handbook 6.3, tests-tier1/2, 33-bridge-paths, 97-two-gms |
| EXP-GM-05 | Na karcie nie widać, że inny GM ją rozstrzyga; drugi GM dowiaduje się z odmowy. | „Znak "rozstrzyga GM {name}" na karcie u wszystkich GM-ów (razem z CALLS-01).” Musi: każda kopia karty u GM-a (dziennik i komunikator, `wireCallActions`) pokazuje w bloku tylko dla GM-ów linię `DRPG.Bridge.claimedBy` "Rozstrzyga GM {gm} od {time}." i przycisk Przejmij, gdy w `ruledCardStore` stoi wiersz `pending` innego GM-a; znika, gdy wiersz znika albo karta jest rozstrzygnięta; odświeżane na zmianę magazynu, bez przeładowania. Graczowi nic z tego nie jest rysowane (przyciski i tak są zdejmowane). | Tier 1: R9023 (rysowanie znaku z wiersza `pending`, brak znaku u gracza i przy własnym zajęciu). Tier 2: w teście CALLS-01 odczyt znaku na drugiej kopii. Brak osobnej kontroli Forge (s2 B mierzy tylko przejęcie). | messenger-app.mjs, call-gm.mjs, lang |
| CALLS-12 (nit) | Ten sam GM naciska drugą kopię karty przy własnym otwartym oknie i czyta `claimBusy` z własnym imieniem. | „Osobny komunikat "masz już otwarte okno tej karty", gdy zajmujący to ten sam GM.” Musi: w `claimCard`, gdy `why === "busy"` i `by === game.user.id`, `DRPG.Bridge.claimOwnOpen` "Masz już otwarte okno tej karty. Dokończ je albo zamknij." i okno tej karty wysunięte na wierzch, jeśli da się je znaleźć; bez pytania o przejęcie. | Tier 1: R9024. Brak kontroli Forge. | bridge-asks.mjs, lang |
| CALLS-02 | Jedyny połączony GM przeładowuje z otwartym oknem: jego wiersz `pending` zostaje w `ruledCardStore` (client setting, przeżywa F5), a po powrocie jest "active", więc karta jest zajęta przez niego samego na zawsze; `releaseClaimsOf` biegnie tylko na innej przeglądarce. S3 D5 potwierdził. | „GM po powrocie (ready) zwalnia własne zawieszone zajęcia kart.” Musi: w `registerGmBridge` (gałąź GM-a), po `ruledCardStore.whenHydrated()`, każdy wiersz `pending` z `by === game.user.id` jest zwalniany (ta przeglądarka dopiero się wczytała, więc żadne jej okno nie jest otwarte): na głównym `ruledCardStore.dropMany` + `expiryAfterClaim`, na drugim GM-ie krok "drop" do głównego (istniejący). Do tego zajęcie starsze niż `claimHoldMs` z CALLS-01. | Tier 1: R9025 (wiersz własny `pending` znika po wywołaniu funkcji gotowości; cudzy zostaje). Tier 2: `E132 CALLS-02 - the only GM's own claim left by a reload is let go at ready`. Forge: `s3-disconnects` C2, D5. | gm-bridge.mjs, call-gm.mjs (nowa eksportowana funkcja zwalniania własnych zajęć), gm-stores.mjs (bez nowego wiersza, jeśli wystarczy `ruledCardStore`), tests-tier1 |
| CALLS-03 | Zegar decyzji (180 s, Call 300 s) biegnie od prośby; okno trudności (`askDynamicDifficulty`) nie pokazuje, ile zostało; decyzja po czasie to `askNotHeld`, a gracz pisze opis od nowa (`promptForRequest` bez wartości startowej). | „Odliczanie w oknie decyzji GM-a; tekst gracza zachowany po przekroczeniu czasu i podany przy ponownej prośbie.” Musi: (1) `askDynamicDifficulty` dostaje `expires` (z `askCardExpiry(message)` karty, przekazane przez `ruleSetDifficulty`) i rysuje element `data-drpg-expires` z tekstem `DRPG.Bridge.timeLeft` "Zostało {time}." odświeżanym co sekundę, a po czasie `DRPG.Bridge.timeUp` "Czas minął: gracz już nie czeka na tę decyzję."; (2) przeglądarka gracza, której prośba Dynamic skończyła się bez odpowiedzi (`noAnswer`, wygaśnięcie) albo została wycofana, trzyma opis i proponowaną statystykę per postać w pamięci strony, a następny `performDynamic` tej postaci podaje je jako wartość startową pola `textarea[name="request"]` (nowy parametr `value` w `promptForRequest`/`askForRequest`); udana prośba czyści zapamiętany tekst. To samo dla notki karty statystyki (`trait-ruling.mjs` `askGms`, pole `note`), jeśli okno ją ma. | Tier 1: R9026 (okno trudności ma element czasu z `expires`), R9027 (zapamiętany opis podany przy następnej prośbie, czyszczony po udanej). Tier 2: `E132 CALLS-03 - a Dynamic description that ran out is offered again`. Forge: `s2-second-gm` C1, C2 (C2 przechodzi przez wariant "next Dynamic window holds the words"). | action-dynamic.mjs, messenger-app.mjs, call-gm.mjs, trait-ruling.mjs, lang, tests-tier1 |
| EXP-PL-12 + CALLS-09 + DAY-07 | Gracz czekający na trudność Dynamic, kartę statystyki albo zgodę na Call widzi tylko `showWaiting` ("Czekamy na GM-a…", "GM wybiera statystykę…", "{call} czeka na decyzję GM-a…"): bez czasu, bez wiedzy, że GM wziął kartę, bez wycofania. | „Stan "GM rozstrzyga" na karcie gracza i w okienku czekania, czas do końca i przycisk Wycofaj, który zamyka prośbę u GM-ów bez kosztu. Handbook gracza PL i EN.” Kształt w 2.3: `showWaiting` dostaje `expires`, `onWithdraw` i stan; główny po "take"/"takeover"/"drop" na karcie z trzymaną prośbą wysyła pytającemu pakiet stanu; nowa akcja mostu `ask.withdraw` (gracz -> główny) kończy prośbę i kartę "Gracz wycofał prośbę."; lokalny czekacz kończy się bez komunikatu "nie została wykonana" i bez kosztu. Observe na punkt (karta T3) nie wchodzi. | Tier 1: R9028 (okienko czekania rysuje czas i Wycofaj), R9029 (`ask.withdraw`: strażnik przyjmuje tylko pytającego tej prośby, sfałszowany `rid` cudzej prośby odrzucony), R9030 (pakiet stanu przyjmowany tylko od głównego GM-a, `senderId` Foundry). Tier 2: `E132 EXP-PL-12 - a player sees a GM ruling, the time left, and withdraws for free` (dla Call, Dynamic i statystyki: Hope, akcja i Sanity bez zmian). 30-security / 33-bridge-paths: wiersz `ask.withdraw`. Brak kontroli Forge. | calls.mjs, action-dynamic.mjs, trait-ruling.mjs, popup.mjs (`showWaiting`), call-gm.mjs, bridge-asks.mjs, bridge-guards.mjs (czekacz: `cancel(requestId)`), bridge-table.mjs, bridge-wire.mjs (`ACTION_` stała), messenger-app.mjs, lang (`DRPG.Bridge.what.ask.withdraw` i reszta), player-handbook 14 PL i EN, tests-tier1/2, 33-bridge-paths |
| CALLS-04 | Gracz przeładował w trakcie czekania: karta u GM-ów stoi z żywymi przyciskami do swojego czasu, główny nie reaguje na rozłączenie gracza (`userConnected` w `registerGmBridge` obsługuje tylko GM-ów); trudność kończy się "{name} odpowiada, ale nie wiadomo, czy odpowiedź dotarła", a podręcznik każe wtedy nie pytać ponownie. S3 B potwierdził. | „Znak na karcie u GM-ów, że gracz się rozłączył albo przeładował, i zdanie w podręczniku gracza (1010), że po przeładowaniu prośbę wysyła się od nowa.” Musi: (1) główny przy `userConnected(user, false)` gracza oznacza każdą jego trzymaną prośbę (`heldAskMaps`) znakiem tylko dla GM-ów `DRPG.Bridge.askerLeft` "{name} rozłączył się o {time}. Jeśli wróci po przeładowaniu, zapyta od nowa." (meta karty GM-ów, rysowana w bloku GM-ów); (2) każda przeglądarka gracza po wczytaniu wysyła GM-om pusty pakiet `bridge.playerReady` (nadawca z Foundry, payload bez pól), a główny kończy wtedy wszystkie trzymane prośby tego nadawcy sprzed wczytania: karta `DRPG.Bridge.settledReloaded` "Gracz przeładował stronę; ta prośba już na nic nie czeka. Może zapytać jeszcze raz." u wszystkich, a GM-owie notka `settledGone`; przyciski znikają. Prośba, której czekacz przeżył krótką przerwę sieci bez przeładowania (resend tym samym id), nie jest kończona. | Tier 1: R9031 (znak przy rozłączeniu, tylko GM-owie), R9032 (`playerReady` kończy tylko prośby nadawcy; pakiet od innego gracza nie kończy cudzych). Tier 2: `E132 CALLS-04 - a player's reload ends their old asks' cards`. Forge: `s3-disconnects` B1, B2, B3, B4 (B1 i B4 dziś czerwone). | gm-bridge.mjs, call-gm.mjs, messenger-app.mjs, lang, player-handbook 14 PL i EN (zdanie: po przeładowaniu prośbę wysyła się od nowa), tests-tier1/2 |
| CALLS-05 | Wybór statystyki (`rulePickTrait`) idzie od naciskającego GM-a wprost do gracza (`answerTraitRuling`), bez potwierdzenia; karta od razu "{name} odpowiada.", także gdy gracz już nie czeka. | „Karta mówi uczciwie, że odbiór nie jest potwierdzony (albo czeka na potwierdzenie jak zgoda na Call i trudność).” Musi: karta po naciśnięciu mówi `DRPG.Bridge.settledUnconfirmed` (istniejący tekst); gdy pytający zgłosi odbiór (istniejący raport `received` do GM-ów, `receivedOnPrimary`), główny przepisuje linię karty na `settledAnswered`. Bez odbioru zostaje "nie wiadomo, czy dotarła". | Tier 1: R9033. Tier 2: `E132 CALLS-05 - a statistic's pick says unconfirmed until the player's receipt`. Brak kontroli Forge. | messenger-app.mjs, call-gm.mjs (`receivedOnPrimary` dla prośby statystyki), bridge-asks.mjs, lang (bez nowego klucza, jeśli istniejące wystarczą), tests-tier1 |
| CALLS-06 | Budżet `RESENDS` (3) przy 2 GM-ach: przeładowanie głównego to dwa ponowienia (wyjście -> `primaryLeft` -> `resendOnGmReady`, powrót -> `bridge.gmReady` -> drugie). Po dwóch przeładowaniach zgoda daje "Gracz już nie czeka". | „Przeładowanie głównego liczyć jako jedno ponowienie, zgodnie z komentarzem bridge-guards.mjs:2135-2137.” Musi: wpis czekacza (`createWaiter`) zapamiętuje id głównego, którego odejście wywołało ponowienie; ponowienie na `bridge.gmReady` od tego samego GM-a nie zużywa budżetu i czyści znak. `resendOnGmReady` dostaje `senderId`. Komentarz nad `RESENDS` przepisany na to, co kod robi, z datą i tym testem. | Tier 1: R9034 (dwa przeładowania tego samego głównego w czasie jednej prośby zużywają 2 z 3; trzecie zdarzenie innego GM-a dalej ponawia). Forge: pośrednio `s3-disconnects` C3. | bridge-guards.mjs, gm-bridge.mjs (`onGmReady` podaje nadawcę), tests-tier1 |
| CALLS-07 | Daj na Ask for Hope Monocuba płaci z puli Despair naciskającego GM-a (`answerHopeAsk` -> `convertDespairToHope(game.user.id, ...)`); drugi GM z pustą pulą: `DRPG.Despair.poolEmpty`, karta otwarta, nic nie mówi dlaczego. | „Karta i odmowa mówią, z czyjej puli płaci Daj; handbook GM-a.” Musi: przyciski karty (`askGive`) albo blok GM-ów mówią `DRPG.Monocub.askFromYourPool` "Daj płaci z puli Despair GM-a, który naciśnie."; `answerHopeAsk` przed `convertDespairToHope` sprawdza pulę naciskającego i przy pustej mówi `DRPG.Monocub.askPoolEmpty` "Twoja pula Despair ({pool}) jest pusta, a Daj płaci z puli GM-a, który naciska. Daj może nacisnąć GM z Despair w puli albo naciśnij Nie teraz." Reguła płacenia bez zmian (to nie jest decyzja tej linii). | Tier 1: R9035 (tekst karty i odmowa z nazwą puli). Brak kontroli Forge. | monocub.mjs, messenger-app.mjs (`ruleCubHope` bez zmian logiki), lang (`DRPG.Monocub`), gm-handbook 8 (akapit Ask for Hope; sekcja 8 to T5/T4 tylko dla motywów i ogłoszeń) |
| CALLS-14 (nit) | `askNotHeld` zwraca `settled("DRPG.Bridge.settledGone")`, czyli "Gracz już nie czekał." jako główną linię karty, widoczną dla gracza; handbook GM-a 6.3 mówi, że to notka GM-ów. | „Pisać ją jako notkę GM-ów (gmNote), zgodnie z handbookiem.” Musi: `askNotHeld` zwraca `{ settled: <settledExpired>, gmNote: { key: "DRPG.Bridge.settledGone" } }`, a `wireCallActions` i `pressCard` przekazują `outcome.gmNote` do `settleCall(message, text, ruling, gmNote)`. | Tier 1: R9036 (`fnSource` `askNotHeld` i ścieżka gmNote w `wireCallActions`/`pressCard`). Tier 2: dopisać odczyt do istniejącego testu A11 albo `E132 CALLS-14 - the player was no longer waiting is the GMs' note`. Brak kontroli Forge. | messenger-app.mjs, gm-handbook 6.3 (zdanie zostaje prawdziwe; sprawdzić), tests-tier1 |
| CALLS-15 (nit) | Podręcznik gracza 14 cytuje "Odpowiedział: ... - odbiór niepotwierdzony.", karta mówi "{name} odpowiada, ale nie wiadomo, czy odpowiedź dotarła." | „Poprawić cytat w podręczniku gracza PL i EN do tekstu karty.” Cytat z `lang/pl.json` i `lang/en.json` `DRPG.Bridge.settledUnconfirmed`, z `{name}` zamienionym na "GM". Razem z CALLS-04 zdanie "wtedy nie pytaj jeszcze raz" zostaje tylko dla trudności, nie dla przeładowania. | Bez testu (tekst podręcznika); commit to mówi. Jeśli `docs/handbook-facts.player-handbook.en.json` trzyma ten cytat - poprawić fakt. | player-handbook 14 PL i EN |
| INV-10 (nit) | Podręcznik gracza 14 przypisuje czas "Otwarta do ..." karcie Observe na punkt zainteresowania; w kodzie kartę z czasem ma Skup wzrok (`askObserveByCard`), a Zbadaj punkt zainteresowania to karta decyzji bez czasu. | „Poprawić podręcznik gracza PL i EN.” Przed zmianą przeczytaj w `observe.mjs` i `call-gm.mjs`, która karta niesie `expires`, i nazwij ją tak, jak nazywa ją interfejs (`lang/pl.json`). | Bez testu (tekst); commit podaje odczyt kodu. | player-handbook 14 PL i EN |
| DAY-01 | Zdanie poranka to `morningLineDraft` (`scope: "client"`): pisze je Edytuj kampanię (`gm-campaign.mjs`) i Season setup (`season-setup.mjs`), czyta `morningInputs` w `clock.mjs` i `openingDayPatch` (poranne Eclipse w `eclipse.mjs`). Gdy zegar przesuwa drugi GM, zdanie piszącego nie wychodzi, nie jest czyszczone i wyjdzie przy jego następnym poranku. S2 I1 i S1a DAY-01 czerwone. | „Zdanie poranka we wspólnym magazynie GM-ów, widoczne (i edytowalne) u obu, użyte przez tego, kto przesuwa zegar, i czyszczone po użyciu. Handbook GM-a (354) PL i EN.” Kształt w 2.4: nowy magazyn GM-ów (jeden wiersz `{ text, by, at }`), funkcje `morningLine()`/`setMorningLine(text)` jedyną drogą odczytu i zapisu, krok migracji przenoszący szkic klienta, `SETTINGS.morningLineDraft` bez użycia poza migracją. | Tier 1: R9037 (żaden plik poza migracją nie czyta `SETTINGS.morningLineDraft`; `morningInputs` czyta magazyn), R9038 (krok migracji przenosi niepusty szkic, gdy magazyn pusty; nie nadpisuje). Tier 2: `E132 DAY-01 - the morning line one GM wrote is the one the other GM's advance uses, then cleared on both`; przepisać istniejące, które czytają ustawienie klienta: R4475, `E101-T12`, test E110 z `morningLineDraft`, scenariusz `69-day-boards` (zapis zdania). Forge: `s2-second-gm` I1, `s1a-day-murder` "DAY-01" - w obu zamienić zapis `game.settings.set(..., "morningLineDraft", ...)` na nowe API (sekcja 2.4), tekst kontroli bez zmian. | settings.mjs, clock.mjs, eclipse.mjs (tylko odczyt i oddanie zdania przy `undoOpening`), gm-campaign.mjs, season-setup.mjs (tylko zapis zdania), gm-stores.mjs, migrate.mjs (krok na końcu listy), api.mjs (na końcu obiektu), gm-handbook 4 PL i EN, tests-tier1/2, 69-day-boards, forge s2 i s1a (tylko zapis zdania) |
| DAY-02 | Lewa strzałka HUD (`hud.mjs`, kontrolka `fa-chevron-left`) woła `rewindTimeOfDay()` od razu, bez pytania; działa też w incydencie przed Stage 6, gdzie Następna pora dnia jest zabroniona (`incidentHoldsTheHour`, CORE-32). | „Pytanie z Anuluj domyślnym przed cofnięciem (z opisem skutku, por. EXP-GM-13) i bramka incydentu przed Stage 6 jak dla Następnej pory dnia.” Musi: (1) `rewindTimeOfDay` odmawia przy `incidentHoldsTheHour()` z `DRPG.Clock.rewindDuringIncident` (każda droga: HUD, API, konsola), przed `cancelGather`, tak jak odmowa Eclipse; (2) strzałka HUD pyta przez wzorcowe potwierdzenie cofnięcia (EXP-GM-13) z opisem: z jakiej pory na jaką, czy wraca dzień i sesja, i czy budżety, Search Tokeny i pieczęcie wrócą (`takeBackFor` młodsze niż `TAKE_BACK_MS`) albo nic poza zegarem; Anuluj i zamknięcie okna nic nie robią. Chevron przyciemniony w incydencie przed Stage 6 z tym samym powodem w podpowiedzi (jak chevron Eclipse czyta `startRefusalOf`). | Tier 1: R9039 (bramka incydentu w `rewindTimeOfDay`, przed `cancelGather`), R9040 (strzałka pyta, Anuluj domyślny, opis skutku z `takeBackFor`). Tier 2: `E132 DAY-02 - the rewind asks first and is refused inside an incident before Stage 6`. Brak kontroli Forge. | hud.mjs, clock.mjs, boundary.mjs (eksport `incidentHoldsTheHour` jest), lang (`DRPG.Clock`, `DRPG.Hud`), gm-handbook 4 PL i EN, tests-tier1/2 |
| EXP-GM-13 | Cofnięcia nie pokazują przed wykonaniem, co cofną: strzałka (DAY-02) cofa od razu, Stan "Żyje" w oknie Uczniowie cofa śmierć po Zastosuj (`applyAliveStates` -> `reviveCharacter`). | „Opis skutku w potwierdzeniu przed każdym cofnięciem (Stan "Żyje" w oknie Uczniowie; strzałka razem z DAY-02).” Musi: jedno wzorcowe potwierdzenie cofnięcia - nowy plik `scripts/undo-confirm.mjs` z `confirmUndo({ title, effects: string[], yesLabel })` na ramie kitu (`drpgWindow`, Anuluj po lewej i domyślny, jak `noFirst` w `boundary.mjs`); używają go strzałka (DAY-02) i Zastosuj w oknie Uczniowie, gdy którykolwiek uczeń przechodzi z "Nie żyje"/"Nie znaleziono" na "Żyje": lista uczniów i skutków, które naprawdę robi `reviveCharacter` (przeczytaj ją i opisz to, co zapisuje: żeton, Widz, Monocub, głos), Anuluj nic nie zapisuje (także innych zmian z tego Zastosuj). | Tier 1: R9041 (`confirmUndo` - Anuluj domyślny, zamknięcie = nie), R9042 (Zastosuj z "Żyje" pyta przed `reviveCharacter`, Anuluj nic nie zapisuje). Tier 2: `E132 EXP-GM-13 - Alive asks with what the revive does, Cancel writes nothing`. Brak kontroli Forge. | undo-confirm.mjs (nowy), gm-students.mjs, hud.mjs, clock.mjs, lang, gm-handbook 3 (okno Uczniowie) i 4 PL i EN |
| DAY-06 | GM B naciska zegar (strzałka Eclipse, Dalej) przy otwartej rundzie innego rodzaju GM-a A: `openRoundOnPrimary` odmawia "another readiness round is open", a B czyta ogólne "Prośba ... nie została wykonana. Teraz nie możesz tego zrobić." S4 C3 potwierdził. | „Komunikat nazywa GM-a i rodzaj otwartej rundy oraz drogę wyjścia: Dalej w panelu dołącza do rundy, jej Anuluj ją kończy.” Musi: odmowa dostaje własny kod `roundOpen` (`REASONS`, `REASON_PATTERNS`, `DRPG.Bridge.why.roundOpen`, R164 musi go przyjąć); wołający (`askReadiness` w `boundary.mjs`) przy tej odmowie czyta `readyRecord()` (ustawienie świata, każdy klient je ma) i mówi `DRPG.Ready.otherRoundOpen` "GM {gm} pyta właśnie graczy, czy są gotowi ({kind}). Żeby dołączyć, naciśnij Dalej w panelu GM-a; Anuluj w oknie tej rundy ją kończy." (`sayRefused: false` dla tej prośby, żeby nie było dwóch komunikatów); linia Dalej (`nextStep`/`nextLineHtml`) przy otwartej rundzie innego GM-a nazywa tego GM-a. Sprawdź w kodzie, że "Dalej" naprawdę dołącza (`openRoundOnPrimary`: ten sam rodzaj -> `reply.round = open`) i że "Anuluj" w oknie rundy ją kończy; jeśli któreś nie jest prawdą, tekst mówi to, co jest. | Tier 1: R9043 (kod `roundOpen` i jego wzorzec), R9044 (komunikat z GM-em i rodzajem z `readyRecord`). Tier 2: `E132 DAY-06 - a second GM's press during another kind of round is told whose round and how to join`. Forge: `s4-two-gms-at-once` C3. | boundary.mjs, bridge-guards.mjs, gm-panel.mjs (`nextStep`, `nextLineHtml`), lang (`DRPG.Ready`, `DRPG.Bridge.why`), tests-tier1/2 |
| DAY-05 | Search, któremu ostatni Search Token zabrał w tej samej chwili inny gracz: `SearchTokens.claim` odmawia "empty", `unclaimedOutcome` daje `pickedClean` "W pokoju nie było już wtedy Search Tokenu. Akcja przepada." i `refund: false`, choć sprawdzenie przed rzutem (`SearchTokens.left(room, scene) > 0` w `performSearch`) przepuściło. | „Oddać akcję przy przegranym wyścigu o token (jak Tail, gdy rzut nie dał Hope); handbook gracza 3.” Musi: `performSearch` zapamiętuje, że przed rzutem ta przeglądarka widziała wolny token; `unclaimedOutcome(why, left, { sawFree })` przy przegranym wyścigu daje nowy tekst `DRPG.SearchTokens.lostRace` "Ktoś zabrał ostatni Search Token tego pokoju w tej samej chwili." i `refund: true`; zwrot idzie przez `giveBackAfterRoll(actor, paid, [roll])`, który sam stosuje regułę zwrotu po rzucie (cena wraca tylko tam, gdzie pozwala `mayRefundAfterRoll` - np. bez Hope z rzutu), a gracz czyta, czy akcja wróciła. Pokój przeszukany do cna przed rzutem dalej jest odmawiany przed ceną (`DRPG.SearchTokens.exhausted`). Komentarz "Hope generator" nad `claim` przepisany na nową regułę. | Tier 1: R9045 (`unclaimedOutcome` czysta: przegrany wyścig -> zwrot, pusty pokój bez `sawFree` -> bez zwrotu). Tier 2: `E132 DAY-05 - a Search that lost the last token's race gets its action back by the after-roll rule`. Brak kontroli Forge. | action-search.mjs, search-tokens.mjs (jeśli potrzebny powód odmowy), lang (`DRPG.SearchTokens`), player-handbook 3 (Search Tokens) PL i EN, tests-tier1/2 |
| DAY-10 (nit) | Search "coś konkretnego" za postać rzucany przez drugiego GM-a, którego karta nie została wysłana: `SearchTokens.giveBack` zwraca null poza głównym, więc token pokoju nie wraca. | „Oddanie tokenu także dla drugiego GM-a (przez głównego).” Musi: na drugim GM-ie gałąź `if (!sent)` w `searchSpecific` prosi głównego o zwrot. Najpierw sprawdź, czy spend drugiego GM-a idzie przez most z wpisem w księdze (`handedOut`, `runSpend` z `ctx.requestId`): jeśli tak - użyj istniejącego `searchTokens.returnToken` z `spendRequestId` tej prośby; jeśli nie - nowa akcja mostu tylko dla GM-ów (`gmOnly`), zgodnie z trust-model.md, z wierszem w 33-bridge-paths. | Tier 1: R9046. Tier 2: `E132 DAY-10 - a second GM's unsent specific Search gives the room's token back through the primary` (harness: gm2 w scenariuszu albo test na drodze mostu). Brak kontroli Forge. | action-search.mjs, search-tokens.mjs, bridge-asks.mjs, tests-tier1/2 |
| DAY-09 | Shut the Door przy cudzej barykadzie w tym samym pokoju: `shutShutWhy` (action-listen.mjs) nie zna barykady, więc wiersz jest czynny, akcja płacona i rzucana, a `shutRefusal` (doors-gm.mjs) odmawia po rzucie "that cannot be done now" -> ogólne "Teraz nie możesz tego zrobić." | „Wyszarzyć wiersz przed ceną z powodem, gdy w pokoju stoi cudza barykada (odmowa po rzucie zostaje tylko przy nieznalezionym ciele); handbook gracza 4.” Musi: `shutShutWhy` czyta publiczną flagę pokoju (`roomBarricaded` w movement.mjs - jedyny czytelnik flagi) i wyszarza wiersz `DRPG.Infiltrate.shut.whyBarricaded` "W tym pokoju stoi już barykada." Autor barykady jest tajemnicą GM-ów (`barricadeStore`): przeglądarka gracza go nie zna. Przeczytaj, co robi Shut the Door autora we własnym zabarykadowanym pokoju (`shutRefusal` go przepuszcza); jeśli nic nie zmienia (barykada już stoi) - wyszarzaj przy każdej barykadzie; jeśli coś daje, potrzebna jest dana, którą zna tylko właściciel postaci, i zapisujesz, jaką wybrałeś. Odmowa po rzucie przy barykadzie postawionej w międzyczasie mówi swój powód (`DRPG.Infiltrate.shut.whyBarricaded`, kod `barricaded` istnieje w `REASONS`), nie ogólne "Teraz nie możesz". | Tier 1: R9047 (`shutShutWhy` przy fladze barykady), R9048 (odmowa po rzucie z własnym powodem). Tier 2: `E132 DAY-09 - Shut the Door is greyed before its price where a barricade stands`. Brak kontroli Forge. | action-listen.mjs, doors-gm.mjs, bridge-asks.mjs (`requestDoorShut` - tylko odczyt powodu), lang (`DRPG.Infiltrate.shut`, na końcu obiektu), player-handbook 4 (Shut the Door) PL i EN, tests-tier1/2 |
| PRIM-01 | Nie widać, kto jest głównym GM-em; handbook 20.7 każe sprawdzić najniższe id, którego nie ma w interfejsie. S2 J2 i S3 D2 czerwone. | „Linia w panelu GM-a "Główny GM: {name}" i zdanie w handbooku 20.7.” Musi: `buildPanelContent` rysuje na górze bloku stanu `<p class="drpg-gmp-primary" data-drpg-primary="{id}">` z `DRPG.Panel.primaryGm` "Główny GM: {name}" (i "(ty)" na jego własnym ekranie), z podpowiedzią, co główny prowadzi; panel odświeża ją na `drpgPrimaryChanged` (PRIM-02). Handbook 20.7: wiersz "Despair Call albo decyzja nic nie zrobiły" mówi, że główny jest na górze panelu, nie "najniższe id". | Tier 1: R9049 (linia w treści panelu, imię z `primaryGmId()`). Forge: `s2-second-gm` J2 (oba GM-y), `s3-disconnects` D2. | gm-panel.mjs, utils.mjs (tylko odczyt), lang (`DRPG.Panel`), gm-handbook 3 i 20.7 PL i EN, tests-tier1 |
| PRIM-02 | Rola głównego przechodzi bez słowa: przy odejściu głównego GM2 przejmuje po 0,3-0,8 s (S3, S5) i nic nie wie; po powrocie GM1 rola wraca od razu. | „Poprawić: powiadomienie GM-ów przy przejęciu i oddaniu roli głównego. Czy rola ma zostawać u przejmującego do końca sesji (zmiana primaryGmId dotyka całej automatyki), triage nie rozstrzyga - do potwierdzenia przed zmianą reguły.” Musi: (1) nowy obserwator w `gm-bridge.mjs`: każdy klient GM-a liczy `primaryGmId()` po `userConnected`, `bridge.gmReady` i zmianie roli użytkownika i przy zmianie woła `Hooks.callAll("drpgPrimaryChanged", { from, to })`; (2) GM, który został głównym, czyta `DRPG.Panel.primaryNowYou` "Jesteś teraz głównym GM-em: twoja przeglądarka prowadzi automatykę stołu (głos, rzuty graczy, audyt arkuszy, mgłę). Nie zamykaj tej karty przeglądarki."; pozostali GM-owie `DRPG.Panel.primaryNow` "Głównym GM-em jest teraz {name}."; GM, który przestał być głównym, `DRPG.Panel.primaryBack` "Głównym GM-em jest znowu {name}. Twoja przeglądarka już nie prowadzi automatyki."; powiadomienie przez `showPopup` (zostaje w historii), raz na zmianę; nic u graczy; (3) **reguła wyboru bez zmian** (rola wraca do gotowego pełnego GM-a o najmniejszym id) - pytanie do właściciela w raporcie. | Tier 1: R9050 (obserwator: zmiana `from/to` raz, bez powiadomienia przy braku zmiany), R9051 (tekst u przejmującego, u pozostałych i u oddającego; nic u gracza). Tier 2: `E132 PRIM-02 - the GM who takes the table over is told, and so is the one who hands it back` (97-two-gms ma `makePrimary`). Forge: `s3-disconnects` D1 (ma przejść), F1 (zostaje czerwone, dopóki właściciel nie zdecyduje o zostawaniu roli - zapisz to), `s5-voice` "primary returns" (notatka). | gm-bridge.mjs, utils.mjs, bridge-guards.mjs (tylko jeśli obserwator potrzebuje `primaryLeft`), lang, gm-handbook 6.3 (akapit Główny GM) i 20.7 PL i EN, tests-tier1/2, 97-two-gms |
| PRIM-03 | Po F5 głównego jego `userConnected(true)` przychodzi wiele sekund przed `ready`; `primaryGmId` liczy `u.active`, więc wszyscy uznają go za głównego, a on nie słucha: hooki automatyki (głos, pułapki, wejście do pokoju z ciałem, przejście) nikt nie wykonuje. S3 C1: 17,1 s bez słuchającego głównego. | „Wybór głównego liczy tylko GM-ów gotowych (sygnał bridge.gmReady), nie samych połączonych; zdarzenia z tego okna odtworzyć przy ready.” Kształt w 2.2: rejestr gotowości w `utils.mjs`, GM połączony po wczytaniu tego klienta jest "wczytujący się" do swojego `bridge.gmReady` (albo do `TIMING.gmReadyWaitMs`), GM-owie słyszą `bridge.gmReady` (dziś słuchają go tylko gracze), `primaryGmId` liczy tylko gotowych; okno znika, bo drugi GM zostaje głównym do gotowości pierwszego; przy zmianie głównego głos przelicza plan (jeden hook w `voice.mjs`). | Tier 1: R9052 (`primaryGmId` czysta na liście z GM-em połączonym i niegotowym: wybiera gotowego), R9053 (GM aktywny w chwili wczytania tego klienta liczy się jako gotowy; `arriving` jak dziś), R9054 (bez gotowego pełnego GM-a: Asystent jak dziś; żaden - null), R9055 (granica `gmReadyWaitMs`). Tier 2: `E132 PRIM-03 - while the reloading primary loads, the other GM answers for the table`. Scenariusze harness: `97-two-gms` A3 (główny po przeładowaniu znów główny), `17-assistant`, `33-bridge-paths`, `61-gmstore-case`, `62-investigation` - bez regresji. Forge: `s3-disconnects` C1, C3; `s5-voice` "primary leaves" (VOICE-05, PRIM-03). | utils.mjs, gm-bridge.mjs, bridge-guards.mjs (`primaryLeft`, ponowienia), voice.mjs (jeden hook), config.mjs (`TIMING.gmReadyWaitMs`), tests-tier1/2 i każdy test, który zakłada, że połączony GM jest od razu głównym |
| PRIM-04 | `runHealthCheck` (gm-stores.mjs) wraca od razu, gdy `!isPrimaryGm()`; biegnie tylko u głównego przy wczytaniu i po przywróceniu. Drugi GM, także po przejęciu roli, nie dostaje czerwonej ramki z handbooka 3. | „Sprawdzenie także u drugiego GM-a i przy przejęciu roli głównego.” Musi: na drugim GM-ie sprawdzenie biegnie cicho (`gmStoreHealth` -> `setLastHealth`, czerwona linia w panelu, bez okna Przywróć/Kontynuuj, bez decyzji Mastermind - te zostają głównego); na `drpgPrimaryChanged` z `to === game.user.id` biegnie pełne sprawdzenie głównego. Nie dublować powiadomienia o pustym planerze, które dopisuje T4 (FORGE-01): czerwona linia tak, osobne powiadomienie nie. | Tier 1: R9056 (sprawdzenie na nie-głównym ustawia `caseWarning` bez okna), R9057 (przejęcie roli uruchamia pełne sprawdzenie). Brak kontroli Forge. | gm-stores.mjs (nowy blok na końcu definicji), gm-panel.mjs (bez zmian, jeśli `caseWarning` wystarcza), gm-handbook 3 PL i EN, tests-tier1 |
| PRIM-08 | Dziennik debugowania (`openFailureLog`) jest tylko tej przeglądarki; odmowy przekazanych próśb i automatyka są w dzienniku głównego, drugi GM tego nie wie. | „Podpowiedź w Dzienniku debugowania i w handbooku 20.7, że wpisy automatyki i przekazanych próśb są w dzienniku głównego GM-a {name}.” Musi: na nie-głównym GM-ie okno pokazuje nad listą `DRPG.Failures.elsewhere` "Wpisy automatyki stołu i odmowy próśb przekazanych głównemu GM-owi są w Dzienniku debugowania głównego GM-a, {name}."; na głównym nic. | Tier 1: R9058. Brak kontroli Forge. | gm-panel.mjs (`openFailureLog`), lang (`DRPG.Failures`), gm-handbook 20.7 PL i EN |
| PRIM-09 | Safeword: pauzę włącza tylko przeglądarka głównego (`createChatMessage` w `registerSafeword`: `game.user.isGM && isPrimaryGm() && !game.paused`); w oknie z PRIM-03 gra nie staje, drugi GM dostaje tylko notkę. | „Pauza z przeglądarki drugiego GM-a, gdy główny nie słucha (podwójna pauza jest nieszkodliwa, !game.paused).” Musi: pauzuje każda przeglądarka GM-a, która zobaczy kartę safeword i `!game.paused`; komentarz "Exactly one client pauses" przepisany na nowy powód (podwójne `togglePause(true)` nie przełącza z powrotem - sprawdź to w kodzie Foundry, który ma harness, albo zapisz jako LIVE do pomiaru na v14). Karta publiczna nadal od głównego (`hearSafeword`); po PRIM-03 główny to zawsze ktoś gotowy. | Tier 1: R9059 (warunek pauzy bez `isPrimaryGm`). Tier 2: `E132 PRIM-09 - a safeword pauses the game on a GM who is not the primary`. Brak kontroli Forge. | safeword.mjs, tests-tier1/2; gm-handbook 19 (jedno zdanie, jeśli mówi o głównym) |
| EXP-GM-01 (major) | Moduł ukrywa listę graczy Foundry wszystkim, także GM-om (`#players` w danganronpa.css), a okno Uczniowie i panel nie mają kolumny połączenia. S2 J1 na obu GM-ach czerwone. | „Lista podłączonych w panelu GM-a, widoczna tylko dla GM-ów.” Musi: `buildPanelContent` rysuje pod linią Główny GM listę kont graczy (nie GM-ów) z `data-drpg-connected="yes|no"` i słowami `DRPG.Panel.connected` "połączony" / `DRPG.Panel.notConnected` "niepołączony" oraz postacią, którą konto prowadzi; odświeżana na `userConnected` (`keepPanelFresh`); w oknie Uczniowie kolumna Połączenie dla właściciela ucznia. Panel i okno są tylko GM-a, więc u gracza nic się nie zmienia (sprawdź, że `#players` dalej ukryte dla gracza). Blok CSS na końcu `styles/danganronpa.css` z komentarzem `/* T2 ... */`. | Tier 1: R9060 (lista w treści panelu z `game.users`), R9061 (kolumna w `aliveTableHtml`). Tier 2: `E132 EXP-GM-01 - a GM sees who is connected in the panel and Students`. Forge: `s2-second-gm` J1 (oba GM-y). Po CSS: `node tools/check.mjs css`, `contrast`. | gm-panel.mjs, gm-students.mjs, styles/danganronpa.css, lang (`DRPG.Panel`), gm-handbook 3 PL i EN, tests-tier1/2 |
| EXP-GM-17 | Okno Uczniowie i panel nie pokazują pokoju ucznia ani tego, czy czeka na GM-a. | „Kolumny pokoju i "czeka na GM-a" w oknie Uczniowie.” Musi: w `aliveTableHtml` kolumna Pokój (pokój, w którym GM widzi ucznia: `gmPlaceOf`, "-" bez pokoju) i kolumna Czeka (liczba nierozstrzygniętych kart decyzji tego ucznia, z tego samego odczytu, którym Oś czasu buduje "Czeka na decyzję" w `messenger-gm.mjs` - wydziel go do eksportowanej funkcji czystej, nie licz drugi raz inaczej); wiersz Monokumy i NPC puste komórki, jak dziś; okno odświeża się na zmianę kart. Panel: bez nowych kolumn w `rosterTableHtml`, chyba że zmieszczą się bez przesunięcia układu (zasada właściciela z 10.11: stan zmienia wygląd, nie układ). | Tier 1: R9062 (kolumny i źródło liczby). Brak kontroli Forge. | gm-students.mjs, messenger-gm.mjs (wydzielenie odczytu), gm-panel.mjs (tylko jeśli panel), lang (`DRPG.Panel`), gm-handbook 3 PL i EN, tests-tier1 |
| EXP-GM-06 | `setActions` przycina do `actionsMax`; `grantFreeActions` (akcje ponad maksimum) nie ma przycisku. | „Przycisk dania akcji ponad maksimum (grantFreeActions) w oknie Uczniowie albo w nagłówku arkusza; handbook GM-a.” Musi: w oknie Uczniowie, w komórce Akcje żyjącego ucznia, przycisk `DRPG.Panel.grantAction` "+1 ponad maksimum" (`iconButton`, podpowiedź z wyjaśnieniem, że to akcja nagrodowa do końca pory dnia) wołający `grantFreeActions(actor, 1, { reason })`; sprawdź w `sheet-audit.mjs`, jaki `reason` przyjmuje zapis GM-a, i użyj istniejącego (albo dopisz z uzasadnieniem); po naciśnięciu komórka pokazuje "+N" jak panel (`freeActionsLeft`). | Tier 1: R9063 (przycisk w wierszu, droga `grantFreeActions`). Tier 2: `E132 EXP-GM-06 - a GM grants an action above the maximum from Students`. Brak kontroli Forge. | gm-students.mjs, actions.mjs (bez zmiany logiki, jeśli `grantFreeActions` wystarcza), sheet-header.mjs (nie, jeśli okno Uczniowie wystarcza), lang, gm-handbook 5 PL i EN |
| EXP-GM-07 | GM rzucający akcję za ucznia nie zostawia znaku "rzucił GM" na karcie ani w Osi czasu (jedyny znak `TRAIT_BY_GM` dotyczy statystyki). Rzuty graczy losuje i tak główny GM (E28), więc autor wiadomości nie odróżnia tych przypadków. | „Oznaczenie "rzucił GM {name}" na karcie rzutu i w Osi czasu.” Musi: gdy akcję ucznia, którego właścicielem jest gracz, uruchamia przeglądarka GM-a (`performAction` na GM-ie), karta wyniku i rzutu dostaje flagę z id tego GM-a, ustawioną w miejscu startu akcji (nie z autora wiadomości), i linię `DRPG.Rolls.rolledByGm` "Rzucił GM {name}." widoczną dla czytelników karty; Oś czasu (`messenger-gm.mjs`) pokazuje ten sam znak przy wpisie. Flaga niesiona przez dokument gracza jest ignorowana (trust model: pole w pakiecie to twierdzenie), liczy się tylko zapis GM-a. | Tier 1: R9064 (flaga od GM-a, linia na karcie, flaga z dokumentu gracza zignorowana). Tier 2: `E132 EXP-GM-07 - an action a GM runs for a student says so on its card`. Brak kontroli Forge. | action-pipeline.mjs, private-rolls.mjs, messenger-gm.mjs, lang (`DRPG.Rolls`, nowy klucz na końcu obiektu), tests-tier1/2 |
| EXP-GM-14 | Drugi GM nie dowiaduje się, co zmienił pierwszy (dany Truth Bullet, zmiana Stanu, ręczna korekta puli): szepty do GM-ów nie wyskakują (`onCreateChatMessage` w popup.mjs zatrzymuje szept bez `gmPopup`), Oś czasu zbiera tylko to, co pokazała ta przeglądarka. | „Krótkie powiadomienie (albo wpis w Osi czasu) u pozostałych GM-ów o takich zmianach.” Musi: jedna funkcja w `popup.mjs` (np. `tellOtherGms(key, data)`), która szepcze GM-om krótką kartę z `gmPopup` i nie rysuje jej na przeglądarce, która ją wysłała (autor = `game.user`); wołana po: Daj w `gm-items.mjs` (jedno wywołanie po udanym daniu; T3 zmienia tę funkcję - dopisz po scaleniu albo jako wywołanie na końcu, opisane w gałęzi), Zastosuj w oknie Uczniowie (zmiana Stanu), ręczna korekta puli Despair (jedno wywołanie w drodze GM-a w `despair.mjs` - plik spoza listy, wymień w opisie gałęzi). Treść: kto, co, komu, bez tajemnic, których drugi GM i tak nie zna (to GM-owie). | Tier 1: R9065 (karta z `gmPopup`, nie rysowana u nadawcy). Tier 2: `E132 EXP-GM-14 - the other GM is told of a Truth Bullet given, a state changed, a pool corrected`. Brak kontroli Forge. | popup.mjs, gm-items.mjs, gm-students.mjs, despair.mjs (jedno wywołanie), messenger-gm.mjs, lang, tests-tier1/2 |
| EXP-GM-16 (nit) | Wynik rzutu gracza dochodzi do GM-a jako szept w logu bez karty; dymki czatu są ukryte; przy zwiniętym czacie GM ma tylko kości 3D. | „Karta albo powiadomienie z wynikiem rzutu u GM-ów (np. w Osi czasu).” Proponowane: wpis w części "Na bieżąco" Osi czasu u każdego GM-a dla rzutu akcji gracza (postać, akcja, wynik i Hope/Despair), bez wyskakującej karty (cztery rzuty naraz to cztery karty w rogu; czy chce kart, pytanie do właściciela). | Tier 1: R9066 (wpis Osi czasu dla rzutu gracza). Brak kontroli Forge. | messenger-gm.mjs, private-rolls.mjs, popup.mjs (tylko jeśli potrzebne), lang |
| EXP-PL-09 | Gracz nie ma miejsca na notatki tylko dla siebie: Notatkę w komunikatorze czytają GM-owie (`DRPG.Note.intro`), dzienników nie ma (pasek boczny ukryty). | „Miejsce na prywatne notatki gracza; handbook gracza (1014).” Proponowane: trzecia zakładka komunikatora gracza **Moje notatki** (`DRPG.Note.privateTab`), pole tekstowe zapisywane w nowym ustawieniu `privateNotes` o zasięgu `client` (tylko ta przeglądarka, nigdy wysyłane socketem ani do GM-ów); handbook mówi uczciwie, że notatka zostaje w tej przeglądarce i nie przejdzie na inny komputer. Zasięg `user` (na serwerze świata, idzie za graczem, ale GM z dostępem do danych świata może ją odczytać) - tylko po decyzji właściciela, pytanie w raporcie. Limit długości jak Notatka. | Tier 1: R9067 (zakładka, zapis w ustawieniu klienta, żadnego pakietu). Tier 2: `E132 EXP-PL-09 - a player's private note is kept on this browser and reaches no GM`. Brak kontroli Forge. | messenger-app.mjs, settings.mjs (nowe `register` na końcu swojej grupy), lang (`DRPG.Note`), player-handbook 14 PL i EN, tests-tier1/2 |

### 2.1 CALLS-01 i EXP-GM-05 - przejęcie karty

1. `claimOnPrimary(messageId, step, by)` dostaje krok `"takeover"` (i `card.claim` w `bridge-table.mjs`:
   `step: as.oneOf("take", "done", "drop", "takeover")`, opis w `claims` uzupełniony). "takeover" przyjmowany tylko wtedy,
   gdy karta jest zajęta przez innego GM-a (`claimsInProgress` albo wiersz `pending`) i nie jest rozstrzygnięta; zapisuje
   `claimsInProgress.set(messageId, by)` i wiersz `{ by, at, pending: true, from: <poprzedni> }`. Odpowiedź jak "take".
2. Zajęcie wygasa: wiersz `pending` (i wpis w `claimsInProgress`) starszy niż `TIMING.claimHoldMs` liczy się jako wolny
   w "take" i w `underClaim`. Proponowana wartość **120 s**: mniej niż zegar gracza (`rulingMs` 180 s), więc po wygaśnięciu
   zostaje minuta na decyzję innego GM-a; S2 B mierzy do 150 s. To wybór, nie pomiar - komentarz przy stałej mówi to wprost
   i podaje LIVE do zmierzenia przy stole (ile trwa decyzja GM-a). Wygasłe zajęcie zwalnia też czekające wygaśnięcie karty
   (`expiryAfterClaim`).
3. Stary posiadacz: główny po przejęciu wysyła mu pakiet (GM -> GM, sprawdzany po `senderId` głównego), jego przeglądarka
   zamyka okno decyzji tej karty (rozstrzygnięcie okna to null -> reguła zwraca null) i pokazuje
   `DRPG.Bridge.claimTakenOver` "Kartę przejął GM {gm}. Twoje okno tej karty zostało zamknięte; nic z niego nie poszło."
   Dodatkowo, niezależnie od pakietu: decyzje, które idą przez głównego (`yesOnPrimary`, `dynamicOnPrimary`,
   `observePickOnPrimary` - mają `by`), są odrzucane, gdy `claimsInProgress.get(messageId) !== by`; reguły, które działają
   bez głównego (`rulePickTrait`, `ruleCubHope`, efekt przedmiotu, odpowiedzi Search/Observe), przed swoim skutkiem pytają
   głównego krokiem sprawdzającym (np. `"check"` w `claimOnPrimary`, odpowiedź `{ held: by === holder }`) albo sprawdzają
   lokalny znak przejęcia - wybierz jedno i zastosuj do każdej reguły `CARD_ACTIONS`, która ma okno. "done" i "drop" starego
   posiadacza nic nie zapisują (dziś `own` już to trzyma - test to mierzy).
4. GM B: `claimCard` przy `why === "busy"` innego GM-a nie mówi już tylko `claimBusy`, tylko pyta (`drpgWindow`, Anuluj
   po lewej i domyślny) `DRPG.Bridge.takeOverAsk` "Tę kartę rozstrzyga GM {gm} od {time}. Przejąć ją? Jego okno tej karty
   zostanie zamknięte." z przyciskiem `data-action="take"` (`DRPG.Bridge.takeOver` "Przejmij"); tak -> "takeover" -> praca
   reguły biegnie u B od razu. Przycisk Przejmij na karcie (EXP-GM-05) tylko przejmuje zajęcie i zamyka okno A, bez
   otwierania okna decyzji; B naciska potem przycisk decyzji jak zwykle. Pytanie przy naciśnięciu zajętej karty to droga,
   którą mierzy S2 B1 (kit naciska w oknie bez tytułu przycisk `yes`, `take`, `takeOver`, `takeover`, `confirm` albo `ok`,
   a potem oczekuje okna trudności).
5. Handbook GM-a 6.3 (akapit "Jedna decyzja na kartę"): znak "Rozstrzyga GM ...", Przejmij, samoczynne zwolnienie po 2
   minutach (albo wartości, którą przyjmiesz), co się dzieje z oknem poprzedniego GM-a.

### 2.2 PRIM-03 - główny to gotowy GM

1. `utils.mjs`: rejestr gotowości GM-ów tej przeglądarki (np. `gmLoading: Map<id, sinceMs>`), funkcje `markGmLoading(id)`,
   `markGmReady(id)`. `primaryGmId({ arriving, leaving, users })` liczy pełnego GM-a jako obecnego, gdy
   `(u.active && !loading(u.id)) || u.id === arriving`; to samo dla puli Asystentów. Sygnatura i wszyscy wołający bez zmian
   (ponad 1200 odwołań do `isPrimaryGm`/`primaryGmId` - zmiana tylko w środku). GM jest "wczytujący się" od
   `userConnected(user, true)` widzianego przez tę przeglądarkę do jego `bridge.gmReady`, najdłużej `TIMING.gmReadyWaitMs`
   (proponowane 90 s: S3 zmierzył 22,6 s do gotowości, S5 logowanie 30,7-41,9 s i rolę z powrotem po 33,8-51,7 s; po
   granicy liczy się jako gotowy, żeby zgubiony pakiet nie wykluczał GM-a na zawsze). GM aktywny w chwili wczytania tej
   przeglądarki liczy się jako gotowy (ta przeglądarka nie widziała jego połączenia). Własna przeglądarka GM-a przed swoim
   `registerGmBridge` nie uważa się za główną.
2. `gm-bridge.mjs`: `bridge.gmReady` słyszą teraz także GM-owie (dziś `else game.socket.on(..., onGmReady)` tylko u
   graczy); GM, który go usłyszy, `markGmReady(senderId)` i przelicza głównego (obserwator z PRIM-02). Gracze jak dziś.
   Ponowienia próśb (`resendOnGmReady`) i `drpgPrimaryReady` bez zmian znaczenia.
3. "Zdarzenia z tego okna odtworzyć": przy tej regule okna nie ma - drugi GM jest głównym, dopóki powracający nie będzie
   gotowy, więc słucha hooków automatyki. Zostaje chwila zmiany roli przy `gmReady`: na `drpgPrimaryChanged` nowy główny
   prosi głos o przeliczenie planu (w `voice.mjs` tylko jeden hook wołający istniejące `standDownRoomsKept()` i
   `scheduleReconcile({ force: true })`; nic więcej w plikach głosu - T4). Inne hooki (pułapki, wejście do pokoju z ciałem,
   przejście) - przeczytaj, czy któryś trzyma stan tylko w pamięci starego głównego; jeśli tak, zapisz w raporcie, czego nie
   odtwarzasz i dlaczego.
4. Ryzyko: to zmienia wybór głównego na każdej przeglądarce. Różne przeglądarki mogą chwilę nie zgadzać się (klient wczytany
   w trakcie wczytywania GM1 uzna go za gotowego). Zapisz to w komentarzu nad `primaryGmId` z LIVE (kolejność `userConnected`
   i `ready` na v14 to LIVE-E04-12), zmierz w harness, ile scenariusz 97 i 33 widzą rozjazdu. Puść całe tiery 0-1 i
   scenariusze 17, 33, 61, 62, 97 przed commitem, nie dwa.

### 2.3 EXP-PL-12 + CALLS-09 + DAY-07 - gracz widzi stan, czas i może wycofać

1. `popup.mjs` `showWaiting(text, title, { expires = null, onWithdraw = null, requestId = null } = {})`: okienko pokazuje
   "Zostało {time}" (`data-drpg-expires`), przycisk **Wycofaj** (`DRPG.Bridge.withdraw`), a stan zmienia się na
   `DRPG.Bridge.askRuling` "GM czyta twoją prośbę." po pakiecie stanu i z powrotem na tekst czekania po zwolnieniu.
   Wywołujący: `calls.mjs` `showWaitingCard`, `action-dynamic.mjs` `performDynamic`, `trait-ruling.mjs` `askGms`; czas z
   `timeoutMs` prośby (`TIMING.rulingMs`, Call `hopeCallRulingMs`) liczony od jej wysłania. Karta prośby w wątku gracza
   dostaje tę samą linię stanu, rysowaną lokalnie (karta to dokument gracza - nie zapisujesz dokumentu).
2. Pakiet stanu: główny po "take", "takeover" i "drop"/wygaśnięciu zajęcia na karcie, dla której trzyma prośbę
   (`heldAskMaps` po `messageId`), wysyła pytającemu `{ rid, state: "ruling" | "waiting" }`; gracz przyjmuje go tylko od
   `primaryGmId()` (po `senderId`), a `rid` musi być jego czekającą prośbą. Bez imienia GM-a w pakiecie.
3. Wycofaj: lokalnie czekacz (`createWaiter` w `bridge-guards.mjs`) dostaje `cancel(requestId)` - zamyka wpis bez
   `notDone`, z `nothingSpent`, a wołający dostaje wynik "wycofane" i mówi `DRPG.Bridge.withdrawn` "Prośba wycofana. Nic nie
   zostało wydane."; potem pakiet `ask.withdraw` (`{ rid }`) do głównego: nowa akcja mostu wg `.claude/rules/trust-model.md`
   (nazwa w `bridge-wire.mjs`, `DRPG.Bridge.what.ask.withdraw`, wiersz z `knownSender`, `sanitize: pick({ rid: as.id })`,
   strażnik: `heldAskOf(rid, sender.id)` istnieje, `answer: "none"`, `quiet`), uruchomienie: zdejmuje trzymaną prośbę jak
   `expiredOnPrimary` i kończy kartę `DRPG.Bridge.settledWithdrawn` "Gracz wycofał prośbę." u wszystkich. Decyzja GM-a
   wydana potem trafia w `askNotHeld` (CALLS-14). Sprawdź dla każdej z trzech dróg, że nic nie zostało pobrane przed
   decyzją (Call: Hope po zgodzie; Dynamic: akcja - przeczytaj `performDynamic`; statystyka: cena przed czy po), a jeśli
   coś było - Wycofaj to oddaje istniejącą drogą (`abort`).
4. Wiersz w `audit/harness/scenarios/33-bridge-paths.mjs` i przypadek sfałszowanego `rid` (cudza prośba) w 30-security
   albo w teście tier 1.

### 2.4 DAY-01 - zdanie poranka w magazynie GM-ów

1. `gm-stores.mjs`: nowy magazyn (np. `morningLineStore`, w osobnym bloku na końcu definicji, nazwa klucza magazynu
   nowa), synchronizowany między GM-ami jak inne (`sync: true`); kopia zapasowa sprawy - zdecyduj z `tools/check.mjs` i
   sprawdzeniem zdrowia (PRIM-04), zapisz wybór. Gracze go nie mają (zdanie jest tajne do początku dnia).
2. Jedyna droga: `morningLine()` i `setMorningLine(text, { by })` (eksport z `clock.mjs` albo `gm-stores.mjs`), przycięcie
   do 400 znaków jak dziś. `morningInputs` czyta magazyn; `advanceTimeOfDay` i `clearMorningDraft` czyszczą go po użyciu
   (zapis widzą obaj GM-owie); `eclipse.mjs` przy `undoOpening` oddaje zdanie do magazynu (jedno miejsce); Edytuj kampanię
   (`gm-campaign.mjs`) i Season setup (`season-setup.mjs`, tylko zapis zdania - resztę tego pliku ma T4) czytają i piszą
   magazyn, a pole mówi `DRPG.Clock.morningLineShared` "Wspólne dla GM-ów. Ostatnio zmienił: {gm}." `api.mjs`: na końcu
   obiektu API `setMorningLine` i `morningLine` (scenariusze Forge i harness piszą przez nie).
3. `migrate.mjs`: krok na końcu listy kroków, z własnym numerem i wersją (T4 scalany pierwszy wstawia bramkę D2-13 - Twój
   krok musi przez nią przechodzić jak inne): na każdej przeglądarce GM-a niepusty `morningLineDraft` przechodzi do
   magazynu, gdy magazyn jest pusty, potem szkic klienta jest czyszczony. `SETTINGS.morningLineDraft` zostaje
   zarejestrowane tylko dla tego kroku (komentarz: do usunięcia po 2.0), nikt inny go nie czyta (R9037).
4. Handbook GM-a 4 (akapit o planszy "Dzień N", zdanie "przy dwóch GM-ach to zdanie GM-a, który przesuwa zegar"): teraz
   zdanie jest jedno, wspólne, widoczne i edytowalne u obu GM-ów, użyte przez tego, kto przesuwa zegar, i czyszczone.

---

## 3. Metoda (docs/dev/METHOD.md, jak praktykowana)

1. **Przygotowanie.** `git checkout -b claude/v2-t2 origin/claude/dazzling-bohr-juuh4g`; `cd audit/harness && npm ci`;
   pierwszy `npm run quick` i `node run-tests.mjs --tier 1` na czystym drzewie - zapisz wynik bazowy (liczby i czas).
2. **Czerwone najpierw.** Dla każdej pozycji najpierw test (numer R z zakresu, sekcja 4; test tier 2 nazwany `E132 <ID> -
   ...`), uruchomiony na drzewie bez zmiany. Ma nie przejść, i to z powodu, który nazywa pozycja. Commit zawiera test i
   poprawkę razem, a wiadomość cytuje odczyt czerwony (linia błędu testu na 1.2.129) i zielony po zmianie. Pozycja bez
   czego być czerwonym (podręcznik: CALLS-15, INV-10) mówi to w commicie. Test spełnia kontrakt z `.claude/rules/tests.md`
   (mierzy coś; skip tylko z `env.*`/`world.*`; cięcie źródła przez `bodyOf`/`fnSource`; nic prawdziwego z konstrukcji).
   `expectedRed("E132", why)` tylko dla pozycji, której nie skończysz - wtedy w raporcie "nie zrobione" z powodem.
3. **Szybka bramka przed każdym commitem**, z `audit/harness`, wszystkie kroki nawet po czerwonym, i linia podsumowania
   w wiadomości: `QUICK GREEN|RED at <sha>[+edits]: lint/check/gate ok; prose ok; t01 ok; own(N) ok; ...`:
   - `npm run quick` (lint, `tools/check.mjs` wszystkie części, self-test bramki);
   - w katalogu głównym `node tools/config-prose.mjs --check lang/pl.json` ("missing 0, extra 0") i
     `node tools/check.mjs parity`, `prose`, `text`, `budget`;
   - `node run-tests.mjs --tier 1` (tiery 0-1);
   - własne testy tier 2 i powiązane: `node run-tests.mjs --tier 2 --only "E132 <ID>" --only <nazwa powiązanego>` -
     powiązane to te, których źródło nazywa zmienioną funkcję, magazyn, ustawienie albo wiersz mostu (`git grep` w
     `scripts/tests-tier2.mjs`, do ok. 15, wymienione w wiadomości);
   - scenariusze: ten, który commit edytuje, i starsze, które nazywają zmienioną regułę, komunikat albo kod mostu - najwyżej
     dwa (`node run-all.mjs scenarios --only NN`), poza PRIM-03 (sekcja 2.2 pkt 4);
   - po zmianie CSS `node tools/check.mjs css` i `contrast`.
   Jeden harness naraz. Na koniec każdego commita `git status --porcelain` puste.
4. **Jeden commit na pozycję albo ciasną grupę.** Grupy dozwolone: CALLS-01+EXP-GM-05+CALLS-12; DAY-02+EXP-GM-13;
   PRIM-01+PRIM-02; CALLS-15+INV-10 (+zdanie z CALLS-04, jeśli w tym samym akapicie); EXP-GM-01+EXP-GM-17 (kolumny okna
   Uczniowie). Proponowana kolejność (fundament najpierw, bo na wyborze głównego z T2 stoją reguły innych linii):
   PRIM-03 -> PRIM-01+PRIM-02 -> CALLS-06 -> CALLS-02 -> CALLS-01 grupa -> CALLS-14 -> CALLS-05 -> CALLS-03 ->
   EXP-PL-12 grupa -> CALLS-04 -> CALLS-15+INV-10 -> DAY-01 -> DAY-02+EXP-GM-13 -> DAY-06 -> DAY-05 -> DAY-10 -> DAY-09 ->
   PRIM-04 -> PRIM-08 -> PRIM-09 -> EXP-GM-01+EXP-GM-17 -> EXP-GM-06 -> EXP-GM-07 -> EXP-GM-14 -> EXP-GM-16 -> CALLS-07 ->
   EXP-PL-09 -> etap i raport.
5. **Teksty.** Każdy tekst widoczny dla użytkownika w `lang/en.json` I `lang/pl.json` w tym samym commicie (D/E65), klucze
   z `plural()` z `.one`/`.other`, a w PL także `.few`/`.many`. Przed pisaniem przeczytaj `docs/text-style.md` i
   `docs/glossary.json` (nazwy: Hope Call, Despair, Search Token, Eclipse, Stage 6, Truth Bullet, Dynamic Action - jak w
   słowniku). Konsola `diagnostics.mjs` zostaje po angielsku. Myślnik to `-`, nigdy długa kreska, także w komentarzach i
   podręcznikach. Polskie teksty w tej specyfikacji to propozycje - dopasuj je do stylu i budżetów (`docs/text-budgets.json`).
6. **Podręczniki.** Każda zmiana zachowania w `docs/handbooks/*.md`, PL i EN w tym samym commicie, w sekcjach tej linii
   (sekcja 4 niżej). Gdy fakt w `docs/handbook-facts.*.en.json` przestaje być prawdą - poprawiony w tym samym commicie.
7. **Komentarze** w stylu repozytorium: co próbowano, co zmierzono, dlaczego kod ma ten kształt, z datą i ID pozycji
   (np. "(2.0 line T2, CALLS-01, 27.11.2026)"). Komentarz, który przestaje pasować do kodu, poprawiasz w tym samym commicie
   (przykłady: nad `RESENDS`, nad `claimOnPrimary` "A CLAIM UNDER WAY", w `searchUnclaimed` "Hope generator", w safeword
   "Exactly one client pauses", nad `primaryGmId`). Wartości wybrane, nie zmierzone (`claimHoldMs`, `gmReadyWaitMs`) mówią to.
8. **Czego nie robisz:** podbicia wersji (`module.json`, numer 1.2.130 ustawia koordynator), `tools/stages.mjs ship`,
   pliku zwolnienia ani pola zwolnienia, pushu poza `claude/v2-t2`, edycji `CHANGELOG.md` (jest generowany z
   `.github/release-notes/` przez `tools/changelog.mjs`; `check notes` odrzuca ręczną zmianę - tekst do notatek wydania
   idzie do raportu), ręcznego scalania `docs/dev/R-REGISTRY.md` (patrz 4.2).
9. **Etap.** Wstaw do `tools/stages.json` własny wiersz `{"id": "E132", "planned": "1.2.130", "with": "E83", "version":
   null, "shipped": null, "touches": ["sockets", "rolls"], "drills": []}` za wierszem `E83`, przed `E26` (**poprawione 27.11.2026 przy przeglądzie pięciu specyfikacji**: `tools/stages.mjs check` odrzuca wiersz `planned` "1.2.130" za wierszem `E26` ("planned 1.2.130 does not come after the row above's 1.3.0"), dwa wiersze "1.2.130" obok siebie bez `with` i wiersz bez pól `version`/`shipped` - sprawdzone uruchomieniem `node tools/stages.mjs check` na kopii `tools/stages.json` z wierszem dopisanym na końcu, przed `E26` bez `with` i bez `version`/`shipped` (trzy razy czerwone) oraz za `E83` z `with` (zielone); dlatego wiersz stoi bezpośrednio za `E83`, przed `E26`, z `"with": "E83"`, `"version": null` i `"shipped": null`. Przy scaleniu koordynator łańcuchuje wiersze linii w kolejności scalania: `E83` <- `E134` (T4) <- `E132` (T2) <- `E131` (T1) <- `E133` (T3) <- `E135` (T5), każdy `with` = id wiersza nad nim). Id musi mieć postać `E` i 2-3 cyfry
   (`tools/stages.mjs check`: `/^E\d{2,3}$/`), więc przykład z planu nakładania się "E130-T2" nie przejdzie, a E130 to już
   1.2.129 - stąd propozycja T1=E131, T2=E132, T3=E133, T4=E134, T5=E135; koordynator potwierdza przy scaleniu.
   `node tools/check.mjs stages`.
10. **Koniec:** push `claude/v2-t2`; poczekaj na CI (`.github/workflows/ci.yml` na `claude/**`), zapisz w raporcie wynik
    każdego zadania (shardy, scenariusze); czerwone, którego nie naprawisz, opisz z przyczyną.

---

## 4. Numery R i wspólne pliki

### 4.1 Numery

Zakres linii: **R9020-R9119**. Nie wołasz `node tools/registry.mjs --next`, bierzesz kolejne z zakresu (tabela w sekcji 2
rezerwuje R9020-R9067 w kolejności wierszy; jeśli potrzebujesz więcej albo innego podziału - R9068-R9119, a raport podaje
rzeczywiste numery). R8912-R8919 są koordynatora. Testy tier 2 bez numerów, z przedrostkiem `E132`.

### 4.2 Zasady wspólnych plików (z planu nakładania się)

- **Testy:** nowe testy na końcu każdego pliku tieru, w bloku z nagłówkiem `// T2 rulings-bridge-secondgm`, nie między
  istniejącymi. Istniejące testy zmieniasz tylko wtedy, gdy zmieniasz zachowanie, które mierzą (DAY-01: R4475, E101-T12,
  test E110; PRIM-03: testy, które zakładają, że połączony GM jest od razu głównym; CALLS-14: test A11), i wymieniasz je
  w commicie. `docs/dev/R-REGISTRY.md` jest generowany: na swojej gałęzi uruchamiasz `node tools/registry.mjs --write`,
  żeby `check registry` był zielony; przy scaleniu koordynator regeneruje plik zamiast rozwiązywać konflikt. Do
  `audit/harness/skip-baseline.json` nie dodajesz pominięć; jeśli musisz - po id testu i z uzasadnieniem w raporcie.
- **lang/en.json, lang/pl.json:** T2 jest właścicielem przestrzeni `DRPG.Calls`, `DRPG.TraitRuling`, `DRPG.Bridge`,
  `DRPG.Clock`, `DRPG.Hud`, `DRPG.Panel` (linie Główny GM, następny krok, lista podłączonych, okno Uczniowie),
  `DRPG.Assign`, `DRPG.SearchTokens`, Listen (Shut the Door ma teksty w `DRPG.Infiltrate.shut` - nowe klucze na końcu
  tego obiektu, istniejące zmieniasz tylko w nim), `DRPG.Monocub`. Nowy klucz w cudzej przestrzeni
  (`DRPG.Ready`, `DRPG.Failures`, `DRPG.Note`, `DRPG.Rolls`) dopisujesz na końcu tego obiektu i wymieniasz w raporcie.
  Istniejących kluczy cudzych przestrzeni nie zmieniasz.
- **Podręcznik GM-a:** twoje sekcje: 3 Panel GM-a (bez akapitów Diagnostyki - T4), 4 Zegar, 5 Akcje, 6 Hope Calls i
  Despair Calls (bez wiersza i akapitu Motive - T5), 20.7; w 8 tylko akapit Ask for Hope Monocuba (CALLS-07), w 19 jedno
  zdanie (PRIM-09), jeśli potrzebne. **Podręcznik gracza:** 3 Ruch i widzenie (DAY-05), 4 Akcje (DAY-09; akapit Direct
  Murder to T1), 14 Komunikator w całości (CALLS-04, CALLS-15, INV-10, EXP-PL-09, EXP-PL-12). Sekcja 22 (GM) i 17 (gracz),
  dodatki techniczne - tylko gdy ich akapit przestaje być prawdą. Nikt nie przenumerowuje sekcji najwyższego poziomu;
  nowe treści jako podsekcje na końcu własnej sekcji. PL i EN w tym samym commicie.
- **bridge-guards.mjs, bridge-table.mjs, gm-bridge.mjs, 33-bridge-paths.mjs:** T2 właścicielem logiki wyboru głównego i
  ponowień i całego `gm-bridge.mjs`; nowe wiersze mostu na końcu tabeli. T1 i T3 scalają się po tobie i dopasowują do
  nowego wyboru głównego - dlatego `primaryGmId`, `isPrimaryGm`, `primaryLeft` zachowują sygnatury.
- **bridge-asks.mjs:** twoje zajęcie karty, Wycofaj, DAY-09, DAY-10, CALLS-05; ścieżki `observe.resolve/analyze.resolve`
  nie ruszasz (T3).
- **clock.mjs:** twoje `advanceTimeOfDay`/`rewindTimeOfDay` i zdanie poranka; `reconcilePhase`, kroki rozprawy, opłata za
  Klucze, karta startu Investigation - T3.
- **eclipse.mjs:** tylko odczyt i oddanie zdania poranka (jedna funkcja), reszta T1.
- **gm-panel.mjs:** twoje `buildPanelContent` (Główny GM, lista podłączonych), `nextStep`/`nextLineHtml` (DAY-06),
  `rosterTableHtml`/`studentsLeftHtml` (EXP-GM-17, jeśli w ogóle), `openFailureLog` (PRIM-08). `buildSections` i
  kafelki Diagnostyki - T4; `bodyWaiting` i linia Dalej ciała - T1; Napraw głos - T3.
- **gm-students.mjs:** twój (`aliveTableHtml`, `wireAliveTable`, `applyAliveStates`): kolumny Pokój, Czeka, Połączenie,
  przycisk +1 akcji, potwierdzenie "Żyje", powiadomienia. T4 dopisze mikrofon, T5 motywy - osobne komórki i funkcje, więc
  nie przebudowuj `columns` w sposób, który utrudni dopisanie kolumny na końcu.
- **gm-stores.mjs:** własne bloki na końcu definicji (zdanie poranka, ewentualnie zawieszone zajęcia, sprawdzenie u
  drugiego GM-a); istniejących wierszy nie przemianowujesz.
- **messenger-app.mjs, messenger-gm.mjs:** `messenger-app.mjs` twój (karty decyzji, zajęcie, odliczanie, Wycofaj, gmNote,
  prywatne notatki); T1 zmienia tylko bramkę `DRPG.Spectator.noChat`, T4 tylko podgląd wątku Timeline. `messenger-gm.mjs`:
  twoje wpisy Osi czasu (EXP-GM-07, -14, -16) i wydzielony odczyt "Czeka na decyzję" (EXP-GM-17); T3 tylko go czyta.
- **popup.mjs:** twój `gmPopup`/`showWaiting`; T1 i T3 tylko wołają istniejące API (jeśli T3 dopisze "zamknij u
  pozostałych GM-ów", to na końcu pliku - nie koliduje z twoimi zmianami).
- **utils.mjs:** twoje `isPrimaryGm`/`primaryGmId` i gotowość; T4 tylko funkcja oczyszczania HTML opisu (R505).
- **voice.mjs:** jeden hook (PRIM-03, sekcja 2.2 pkt 3). T4 scalany pierwszy - dopasuj się do jego wersji, jeśli koordynator
  przebazuje twoją gałąź.
- **settings.mjs, migrate.mjs:** w `settings.mjs` twoje: wycofanie użycia `morningLineDraft` (rejestracja zostaje dla
  migracji) i `privateNotes`; każdy w swoim `register`, bez przestawiania kolejności. W `migrate.mjs` twój krok na końcu
  listy, z własnym numerem; bramka D2-13 to T4.
- **season-setup.mjs, gm-campaign.mjs:** tylko zapis zdania poranka; wiersze listy kontrolnej (T4) i reset sezonu (T3) nie.
- **actions.mjs, gm-items.mjs, api.mjs:** `actions.mjs` tylko droga przycisku `grantFreeActions` (T1 ma zwrot akcji przy
  Direct Murder - inna funkcja); `gm-items.mjs` jedno wywołanie powiadomienia; `api.mjs` na końcu obiektu.
- **styles/danganronpa.css:** własny blok na końcu pliku z komentarzem `/* 2.0 line T2: ... */`; istniejących reguł nie
  zmieniasz.
- **tools/stages.json, docs/glossary.json, docs/text-budgets.json, docs/handbook-facts.*.json:** własny wiersz etapu
  (E132); w pozostałych dopisujesz klucze (koordynator robi unię).
- **Pliki spoza listy, których ta specyfikacja wymaga** (wymień w raporcie): `config.mjs` (dwie stałe na końcu `TIMING`),
  `bridge-wire.mjs` (stała `ask.withdraw`), `despair.mjs` (jedno wywołanie EXP-GM-14), `undo-confirm.mjs` (nowy),
  `audit/harness/scenarios/97-two-gms.mjs` i `69-day-boards.mjs`, `audit/forge/scenarios/s2-second-gm.mjs` i
  `s1a-day-murder.mjs` (tylko zapis zdania poranka przez nowe API).

**Zasady dopisane przy przeglądzie pięciu specyfikacji (27.11.2026; wiążą tak samo jak lista wyżej):**

- **Stempel `Since` w rejestrze.** `node tools/registry.mjs --write` stempluje nowy numer pierwszym niewydanym etapem `tools/stages.json`, a to dziś `E39`, nie etap linii; nie poprawiasz tego w `tools/registry.mjs` (`SINCE_CORRECTED`). Po ostatnim scaleniu koordynator dopisuje do `SINCE_CORRECTED` po jednym zakresie na linię: R8920-R9019 E131, R9020-R9119 E132, R9120-R9219 E133, R9220-R9319 E134, R9320-R9419 E135 (wzór: wiersze E129 i E130), i generuje rejestr od nowa.
- **`REASONS` i `REASON_PATTERNS` (`bridge-guards.mjs`).** Nowy kod tylko jako nowa linia na końcu tablicy `REASONS` (za `"barricaded", "onWatch"`), z komentarzem `// 2.0 line T<n> <ID>: ...`; nowy wzorzec tylko na końcu `REASON_PATTERNS` (najpierw sprawdź, że żaden wcześniejszy wzorzec go nie łapie - pierwszy pasujący wygrywa); istniejących wpisów nikt nie przestawia. Kod dopisują T2 (`roundOpen`, DAY-06) i ewentualnie T1 i T5 (nowe akcje), po kolei scalania. T3 nie dodaje kodu i zmienia w bloku nad `REASONS` tylko jedno zdanie o `refused` ("which of its resolver's silent reasons applied is not told", TRIAL-02) - koordynator łączy je z dopisanymi liniami T2.
- **Jeden odczyt czekających kart (`messenger-gm.mjs`).** EXP-GM-17 (T2) i EXP-GM-03 (T3) wydzielają z logiki `waitingCard` ten sam odczyt "Czeka na decyzję". Obie linie piszą go pod jedną nazwą i sygnaturą: eksportowana czysta funkcja `waitingCards()` bez argumentów, zwracająca tablicę `{ messageId, actorId, userId, kind, text }` z kopii tej przeglądarki (te same karty, które konsola rysuje w "Czeka na decyzję"), bez zmiany zapisu i rysowania. Przy scaleniu zostaje wersja T2 (scalana wcześniej), a wywołania T3 (`trial-floor-ui.mjs`) idą na nią; pole, którego T3 potrzebuje, a którego T2 nie zwraca, koordynator dopisuje do wersji T2 i obie linie wymieniają je w raporcie.
- **Kolejność kolumn okna Uczniowie (`gm-students.mjs` `aliveTableHtml`).** Po scaleniu: kolumny istniejące, potem kolumny T2 (Pokój, Czeka, Połączenie; przycisk "+1 ponad maksimum" w komórce Akcje), potem Mikrofon T4, na końcu Cele T5. T4 (scalana pierwsza) dopisuje Mikrofon jako osobny obiekt kolumny na końcu `columns`; T2 przy przebazowaniu wstawia swoje kolumny przed nim; T5 dopisuje Cele za Mikrofonem. Każda linia swoje komórki rysuje i wiąże w osobnych funkcjach.
- **`audit/harness/scenarios/30-security.mjs`.** Dopisują T2 (`ask.withdraw`) i T5 (`motive.report`, `motive.rule`, `motive.set`): nowe przypadki tylko na końcu pliku, każdy w bloku z komentarzem `// 2.0 line T<n>`; T1 i T3 go nie edytują (mutanty opisują w raporcie).
- **Kroki `migrate.mjs` (`CLAUSES`).** "Własny numer" kroku to jego unikalny `key` (T2 np. `morningLineToStore`, T5 np. `oldMotiveGone`) i `since: "1.2.130"` - nie nowy numer TRAP; po scaleniu kolejność na końcu `CLAUSES`: krok T2, potem krok T5; bramka D2-13 (T4) stoi na wejściu runnera, nie w `CLAUSES`. Istniejącego `motiveTimer` nikt nie usuwa (stare światy).
- **Hak `userConnected` w `gm-bridge.mjs`.** Dzisiejszy hak gałęzi GM-a kończy się `return` dla każdego, kto nie jest GM-em. Przebudowując go dla CALLS-02/04 i PRIM-02/03, zostaw jedno miejsce, do którego rozłączenie **gracza** dochodzi przed jakimkolwiek `return` (np. zaraz po `releaseClaimsOf(user.id)`), i oznacz je komentarzem; tam koordynator postawi jedną linię T1 (`noteParticipantLeft(user)`, MURDER-06). T3 nie zmienia haków tego pliku (rejestruje własne).
- **`clock.mjs`.** T4 (scalana pierwsza) może dopisać jedno wywołanie przypomnienia o kopii sprawy w miejscu końca sesji (FORGE-01) - przy przebazowaniu `advanceTimeOfDay` zostaw je we własnej linii; wywołań `tickMotive`/`untickMotive` nie ruszasz (T5).
- **`utils.mjs`.** T4 dopisuje na końcu także funkcję hostingu (FORGE-01), nie tylko oczyszczanie opisu (R505).
- **`despair.mjs`.** T4 zmienia w nim wywołanie `DRPG.Despair.hopeAlreadyFull` (zamiana Despair w Hope, CALLS-18); twoje jedno wywołanie EXP-GM-14 stoi w drodze ręcznej korekty puli - inna funkcja, osobna linia.
- **`DRPG.Calls.motiveSet`.** Istniejący klucz w twojej przestrzeni mówi o starym motywie; zmienia go T5 (M3, D2-23) - ty go nie ruszasz.

Kolejność scalania (koordynator): T4 -> **T2** -> T1 -> T3 -> T5. Po każdym scaleniu `npm run quick`, po ostatnim pełny
`npm test`; lista testów zmienia hash `suite-merge`, więc koordynator puszcza 8 shardów.

---

## 5. Raport po skończeniu

Napisz `docs/dev/v2/LINE-T2-REPORT.md` (po polsku, myślniki `-`) i zacommituj go jako ostatni commit gałęzi:

1. **Podsumowanie:** sha początku i końca, liczba commitów, wynik bazowy i końcowy (`run-tests: P passed, F failed, S
   skipped, R red` dla tierów 0-1, czas), wynik CI na ostatnim pushu (każde zadanie).
2. **Tabela pozycji:** `ID | status | commit | testy (R i tier 2) | sekcje podręczników | uwagi`, status "zrobione" (sha
   commita i test, który był czerwony i jest zielony, z cytatem czerwonego odczytu) albo "nie zrobione" (dlaczego, co
   zostało, `expectedRed` jeśli jest). Każde z 35 ID osobno, także te z grup.
3. **Testy dodane i zmienione:** numery R (rzeczywiste), nazwy tier 2, zmienione istniejące testy i scenariusze z powodem,
   zmiany w `skip-baseline.json` (oczekiwane: żadne).
4. **Kontrole Forge do końcowego sprawdzenia (D2-15):** każda kontrola z kolumny 4 tabeli i to, czego oczekujesz na
   kandydacie (przejdzie / zostaje czerwona z powodu), w szczególności `s3-disconnects` F1 (reguła PRIM-02 czeka na
   właściciela) i zmienione zapisy w `s2-second-gm` I oraz `s1a-day-murder`.
5. **Zmienione sekcje podręczników** (PL i EN, numery sekcji) i nowe/zmienione klucze językowe, z wyróżnieniem kluczy w
   cudzych przestrzeniach.
6. **Pliki spoza listy** i miejsca, w których kształt odbiega od tej specyfikacji (z powodem).
7. **Tekst do notatek wydania 1.2.130** (kilka zdań po angielsku i po polsku, w stylu `.github/release-notes/`), do
   wklejenia przez koordynatora.
8. **Pytania do właściciela**, każde z domyślnym zachowaniem, na którym linia pracowała:
   - PRIM-02: czy rola głównego ma zostawać u GM-a, który ją przejął, do końca sesji (albo do decyzji GM-ów), zamiast
     wracać do najmniejszego id przy jego powrocie? Domyślnie: wraca (kod bez zmian reguły), z powiadomieniem; `s3` F1
     zostaje czerwone.
   - CALLS-01: czas samoczynnego zwolnienia zajęcia (domyślnie 120 s) i czy przejęcie ma pytać (domyślnie: pyta, Anuluj
     domyślny).
   - EXP-PL-09: notatki prywatne w tej przeglądarce (domyślnie) czy na serwerze świata (idą za graczem, GM z dostępem do
     danych świata może je odczytać)?
   - EXP-GM-16: czy wynik rzutu gracza ma też wyskakiwać kartą w rogu GM-a (domyślnie: tylko wpis w Osi czasu)?
   - EXP-PL-12: czy stan "GM czyta twoją prośbę" ma nazywać GM-a (domyślnie: nie)?
   - Inne, które wyjdą w trakcie.
9. **Znalezione poza zakresem:** błędy i niespójności zauważone w plikach innych linii albo w pozycjach spoza T2, z
   plikiem i funkcją, bez poprawiania.
