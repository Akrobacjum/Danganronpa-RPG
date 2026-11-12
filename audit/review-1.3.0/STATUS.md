# STATUS weryfikacji 1.3.0 (gałąź audit-130)

Aktualizacja: 12.11.2026, ok. 00:55 UTC. **Wstrzymane** na polecenie koordynatora (decyzja właściciela, 12.11): oba przebiegi zatrzymane, nic nowego nie jest uruchomione. Ten plik opisuje stan w chwili zatrzymania.

## Gdzie jest metoda i wzór
- Metoda audytu: artefakt "DRPG Audyt 1.3.0 Stained Update", JSON `<script id="data">`, pole `meta.method` (recenzenci obszarów czytający pliki w całości, przekroje, weryfikacja kontradyktoryjna: niezależny weryfikator próbuje obalić każde zgłoszenie krytyczne, wysokie i średnie; granice zapisane wprost).
- Metoda weryfikacji etapów: `verification.intro` (kod na wersji etapu i na najnowszym wydaniu, uruchomienie zamiast czytania, mutacje, sceptyk do każdego wyniku) oraz `plan.stages[E83].verify` (pełna metoda: zgłoszenia, przekroje, na żywo, mutacje, sceptyk, krytyk kompletności, sędzia).
- Wzór: `verification.stages[]` (E01, E02): id, version, checkedOn, date, verdict, short, summary, versionChoice, conclusion, criteria[text,status,evidence], issues[key,verdict,at1267,notePl], defects[id,title,severity,kind,where,problem,fix,owner,group,issueKey], measurements[what,result], limits. Oceny: `verification.scores[]` (unit,name,old,now,why,stage). Strona czyta `at1267` jako kolumnę wersji `verification.latest`, więc klucz zostaje, a przy wstawianiu `latest` trzeba ustawić na "1.2.104".
- Dozwolone wartości (z kodu strony): verdict "zatwierdzone" / "zatwierdzone z uwagami" / "do poprawy"; issues.verdict fixed/partial/not_fixed/regressed/superseded; at1267 holds/changed_ok/regressed/unknown; criteria.status met/partial/not_met/unknown; group pilne/decyzja/etap/zamkniete/proces; defekt z owner zaczynającym się od "poprawka" strona pokazuje przy etapie, pozostałe jako przekazane dalej.
- Etap przeglądu wszystkich etapów: **E83** ("STOP przed 1.3.0 ... audytor recenzuje kod i weryfikuje każdy etap").

## Zakres
65 etapów wydanych według tools/stages.json @ 1.2.104 (b97028e); E01 i E02 zweryfikowane już w audycie, do zrobienia 63 (w tym E84, E90, E96 bez wpisu w planie, ich specyfikacją są notatki wydania). Kod: worktree 1.2.104 i tag wersji każdego etapu (tagi v1.2.57..v1.2.104 są dostępne po `git fetch --tags`).

## Zrobione (pliki w tym katalogu)
Wszystko poniżej to **szkice jednego przebiegu, bez sceptyka**. Wzór audytu wymaga sceptyka do każdego wyniku, więc żadnego z tych werdyktów nie należy wstawiać do audytu jako ostatecznego.
- `E27.json`, `E27.md`: weryfikator, werdykt szkicu "zatwierdzone z uwagami" (2 problemy z audytu: 2 fixed; 9 defektów: 6 low, 3 info; jeden w grupie pilne). checkstage: OK. Sceptyk E27 był w toku, plików nie zmienił (czas zapisu 00:36, przed jego startem).
- `E03.json`, `E03.md`: weryfikator, werdykt szkicu "zatwierdzone z uwagami" (22 problemy: 21 fixed, 1 partial S01-10; 9 defektów: 2 medium, 2 low, 5 info). checkstage: OK. Sceptyk nie wystartował.
- `units/U24-gm-bridge.json`: recenzja jednostki na 1.2.104, ocena szkicu 5 -> 8 (9 znalezisk: 1 medium, 7 low, 1 info). Bez weryfikatora kontradyktoryjnego; ocena 8 jest niepotwierdzona.
- `units/L02-security-leaks.json`: recenzja przekroju na 1.2.104, ocena szkicu 4 -> 7 (4 znaleziska: 3 medium, 1 low). Bez weryfikatora; ocena niepotwierdzona.
- Pomiar bazowy 1.2.104 (b97028e), `node run-tests.mjs --tier 1` w audit/harness: 1108 testów uruchomionych, 1093 passed, 0 failed, 16 skipped, 0 red, 291,9 s (12.11.2026, 4 rdzenie, równolegle dwa agenty). Do sprawdzenia: 1093 + 0 + 16 = 1109, a nie 1108 (rozjazd o jeden test w liczniku runnera, niesprawdzony).

