# Przekazanie pracy: plan Stained Update (1.3.0), stan na 24.09.2026, 19:00 UTC

Ten folder jest tymczasowy. Przenosi pracę z sesji w chmurze do Claude Code CLI. **Usuń go
(`git rm -r audit/handoff`) w commicie wydania 1.2.61, zanim PR trafi do main.**

## 1. Źródła prawdy

| Co | Gdzie |
|---|---|
| Plan (60 etapów, decyzje D1-D47, znaleziska) | `docs/Audyt Stained Update.html` na **main** (dane w `<script type="application/json" id="data">`) |
| Brief jednego etapu z planu | `python3 audit/handoff/tools/brief.py E31 [--no-members]` (czyta plik z main przez `git show`, gdy go nie ma w checkoucie) |
| Projekt E30 (plan commitów C0-C28 i 5 specyfikacji) | `audit/handoff/e30-design/`; **`05-plan.md` rozstrzyga**, gdy specyfikacje się różnią |
| Instrukcje dla wykonawcy fazy F | `audit/handoff/briefs/brief-common.md` + `brief-phaseF.md` |
| Dziennik sesji w chmurze (po polsku) | `audit/handoff/STATE-cloud-session.md` |
| Zasady repo | `CLAUDE.md` (w E30 jego sekcje zmienia C27) |

Projekt E30 pisano pod commit 411d4da, więc numery linii są przesunięte: kod szukaj po treści. Ścieżki
`<scratch>/...` w briefach oznaczały katalog roboczy sesji w chmurze; odpowiedniki są w tym folderze
(`tools/v.sh`, `tools/vsum.sh`) albo znikają (worktree = Twój klon na tej gałęzi).

## 2. Co wydane

Kolejność planu v2: E01 E27 E02 E03 **E30** E31 E04 E05 E06 E32 E07 E08 E28 E29 E33 E34 E09 E10 E11 E12 E13
E35 E14 E36 E15 E16 E17 E18 E19 E37 E38 E39 E40 E41 E42 E60 E43 E20 E44 E21 E22 E23 E24 E45 E46 E47 E48
E49 E50 E51 E25 E52 E53 E54 E55 E56 E57 E58 E59 E26. Numeracja D20: każdy etap to kolejne 1.2.X, E26 = 1.3.0.

| Etap | Wersja | Uwagi |
|---|---|---|
| E01, E27, E02 | 1.2.57, 1.2.58, 1.2.59 | |
| E03 | 1.2.60 (`releases/latest`) | most do GM-a i strażnik przekaźnika Daggerheart; poprawka nazwy puli Despair |

## 3. E30 (1.2.61): stan

Gałąź `claude/fervent-sagan-gme4vt`, 25 commitów od 6ea3bba (1.2.60 na main), ostatni 36f1f67, plus ten
folder. Zrobione: faza A (C0-C2: suite-diff, podział `tests.mjs` na `tests.mjs` + `tests-kit.mjs` +
`tests-tier0/1/2.mjs`, higiena), B (C3a-C3b: uczciwe kody wyjścia harnessu, `results/` poza gitem,
`probes/`, `layers`), C (C4-C10: operatory v14 i `-=`, `migrateRemnants` + R152, rola Asystenta,
17-assistant + R153, wersje, rzuty DH, `preUpdate` jak w Foundry, sześć arkuszy CSS), D (C11-C16:
`tools/stages.json`/`stages.mjs`, licznik asercji, `expectedRed`, sondy `env`/`world`, cięcie źródła
przez kit + `tools/check.mjs contract`, `worldDump`, `runTests()` domyślnie tier 1 + okno tier 2),
E (C17-C20: rejestry scenariuszy i R w `audit/harness/README.md` i `CLAUDE.md`, FLOWS + R160, znane
wycieki jako opcje `check()`, kanarek sekretów 72-canary).

Pomiar na 36f1f67 (headless): suite **304 passed, 0 failed, 16 skipped, 0 red** (01-runtests 19/19,
ok. 5 min 15 s); każdy scenariusz 00 10 11 12 13 14 15 17 20 30 40 50 60 72 kończy się kodem 0; 72-canary
14/21 (7 expected red, 0 failed); `known-leaks.json` 9 wpisów, każdy z etapem zamykającym albo jako
granica Foundry; proza PL 497/497.

**Zostało:** faza F (C21-C27, `briefs/brief-phaseF.md`): ESLint no-undef, pełny `tools/check.mjs`,
`audit/harness/run-all.mjs` (`npm test`), `.github/workflows/ci.yml`, lokalna bramka (`audit/gate`,
`audit/live`) i zmiany `release.yml`, `audit/perf-baseline.json` (status not-measured), dokumentacja
(CLAUDE.md, CONTRIBUTING.md, audit/README.md). Potem przegląd całego E30 i wydanie C28.

## 4. Decyzje podjęte w trakcie (sprawdź przy przeglądzie)

