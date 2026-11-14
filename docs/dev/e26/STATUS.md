# E26 prep - status (line claude/e26-prep, base 1463f22b)

The part of E26 (1.3.0) that needs no Foundry, for 1.2.113. Plan: docs/dev/plans/E26.md on claude/plan-130.
R block R6300-R6349.

| Item | State | Commit |
| --- | --- | --- |
| Font licences: each face's real licence named, each text in fonts/ (R6300) | done | C1 |
| Modified Press Start 2P under its Reserved Font Name | in progress | C2 |
| module.zip ships nothing it should not; reproducible build; tools keep line endings | open | |
| module.json: Daggerheart verified, no maximum (D1) | open | |
| README draft (docs/dev/e26/README-DRAFT.md) | open | |

## Measured

- 14.11.2026, fontTools 4.68 on the woff2 files at 1463f22b: Special Elite's name table (ID 0 and 14) says Apache 2.0;
  VT323's and Press Start 2P's say OFL; Press Start 2P's copyright reserves the font name "Press Start 2P", and both
  pixel files still carry that name (ID 1, 4, 6) after the 13.11 redraw (62e6e1d2).
- google/fonts' apache/specialelite has no NOTICE file (404 for NOTICE and NOTICE.txt, 14.11.2026); METADATA.pb says
  license "APACHE2".
