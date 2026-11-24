# F3 na Forge - S0: kontrola stołu (24.11.2026)

Narzędzie: `audit/forge/doctor.mjs`. Gra: Forge, świat `drpg-qa-forge` (kopia kampanii po resecie sezonu, konta GM1, GM2,
P1-P4 bez haseł, gra publiczna). Przeglądarki: Chromium w kontenerze bez GPU (4 rdzenie, 15 GB), przez proxy sesji.
Raporty i zrzuty: `audit/forge/out/` (poza repozytorium, `.gitignore`). Cztery przebiegi; liczby niżej z czwartego
(17:31Z), chyba że napisano inaczej.

## Co zmierzone

| Co | Wynik | Uwagi |
| --- | --- | --- |
| Wersje | Foundry 14.370, Daggerheart 2.12.8, danganronpa-rpg 1.2.129, avclient-livekit 0.6.8, dice-so-nice 6.4.5, isometric-perspective 14.0.6 | `module.json` deklaruje verified Foundry 14.365 i Daggerheart 2.12.9 |
| Zalogowane konta | 5 z 6 (GM2 nie zdążył: formularz /join nie pojawił się w 30 s, trzy próby) | obciążenie kontenera, nie Forge (niżej) |
| Główny GM | GM1 na każdej przeglądarce | zgodne z regułą `primaryGmId` |
| Motyw | Stained Glass na każdej przeglądarce | |
| Kontrakt modułu (`game.drpg.diagnosePatches`) | 46 ok, 0 niezgodnych, 24 nieodczytane | nieodczytane: haki, które S0 nie wywołuje (arkusz, rzut, okno obrazka) i pozycje "tylko przy stole" |
| Błędy JavaScript z modułu (`window.__errors`) | 0 na każdej przeglądarce | |
| Brakujące klucze tłumaczeń | 0 | |
| Głos | klient LiveKit Forge (`livekit.forge-vtt.com`), stan "disconnected" | host celowo zablokowany w tej sesji; głos testowany z komputera właściciela (D2-04) |

## Znaleziska

| ID | Co | Dowód | Waga (rekomendacja) | Pewność |
| --- | --- | --- | --- | --- |
| FORGE-01 | Kopia sprawy na serwerze (planer zagadki dzielony między GM-ami, E111) nie zapisuje się na Forge u GM-a niezalogowanego do konta Forge: `FilePicker.upload` do źródła "data" odpowiada "Access Unauthorized. Please enter your API key or sign in to The Forge." Na GM1 jednocześnie: "The case planner is empty here and the server holds no copy of it". Jeśli GM-owie kampanii wchodzą bez konta Forge, planer nie przechodzi między GM-ami i między komputerami. | GM1, przebieg 4: powiadomienie i konsola `danganronpa-rpg \| The case's server copy could not be written Access Unauthorized...`; kod: `scripts/case-copy.mjs` `writeServerCopy` (FP.upload "data"); model zabezpieczeń w nagłówku pliku zakłada serwer Foundry, nie Forge | major (do potwierdzenia: jak logują się GM-owie kampanii) | zmierzone na GM1 bez konta Forge |
| FORGE-02 | GM1 stracił połączenie z serwerem i odzyskał je ("You have lost connection to the server, attempting to re-establish." / "Server connection re-established.") | GM1, przebieg 4 | do obserwacji: przy przeciążonym kontenerze nie da się odróżnić od przyczyny po stronie testu | jeden odczyt |
| FORGE-03 | Gdy LiveKit nie może się połączyć, gracz dostaje stos czerwonych powiadomień "Error connecting to LiveKit Server" (5 na ekranie P1) obok kafelka modułu "Voice disconnected" | zrzuty p1-1920x1080, gm1-1366x768 | minor (powiadomienia są avclient-livekit, nie modułu; moduł mógłby je zbierać w jedno) | zmierzone, przy sztucznie zablokowanym LiveKit |

## Ograniczenia tego środowiska (nie błędy modułu)

- Pierwszy przebieg pokazał 14 niezgodności kontraktu: były skutkiem zablokowanego `assets.forge-vtt.com` (Forge serwuje z niego pliki systemu i modułów). Po dopuszczeniu hosta: 0.
- Bez GPU sześć przeglądarek rysuje płótno procesorem; logowania i zrzuty przekraczały limity. Przebieg 4 z najniższym trybem wydajności Foundry i 10 kl./s w przeglądarkach testowych: 5 z 6 logowań, wszystkie zrzuty zalogowanych. Cięższe scenariusze (S1-S4, S6) mogą wymagać komputera właściciela.
- Konsola każdej przeglądarki ma ostrzeżenia WebGL o programowym renderowaniu (`texImage2D`, `glGenerateMipmap`) - skutek braku GPU.

## Czego S0 nie sprawdza

Rzutów, arkusza postaci, ruchu, morderstwa, procesu, głosu i rozłączeń - to S1-S7.
