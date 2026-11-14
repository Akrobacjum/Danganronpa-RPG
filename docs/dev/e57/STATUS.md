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
| C3 D34 | waits for E54 (settings.mjs, utils.mjs) | - | - |
| C4 D35 "?" in six windows (GM panel 3, Season setup 2, Room setup 9.1, The case 14, the trial console 15, Edit campaign 4); "section N" references made jumps | done | a93cc6f1 | R6601, R6602, R111's layout part; AUDIT 9.2 529-531 (LIVE-E57-01..03) |
| C4 the Investigation dashboard's "?" and tabs | waits for E54 (investigation.mjs) | - | - |
| C5 window registry (Q-E57-16: SCREENS' window rows) and scenario 51-lang-mixed | done | fb70d2c3 | 51-lang-mixed 35/35, twice; a mutant (Edit campaign's title key gone) red on that window alone |
| C12 last pass, text lints to their final modes | waits for the text and handbook lines | - | - |

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
