# Audyty

## Audyt v1.2.42 (pod 1.2.43)

- `AUDIT-1.2.42.md` - raport (PL): metoda, oceny, co naprawiono, analiza treści, lista zadań do 10/10, live checks, jak wydać.
- `findings-1.2.42/` - surowe znaleziska dziewięciu domen (EN) z cytatami kodu.
- `harness/` - ten sam harness, rozbudowany do 1 GM + 3 graczy; scenariusze `40-flow.mjs` i `50-lang.mjs`.
  Uruchomienie: `cd harness && npm i && node cluster.mjs scenarios/<x>.mjs`.

## Audyt v1.2.13

- `AUDIT-1.2.13.md` - raport (PL), audyt statyczny.

## Audyt v1.1.88 (pod 1.2.0)

- `AUDIT-1.1.88.md` - raport końcowy (PL).
- `findings/` - surowe znaleziska z testów na żywo.
- `harness/` - headless harness mock-Foundry (3 klienci) użyty do audytu.
  Uruchomienie: `cd harness && npm i jsdom && node cluster.mjs scenarios/<x>.mjs`.
  `results/` - zapisane wyniki scenariuszy.

Katalog pomocniczy do audytu - nie jest częścią ładowanego modułu Foundry
(poza `esmodules`/`styles` z manifestu). Do usunięcia lub zachowania wg uznania.
