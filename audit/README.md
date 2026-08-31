# Audyt v1.1.88 (pod 1.2.0)

- `AUDIT-1.1.88.md` - raport końcowy (PL).
- `findings/` - surowe znaleziska z testów na żywo.
- `harness/` - headless harness mock-Foundry (3 klienci) użyty do audytu.
  Uruchomienie: `cd harness && npm i jsdom && node cluster.mjs scenarios/<x>.mjs`.
  `results/` - zapisane wyniki scenariuszy.

Katalog pomocniczy do audytu - nie jest częścią ładowanego modułu Foundry
(poza `esmodules`/`styles` z manifestu). Do usunięcia lub zachowania wg uznania.
