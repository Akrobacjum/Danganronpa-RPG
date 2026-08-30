# Audyt Danganronpa RPG v1.1.88 — pod wydanie 1.2.0

**Data:** 2026-08-30 · **Audytowany stan:** tag `v1.1.88` (7a6f205) · **Metoda:**
audyt na żywo w harnessie mock-Foundry (3 klienci: GM + 2 graczy) + audyt
statyczny źródła + weryfikacja release'u i zależności przez sieć.

---

## Werdykt

**To jest solidny, dojrzały moduł — bliski gotowości na 1.2.0, ale jeszcze nie
gotowy dziś, z trzech powodów, z których dwa są mechaniczne, a jeden czysto
wydawniczy i pilny.**

Odpowiedzi wprost na Twoje pytania:

- **Czy to produkt gotowy do 1.2.0 i pierwszych sesji?** Prawie. Rdzeń działa,
  architektura jest przemyślana, a własny suite regresyjny modułu (147 scenariuszy)
  to rzadko spotykana dojrzałość. Przed „oficjalnym" 1.2.0 napraw 3 rzeczy:
  krytyk płacący +3 zamiast +2 Hope (balans), odczyt tożsamości mordercy z konsoli
  gracza (spoiler), i higienę release'u (patrz niżej).
- **Czy mogę pokazać komuś obcemu bez wstydu?** Kod — tak, śmiało; jest wyżej niż
  większość publicznych modułów Foundry. ALE **dziś obcy dostaje wersję 1.1.0**, nie
  1.1.88 — bo `releases/latest` i gałąź `main` stoją na 1.1.0 (wszystkie 1.1.x>0 są
  oznaczone jako *prerelease*). To najpilniejsza rzecz do naprawy przed pokazaniem
  komukolwiek: obecnie pokazujesz kod i wersję sprzed 110 commitów.
- **Czy mogę zacząć grę bez ryzyka glitchy, również wizualnych?** Pod kątem
  awarii/wywrotek — tak, nie znalazłem żadnego crasha ani niezłapanego wyjątku w
  pełnym przebiegu zbrodni na 3 klientach; moduł degraduje się elegancko przy
  brakujących zależnościach. Pod kątem glitchy wizualnych — jedno realne (surowy
  klucz i18n w kreatorze sezonu), reszta ryzyk wizualnych wymaga oka na żywej
  scenie izometrycznej (poza zasięgiem headless).

Ocena całości: **7.5–8 / 10** jako produkt; rdzeń inżynierski **9/10**, dojmujący
minus to higiena wydania i dwa błędy w ekonomii/prywatności, których łapie własny
suite.

---

## Jak to było testowane

