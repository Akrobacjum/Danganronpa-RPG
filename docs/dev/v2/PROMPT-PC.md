# Prompt dla czatu Claude Code na komputerze właściciela (punkty 2-3 testów na Forge)

Napisane 25.11.2026 (D2-21). Adres gry jest tu zastąpiony `<ADRES GRY>`: repozytorium jest publiczne, a konta testowe
GM-ów nie mają haseł. Pełna wersja z adresem jest w rozmowie z właścicielem.

---

Uruchamiasz testy modułu Danganronpa RPG na Forge z komputera właściciela. To kontynuacja pracy "droga do 2.0" (etap
F3): plan i decyzje są w `docs/dev/v2/` (zacznij od `DECISIONS.md`, `F3-forge-S0.md`, `F3-forge-PC.md`), narzędzia i
instrukcja w `audit/forge/README.md`, wszystko na gałęzi `claude/dazzling-bohr-juuh4g`.

## 0. Najpierw sprawdź, gdzie działasz

Poprzedni "lokalny" tester okazał się sesją w chmurze. Zanim cokolwiek zrobisz, sprawdź i wypisz: system, nazwę
komputera, kartę graficzną. Jeśli to kontener Linux w chmurze (np. host `vm`, ścieżka `/home/user`, brak GPU),
**zatrzymaj się i powiedz to właścicielowi** - ta praca ma sens tylko na jego komputerze (Windows lub macOS z GPU
i prawdziwą siecią).

## Zasady

- Świat kampanii jest na tym samym koncie Forge. Narzędzia z `audit/forge/` same odmawiają pracy w świecie bez "qa",
  "copy" ani "gate" w nazwie: nie obchodź tego.
- Nie zmieniaj kodu modułu (`scripts/`, `styles/`, `lang/`, `module.json`), ustawień Forge ani ustawień świata (poza tym,
  co robią same scenariusze - opisane w ich nagłówkach). Nie wpisuj haseł. Nie wpisuj adresu gry do żadnego pliku.
- Instalacje poza folderem repozytorium (Node.js, git, cokolwiek systemowego): najpierw opisz właścicielowi i poczekaj
  na zgodę.
- Myślnik w tekstach zawsze "-", nigdy długa kreska.

## Dane

- Adres gry: `<ADRES GRY>` (podawaj tylko w zmiennej `DRPG_FORGE_URL`)
- Świat testowy: `DRPG-QA-Forge` (musi być uruchomiony na Forge); konta bez haseł: GM1, GM2 (Gamemaster), P1-P4.
- Docelowe rozdzielczości: 1920x1080 i 2560x1440 (D2-20; 1366x768 nas nie interesuje). Domyślne `DRPG_SIZES`.

## 1. Przygotowanie

1. Node.js 22, git. Repozytorium na gałęzi `claude/dazzling-bohr-juuh4g` (`git pull`). Jeśli w folderze są lokalne
   zmiany właściciela, nie ruszaj ich: osobny `git worktree` albo świeży klon.
2. `cd audit/harness`, `npm ci`, `npx playwright install chromium firefox`.
3. Zapytaj właściciela i poczekaj na potwierdzenie: (a) kopia zapasowa świata DRPG-QA-Forge zrobiona (scenariusze
   zmieniają świat, a końcowe sprawdzenie musi startować z tego samego stanu), (b) świat DRPG-QA-Forge uruchomiony, świat
   kampanii nie, (c) na Forge zainstalowana jest wersja modułu 1.2.129.
4. Kontrola: `DRPG_FULL_RENDER=1 node audit/forge/doctor.mjs` (zmienne jak w README; PowerShell: `$env:NAZWA="..."`).
   6 z 6 kont powinno się zalogować; jeśli nie, zanotuj i idź dalej.

## 2. Punkt 2: zestaw testów modułu i scenariusze bez głosu

Każde uruchomienie z `DRPG_FULL_RENDER=1`, jedno naraz, w tej kolejności:

1. `node audit/forge/suite.mjs` - wbudowany zestaw testów, poziomy 0-1. W chmurze nigdy nie skończył (40 min). Raport
   ma teraz ostatnie 400 linii konsoli GM1 i otwarte okna: jeśli i tu nie skończy, napisz, na czym stanął.
2. `node audit/forge/run.mjs s7-look` w Chromium, potem to samo z `DRPG_BROWSER=firefox` (jeśli Firefox nie narysuje
   /join, dodaj `DRPG_HEADFUL=1`). S7 niczego nie zapisuje.
3. `node audit/forge/run.mjs s4-two-gms-at-once`
4. `node audit/forge/run.mjs s2-second-gm`
5. `node audit/forge/run.mjs s3-disconnects`
6. Jeśli starczy czasu: `s1a-day-murder`, potem `s1b-case-trial`.

## 3. Punkt 3: głos i wydajność

1. `DRPG_FAKE_MEDIA=1 node audit/forge/run.mjs s5-voice` (Chromium). Najważniejsze liczby: czas przełączenia pokoju,
   przerwa w dźwięku, liczba ponownych połączeń (VOICE-01, VOICE-02, VOICE-07). Jeśli LiveKit w ogóle się nie połączy,
   zapisz dlaczego.
2. `node audit/forge/run.mjs s8-load` - krzywa wydajności przy rosnącym świecie; sprząta po sobie.
3. `DRPG_SOAK_MINUTES=120 node audit/forge/run.mjs s6-soak` - 2 godziny (zapytaj właściciela, czy nie skrócić do 60).

## Gdy scenariusz się wysypie

Scenariusze nigdy nie działały na prawdziwym Forge: pierwsze przebiegi będą się wywracać na własnych założeniach
(oznaczonych w nagłówkach jako UNMEASURED). Wolno ci poprawiać wyłącznie pliki w `audit/forge/` i tylko tak, żeby
scenariusz mierzył to, co miał mierzyć.

- **Rozróżniaj:** błąd scenariusza (nie znalazł okna, zły selektor, zły limit czasu) - poprawiasz; kontrola, która nie
  przechodzi, bo moduł zachowuje się jak przed poprawkami - **to oczekiwany wynik "przed", nie ruszasz jej**. Nigdy
  nie osłabiaj kontroli, żeby przeszła.
- Każda poprawka to osobny commit z powodem. Po poprawce uruchom scenariusz jeszcze raz.
- Jeśli scenariusz blokuje się dłużej, zapisz stan i przejdź do następnego.

## Wynik

Zapisz `docs/dev/v2/F3-forge-PC-2.md` (po polsku):

- gdzie działałeś (system, GPU), wersje;
- dla każdego uruchomienia: kontrole zaliczone i niezaliczone z ich ID (`ids`), najważniejsze pomiary z notatek
  (głos w ms, krzywa fps i czasy klatek z S8, wzrost pamięci na godzinę z S6), czas trwania;
- poprawki scenariuszy, które zrobiłeś, i dlaczego;
- co widać na zrzutach w 1920x1080 i 2560x1440 (obejrzyj je);
- nowe znaleziska jako proponowane wiersze `FORGE-NN` z wagą (`blocker`, `major`, `minor`, `nit`) i dowodem;
- czego nie zrobiłeś i dlaczego.

Zatwierdź tylko ten raport i poprawki w `audit/forge/`. Bez `audit/forge/out/` i zrzutów. `git pull` przed `git push`,
push wyłącznie na `claude/dazzling-bohr-juuh4g`, nigdy na `main`. Na końcu krótkie podsumowanie dla właściciela i
przypomnienie, że świat testowy trzeba przywrócić z kopii zapasowej przed końcowym sprawdzeniem.
