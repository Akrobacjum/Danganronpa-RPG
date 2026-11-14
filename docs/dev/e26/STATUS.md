# E26 prep - status (line claude/e26-prep, base 1463f22b)

The part of E26 (1.3.0) that needs no Foundry, for 1.2.113. Plan: docs/dev/plans/E26.md on claude/plan-130.
R block R6300-R6349.

| Item | State | Commit |
| --- | --- | --- |
| Font licences: each face's real licence named, each text in fonts/ (R6300) | done | C1 |
| Modified Press Start 2P under its Reserved Font Name: renamed DRPG Pixel in its name tables; `check fonts` | done | C2 |
| module.zip ships nothing it should not (no macros/, no "DM" in lang/ or handbooks); reproducible build (tools/build-package.mjs, check package); tools that write files on a CRLF checkout (tools/crlf-writers.mjs) | done | C3 |
| module.json: Daggerheart verified, no maximum (D1): already verified 2.12.8 (8f1b1b38), newer than the plan's 2.10.5, kept; R6301 holds it | done | C4 |
| README draft (docs/dev/e26/README-DRAFT.md) | open | |

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
