# E57 tools line - status

Branch `claude/e57-tools` (from `claude/e57-prep`, with `claude/fervent-sagan-gme4vt` 1463f22b merged in). R block
R6600-R6699. Kept current as the line goes; the coordinator's ledger is the record.

## Commits

| Item | State | Commit | Tests |
| --- | --- | --- | --- |
| Merge of the 1.2.113 assembly | done | 30053fec | quick green |
| C0 spec and inventory | done | fb4f3a47 | none (a book) |
| C1 guards: stale-pl `--check`, `--sheet`, `--stamp`, `tools/pl-reviewed.json`, T9 FAIL | done | 78e4576e | R6600; R1058 widened; `check text` with T9 and the tool's self-check (a planted English moved alone seen) |
| C2 rules-parity, check part `rules` | done | e66f01dc | the part's 14 planted faults |
| C3 D34: worldLocalize reads config prose itself, the English kept when a page swaps it; the tier line through it; the setting shown (Q-E57-18) | done | 153e8642, dbdea36b | R6603; R3420 widened; 51-lang-mixed 38/38 twice; a mutant (the English not kept) red in R6603 and 51 |
| C4 D35 "?" in six windows (GM panel 3, Season setup 2, Room setup 9.1, The case 14, the trial console 15, Edit campaign 4); "section N" references made jumps | done | a93cc6f1 | R6601, R6602, R111's layout part; AUDIT 9.2 529-531 (LIVE-E57-01..03) |
| C4 the Investigation dashboard's "?" (its tabs share it, Q-E57-17; section 14) | done | c6b00847 | R6601 widened to seven windows |
| C5 window registry (Q-E57-16: SCREENS' window rows) and scenario 51-lang-mixed | done | fb70d2c3 | 51-lang-mixed 35/35, twice; a mutant (Edit campaign's title key gone) red on that window alone |
| Merges of claude/e71-a..d (the text lines) | done | 294ace65, 1693a20d, 81f12349, fd85baa7 | R1058, R1157 widened as both sides wrote them |
| C12, the text lines' part: T9 read (212 keys: 43 Polish corrected, 169 confirmed, all stamped), T25 to FAIL, the sample of 60 for the owner, the lints' counts (docs/dev/e57/C12-FINDINGS.md, C12-SAMPLE.md) | done | ad286bdd | T9 0, T25 0; R1058, R1059 |
| C12: T15, T16, T21, T24 to FAIL at 0 (fixtures, two allow tables with reasons, three texts) | done | 63f91dd3 | R1058, R1059, R3555 |
| C12: the lang findings of T8 and T11 fixed; T4, T5, T7, T8, T11, T12, T13 moved to 1.2.114 as reports with their counts | done | (this commit) | C12-FINDINGS.md |
| C12, what waits (1.2.114): those seven detectors' FAIL; the cold read of README and the handbooks, after the handbooks line | moved | - | - |

## Test numbers

Full tier 1 at c545ab94 (14.11.2026, 4 cores, 434 s): 1611 tests ran, 1595 passed, 1 failed, 16 skipped, 0 red. The
one failure is R2001, the base's known one at 1463f22b (the coordinator's word: its fix comes with E54's merge). The
first full run, at fb70d2c3, also read R22 red on this line's regex literal; fixed at c545ab94.

## Anchors added to docs/handbooks/*.md

None. C4a's anchors are attributes the handbook window writes on the headings it renders (`data-drpg-section`); no handbook file was edited.

## For the coordinator

- CLAUDE.md's "One check" row lists the check parts; `rules` (C2) is a new one. This line may not edit CLAUDE.md.

## Needs a local Foundry

- The "?" in a real window's header and its landing (R111's layout part; LIVE-E57-01); the plan's screenshots of each
  window's header with its "?", both themes, 1366x768 and 820x1180, need the same.

- LIVE-E57-01..03 as the plan proposes (each "?" landing on its section; a document written in a world whose document
  language differs from the GM's; the handbook window at 820x1180).
