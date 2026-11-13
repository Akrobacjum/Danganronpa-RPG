# Audits and tests

A folder for the repository, not the module: `.gitattributes` marks `audit/` `export-ignore`, so nothing in it
reaches `module.zip` or the module Foundry loads. Read against the tree on 13.11.2026 (main at 421f2395, 1.2.109);
until then this file was in Polish and dated E30 (24.09.2026), and the sweeps, the style harness, the design pictures
and the window captures below were not in it.

## What is here

- `harness/` - the headless harness: a shim of Foundry and four jsdom clients, one GM and three players, and more
  where a scenario declares them (an Assistant GM in 17-assistant and 33-bridge-paths, a second GM in 61-gmstore-case
  and 62-investigation). Once `cd harness && npm ci` (jsdom, ESLint, espree, Playwright with no browser), then
  `npm test`: lint, `tools/check.mjs`, the gate's self-test, the suite and every scenario whose layers include `ci`.
  One scenario: `node cluster.mjs scenarios/<x>.mjs`. The harness boots the checkout it sits in, or the one
  `DRPG_REPO` names. `harness/README.md` holds the register of scenario numbers with their layers, and what the
  harness cannot do. `harness/probes/` holds tools run by hand (`probes/README.md`).
- `harness/results/` - each run's results and logs, written again by every run; git tracks none of it
  (`.gitignore`, since E30; `node tools/check.mjs tree` holds it).
- `gate/` - the release gate's second layer (D47): `local-gate.mjs` writes `local-gate.json` on a machine with a
  Foundry v14 sandbox, and `verify-gate.mjs` checks it in `release.yml`, in `record` or `enforce` mode
  (`gate/README.md`). The record committed for 1.2.109 reads `incomplete`, every one of its eight parts `not-run`
  for `no-server`: no part has run on a sandbox yet.
- `live/` - the runner for a real Foundry v14: tier 2 in both themes, the world diff, scenarios on a sandbox, the
  world's seed, the 1.2.56 performance measurement. Its README says it has never run against a real Foundry
  (`live/README.md`).
- `perf-baseline.json` - the 1.2.56 performance baseline: not measured yet, with the record of the attempt and of
  what was missing.
- `glass-harness.html`, `pack-harness.html` - the curtain and the evidence pack without Foundry
  (`python3 -m http.server 8765` at the repository's root, then `/audit/glass-harness.html`).
- `glass-sweep.mjs` - the glass harness at 23 sizes in Chromium: the curtain's self-check and the corner's
  launchers, a non-zero exit when a size is not right (Playwright from `harness/`).
- `style-harness.html`, `style-sweep.mjs`, `style-baseline.json` - the kit's surfaces as Chromium computes their
  style, held to the baseline (E44 C1d); the baseline is written by the sweep's `--write` or `--accept`, never by hand.
- `forced-sweep.mjs` - the module's state marks under `forced-colors: active`, both themes (E48 K3).
- `case-map-sweep.mjs` - the case map in Chromium: whether a node's text is cut, or two nodes overlap (E97 fix).
- `windows/` - the module's windows as the harness draws them (59 pages and their `manifest.json`), written by
  `harness/probes/08-capture-windows.mjs` for the style harness and the mockups.
- `design/` - the approved design pictures (62 files; E44's review, `docs/design/windows.md`, which tier 0 holds to
  them).
- `probe-daggerheart-2.10.5.md` - a static compatibility probe of Daggerheart 2.10.5 (24.09.2026): a source diff,
  nothing run against a live Foundry.

## The v1.2.42 audit (for 1.2.43)

- `AUDIT-1.2.42.md` - the report (in Polish): the method, the marks, what was fixed, the text analysis, the list of
  tasks to 10/10, the live checks (section 9.2, the ones still open), how to release.
- `findings-1.2.42/` - the nine domains' raw findings (in English), with code quotes.
- `harness/` - the same harness, then grown to one GM and three players; the scenarios `40-flow.mjs` and
  `50-lang.mjs`.

## The v1.2.13 audit

- `AUDIT-1.2.13.md` - the report (in Polish), a static audit.

## The v1.1.88 audit (for 1.2.0)

- `AUDIT-1.1.88.md` - the final report (in Polish).
- `findings/` - the raw findings of the live tests.
- `harness/` - the mock-Foundry headless harness used for the audit; then three clients (a GM and two players,
  `AUDIT-1.1.88.md`), four today, more where a scenario declares them.
