# E26 prep - status (line claude/e26-prep, base 1463f22b)

The part of E26 (1.3.0) that needs no Foundry, for 1.2.113. Plan: docs/dev/plans/E26.md on claude/plan-130.
R block R6300-R6349.

| Item | State | Commit |
| --- | --- | --- |
| Font licences: each face's real licence named, each text in fonts/ (R6300) | done | C1 |
| Modified Press Start 2P under its Reserved Font Name: renamed DRPG Pixel in its name tables; `check fonts` | done | C2 |
| module.zip ships nothing it should not (no macros/, no "DM" in lang/ or handbooks); reproducible build (tools/build-package.mjs, check package); tools that write files on a CRLF checkout (tools/crlf-writers.mjs) | done | C3 |
| module.json: Daggerheart verified, no maximum (D1): already verified 2.12.8 (8f1b1b38), newer than the plan's 2.10.5, kept; R6301 holds it | done | C4 |
| README draft (docs/dev/e26/README-DRAFT.md): Dice So Nice, the settings held for everyone, voice, the fonts' credits; README.md not edited | done | C5 |

## Measured

- 14.11.2026, fontTools 4.68 on the woff2 files at 1463f22b: Special Elite's name table (ID 0 and 14) says Apache 2.0;
  VT323's and Press Start 2P's say OFL; Press Start 2P's copyright reserves the font name "Press Start 2P", and both
  pixel files still carry that name (ID 1, 4, 6) after the 13.11 redraw (62e6e1d2).
- google/fonts' apache/specialelite has no NOTICE file (404 for NOTICE and NOTICE.txt, 14.11.2026); METADATA.pb says
  license "APACHE2".
- 14.11.2026, the rename (fontTools 4.68, `recalcTimestamp=False`): before and after, every glyph's compiled bytes the
  same in both pixel files (225 and 145 glyphs); head differs in checkSumAdjustment alone; name IDs 1, 3, 4, 6 changed,
  ID 0 (copyright) kept. `node audit/glass-sweep.mjs --accents` green after it (Chromium, 1366x768 and 393x852, both
  themes, "DRPG Pixel" drawn).
- 14.11.2026, git 2.43.0 at c31d9b0d: `git archive --format=zip HEAD` twice, the same bytes (sha256 0c4df303...);
  with `-c core.autocrlf=true` (and with `core.eol=crlf` beside it) other bytes (3a10c1ba...), every text file CRLF;
  binaries the same. Another git version's deflate: not measured.
- The archive: 319 files, top level LICENSE README.md docs/handbooks fonts icons lang module.json scripts styles. No
  macros/ (it left the repository on 13.11.2026, b9c3e7ec), no tools/port-glass.py (E59 C5a, dab6d2ab). "DM" as a
  word: 14 scripts' comments quoting the rule guide, none in lang/ or docs/handbooks/.
- Found, not changed (the texts lines' files): Polish "MG" where the glossary says "GM", 7 occurrences by
  `grep -ow MG` - lang/pl.json 1 (`presentByButton`), docs/handbooks/gm-handbook.pl.md 3, player-handbook.pl.md 3.
- 14.11.2026, a CRLF clone (core.autocrlf=true) at c31d9b0d, the eight writers of tracked files run: no content change
  (`git diff` empty), no file longer than the commit's, 44 files touched; each writes LF. chrome-icons' doubled section
  (S14-13) does not come back. 20 s.

## Left for the release (E26's own commits, not this line's)

- Move release.yml's "Build the package" step onto `node tools/build-package.mjs` (or add its two `-c` flags to the
  `git archive` line). Not done here: the build in release.yml is the release's. On the runner's default config the
  plain command gives the same bytes as the pinned one (measured here with git 2.43.0, not on the runner).
- Paste the README blocks of docs/dev/e26/README-DRAFT.md once the owner says yes (Q-E26P-1).
- The tag v1.3.0, the stamps (`node tools/check.mjs stamps --release v1.3.0`), `.github/release-notes/v1.3.0.md` with
  its "## Checked", `node tools/changelog.mjs --write`, `node tools/stages.mjs ship E26 ...`, the dispatch with
  `prerelease`, then `promote` (plan C4, C6). The notes say the fonts' licences changed (Special Elite Apache 2.0; the
  pixel face renamed DRPG Pixel in its name tables).
- The plan's C6 checks after publishing: releases/latest, both download URLs 200, the manifest's 1.3.0, the zip without
  docs/dev, audit/ or .github/ (check package already holds the last at every commit).

## Needs a local Foundry

- LIVE-E26-01 (the plan): the published manifest installs on a clean Foundry v14 with Daggerheart at `verified`
  (2.12.8). Needs a v14 server, the release's manifest URL, Daggerheart 2.12.8.
- LIVE-E26-02 (the plan): the owner's smoke at a table before `promote`.
- The renamed pixel face at a table: a Monokuma Legacy page whose HUD and tabs draw "DRPG Pixel" from
  `pixel.woff2?v=4` and `pixel-ext.woff2?v=5` (no stale cache), Polish capitals as glass-sweep --accents saw them.
  Needs Foundry v14 with the module, Legacy theme, a Polish campaign name. Not a new LIVE row yet: the coordinator
  decides whether it is one (Q-E26P-4).
- 1.3.0's passed local gate (gate-lib `NO_WAIVER`), which moved to E83 (plan Q-E26-2): a v14 sandbox at :30099.

## Questions (default taken)

| Id | Question | Default |
| --- | --- | --- |
| Q-E26P-1 | README blocks into README.md as drafted? | Left for the owner; nothing in README.md |
| Q-E26P-2 | Section names beside each switch in the README list? | Kept |
| Q-E26P-3 | The pixel face renamed "DRPG Pixel" inside the woff2 files (OFL condition 3), and the setting's hint no longer naming Press Start 2P? | Done; the credit to Press Start 2P stays in fonts/README.md and the draft |
| Q-E26P-4 | A LIVE row for the renamed face at a table? | None added: the glyphs are byte-equal (fontTools) and the accents sweep is green |
| Q-E26P-5 | The seven Polish "MG" where the glossary says "GM" | Not changed here (texts lines' files); reported |
| Q-E26P-6 | tools/crlf-writers.mjs is a standalone tool (20 s), not in `npm run quick` or CI's CRLF dispatch | Standalone; the coordinator may add it to the CRLF dispatch |
