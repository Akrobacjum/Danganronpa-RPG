# Audyt na żywo (harness mock-Foundry, 3 klienci: GM + 2 graczy) — v1.1.88

Harness: forkowane procesy-klienci z jsdom + wierny shim Foundry v14 (dokumenty,
uprawnienia serwera, filtrowanie whisperów, PIXI, ApplicationV2/DialogV2,
pipeline DualityRoll systemu Daggerheart). Serwer odrzuca zapisy, które
odrzuciłby prawdziwy serwer Foundry (world settings i cudzy aktor spoza
uprawnień gracza). Awarie modułu = znaleziska, nie łatane po stronie modułu.

## Wbudowany suite regresyjny (game.drpg.runTests, tier 2)
- Wynik przez harness: **102 passed / 9 failed**. Z tych 9 — **wszystkie 9 to
  ograniczenia harnessu, nie modułu**: mierzą realny layout okien w przeglądarce
  (R12 „0 okien się otworzyło"), geometrię ścian PIXI po pikselu (staircase/wall),
  rendering karty w DOM (Hope drawer, dashboard, roll window), i jeden brak
  klucza i18n (patrz niżej — to JEST realne). Po stronie logiki: **wszystkie
  tier-0 (regresje źródła) i tier-1 (inwarianty) przechodzą** poza dwoma, z czego
  jeden to realny brak i18n. To bardzo mocny wynik.
- Suite jest wybitny: 25 regresji źródła + ~40 inwariantów + ~20 scenariuszy
  niszczących z pełnym snapshot/restore świata. To sam w sobie dowód dojrzałości.

## [LIVE-001] killerId (i wspólnik) czytelny z konsoli gracza w trakcie incydentu i procesu — WAGA: WYSOKI — pewność: wysoka
- Plik: scripts/settings.mjs:692 (rejestracja `murderState` jako `scope:"world"`),
  scripts/murder.mjs:57 (`murderState()` zwraca pełny obiekt z `killerId`),
  scripts/murder.mjs:~106 (`thirdId` = wspólnik trzymany w tym samym stanie).
- Kategoria: prywatność / zgodność-z-intencją
- Dowód (empiryczny, harness scenario 11): w fazie `classTrial`, klient gracza
  nieuczestniczącego (Aiko) wykonał
  `game.settings.get("danganronpa-rpg","murderState").killerId` → `ACTORCHIE0000000`,
  a stąd `game.actors.get(id).name` → „Chie Mori". W Foundry world-settings
  replikują się do WSZYSTKICH klientów; interfejs tego nie pokazuje, ale konsola
  F12 tak. To samo dotyczy `thirdId` (wspólnika), gdy jest ustawiony.
- Dlaczego to się liczy: class trial to cała zagadka gry. Jeden ciekawy gracz w
  konsoli kończy centralną tajemnicę dla całego stołu w grze z gatunku social
  deduction — gdzie pokusa zajrzenia jest największa.
- WAŻNE — to wyciek wg WŁASNEGO standardu modułu: test R9 („nothing the
  investigation depends on is in a world setting", tests.mjs) architektuje
  dokładnie przeciw temu, cytuję komentarz: „FOUNDRY SENDS THE WHOLE WORLD TO
  EVERY CLIENT... the entire murder mystery rests on one rule: [Remnant secrets]
  never leaves the GM's own browser". R9 pilnuje jednak tylko 5 kluczy Remnantów
  (`sourceActor, realType, pointsAt, dc, tiedToCrime`) i NIE sprawdza `killerId`/
  `thirdId`. Komentarz R9 świadomie akceptuje tylko `projectMeta.killerId`
  (morderstwo pośrednie, „Dawid's call"); o `murderState.killerId` nie ma słowa —
  to luka, nie świadoma decyzja.
- Rekomendacja: trzymać tożsamość zabójcy/wspólnika poza world-settingiem.
  Architektura już istnieje: gm-bridge (socket kierowany do konkretnego klienta)
  + secret.mjs (prywatne karty). Wariant minimalny: zapisywać w `murderState`
  tylko zredagowany stan (bez killerId/thirdId/thirdSide), a realne id trzymać w
  pamięci GM + dosyłać zainteresowanemu klientowi (zabójcy) socketem, jak reszta
  prywatnych danych. Dodać do R9 klucze `killerId`/`thirdId` (dla `murderState`),
  żeby test złapał regresję.
- Uczciwy kontekst wagi: wymaga świadomego otwarcia konsoli (cheat), nie jest
  pokazywane w UI. Dlatego WYSOKI, nie KRYTYCZNY — ale przy tym gatunku i przy
  tym, jak rygorystycznie reszta modułu broni tej granicy, wart naprawy przed 1.2.0.

## Co WERYFIKALNIE działa dobrze (potwierdzone na żywo)
- **Śmierć replikuje się poprawnie** do klienta gracza (marker `dead` jako
  ActiveEffect, isDeceased widoczne u p1). Finishing Blow faktycznie zabija i
  ustawia stage `resolution`.
- **Nazwa tokenu Remnantu nic nie zdradza** (p2 nie odczyta „towel/weapon" z
  nazwy) i **treść/typ Remnantu NIE są w flagach tokenu** czytelnych dla gracza —
  redakcja Remnantów działa tak, jak deklaruje R9. To mocna strona.
- **Uprawnienia serwera trzymają**: gracz NIE zapisze world-settingu (serwer
  odrzuca), co potwierdza, że kod GM-only (writeState itd.) nie może być wołany
  „w drugą stronę" przez gracza do zapisu.
- **Głosowanie**: otwarcie/oddanie/zliczenie/zamknięcie przechodzi bez wyjątków.
- **Sprzątanie**: `endMurder` czyści stan do idle; suite restore nie zostawia
  osieroconych tokenów/wiadomości.
- **Brak niezłapanych wyjątków** na żadnym z 3 klientów w pełnym przebiegu zbrodni.

## [LIVE-003] Krytyk płaci +3 Hope zamiast +2 (podwójny rachunek) — WAGA: WYSOKI — pewność: wysoka
- Pliki: scripts/critical.mjs (wrapper `addDualityResourceUpdates` ustawia hope =
  base + CRITICAL.hope = +2 w pipeline) ORAZ scripts/despair-award.mjs:77 +108
  (`topUpCritHope` → `adjustCritHopeTopUp(actor, 1)` dokłada +1 na
  `createChatMessage`). config.mjs:834 `CRITICAL = { hope: 2 }`.
- Kategoria: bug / balans / logika
- Dowód (empiryczny, harness scenario 20, pełny pipeline DualityRoll): akcja z
  wynikiem krytycznym (hope==fear) → Hope 0→3, **delta = +3**. Kontrola: zwykły
  rzut z Hope → **delta = +1** (poprawnie), co waliduje, że baseline pipeline'u
  jest wierny. Zatem +3 na krytyku to nadwyżka, nie artefakt harnessu.
- Przyczyna: DWA niezależne mechanizmy realizują tę samą regułę „+2 na krytyku".
  Stary model (despair-award): pipeline Daggerheart płaci +1, moduł dokłada +1 =
  +2. Nowy model (critical.mjs, dodany później — jego nagłówek: „This module had
  never overridden either… It follows the guide on both halves"): każe pipeline'owi
  płacić od razu +2. Gdy oba są aktywne (a są — oba rejestrowane w module.mjs, brak
  wzajemnego guarda), sumują się do +3. Klasyczna regresja „dwie łatki na jeden
  problem".
- Skutek PRZY STOLE: KAŻDY krytyk KAŻDEGO gracza daje 50% Hope więcej niż
  zaprojektowano. Hope kupuje Calle — w ekonomii, której komentarze w config.mjs
  pieczołowicie stroją co do 1 punktu, to realny dryf balansu, nie kosmetyka.
- Dlaczego suite tego nie łapie: inwariant „a critical pays the guide's price,
  and something is enforcing it" sprawdza wartość CRITICAL.hope i instalację
  wrappera, ale nie mierzy sumy end-to-end po obu mechanizmach.
- Rekomendacja: zostawić JEDEN mechanizm. Skoro critical.mjs jest nowszy i czystszy
  (funnel zasobów, nie hook po fakcie), usunąć top-up krytyka z despair-award
  (`topUpCritHope`/wywołanie w onChatMessage) — despair-award niech odpowiada tylko
  za Despair pools, a Hope krytyka niech płaci wyłącznie pipeline. Uwaga: reroll.mjs
  `settleCritHope` woła `adjustCritHopeTopUp` przy rzucie przerzuconym NA/Z krytyka
  (reroll nie odpala createChatMessage) — tę ścieżkę trzeba wtedy przepiąć na ten
  sam pojedynczy mechanizm, inaczej reroll-do-krytyka też się rozjedzie. Dodać test
  mierzący realny przyrost Hope end-to-end (+2), nie tylko stałą.

## [LIVE-002] Brak kluczy i18n: DRPG.Season.step.resources, DRPG.Season.hint.resources — WAGA: NISKI — pewność: wysoka
- Wykryte przez inwariant modułu („every string the code asks for exists in the
  language file") i niezależnie przez licznik brakujących kluczy w harnessie.
- Skutek: w kreatorze sezonu (Season Setup) gracz/GM zobaczy surowy identyfikator
  „DRPG.Season.step.resources" zamiast tekstu — drobny glitch wizualny, ale
  widoczny i łatwy do naprawienia (dopisać 2 klucze do lang/en.json).
- Uwaga: 3 klucze LIVEKITAVCLIENT.* zgłoszone jako brakujące przy boocie to klucze
  CUDZEGO modułu (avclient-livekit), nie tego — poza zakresem, nie liczyć.
