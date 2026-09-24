# Stained Update - stan pracy (aktualizować co krok)

Plan: https://claude.ai/artifact/CN1FGcfkAWpX1JUp4feqsT (v2, 60 etapów). Dane: scratchpad/data-v2.json
(wyciąg: `<script type="application/json" id="data">` z pliku artefaktu; odtwarzalne przez Artifact read).
Rutyna autowznawiania: trig_018WtVVGXJhddg5nV63vNi6n (co godzinę :57) - usunąć po E26.

Kolejność: E01 E27 E02 [E03] E30 E31 E04 E05 E06 E32 E07 E08 E28 E29 E33 E34 E09 E10 E11 E12 E13 E35
E14 E36 E15 E16 E17 E18 E19 E37 E38 E39 E40 E41 E42 E60 E43 E20 E44 E21 E22 E23 E24 E45 E46 E47 E48
E49 E50 E51 E25 E52 E53 E54 E55 E56 E57 E58 E59 E26(=1.3.0). Numeracja D20: E03=1.2.60, E30=1.2.61, ...

Wydane: E01 1.2.57, E27 1.2.58, E02 1.2.59, E03 1.2.60.

## E03 (1.2.60) - WYDANE 24.09
- PR #5 zmergowany (6ea3bba), release.yml run 45, latest = v1.2.60, manifest sprawdzony (download v1.2.60 zip).
- Gałąź dev przewinięta do 6ea3bba (fast-forward, bez force).
- Odłożone do etapów Rerolla/incydentu (AUDIT §9.2 "Znane luki po E03"): Use item przy Rerollu, krytyczny Strike
  bez obrażeń, ślad gracza bez id w zakładce, Reroll śmiertelnej akcji.
- Raport 1.2.60 wysłany użytkownikowi razem z pytaniem o prawdziwe Foundry v14 dla local-gate (nie blokuje).

## E30 (1.2.61) - W TOKU
- Projekt: scratchpad/e30design/ (00-split, 01-harness, 02-contract, 03-gate, 04-registries, 05-plan = plan commitów C0-C28,
  autorytatywny przy sprzecznościach). Pisany na 411d4da - numery linii przesunięte, szukać po treści.
- Worktree: scratchpad/e30wt (branch e30-wip, od 6ea3bba). Baza do porównań: scratchpad/e30base (6ea3bba, detached).
- Skrypty: v.sh <wt> <outdir> <n-suite> <scen...>; vsum.sh <outdir>; after.sh <DONE-file> <v.sh args>;
  suite-diff: <wt>/audit/harness/suite-diff.mjs a.log b.log [--rename map.json].
- Baza 1.2.60 (e30run/base): suite 292/0/16 x2 identyczne; 00 18/19; 10 19/19; 11 5/6; 12 10/10; 13 20/20; 14 7/7;
  15 9/9; 20 3/3; 30 66/66; 40 37/38; 50 43/43; 60 14/14; proza 497/497; wszystkie exit 0 (błąd C3a).
- Zrobione: C0 suite-diff (5eec697), C1 podział (afb4e8d; verify-split zielony, suite x2 identyczne z bazą),
  C2 higiena (1c0db05; 28 zmian nazw, 0 zmian statusów), C3a exit code + sprzątanie klientów (1aa8901),
  C3b results poza gitem, probes/, layers, note(), lib/seed.mjs (fd4f711; 00-boot 20/20, 11 i 40 exit 1).
  C4 operatory (bb3770a), C5 migrateRemnants + R152 (d975583; 295/0/16), C6 Asystent/accounts/disconnect (dbfb29f),
  C7 relay-guard forwardsUnjudged + 17-assistant + R153 (be89c40; 296/0/16, 17 20/20), C8 wersje (d2cb135; 00 27/27).
  C9a rzuty DH (a7dac13), C9c preUpdate edytuje wysyłaną zmianę (3422d42; 30 67/67 - backstop testowany obejściem
  drpgAutomated + nowy check odmowy u gracza), C9b relay gracza (3ee5627), C10 sześć arkuszy CSS (71a56d1; suite 3m37,
  00 30/30). Suite 296/0/16 identyczne od C7.
  Faza D (agent ae3ffe53e70596dbd): C11 stages (4a8ce97), C12 licznik/expectedRed (552372b), C13 sondy (c5cd25e),
  C14 cięcia R156-158 + tools/check.mjs contract (ba875be), C15a restore (59beafd), C15b worldDump R159 (e41d9c9),
  C16 runTests tier 1 + okno (dd8e0b7). Suite 303/0/16, red 0; 01-runtests 19/19, 5m14. Wypchnięte dd8e0b7.
  Uwagi: stripComments myli "/*" w stringach/regexach (moduł nie ma takich - nieszkodliwe dziś); release.yml
  potrzebuje fetch-depth: 0 dla stages.mjs check --release (C25).
  Do przeglądu E30: anonymity.mjs i overflow.mjs przycinają w preUpdate także zapisy GM-a (brak testu); błąd mgły
  'indexOf' w placeLayer to szum atrapy PIXI (jest już w bazie 1.2.60). Uwagi agenta: resource-guard prune() może gubić usunięcia (zależy od
  LIVE-E30-02/03); v14 może jeszcze honorować '-=' z ostrzeżeniem (LIVE-E30-01) - poprawka działa w obu przypadkach. Równolegle workflow
  projektu E31 (wf_f2c79786-a33, wynik -> scratchpad/e31-design/ + wynik workflow).
