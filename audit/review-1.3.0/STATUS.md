# STATUS weryfikacji 1.3.0 (gałąź audit-130)

Aktualizacja: 12.11.2026

## Gdzie jest metoda i wzór
- Metoda audytu: artefakt "DRPG Audyt 1.3.0 Stained Update", JSON `<script id="data">`, pole `meta.method` (recenzenci obszarów, przekroje, weryfikacja kontradyktoryjna: niezależny weryfikator próbuje obalić każde zgłoszenie krytyczne, wysokie i średnie; granice zapisane wprost).
- Metoda weryfikacji etapów: `verification.intro` (kod na wersji etapu i na najnowszym wydaniu, uruchomienie zamiast czytania, mutacje, sceptyk do każdego wyniku) oraz `plan.stages[E83].verify` (pełna metoda: zgłoszenia, przekroje, na żywo, mutacje, sceptyk, krytyk kompletności, sędzia).
- Wzór: `verification.stages[]` (E01, E02): pola id, version, checkedOn, date, verdict, short, summary, versionChoice, conclusion, criteria[text,status,evidence], issues[key,verdict,at1267,notePl], defects[id,title,severity,kind,where,problem,fix,owner,group,issueKey], measurements[what,result], limits. Oceny: `verification.scores[]` (unit,name,old,now,why,stage). Strona czyta `at1267` jako kolumnę wersji `verification.latest`, więc klucz zostaje, a `latest` ma być "1.2.104" (verification-meta.json).
- Etap przeglądu wszystkich etapów: **E83** ("STOP przed 1.3.0 ... audytor recenzuje kod i weryfikuje każdy etap").

## Zakres
65 etapów wydanych (tools/stages.json @ 1.2.104, b97028e); E01 i E02 już zweryfikowane w audycie, do zrobienia 63 (w tym E84, E90, E96 bez wpisu w planie). Kod: 1.2.104 (main) i tag wersji każdego etapu.

## Odchylenie od pełnej metody (do decyzji właściciela)
Pełna metoda E83 to ok. 24 agentów i ok. 5 mln tokenów na etap oraz przebiegi na żywo w sandboksie Foundry :30099. W tym kontenerze nie ma Foundry ani sandboksu, więc nic nie jest sprawdzone na żywo; każdy werdykt mówi to w `limits`. Na etap: weryfikator (pomiary w harnessie, mutacje w kopii roboczej poza repo) i sceptyk, który próbuje obalić każdy werdykt i defekt; na koniec krytyk kompletności w E83.
Pytanie Q1: czy taki skład wystarcza zamiast 24 agentów na etap? Proponowana odpowiedź domyślna: tak dla werdyktu, a przebiegi na żywo zostają jako lista do zrobienia w sandboksie (E83 verify (1)).

## Zrobione
- (nic jeszcze)

## W toku
- Pomiar bazowy 1.2.104 (b97028e), `node run-tests.mjs --tier 1` w audit/harness: 1108 testów uruchomionych, 1093 passed, 0 failed, 16 skipped, 0 red, 291,9 s (12.11.2026, 4 rdzenie, obok dwa agenty). Uwaga do sprawdzenia: 1093 + 0 + 16 = 1109, a nie 1108.
- Próba metody na E27, E03, E30 (weryfikator + sceptyk na etap), potem reszta etapów w kolejności wydań.
- Przegląd modułu: 45 jednostek audytu (36 obszarów U i 9 przekrojów L), recenzent + weryfikator kontradyktoryjny na jednostkę, wyniki w units/.

## Dalej
- Weryfikacja etapów w kolejności wydań, potem przegląd modułu (modul.md, scores.json), potem E83.

## Blokery
- Brak Foundry v14 i sandboksu: żadnych pomiarów na żywo.

## Tokeny (szacunek)
- do tej pory: ok. 0,3 mln (czytanie artefaktu i przygotowanie)
