# Droga do 2.0 - rejestr decyzji właściciela

Każdy wiersz to decyzja właściciela z datą. Zachowanie, które kod, komentarz albo handbook nazywa celowym, a którego
tu nie ma, jest do sprawdzenia w triage (docs/dev/v2/BRIEF.md). Wiersz zmienia tylko właściciel.

| ID | Data | Decyzja | Skąd | Co z tego wynika dla kodu |
| --- | --- | --- | --- | --- |
| D2-01 | 24.11.2026 | Wynik tej pracy wychodzi jako 2.0.0 "Stained update"; wydania testowe 1.9.x jako prerelease | rozmowa z właścicielem | numeracja bez zmian w kodzie (sprawdzone: migrate.mjs, tools/stages.mjs, tools/changelog.mjs, audit/gate) |
| D2-02 | 24.11.2026 | Podział na rdzeń i drugi krąg ustala Claude; nic nie jest wyłączane | rozmowa z właścicielem | tabela w dokumencie planu, sekcja F0 |
| D2-03 | 24.11.2026 | Motyw przy stole: Stained Glass | rozmowa z właścicielem | Stained Glass w rdzeniu, Monokuma legacy w drugim kręgu |
| D2-04 | 24.11.2026 | Testy głosu (S5) przez Claude Code na komputerze właściciela | rozmowa z właścicielem | - |
| D2-05 | 24.11.2026 | Świat testowy na tym samym koncie Forge co kampania | rozmowa z właścicielem | wersja modułu wspólna dla obu światów: procedura przed i po testach (dokument planu, F3) |
| D2-06 | 24.11.2026 | Gdy ofiara przeżyła incydent, maska zabójcy zostaje do końca pory dnia albo do wyjścia zabójcy z pokoju, cokolwiek nastąpi pierwsze | odpowiedź na MURDER-02 (F1-murder.md) | dziś maska spada także z końcem incydentu (mask-gm.mjs, murder-rules.mjs wg F1-murder.md); do zmiany. Doprecyzowuje decyzję z 23.11.2026 "maska zawsze spada na końcu" |
| D2-07 | 24.11.2026 | Triage paczek 1 i 2: rekomendacje Claude przyjęte; paczka 3: rekomendacje przyjęte, wyjątki w kolumnie "Twoja uwaga" (TRIAGE-3.md) | rozmowa z właścicielem | statusy w dokumencie planu ustawione na "Zatwierdzone"; otwarte pod-pytania przy MURDER-01 (maska przy Hope albo krytyku poza Eclipse) |
| D2-08 | 24.11.2026 | Gdy rzut otwarcia morderstwa się nie uda, ofiara dostaje powiadomienie o próbie | uwaga do F1-blind-player.md | nowe zachowanie. Założenie do potwierdzenia: powiadomienie nie mówi, kto próbował |
| D2-09 | 24.11.2026 | Rzuty w incydencie nie dają Despair ani Hope | uwaga do F1-blind-player.md (EXP-PL-03) | dziś rzut otwarcia i rzuty kryzysu dają Despair (murder-rules.mjs wg F1-verify.md). Założenie do potwierdzenia: dotyczy rzutów należących do incydentu (otwarcie, kryzys), nie zwykłych rzutów postronnych w tym czasie |
