# E109 for 1.2.115: the owner's answers on DRPG-Q113, and the leftovers of 1.2.113

Branch `claude/e109-115` from main 9e7e3d78. R numbers R7120-R7149. Kept as the work goes, so a restart loses nothing.

## Progress

| Item | State | Test | Commit |
| --- | --- | --- | --- |
| #27 D-NIEZG | docs/dev/e109/DISAGREEMENTS.json written first (below); no text changed for these | - (a document) | dd576f46 |
| #6 Q-A1 `Overflow.hopeBlocked` | "The darkening blocks Hope this time of day." / „Zaciemnienie blokuje Hope o tej porze dnia.” (the words of `Monocub.darkened`, the owner's "say that it blocks") | R7120 | 56c85378 |
| #16 Q-A11 `TraitRuling.propose` | "Send to the GM" / „Wyślij do GM-a” (equal to `Bridge.send`) | R7120 | 56c85378 |
| #11 Q-A6 the stage after the fight | "Tamper" on the tracker (`Murder.stage.resolution`) and a Remnant's stage (`Remnant.action.resolution`); "the Tamper stage" / „etap Tamper” on the five cards that named "the clean-up" as the stage, Polish `afterInterrupted`, and the Crime Tool's hint; glossary `tamper-stage` | R7120 | 56c85378 |
| #49 H13 Prepare the Weapon's note | the clause "unless the killer already has the tool" dropped, EN (config.mjs) and PL; the code unchanged | R7120 | 56c85378 |
| #53 H20 `Season.resetKeeps` | already true at the base (E71 B15 dropped "who watches whom"); held by R7120, and season-wipe.mjs's header comment, which still counted it as kept, follows the code | R7120 (green at the base on this part) | 56c85378 |
| #43 Q-NC-10 the critical's hint line | drawn only when the caller says the card owes one (`criticalHint`): Observe's and Analyze's cards, and the Reroll's re-asked ruling of an Observe or an Analyze | R7121 | daba7d5c |
| #40 Q-NC-7 Analyze's card order | the roll card is posted (awaited) before `analyze.resolve` is asked, as Find Stash's; `Analyze.sent` reworded to be true before the answer | R7122 | daba7d5c |
| #48 H11 Move the Body's floor | `atLeastFloor` (CLEANUP.minDc 8) in `resolveStageSix`; no tier reaches it today | R7123 | daba7d5c |
| #60 Q-E43-6 the session log | a ring of the newest 60 (`keepNewest`), the dropped counted (`sessionFailuresDropped`), named first in diagnose()'s "Failures" part | R7124 | daba7d5c |
| #56 Q-E99-9 the GM's replay | "Replay the summary" on the trial console once the summary is out; plays this trial's card's board on this browser only, writes nothing | R7125 | (next commit) |
| Leftover 1: check live | reads any LIVE-<id>-<n> but LIVE-REOPEN-01; a planted control of each form; red with the old patterns (the control: three items not read, two unwritten citations not caught), green after: 522 items (516 before: +3 PV, +2 113R, +1 R4420), 979 citations | `check live` | (below) |
| Leftover 2: KEYS.json | the four Polish tooltips 7de81166 reworded (tiedToCrime, roomPlannedIncidentRemnant, roomPlannedFinal, placeOnTheMap) brought to lang/pl.json | - | (below) |
| Leftover 3: NEEDSCODE.md:21 | "row 1.2.122" is "row 1.2.113", as text-style.md writes it 30 times and stages.json plans E71; the rows Q-NC-7, Q-NC-10, H11, H13, H20 marked answered | - | (below) |
| Leftover 4: radio sweep in Polish | made: audit/windows-pl, probe 08 with DRPG_CAPTURE_LANG=pl DRPG_CAPTURE_OUT=../windows-pl on f85a0071 (114 s; 102 of 104 rows captured, action-palm and action-loot--long answered null, as their rows read); `node audit/radio-sweep.mjs --pl-windows audit/windows-pl --chromium /opt/pw-browsers/chromium-1243/chrome-linux64/chrome` (the bundled headless shell 1194 is not on this machine): 42 windows, 1488 radio readings, RED, 112 problems, all one finding (below) | radio sweep | (next commit) |
| #81, #77 | not this line's (the tips line; the coordinator) | | |

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

