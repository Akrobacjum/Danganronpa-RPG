# Sesja 0 - karta wyników

Wypełniaj w trakcie sesji, krótko. Po sesji ta karta wraca do audytu: każdy kod sprawdzenia ma w `coverage.json` listę
identyfikatorów LIVE, które rozstrzyga, więc "zaliczone" przy kodzie zamyka je w `audit/AUDIT-1.2.42.md` sekcja 9.2,
a "nie zaliczone" otwiera usterkę z twoją notatką.

## Stół

| Pole | Wartość |
| --- | --- |
| Data i godzina | |
| Wersja modułu (`game.modules.get("danganronpa-rpg").version`) | |
| Foundry / Daggerheart / Dice So Nice / avclient-livekit / Isometric Perspective | |
| Gdzie (The Forge, LAN, inny) | |
| GM-owie (ilu, kto główny, czy Asystent) | |
| Gracze (ilu, przeglądarki, systemy) | |
| Motyw i język każdego (GM, A, B, C) | |
| Rozmiar ekranu GM-a i najmniejszy u gracza | |
| Czy sesja doszła do: Eclipse / morderstwa / odkrycia / Class Trial / egzekucji | |

## Wyniki

Wynik: **OK** (zaliczone), **X** (nie zaliczone), **-** (nie robione), **N** (nie doszło w fabule), **C** (częściowo -
napisz, co zrobione). Gdy sprawdzenie ma kilka kroków, a padł jeden, wpisz X i numer kroku w notatce (np. "X: krok 4").

| Kod | Sprawdzenie | Waga | Wynik | Notatka (godzina, co się stało, numer kroku) | Zrzuty / pliki |
| --- | --- | --- | --- | --- | --- |
| A1 | Wersje i czysta konsola | krytyczne | | | |
| A2 | Strażnik przekaźnika i raport `diagnose()` | krytyczne | | | |
| A3 | Testy tierów 0-1 i odczyty stylu | krytyczne | | | |
| A4 | Ustawienia modułu, Ustaw sezon i Kontrola przed sezonem | ważne | | | |
| A5 | Kopia świata: tier 2 i zapisy z konsoli | ważne | | | |
| A6 | Ustawienia pokoi, przejścia, zdjęcia i realizacja | ważne | | | |
| A7 | Okna modułu na ekranie | miłe | | | |
| B1 | Pierwsze logowanie gracza | ważne | | | |
| B2 | Wygląd kości i Dice So Nice | ważne | | | |
| B3 | Głos na starcie (avclient-livekit) | krytyczne | | | |
| B4 | Pierwszy rzut gracza dociera do GM-a | krytyczne | | | |
| C1 | Ruch: pierwsze przeciągnięcie do nowego pokoju | krytyczne | | | |
| C2 | Mgła, obrys pokoju, drzwi i płótno | ważne | | | |
| C3 | Akcje, rzuty i Reroll | krytyczne | | | |
| C4 | Hope Calls, Despair, zegar i Monocub | ważne | | | |
| C5 | Przedmioty i karta postaci | ważne | | | |
| C6 | Projekty | ważne | | | |
| C7 | Tajne przejścia, tunele i schody | ważne | | | |
| C8 | Komunikator, powiadomienia i Safeword | ważne | | | |
| C9 | Dźwięk i muzyka | miłe | | | |
| D1 | Eclipse | ważne | | | |
| D2 | Otwarcie morderstwa i walka | krytyczne | | | |
| D3 | Rzuty w walce: Breakdown, Resolve, broń i Reroll | ważne | | | |
| D4 | Pułapka i pośrednie morderstwo | ważne | | | |
| D5 | Stage 6: sprzątanie, ciało i łup | ważne | | | |
| E1 | Odkrycie ciała | krytyczne | | | |
| E2 | Śledztwo: Observe, Analyze, mapa sprawy | ważne | | | |
| F1 | Wejście do sali rozpraw | krytyczne | | | |
| F2 | Debata, Objection i tryby | ważne | | | |
| F3 | Głosowanie, werdykt i Level Up | krytyczne | | | |
| G1 | Egzekucja i powrót do szkoły | krytyczne | | | |
| G2 | Koniec rozdziału | ważne | | | |
| H1 | Dwóch GM-ów przy jednym stole | ważne | | | |
| J1 | GM wychodzi, przeładowuje albo traci sieć | krytyczne | | | |
| J2 | Gracz próbuje z konsoli | ważne | | | |
| Z1 | Co zostało w zapisach GM-ów | ważne | | | |
| I1 | Kurtyna, róg i okna Foundry | miłe | | | |
| I2 | Układ przy różnych rozmiarach i powiększeniu | miłe | | | |
| P1 | Liczba klatek i praca modułu | ważne | | | |
| P2 | Zerwania głosu | ważne | | | |
| K1 | Czytnik ekranu | ważne | | | |
| K2 | Firefox, wtyczki i tablet | ważne | | | |
| K3 | Scena testowa z dwoma piętrami | ważne | | | |
| K4 | Moduły towarzyszące wyłączone | miłe | | | |
| L1 | `npm run gate:local` | ważne | | | |

## Porażki szczegółowo

Jedna sekcja na każde X. Skopiuj i wypełnij.

```
Kod i krok:
Godzina:
Kto (GM / gracz A / ...), przeglądarka, motyw, język, rozmiar ekranu:
Co zrobiłem/zrobiłam:
Co się stało:
Czego się spodziewałem/spodziewałam (z pakietu):
Linia z konsoli (F12) albo komunikat, dosłownie:
Pliki (zrzuty, wyniki poleceń):
```

## Odczyty z konsoli

Wklej albo dołącz pliki: wynik `game.drpg.runTests()` (cztery liczby), `game.drpg.relayGuard()`, raport
`game.drpg.diagnose()`, `perf()` i `fps()` z każdego komputera, wyniki z Z1.
