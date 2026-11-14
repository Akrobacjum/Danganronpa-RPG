# E109 for 1.2.115: the owner's answers on DRPG-Q113, and the leftovers of 1.2.113

Branch `claude/e109-115` from main 9e7e3d78. R numbers R7120-R7149. Kept as the work goes, so a restart loses nothing.

## Progress

| Item | State |
| --- | --- |
| #27 D-NIEZG: docs/dev/e109/DISAGREEMENTS.json | written first (see below); no text changed for these |

## #27 D-NIEZG, the disagreements

`docs/dev/e109/DISAGREEMENTS.json`, generated 14.11.2026 by a script outside the repository from
`docs/dev/text-batch-B14..B18.json` and lang/ at 9e7e3d78. Counted by that script: 42 rows, one per disagreement line
(B14 12, B15 11, B16 11, B17 5, B18 3, the numbers of STATUS-D's table). 40 are still in the batch files; the 2 of
B15 on the Dice So Nice row (`Season.step.diceSoNice`, `Season.hint.diceSoNice`) left the batch file at 7cfbf294 when
the coordinator answered Q-D-6, and are in the file with `status` "settled". By kind (the script's reading of each
line's words): 22 a question for the owner on wording or code, 10 an owner-approved text with a writer's proposal,
9 held back because a handbook, module.json or a test quotes the text, 1 the Polish writer against the English one.
`proposal` holds the changed text where the batch states it in words (13 rows); elsewhere it is null and
`batchNotes` holds the batch's own lines on the change. One proposal (searchTokensPerRoom.hint, EN) is put together
from those lines and says so: the writer's full text is not in the repository.