### Notes on what was read

- **A finding of the Polish sweep, not fixed here (a module layout fault, Polish only):** Item tables, the Room pools
  tab (`item-tables--rooms`), Stained Glass: the "Serves also as" column's checkbox label „Narzędzie do sprzątania” wraps
  to two lines, and the box stands between them, its centre 13.80 px below the label's first line (the sweep's
  2 px rule), at device scale 1 and 2, with and without core's stand-in: the 112 problems are those 4 distinct ones
  repeated per row. Seen in the sweep's screenshot (`--shots`, Polish, glass). English ("Cleaning Tool") fits on one
  line and reads clean; Legacy reads clean in both. The fix is a style rule (the box to the first line, or the column
  wider), the stylesheet owner's; the harness has no Foundry core sheet, so a table settles whether core changes it.
- The radio sweep on English alone was not run separately; the run above read English too, with the same 42 windows,
  and found nothing in English.

- KEYS.json differs from lang/ in more than the four: `Tips.Gm.minusTooltip` and `plusTooltip` say "one Despair" where both
  lang files now say "{n} Despair" (EN and PL alike, not 7de81166's), and `Tips.Case.undoRealizationTooltip` and
  `finderTextTooltip` are no longer in lang/. Left as they are: the leftover named the four.
- Tamper: what was renamed is the stage's name; "a clean-up attempt", "clean-up roll", the Cleaning Tool, the Clean-up
  window's title (`Cleanup.title`) and `Bridge.what.murder.cleanup` stay. The handbooks still say "the clean-up" for the
  stage (7 lines of "the clean-up" in the English handbooks, read by grep, not one by one): the handbook line's.
- The glossary's source rule took two-digit stages only (`E\d\d plan`); it takes `E\d{2,3} plan` now, for "E109 plan".

## Every row of DRPG-Q113 (140), with the owner's answer of 14.11.2026

"owner's or coordinator's" marks a kept default whose work names the README, CLAUDE.md, .claude/ or the release, read
by the row's name on the page, not by its asking line's file.

| # | Id | Owner 14.11 | This line |
| --- | --- | --- | --- |
| 1 | LEAK-0 | keep | kept, owner 14.11 |
| 2 | LEAK-1 | keep | kept, owner 14.11 |
| 3 | LEAK-2 | keep | kept, owner 14.11 |
| 4 | ROOM-NO-TOKEN | keep | kept, owner 14.11 |
| 5 | group-rest privacy | keep | kept, owner 14.11 |
| 6 | Q-A1 | change | done: R7120 |
| 7 | Q-A2 | keep | kept, owner 14.11 |
| 8 | Q-A3 | keep | kept, owner 14.11 |
| 9 | Q-A4 | keep | kept, owner 14.11 |
| 10 | Q-A5 | keep | kept, owner 14.11 |
| 11 | Q-A6 | keep, note "Nazwijmy to tamper po prostu" | done (the default, the coordinator confirming): R7120 |
| 12 | Q-A7 | keep | kept, owner 14.11 |
| 13 | Q-A8 | keep | kept, owner 14.11 |
| 14 | Q-A9 | keep | kept, owner 14.11 |
| 15 | Q-A10 | keep | kept, owner 14.11 |
| 16 | Q-A11 | change | done: R7120 |
| 17 | Q-B-1 | keep | kept, owner 14.11 |
| 18 | Q-B-3 | keep | kept, owner 14.11 |
| 19 | Q-B-4 | keep | kept, owner 14.11 |
| 20 | Q-B-5 | keep | kept, owner 14.11 |
| 21 | Q-B-8 | keep | kept, owner 14.11 |
| 22 | Q-C-2 | keep | kept, owner 14.11 |
| 23 | Q-E71-4 | keep | kept, owner 14.11 |
| 24 | Q-D-3 | keep | kept, owner 14.11 |
| 25 | Q-D-4 | keep | kept, owner 14.11 |
| 26 | Q-D-5 | keep | kept, owner 14.11 |
| 27 | D-NIEZG | change, "Pokaz mi te niezgody" | DISAGREEMENTS.json written; no text changed |
| 28 | BATCH-OWNER | keep | kept, owner 14.11 |
| 29 | C12-SAMPLE | keep | kept, owner 14.11 |
| 30 | playerHint/PL-d | keep | kept, owner 14.11 |
| 31 | Q-E71-5 / Q-E57-5 | keep | kept, owner 14.11 |
| 32 | Q-NC-1 | keep | kept, owner 14.11 |
| 33 | Q-NC-12 | keep | kept, owner 14.11 |
| 34 | Q-H6 | keep | kept, owner 14.11 |
| 35 | Q-H7 | keep | kept, owner 14.11 |
| 36 | Q-C-3 | keep | kept, owner 14.11 |
| 37 | group-rest UI texts | keep | kept, owner 14.11 |
| 38 | FOOTER-R1320 | keep | kept, owner 14.11 |
| 39 | Q-NC-6 | keep | kept, owner 14.11 |
| 40 | Q-NC-7 | keep, note "Zmienic kolejnosc" | done: R7122 |
| 41 | Q-NC-8 | keep | kept, owner 14.11 |
| 42 | Q-NC-9 | keep | kept, owner 14.11 |
| 43 | Q-NC-10 | change | done: R7121 |
| 44 | Q-NC-11 | keep | kept, owner 14.11 |
| 45 | Q-NC-13 | keep | kept, owner 14.11 |
| 46 | Q-NC-15 | keep | kept, owner 14.11 |
| 47 | H10 | keep | kept, owner 14.11 |
| 48 | H11 | change | done (the default, the coordinator confirming): R7123 |
| 49 | H13 | change | done: R7120 |
| 50 | H15 | keep | kept, owner 14.11 |
| 51 | H18 | keep | kept, owner 14.11 |
| 52 | H32 | keep | kept, owner 14.11 |
| 53 | H20 | change, "Kod zostaje" | done (text already followed the code since B15): R7120 |
| 54 | E40-NULL | keep | kept, owner 14.11 |
| 55 | E39-HEADER | keep | kept, owner 14.11 |
| 56 | Q-E99-9 | keep, note "Budowac" | done: R7125 |
| 57 | Q-E108-1 | keep | kept, owner 14.11 |
| 58 | Q-E108-2 | keep | kept, owner 14.11 |
| 59 | Q-E59-11 | keep | kept, owner 14.11 |
| 60 | Q-E43-6 | change | done: R7124 |
| 61 | Q-E56-2 | keep | kept, owner 14.11 |
| 62 | Q-E57-18 | keep | kept, owner 14.11 |
| 63 | group-rest code and behaviour | keep | kept, owner 14.11 |
| 64 | Q-E55-7 | keep | kept, owner 14.11 |
| 65 | Q-E55-8 | keep | kept, owner 14.11 |
| 66 | Q-E55-9 | keep | kept, owner 14.11 |
| 67 | Q-E59-12 | keep | kept, owner 14.11 |
| 68 | Q-E59-13 | keep | kept, owner 14.11 |
| 69 | R4803 | keep | kept, owner 14.11 |
| 70 | group-rest look and CSS | keep | kept, owner 14.11 |
| 71 | Q-H1 | keep | kept, owner 14.11 |
| 72 | Q-H2 | keep | kept, owner 14.11 |
| 73 | Q-H3 | keep | kept, owner 14.11 |
| 74 | Q-H4 / H26 | keep | kept, owner 14.11 |
| 75 | SIZE | keep | kept, owner 14.11 |
| 76 | Q-E57-1 | keep | kept, owner 14.11 |
| 77 | Q-E57-2 | hold | not this line's: the coordinator explains it again |
| 78 | Q-E57-3 | keep | kept, owner 14.11 |
| 79 | Q-E57-4 | keep | kept, owner 14.11 |
| 80 | Q-E57-7 | keep | kept, owner 14.11 |
| 81 | Q-E57-8 | change | not this line's: claude/tips-115 |
| 82 | Q-E57-9 | keep | kept, owner 14.11 |
| 83 | Q-E57-10 | keep | kept, owner 14.11 |
| 84 | Q-E57-11 | keep | kept, owner 14.11 |
| 85 | Q-E57-12 | keep | kept, owner 14.11 |
| 86 | Q-E57-17 | keep | kept, owner 14.11 |
| 87 | CHECKSTATE-HB | keep | kept, owner 14.11 |
| 88 | group-rest handbooks and "?" | keep | kept, owner 14.11 |
| 89 | Q-E39-1 | keep | kept, owner 14.11 |
| 90 | Q-E39-2 | keep | kept, owner 14.11 |
| 91 | Q-E39-3 | keep | kept, owner 14.11 |
| 92 | S09 | keep | kept, owner 14.11 |
| 93 | Q-E40-1 | keep | kept, owner 14.11 |
| 94 | Q-E40-2 | keep | kept, owner 14.11 |
| 95 | Q-E40-3 | keep | kept, owner 14.11 |
| 96 | Q-E43-1 | keep | kept, owner 14.11 |
| 97 | Q-E43-2 | keep | kept, owner 14.11 |
| 98 | Q-E43-3 | keep | kept, owner 14.11 |
| 99 | Q-E43-4 | keep | kept, owner 14.11 |
| 100 | Q-E43-5 | keep | kept, owner 14.11 |
| 101 | Q-E53-1 | keep | kept, owner 14.11 |
| 102 | Q-E53-3 | keep | kept, owner 14.11 |
| 103 | Q-E58-1 | keep | kept, owner 14.11 |
| 104 | Q-E58-2 | keep | kept, owner 14.11 |
| 105 | Q-E58-3 | keep | kept, owner 14.11 |
| 106 | Q-E56-1 | keep | kept, owner 14.11 |
| 107 | Q-E56-3 | keep | kept, owner 14.11 |
| 108 | Q-E56-4 | keep | kept, owner 14.11 |
| 109 | Q-E57-6 | keep | kept, owner 14.11 |
| 110 | Q-E57-13 | keep | kept, owner 14.11 |
| 111 | Q-E57-14 | keep | kept, owner 14.11 |
| 112 | Q-E57-15 | keep | kept, owner 14.11 |
| 113 | Q-E57-16 | keep | kept, owner 14.11 |
| 114 | Q-E59-15 | keep | kept, owner 14.11 |
| 115 | Q-E59-16 | keep | kept, owner 14.11 |
| 116 | Q-E59-1..5 (plan) | keep | kept, owner 14.11 |
| 117 | R4420-Q1..3 | keep | kept, owner 14.11 |
| 118 | Q-E26P-4 / Q-E26P-6 | keep | kept, owner 14.11 |
| 119 | Q-T4-1 | keep | kept, owner 14.11 |
| 120 | group-rest tools, tests, scope | keep | kept, owner 14.11 |
| 121 | Q-E26P-1 | keep | kept, owner 14.11 |
| 122 | Q-E26P-2 | keep | kept, owner 14.11 |
| 123 | Q-E26P-3 | keep | kept, owner 14.11 |
| 124 | Q-E26P-5 | keep | kept, owner 14.11 |
| 125 | README-A8 | keep | kept, owner 14.11; owner's or coordinator's |
| 126 | Q-H5 | keep | kept, owner 14.11 |
| 127 | E43-README | keep | kept, owner 14.11; owner's or coordinator's |
| 128 | CLAUDE-ONECHECK | keep | kept, owner 14.11; owner's or coordinator's |
| 129 | RELEASE-MD | keep | kept, owner 14.11; owner's or coordinator's |
| 130 | Q-E59-6 / Q-E59-7 | keep | kept, owner 14.11 |
| 131 | GAPS-A | keep | kept, owner 14.11 |
| 132 | group-rest documents and README | keep | kept, owner 14.11; owner's or coordinator's |
| 133 | Q-E26-1 | keep | kept, owner 14.11 |
| 134 | Q-E26-2 | keep | kept, owner 14.11 |
| 135 | Q-E26-3 | keep | kept, owner 14.11 |
| 136 | Q-E26-5 | keep | kept, owner 14.11 |
| 137 | Q-E53-2 | keep | kept, owner 14.11 |
| 138 | LEDGER | keep | kept, owner 14.11 |
| 139 | Q-E59-9 / Q-E59-10 | keep | kept, owner 14.11 |
| 140 | group-rest release | keep | kept, owner 14.11; owner's or coordinator's |

