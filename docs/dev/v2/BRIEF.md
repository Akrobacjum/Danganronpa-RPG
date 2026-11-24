# Droga do 2.0 - brief inwentaryzacji F1 i F2

Napisane 24.11.2026 na 1.2.128 (8f059800). Plan całości: dokument właściciela "Danganronpa RPG - droga do 2.0".
Ten plik to wspólna instrukcja dla każdego czytającego jedną domenę.

## Cel

Właściciel gra z 2 GM-ami i 4 graczami na Forge. Na sesjach 0 wychodziły zachowania, które kod, komentarze i
handbooki opisują jako celowe, a które przy stole są nielogiczne (przykład: drugi GM nie mógł akceptować akcji
graczy). Ta inwentaryzacja ma wypisać, co każda rola może zrobić w każdej fazie gry, każde ograniczenie z jego
warunkiem i komunikatem, oraz każde czekanie na drugą osobę z tym, co się dzieje, gdy ta osoba zniknie.
Decyzję "błąd czy zamiar" podejmuje właściciel (triage). Czytający daje rekomendację, nie decyzję.

## Zasady

1. Czytasz kod na HEAD (1.2.128). Nie zmieniasz niczego w `scripts/`, `styles/`, `lang/`. Piszesz wyłącznie swój
   plik wynikowy `docs/dev/v2/F1-<domena>.md`. Nie commitujesz.
2. Komentarz w kodzie albo zdanie w handbooku, że coś jest "celowe", to twierdzenie, nie uzasadnienie. Zapisujesz je
   w kolumnie "Uzasadnienie w repo", a rekomendację opierasz na pytaniu: czy GM albo gracz przy stole 2 GM-ów i
   4 graczy rozsądnie by się tego spodziewał?
3. Każdy wiersz ma dowód `plik:linia`. Nie twierdzisz niczego, czego nie przeczytałeś. Pewność: "przeczytane" (jeden
   odczyt) albo "sprawdzone" (prześledzone od przycisku do zapisu). Niczego tu nie uruchamiamy; pomiar przyjdzie na
   Forge (F3).
4. Model ról: główny GM to podłączony pełny GM (rola 4) o najmniejszym id (`utils.mjs`, `primaryGmId`). Drugi GM to
   każdy inny pełny GM. Gracz żywy, gracz martwy (Widz), Monokuma (postać prowadzona przez GM-a). Assistant GM
   (rola 3) pomijasz, chyba że coś jest dla niego wyraźnie inne.
5. Punkty startowe, do ponownego sprawdzenia na HEAD: `docs/dev/owner128/SECOND-GM.md` (9 dróg drugiego GM-a z
   1.2.127; 1.2.128 miało je poprawić), `audit/findings-1.2.118/` (znaleziska audytu, pliki `domain-*` i `controls-*`),
   `docs/handbooks/gm-handbook.pl.md` i `player-handbook.pl.md` (co obiecano).
6. Wagi rekomendacji: `blocker` - przerywa sesję albo zdradza tajemnicę (np. zabójcę); `major` - funkcja nie działa
   albo działa nielogicznie, jest obejście; `minor` - niewygoda; `nit` - kosmetyka.
7. Klasy rekomendacji: `błąd` (kod robi co innego, niż obiecano), `zły zamiar` (robi, co zaplanowano, ale plan jest
   nielogiczny przy stole), `niejasny` (zamiar dobry, gracz albo GM tego nie zrozumie bez komunikatu), `zostaje`.
8. Po polsku. Myślnik to `-`, nigdy długa kreska. Skupiasz się na rdzeniu swojej domeny; drugi krąg tylko wtedy,
   gdy blokuje rdzeń. Sekcja B ma najwyżej ~60 wierszy, najważniejsze pierwsze.

## Format pliku wynikowego

```
# F1 - <domena>

Przeczytane na <sha>, <data>. Pliki: <lista>.

## A. Macierz: rola x faza x akcja
| # | Akcja (jak ją widzi użytkownik) | Faza | GM główny | GM drugi | Gracz | Widz | Dowód |
Wartości komórek: działa / przez głównego (przekazane głównemu GM-owi) / odmowa: <komunikat> / cicho (nic się nie
dzieje, bez komunikatu) / brak (nie pokazane) / n/d.

## B. Kandydaci do triage
| ID | Co się dzieje | Warunek | Komunikat (klucz i polski tekst) | Dowód | Uzasadnienie w repo | Klasa | Waga | Dlaczego (perspektywa stołu) | Pewność |
ID: <DOMENA>-NN, np. DAY-01.

## C. Ścieżki awarii (F2)
| ID | Kto czeka | Na kogo / na co | Limit czasu (wartość i skąd) | Gdy tamten się rozłączy | Gdy tamten odświeży stronę | Droga wyjścia dla GM-a | Dowód |

## D. Czego nie sprawdziłem
```
