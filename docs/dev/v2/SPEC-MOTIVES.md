# Cele graczy (Motives) - specyfikacja robocza do 2.0 (D2-23)

Napisane 27.11.2026 ze słów właściciela. Szkic: sekcja "Otwarte pytania" musi być rozstrzygnięta, zanim powstanie
pierwszy test. Zastępuje obecny Monokuma Motive (ustawienie `motive`, Despair Call z `setsMotive`, `rules.mjs`), który
dziś jest publicznym "powodem do zabójstwa" z terminem i ceną za niewykonanie (config.mjs, `motive`; podręcznik zasad
s. 16).

## Trzy cele

| Cel | Kto zna | Kto nadaje | Nagroda | Rytm |
| --- | --- | --- | --- | --- |
| **Monokuma Motive** | wszyscy gracze (może być ukryty i odsłaniany, gdy GM zdecyduje) | Monokuma, przez Despair Call "Monokuma Motive" (nadanie albo zmiana) | 3 Hope dla każdego gracza | wiele razy w rozdziale; ma karę za niewykonanie |
| **Personal Motive** | gracz i GM-owie | GM: panel GM-a, Students, karta postaci, zakładka "Personal" | 3 Hope dla gracza | co rozdział |
| **Relationship Motive** | gracz i GM-owie, ściśle tajny | jak wyżej | 3 Hope dla gracza | co rozdział |

- **Monokuma Motive** zawsze dotyczy współpracy (np. odkrycie wszystkich pokojów, ukończenie projektu). Zmieniając albo
  cofając cel, Monokuma wybiera, czy poprzedni był zaliczony.
- **Personal Motive** może szkodzić innym (sabotaż projektu, pomoc zabójcy w procesie, tamperowanie miejsca zbrodni) albo
  nie (zbijanie Despair Overflow, Support dla innych, gromadzenie Hope, ukończenie projektu, obrona korytarzy).
- **Relationship Motive** zawsze dotyczy innego gracza (przeszkodzić komuś, zamknąć kogoś, wspierać kogoś, dopilnować, by
  ktoś przeżył albo nie zabił).
- Cele prywatne GM wpisuje ręcznie, bez gotowych wzorów, ustalając je z graczem albo narzucając, z poszanowaniem
  charakteru postaci i jej relacji. GM sam weryfikuje ich realizację.

## Przebieg zaliczenia

1. Gracz, który zrealizował Personal albo Relationship Motive, naciska przycisk w karcie postaci i pisze GM-owi, co
   zrobił. To trafia do GM-ów jako prośba do rozstrzygnięcia.
2. GM zalicza albo odrzuca. GM może też zaliczyć cel sam: panel GM-a, Students.
3. Zaliczenie daje 3 Hope i **nowy, prywatny dźwięk** potwierdzenia, słyszany tylko przez tego gracza.
4. Po Class Trial moduł pyta GM-a: "zaznacz, kto zrealizował wszystkie cele" (Relationship, Personal i wszystkie
   Monokuma Motive rozdziału). Zaznaczeni dostają 1 Level Up. GM zaznacza ręcznie.
5. Level Up z samego procesu się nie zmienia: odgadnięcie zabójcy daje Level Up wszystkim, przetrwanie zabójcy daje mu
   reinforced Level Up.

## Interfejs

- Zakładka "Biography" w karcie postaci zmienia nazwę na **"Personal"**: na górze cele (Personal i Relationship, a
  także bieżący Monokuma Motive), niżej biografia w obecnej postaci.
- Panel GM-a, Students: cele każdego ucznia, ich stan i przycisk zaliczenia.

## Tajność (z modelu zaufania modułu)

Cele prywatne nie mogą trafić do przeglądarki innego gracza w żadnej postaci: ani w karcie, ani w czacie, ani w danych
świata, które każda przeglądarka dostaje (EXP-PL-15: konsola gracza czyta dane świata). Przechowywanie jak inne
tajemnice: magazyny GM-ów (`gm-stores.mjs`) i prywatne karty (`secret.mjs`), a do gracza tylko jego własne cele.

## Otwarte pytania

1. **Kara za niewykonanie Monokuma Motive** - stała mechanika (np. Despair dla Monokum, utrata Hope) czy tekst wpisany
   przez Monokumę przy nadaniu, wykonywany ręcznie? Obecny motyw ma pole `consequence`.
2. **Ukryty Monokuma Motive** - co widzą gracze, gdy jest ukryty: nic, czy "jest cel, ale nieznany"?
3. **Limit Hope** - Daggerheart ma maksimum Hope. Co z nagrodą 3 Hope, która przekroczy maksimum: przepada, czy zostaje
   ponad limit?
4. **Ile celów naraz** - jeden Personal i jeden Relationship na gracza na rozdział? Czy Monokuma Motive może być więcej
   niż jeden naraz, czy tylko po kolei?
5. **Termin** - obecny motyw ma liczbę pór dnia. Czy Monokuma Motive dalej ma termin, czy trwa do zmiany albo końca
   rozdziału?
6. **Prompt po procesie** - czy moduł ma wstępnie zaznaczyć graczy, którzy według zapisów zrealizowali wszystkie cele
   (GM może odznaczyć), czy lista ma być pusta?
7. **Zmarli i widzowie** - czy martwy gracz ma cele, i czy cel zaliczony przed śmiercią liczy się do Level Upu?
8. **Dźwięk** - masz plik dźwięku potwierdzenia, czy mam użyć jednego z dźwięków, które moduł już ma (z możliwością
   podmiany w oknie Dźwięk)?
9. **Dotychczasowy motyw** - obecny Monokuma Motive (powód do zabójstwa z terminem i ceną) znika całkiem, czy zostaje
   jako osobny Despair Call obok nowego?
