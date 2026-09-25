# Audyty i testy

Katalog pomocniczy: `audit/` jest w `.gitattributes` jako `export-ignore`, więc
nic z niego nie trafia do `module.zip` ani do modułu ładowanego przez Foundry.

## Co tu jest dziś (E30, 24.09.2026)

- `harness/` - headless harness: shim Foundry i czterech klientów jsdom (GM i
  trzech graczy; w `17-assistant` piąty, Asystent GM-a). Raz `cd harness && npm ci`
  (jsdom, ESLint, espree, Playwright bez przeglądarek), potem `npm test`: lint,
  `tools/check.mjs`, autotest bramki, suite i każdy scenariusz z warstwą `ci`.
  Jeden scenariusz: `node cluster.mjs scenarios/<x>.mjs`. Harness uruchamia
  checkout, w którym leży, albo ten wskazany w `DRPG_REPO`. `harness/README.md`
  ma rejestr numerów scenariuszy z ich warstwami i listę tego, czego harness nie
  umie.
- `harness/results/` - wyniki i logi przebiegów, zapisywane od nowa przy każdym;
  git ich nie śledzi (`.gitignore`, od E30).
- `gate/` - druga warstwa bramki wydania (D47): `local-gate.mjs` zapisuje
  `local-gate.json` na maszynie z sandboxem Foundry v14, `verify-gate.mjs`
  sprawdza go w `release.yml`, w trybie `record` albo `enforce` (`gate/README.md`).
- `live/` - runner dla prawdziwego Foundry v14: tier 2 w obu motywach, diff
  świata, scenariusze w sandboxie, seed świata, pomiar wydajności 1.2.56.
  **Nigdy nie uruchomiony na prawdziwym Foundry** (`live/README.md`).
- `perf-baseline.json` - bazowy pomiar wydajności 1.2.56: jeszcze niezmierzony,
  z zapisem próby i tego, czego zabrakło.
- `glass-harness.html`, `pack-harness.html` - kurtyna i pakiet dowodów bez
  Foundry (`python3 -m http.server 8765` w katalogu repozytorium).

## Audyt v1.2.42 (pod 1.2.43)

- `AUDIT-1.2.42.md` - raport (PL): metoda, oceny, co naprawiono, analiza treści, lista zadań do 10/10, live checks, jak wydać.
- `findings-1.2.42/` - surowe znaleziska dziewięciu domen (EN) z cytatami kodu.
- `harness/` - ten sam harness, rozbudowany wtedy do 1 GM + 3 graczy; scenariusze `40-flow.mjs` i `50-lang.mjs`.

## Audyt v1.2.13

- `AUDIT-1.2.13.md` - raport (PL), audyt statyczny.

## Audyt v1.1.88 (pod 1.2.0)

- `AUDIT-1.1.88.md` - raport końcowy (PL).
- `findings/` - surowe znaleziska z testów na żywo.
- `harness/` - headless harness mock-Foundry użyty do audytu; wtedy 3 klienci
  (GM i 2 graczy, `AUDIT-1.1.88.md`), dziś 4, a w `17-assistant` 5.