- Numery R: R151 (C2), R152 '-=' (C5), R153 Asystent (C7), R154 kontrakt runnera (C12), R155 expectedRed etap (C12),
  R156 gołe cięcia, R157 asercje prawdziwe z konstrukcji, R158 needs tylko sondy (C14), R159 worldDump (C15), R160 FLOWS (C18).
- Briefy agentów: brief-common.md, brief-phaseB.md (C3a-C3b), brief-phaseC1.md (C4-C8). Dalej: C9-C10, C11-C16, C17-C20, C21-C27.
- 24.09 ok. 12:30-13:50 UTC: limit sesji. Agent C1 przerwany w C4 (niezacommitowane futil/shim/operators) - WZNOWIONY
  przez SendMessage (adbe48f65fa07e73e). Workflow E31 przerwany: zapisane 2 mapy (scratchpad/e31-design/map-gmSide.md,
  map-playerSide.md); mapy testów/tekstów, projekt i krytyka - NIE powtarzać workflow, projekt E31 robię sam (+ max 1 agent).
- PROŚBA UŻYTKOWNIKA (24.09): ograniczyć liczbę agentów; używać tylko gdy realnie przyspieszają lub poprawiają jakość.
  Zasada: wznawiać agentów zamiast nowych, łączyć fazy, 1 recenzent na etap, bez spekulacyjnych workflow równoległych.
- DECYZJA (odchylenie od D47, do zgłoszenia użytkownikowi): local-gate nie da się tu uruchomić (brak v14). Domyślnie
  release.yml: local-gate.json musi istnieć, być świeży i związany z commitem; część "not-run" z powodu środowiska
  na 1.2.x przechodzi jako dług z linią "Not checked in a real Foundry" w notatkach; "failed" zawsze blokuje; 1.3.0
  wymaga pełnego przebiegu. Twarda bramka D47 po ustawieniu zmiennej repo DRPG_LOCAL_GATE=enforce (decyzja użytkownika).
- Użytkownik ma skopiować świat przed instalacją 1.2.63 (E04), żeby dało się zrobić pomiar bazowy 1.2.56 (perf) i drill migracji.

## Dalej
- E30 (1.2.61), E31 (1.2.62), E04 (1.2.63; projekt GmStore z workflow wf_8110f70d-8cf nadal aktualny, E04 bez zmian w v2).

## Zasady stałe
- Po polsku do użytkownika, raport tylko przy wydaniu etapu albo blokadzie.
- Nigdy "U+2014"; commit trailers Co-Authored-By + Claude-Session; bez identyfikatorów modelu w repo.
- Notatki wydania i komentarze o przekaźniku: neutralnie, bez opisu ataku.
- Harness: po każdym przebiegu zabić osierocone client-entry.mjs (ps + kill po PID, nie pkill -f).

## PAUZA NA LIMIT TYGODNIOWY (24.09 18:51 UTC)
- Użytkownik: zostało 5% tygodniowego limitu, odnowienie ok. 17:00 UTC 25.09.
- Rutyna godzinowa trig_018WtVVGXJhddg5nV63vNi6n WYŁĄCZONA (enabled=false), żeby nie paliła tokenów.
- Jednorazowe wznowienie: trig_017hb7oYe27jFV82Nut3MvyY o 2026-09-25T17:15Z -> włączyć rutynę z powrotem i kontynuować.
- Agent fazy E (ae3ffe53e70596dbd) dostał polecenie: dokończyć tylko bieżący commit i stanąć; stan w
  scratchpad/e30-phaseE-status.md. Po wznowieniu: przeczytać ten plik, git log e30wt, dokończyć C17-C20, potem F.
- Faza E ZAKOŃCZONA przed pauzą: C17 b11222a, C18 46133ec, C19 4a83b6b, C20 36f1f67 (wypchnięte). Suite 304/0/16,
  wszystkie 14 scenariuszy exit 0, 72-canary 14/21 (7 expected red, 0 failed), known-leaks 9 wpisów, brak NEW.
  Po wznowieniu: od razu faza F (C21-C27, brief-phaseF.md), potem przegląd (1 recenzent) i wydanie 1.2.61.