## W toku w chwili zatrzymania (przerwane, bez wyników)
- Weryfikator E30 (1.2.61): przerwany, pliku nie zapisał.
- Sceptyk E27: przerwany, pliku nie zmienił.
- Recenzenci jednostek U09-murder i U35-tests: przerwani, plików nie zapisali.
- Kolejka niewystartowana: 41 pozostałych jednostek przeglądu modułu i 60 pozostałych etapów.

## Następny krok (gdy praca wróci)
1. Sceptyk dla E27 i E03 (poprawia pliki w miejscu, dopisuje pomiar "Sceptyk:"), weryfikator i sceptyk dla E30; potem pozostałe etapy w kolejności wydań: E31, E04, E05, E06, E32, E07, E08, E28, E29, E33, E34, E09, E10, E75, E11, E12, E13, E81, E77, E78, E84, E79, E80, E85, E86, E18, E19, E35, E14, E36, E15, E16, E17, E87, E88, E70, E89, E20, E52, E90, E50, E51, E65, E66, E37, E41, E42, E60, E44, E21, E22, E23, E24, E45, E96, E46, E47, E95, E68.
2. Weryfikator kontradyktoryjny dla U24-gm-bridge i L02-security-leaks, potem pozostałe 43 jednostki (U i L), synteza obszarów S01-S15 w `modul.md` i `scores.json`.
3. E83: ponowne sprawdzenie defektów E01 i E02 na 1.2.104, krytyk kompletności nad wszystkimi werdyktami, indeks w README.md.
Narzędzia przebiegu (poza repo, w scratchpad sesji; przy nowej sesji trzeba je odtworzyć): pakiety wejściowe etapów (wpis planu + ledger + pełny tekst problemów) i jednostek (werdykt, pliki, problemy, nowe pliki po podziałach E34/E41/E54), `hrun` (najwyżej 3 przebiegi harnessu naraz, blokada 84-viewports), `checkstage` (kształt wpisu i reguły tekstu), `gitpush` (szeregowy commit i push tylko plików z audit/review-1.3.0).

## Odchylenie od pełnej metody (pytanie do właściciela)
Pełna metoda E83 to ok. 24 agentów i ok. 5 mln tokenów na etap oraz przebiegi na żywo w sandboksie Foundry :30099. W tym kontenerze nie ma Foundry ani sandboksu, więc nic nie jest sprawdzane na żywo; każdy werdykt ma to zapisać w `limits`. Skład tu: na etap weryfikator (harness, mutacje w kopii roboczej poza repo) i sceptyk; na jednostkę recenzent i weryfikator kontradyktoryjny; na końcu krytyk kompletności w E83.
- Q1: czy taki skład wystarcza zamiast ok. 24 agentów na etap? Proponowana odpowiedź domyślna: tak dla werdyktu, a przebiegi na żywo zostają jako lista do zrobienia w sandboksie (E83 verify (1)).
- Q2: maszyna ma 4 rdzenie, więc jeden przebieg może prowadzić tylko 2 agentów naraz; cała praca to ok. 220 agentów. Proponowana odpowiedź domyślna: kilka przebiegów równolegle (do 6 agentów), harness nadal najwyżej 3 naraz.

## Blokery
- Brak Foundry v14 i sandboksu: żadnych pomiarów na żywo.
- Praca wstrzymana decyzją właściciela (12.11).

## Tokeny (szacunek, bez dokładnego licznika)
- Główna sesja: ok. 0,4 mln (czytanie artefaktu, przygotowanie, koordynacja).
- Agenci: 4 zakończonych (E27, E03, U24, L02) i 5 przerwanych; szacunek ok. 2-4 mln łącznie.