Zbudowałem headless harness wiernie odwzorowujący Foundry VTT v14: dokumenty i
kolekcje z prawdziwą semantyką uprawnień, autorytatywny „serwer" świata
replikujący zmiany do klientów i **odrzucający zapisy, które odrzuciłby prawdziwy
serwer** (world settings i cudzy aktor spoza uprawnień gracza), filtrowanie
whisperów do adresatów, pipeline `DualityRoll` systemu Daggerheart (z wierną regułą
„krytyk = +1 Hope od systemu"), PIXI, ApplicationV2/DialogV2. Moduł v1.1.88
uruchomiono na 3 równoczesnych klientach (GM + 2 graczy) i przepuszczono przez:
boot, własny suite `runTests`, pełny przebieg zbrodni (morderstwo→proces→głos),
prywatność rzutów między klientami, ekwipunek/ruch/przeszukania, oraz próby
eskalacji uprawnień i XSS. Awarie modułu traktowane jako znaleziska, nie łatane.

Wynik wbudowanego suite przez harness: **102 passed / 9 failed**, gdzie wszystkie 9
FAILi to ograniczenia headless (realny layout okien, geometria ścian PIXI po
pikselu, render karty w DOM) plus jeden realny brak i18n. **Cała logika tier-0
(regresje źródła) i tier-1 (inwarianty) przechodzi** poza jednym realnym brakiem
i18n. To bardzo mocny wynik.

---

## Znaleziska

### [KRYTYCZNY dla wydania] REL-001 — „latest" i `main` to wciąż v1.1.0
- **Fakt (zweryfikowany przez GitHub API):** `releases/latest` → **v1.1.0**
  (`target_commitish: main`, opublikowany 27.08). Wszystkie wydania v1.1.1–v1.1.88
  są oznaczone `prerelease: true`, więc GitHub pomija je jako „latest". Gałąź `main`
  również stoi na v1.1.0 (110 commitów za tagiem, `module.json` na main: `"version":
  "1.1.0"`).
- **Skutek:** Manifest instalacyjny modułu wskazuje na
  `releases/latest/download/module.json` → **każdy, kto zainstaluje moduł z
  manifestu, dostaje v1.1.0**, nie audytowaną 1.1.88. Obcy przeglądający repozytorium
  widzi kod i wersję sprzed 110 commitów. Cała praca od 1.1.1 (dojrzewanie silnika
  zbrodni/procesu/betrayal) jest nieosiągalna dla zwykłego użytkownika.
- **Rekomendacja (to jest samo sedno „wydania oficjalnego 1.2.0"):** wydać 1.2.0
  jako **stabilny** release (nie prerelease), a `main` przewinąć do commitu 1.2.0
  (fast-forward), żeby zarówno instalacja, jak i przeglądanie repo dawały ten sam,
  aktualny kod. Dopóki to nie zrobione, „latest" = 1.1.0.

### [WYSOKI] LIVE-003 — Krytyk płaci +3 Hope zamiast +2 (podwójny rachunek)
- **Pliki:** `scripts/critical.mjs` (wrapper pipeline'u ustawia hope = +2) ORAZ
  `scripts/despair-award.mjs:77` (`topUpCritHope` dokłada +1 na `createChatMessage`).
  `config.mjs:834`: `CRITICAL = { hope: 2 }`.
- **Dowód (empiryczny, pełny pipeline):** akcja z wynikiem krytycznym → Hope
  **0 → 3 (delta +3)**. Kontrola: zwykły rzut z Hope → delta **+1** (poprawnie), co
  waliduje wierność baseline'u. Zatem +3 to realna nadwyżka.
- **Przyczyna:** dwa niezależne mechanizmy realizują tę samą regułę „+2 na
  krytyku". Stary model (despair-award): Daggerheart płaci +1, moduł dokłada +1 =
  +2. Nowy model (critical.mjs, dodany później): każe pipeline'owi płacić od razu
  +2. Oba są aktywne i sumują się do +3. Klasyczna regresja „dwie łatki na jeden
  problem". Własny suite tego nie łapie — inwariant sprawdza stałą `CRITICAL.hope`,
  nie sumę end-to-end.
- **Skutek przy stole:** każdy krytyk każdego gracza daje 50% Hope więcej niż
  zaprojektowano. Hope kupuje Calle — w ekonomii strojonej co do punktu to realny
  dryf balansu.
- **Rekomendacja:** zostawić JEDEN mechanizm (nowszy critical.mjs), usunąć
  `topUpCritHope` z despair-award i przepiąć `reroll.mjs settleCritHope` na ten sam
  jeden mechanizm (reroll nie odpala createChatMessage!). Dodać test mierzący realny
  przyrost Hope (+2), nie tylko stałą.

### [WYSOKI] LIVE-001 — Tożsamość mordercy (i wspólnika) czytelna z konsoli gracza
- **Pliki:** `settings.mjs:692` (`murderState` jako `scope:"world"`),
  `murder.mjs:57` (`murderState()` zwraca pełny obiekt z `killerId`, `thirdId`).
- **Dowód (empiryczny):** w fazie `classTrial` klient gracza nieuczestniczącego
  wykonał `game.settings.get("danganronpa-rpg","murderState").killerId` → id zabójcy,
  stąd `game.actors.get(id).name` → nazwisko. World-settings w Foundry replikują się
  do wszystkich klientów; UI tego nie pokazuje, konsola F12 tak.
- **Dlaczego to się liczy:** class trial to cała zagadka gry (social deduction, gdzie
  pokusa zajrzenia jest największa). Jeden gracz w konsoli kończy centralną tajemnicę
  dla stołu. To wyciek wg **własnego standardu modułu** — test R9 architektuje
  dokładnie przeciw temu dla Remnantów, ale pilnuje tylko 5 kluczy Remnantów i nie
  sprawdza `killerId`/`thirdId`. Komentarz R9 świadomie akceptuje tylko
  `projectMeta.killerId` (morderstwo pośrednie); o `murderState` nie ma słowa — to
  luka, nie decyzja.
- **Kontekst wagi:** wymaga świadomego otwarcia konsoli (cheat), nie jest w UI —
  dlatego WYSOKI, nie KRYTYCZNY. Ale przy tym gatunku wart naprawy przed 1.2.0.
- **Rekomendacja:** trzymać id zabójcy/wspólnika poza world-settingiem. Architektura
  już istnieje (gm-bridge dosyła prywatne dane konkretnemu klientowi, secret.mjs
  trzyma prywatne treści poza światem). Minimalnie: zapisywać w `murderState` stan
  zredagowany, realne id trzymać po stronie GM + socketem do zabójcy. Dodać
  `killerId`/`thirdId` do testu R9.

### [NISKI] LIVE-002 — Brakujące klucze i18n w kreatorze sezonu
- `DRPG.Season.step.resources`, `DRPG.Season.hint.resources` — użyte w kodzie, brak
  w `lang/en.json`. Skutek: GM zobaczy surowy identyfikator zamiast tekstu (glitch
  wizualny). Wykryte niezależnie przez własny inwariant modułu i przez harness.
  Naprawa: dopisać 2 klucze. (Uwaga: 3 klucze `LIVEKITAVCLIENT.*` przy boocie to
  klucze cudzego modułu — poza zakresem.)

---

## Co zweryfikowanie działa dobrze (potwierdzone na żywo)

- **Bezpieczeństwo zapisu — solidne.** Gracz nie zapisze cudzego aktora ani NPC ani
  world-settingu (serwer odrzuca). gm-bridge używa nieforge'owalnego `senderId` (nie
  `payload.userId`), waliduje `ownsActor`, a przywileje wykonuje klient GM po
  walidacji — sfałszowany socket „działaj jako cudza postać" jest odrzucany.
  Przemyślana architektura.
- **XSS — czysto.** Messenger escapuje treść gracza przy zapisie
  (`escapeHTML(body)`); wrogi `<img onerror>`/`<script>` trafia do DOM jako tekst.
- **Prywatność rzutów działa** — rzut gracza nie pojawia się w widocznych
  wiadomościach drugiego gracza (wymuszone prywatne rzuty + filtrowanie whisperów).
- **Redakcja Remnantów działa** — nazwa tokenu nic nie zdradza, a treść/typ/DC nie
  są w czytelnych dla gracza flagach tokenu (dokładnie jak deklaruje R9).
- **Pełny przebieg zbrodni bez awarii** — morderstwo → cios kończący (śmierć
  replikuje się do klienta gracza jako ActiveEffect `dead`) → odkrycie ciała →
  Remnant → proces → głos → zliczenie → `endMurder` czyści stan do idle. Zero
  niezłapanych wyjątków na wszystkich 3 klientach.
- **Ekwipunek** — wspólny limit Gear = 2 sloty egzekwowany (3. przedmiot blokowany).
- **Ruch/przeszukania** — pokój gracza rozpoznawany, żetony przeszukań obecne.
- **Elegancka degradacja** — brak wymaganego modułu = uczciwy stop z komunikatem;
  brak isometric/tekstur = warn i kontynuacja, nie crash.
- **Własny suite regresyjny** — 25 regresji źródła + ~40 inwariantów + ~20
  scenariuszy niszczących z pełnym snapshot/restore świata. To sam w sobie dowód
  klasy inżynierskiej rzadkiej w modułach Foundry.

---

## Obszary wymagające żywego oka (poza zasięgiem testu headless)

Uczciwie: harness nie renderuje pikseli. Poniższe trzeba obejrzeć na żywej,
izometrycznej scenie z prawdziwym Foundry — mój audyt ich nie prześwietlił do
końca:

- **Warstwa mgły/fog i pierścienie/ikony Remnantów na canvasie** (fog.mjs to
  najbardziej złożony plik) — geometria, wydajność przy zmianie sceny, sprzątanie
  obiektów PIXI, współgranie z modułem isometric-perspective.
- **CSS na żywo** — 657 KB, 672 reguł `!important` (dużo, ale to total-conversion
  nadpisujący styl systemu; pojedynczy wysoki z-index 99990 jest udokumentowany).
  Ryzyko: obcięte teksty w wąskich oknach, motyw jasny/ciemny Foundry v14.
- **Głos per pokój (LiveKit)** i **muzyka** — logikę zweryfikowałem (mapowanie
  pokój→pokój LiveKit, maszyna stanów muzyki gra właściwą playlistę), ale realne
  przełączanie audio między pokojami wymaga żywej sesji.

---

## Checklist na 1.2.0 (kolejność = priorytet)

1. **Wydać 1.2.0 jako stabilny (nie prerelease) release i przewinąć `main`** do
   1.2.0. Bez tego „latest" = 1.1.0 i cały ten audyt dotyczy kodu, którego nikt nie
   instaluje. (REL-001)
2. **Naprawić krytyk +3 → +2 Hope** — usunąć jeden z dwóch mechanizmów. (LIVE-003)
3. **Zamknąć wyciek `murderState.killerId`/`thirdId`** z konsoli gracza + dodać do
   testu R9. (LIVE-001)
4. **Dodać 2 brakujące klucze i18n** sezonu. (LIVE-002)
5. Rozważyć: `CHANGELOG.md` (masz świetne opisy commitów — warto je wystawić),
   ewentualnie `pl.json` (makra są po polsku, `en.json` po angielsku — spójność
   językowa do rozważenia).
6. Obejrzeć na żywej scenie izometrycznej cztery obszary z sekcji powyżej.

Po punktach 1–4 to jest moduł, który spokojnie pokażesz obcemu i na którym
zaczniesz pierwsze sesje bez ryzyka wywrotki.

---

## Status after this review (v1.2.0)

- **REL-001 (latest/main behind)** - addressed by this release: main now carries
  the released code, and 1.2.0 is published as a stable release rather than a
  prerelease, so `releases/latest` resolves to it.
- **LIVE-003 (critical paid +3 Hope)** - fixed. The duality funnel in
  critical.mjs is the only payer for a fresh critical; the chat-message top-up in
  despair-award is gone. Regression R26 in the suite states the rule, including
  the reroll path that still tops up by hand. Re-measured: +2.
- **LIVE-002 (missing Season i18n keys)** - **withdrawn, it was a false positive
  of the harness.** Both keys exist in lang/en.json as literal dotted keys inside
  a nested block ("step.resources"), and Foundry expands those when it merges a
  language file, so they resolve in a real world. The harness looked them up
  without expanding first. Fixed in the harness; the module needed no change.
- **LIVE-001 (killerId readable from a player's console)** - still open, and
  deliberately left for a decision rather than patched in a release that was
  about the economy and the copy. It needs the identity moved out of the
  world-scoped `murderState` and onto the GM-to-client channel that already
  carries the module's other secrets.