- **Bramka lokalna (odchylenie od D47, czeka na potwierdzenie użytkownika):** w sesji w chmurze nie
  było Foundry v14, więc `verify-gate` ma mieć dwa tryby przez zmienną repo `DRPG_LOCAL_GATE`:
  `record` (domyślny: część niewykonana z powodu środowiska przechodzi na 1.2.x jako dług, jeśli notatki
  mają linię "- Not checked in a real Foundry"; failed/errored zawsze blokuje; 1.3.0 zawsze wymaga
  pełnego przebiegu) i `enforce` (D47 dosłownie: waiver + zatwierdzenie środowiska). Szczegóły w
  `brief-phaseF.md` (C25). **Jeśli masz lokalnie Foundry v14, bramka może ruszyć naprawdę.**
- Numery R: R151 (drugie R21), R152 (`-=`), R153 (Asystent), R154-R155 (kontrakt runnera, expectedRed),
  R156-R158 (cięcia, asercje z konstrukcji, needs), R159 (worldDump), R160 (FLOWS). Następny wolny: R161.
  R113-R124 zarezerwowane.
- 15-trial z planu to **18-trial** (15-held już istnieje).
- `migrateRemnants` zostaje ręczne (bez klauzuli migracji); tier 2 zostaje w CI; siedem płaskich plików
  `tests*.mjs`; `relay-guard.forwardsUnjudged`: tylko pełny GM przekazuje bez oceny, Asystent jak gracz.
- `touches` w `tools/stages.json`: E01 i E02 `["sockets"]`, E27 `[]`, E03 `["sockets","rolls","scenes"]`.

## 5. Uwagi do przeglądu E30 (znalezione po drodze, niezałatwione)

- `stripComments` w kicie myli `/*` wewnątrz stringów i regexów (moduł nie ma dziś takiej pisowni).
- `anonymity.mjs` i `overflow.mjs` w `preUpdate` przycinają też zapisy GM-a (brak testu, nic się nie ruszyło).
- `resource-guard.mjs prune()` może gubić usunięcia, jeśli operator usunięcia v14 nie ma własnych kluczy
  (LIVE-E30-02/03); v14 może jeszcze honorować `-=` z ostrzeżeniem (LIVE-E30-01) - poprawka działa w obu.
- Błąd mgły `reading 'indexOf'` w `placeLayer` to szum atrapy PIXI (jest od 1.2.60).
- `release.yml` potrzebuje `fetch-depth: 0` dla `node tools/stages.mjs check --release`.
- CLAUDE.md "Running things"/"trzy liczby" i listy scenariuszy w CONTRIBUTING.md są nieaktualne (C27);
  `audit/README.md` mówi "3 klienci" (są 4, w 17-assistant 5).
- Po E30 lista LIVE-E30-01..09 w `audit/AUDIT-1.2.42.md` §9.2 (pozycje 25-32+) to rzeczy do sprawdzenia przy stole.

## 6. Sprawy do użytkownika

1. Czy jest lokalne Foundry v14 z licencją (sandbox na :30099) do bramki lokalnej i pomiaru wydajności?
2. **Przed instalacją 1.2.63 (E04) skopiować świat** - kopia sprzed migracji E04 jest potrzebna do pomiaru
   bazowego 1.2.56 (`audit/perf-baseline.json`) i do ćwiczeń migracji (E38).
3. Tryb bramki: `record` czy `enforce` (patrz 4).

## 7. Zasady pracy (od użytkownika)

- Do użytkownika po polsku, przyjaźnie, z tabelami; raport krótko tylko przy wydaniu etapu albo blokadzie.
- Nigdy znak U+2014 (em dash) - w kodzie, komentarzach, notatkach i commitach; używaj `-`.
- Podwójnie sprawdzać, nie przesadzać z tezami ("Measure, then say"); nie zakładać, że użytkownik ma rację.
- Pracować samodzielnie do końca planu. **Oszczędnie z agentami** (prośba z 24.09): tylko gdy realnie
  przyspieszają lub poprawiają jakość; wznawiać zamiast tworzyć nowych; jeden recenzent na etap.
- Każdy etap: implementacja -> przegląd adwersaryjny -> poprawki -> walidacja (suite + scenariusze ci +
  proza) -> wydanie jako kolejne 1.2.X -> gałąź robocza przestawiona na main.
- Notatki wydania i komentarze o przekaźniku Daggerheart: neutralnie i krótko, bez opisu, jak obejść ochronę.
- Wydanie: `python3 audit/handoff/tools/bump.py <stara> <nowa>` (module.json, znacznik CSS, 6 podręczników,
  README), liczby suite w CLAUDE.md, `.github/release-notes/vX.Y.Z.md`, od E30 `node tools/stages.mjs ship EXX`,
  PR do main, merge, Actions > Release (dispatch na main z tagiem), sprawdzić `releases/latest` i manifest.
- Harness: `cd audit/harness && npm ci` raz; `node cluster.mjs scenarios/NN-x.mjs`; jeden przebieg naraz;
  osieroconych klientów zabijać po PID (`pkill -f`/`pgrep -f` ze wzorcem obecnym we własnej komendzie
  zabija własną powłokę).
