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
| #56 Q-E99-9 the GM's replay | "Replay the summary" on the trial console once the summary is out; plays this trial's card's board on this browser only, writes nothing | R7125 | f85a0071 |
| Leftover 1: check live | reads any LIVE-<id>-<n> but LIVE-REOPEN-01; a planted control of each form; red with the old patterns (the control: three items not read, two unwritten citations not caught), green after: 522 items (516 before: +3 PV, +2 113R, +1 R4420), 979 citations | `check live` | f85a0071 |
| Leftover 2: KEYS.json | the four Polish tooltips 7de81166 reworded (tiedToCrime, roomPlannedIncidentRemnant, roomPlannedFinal, placeOnTheMap) brought to lang/pl.json | - | f85a0071 |
| Leftover 3: NEEDSCODE.md:21 | "row 1.2.122" is "row 1.2.113", as text-style.md writes it 30 times and stages.json plans E71; the rows Q-NC-7, Q-NC-10, H11, H13, H20 marked answered | - | f85a0071 |
| Leftover 4: radio sweep in Polish | made: audit/windows-pl, probe 08 with DRPG_CAPTURE_LANG=pl DRPG_CAPTURE_OUT=../windows-pl on f85a0071 (114 s; 102 of 104 rows captured, action-palm and action-loot--long answered null, as their rows read); `node audit/radio-sweep.mjs --pl-windows audit/windows-pl --chromium /opt/pw-browsers/chromium-1243/chrome-linux64/chrome` (the bundled headless shell 1194 is not on this machine): 42 windows, 1488 radio readings, RED, 112 problems, all one finding (below) | radio sweep | 769ffc61 |
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
  window's title (`Cleanup.title`) and `Bridge.what.murder.cleanup` stay. The handbooks still hold "the clean-up" in 7
  English lines (grep, not read one by one, so some may name the attempts): the handbook line's.
- The glossary's source rule took two-digit stages only (`E\d\d plan`); it takes `E\d{2,3} plan` now, for "E109 plan".

## Round 2: the owner's confirmations and the coordinator's decisions (14.11.2026, about 20:20Z)

The owner confirmed every default of the brief: #11 (Tamper), #48 (the floor), #56 (the replay), #40 (the order) - each
built already on that default, so nothing changed - and #77 (above: already built by E57). The 40 open disagreements
went to the coordinator, whose decisions are in `docs/dev/e109/DISAGREEMENTS.json` (`status` of each row): 27 taken,
13 kept, the 2 settled before as they were. Built in 95bf8d12:

| Rows | What | Test |
| --- | --- | --- |
| D01 | already „Dodaj doświadczenie” at 9e7e3d78; nothing to change | R3555 (green there) |
| D05, D07, D08-D11, D12, D18-D21, D30, D32 | the texts, EN and PL, and every handbook line that quotes them (the GM and player handbooks and the brochures, both languages) | R518, R1016, R2036, R3587 (its expected label follows D20) |
| D13, D14, D16, D17 | the writer's edits of two B01a texts; text-render.mjs `BATCH_LATER` names the coordinator's decision over the approved after | check text |
| D15 | the English, the GM handbook's two rows (the Polish row too, which still said „słyszysz”) and module.json's relationships reason, that string alone | R1517 |
| D33, D34 | Tier tables and Room tables in every text of the Item tables window and `Items.existingNote`, EN (24 texts) and PL (23); the GM handbooks' lines | R975 |
| D22 | `keyRowsUsed`: the rows filled or placed | R7126 |
| D23 | Save counts Remnants once each | R7127 |
| D24 | {n} the rows offered; the clause stays, reworded, since the count cannot say which clues | R7128 |
| D27, D28 | the held card's "Charge the Key fee", wired to the keys.charge road on the primary; small enough to build (about 25 lines, sheet-audit.mjs's flagged card the pattern), so built | R7130 |
| D40 | a GM's and the Mastermind's own floor tooltip | R7129 |

Two of the tool's own checks moved with it: the pilot's control in `check text` read two strings whose Polish was still
the before, and landing reducedMotion's after left one, so it plants its own befores in a copy now; and the Polish of
`Panel.refundCrossing` is stamped (`tools/stale-pl.mjs --stamp`), as the coordinator kept it.

Questions with the default taken (round 2):

| Question | Default taken |
| --- | --- |
| Q-E109-4: D24's clause | kept, reworded ("the {n} planned clues that are not on the map yet"): with {n} the open rows, "the {n} clues you planned" alone would read as every planned clue |
| Q-E109-5: D08, D09 "keep the rest of the approved wording" | the pilot's approved after of pair 21 (EN and PL), which makes exactly the two changes and was approved by the owner on 01.11; the old text was the pilot's before |
| Q-E109-6: the 4 tier-2 test names that say "tier pool", "Refund last crossing" or "DRPG Settings" (git grep of their name lines) | left: a test's name is its id in the results and the baselines; their assertions read the texts through i18n and pass |

## Round 3: after the merge of the assembly's base (4fb0667a), the coordinator's four (14.11.2026, evening)

The coordinator's answers: Q-E109-1 (Tamper renames the stage only), Q-E109-2 (both defaults confirmed by the owner),
Q-E109-3 (the replay plays whatever the switch), Q-E109-4..6 (the defaults stand). The coordinator's first message of
round 3 asked whether the decisions had arrived: they had, and 95bf8d12 built them (the report of round 2 said so).

| Item | What | How it was measured |
| --- | --- | --- |
| The merge | origin/claude/fervent-sagan-gme4vt at 4fb0667a merged (94733c59): conflicts in tests-tier1.mjs's INVARIANTS tail (both sides kept) and tools/tooltip-census.json (the base's side: its sweep removed the rows this line had reworded) | quick green on the merge |
| The Polish checkbox (Item tables, Room tables tab, Stained Glass) | the label's box at the top of its first line: `align-items: flex-start` on the label, and on the glass's 22 px box `margin-top: (1lh - 22px) / 2` with the label's font size and line height (components.css). Read in Chromium on the style harness first: the box was `align-self: center` (the glass's rule) and its own `1lh` 17.33 px (a number line-height times the control's 13.33 px font), so the first two tries moved nothing | the radio sweep on that window: red 112 (13.80 px below the first line) before, green after; then the Polish captures again (probe 08 on 94733c59 with the rule: 103 of 104 rows) and the whole sweep, both languages: 42 windows, 1488 radio readings, 616 checkbox readings of the module's own box, green (0 problems). No tier test can hold a layout (the harness has none), so the sweep is the red-first reading |
| KEYS.json | every row's en and pl as lang/ has them (placeOnTheMapTooltip's English, minusTooltip and plusTooltip's "{n}"), and the two rows lang/ no longer holds removed: `Tips.Case.undoRealizationTooltip` (its note: "Not built (C6b): E64-inv moved Undo realization off the dashboard's footer into the realization's preview") and `Tips.Case.finderTextTooltip` (its note: "Not built (C6b): E104 gave the planned Incident Remnant node New Remnant's own fields ... a second key would say the same") - their notes are kept here | a script over KEYS.json and lang/: 0 rows differ after |
| B-H6 (E59, beside H20) | the reset's "actions" group's label names what the group clears (gm-stores.mjs's rows with `resetGroup: "actions"`: Bounties, Confusions, room effects, lock picks, eavesdrops, masks, tails, watches, crossings, the rolls' records, beside the budget, the rests and the barricades), EN and PL, and the GM handbook's 16.2 row in both languages | check text green; tier 1 |
| B-M6 (E59, beside H11) | the GM handbook's two sentences (both languages): a Cleaning Tool gives advantage on erasing, reshaping and a trail, and takes its tier off the DC to erase or reshape and off Move the Body's 16 - not a trail's 15, and Move the Body gets no advantage (cleanup.mjs: `attemptCleanup` arms advantage, `cleanupDc` takes the tier and the warm scene; `attemptStageSix` arms it but for Move the Body; `resolveStageSix` takes `toolBonusPerTier`, Move the Body's alone); the warm scene's -3 is on the DC to erase or reshape | a book: nothing to be red |

Question with the default taken: Q-E109-7 (E59's Q-115-2, beside B-H6): move `bounties` to the "seals" group, so a reset
with "despair" ticked and "actions" unticked does not lapse a Bounty into the new season? A design call: not changed;
the label now says the group takes the Bounties.

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
| 27 | D-NIEZG | change, "Pokaz mi te niezgody"; then handed to the coordinator ("Czy niezgody mozesz rozwiazac sam?") | DISAGREEMENTS.json written; the coordinator's 40 decisions built in 95bf8d12 (below) |
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
| 77 | Q-E57-2 | hold, then the default (the owner through the coordinator, 14.11 about 20:20Z) | checked: all seven windows of E57's default already draw the "?" at 9e7e3d78 (`help: WINDOW_HELP.<row>` in gm-panel, season-setup, room-setup, gm-stores, investigation, trial-floor-ui and gm-campaign; R6601 holds them); nothing to add |
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


## Checked (this machine, 4 cores, 14.11.2026)

| What | Tree | Result |
| --- | --- | --- |
| tier 1, whole (`node run-tests.mjs --tier 1`) | daba7d5c (with edits in the tree while it ran) | 1677 passed, 0 failed, 16 skipped, 0 red, 568 s |
| tier 1, whole, the final run | 769ffc61 | 1678 passed, 0 failed, 16 skipped, 0 red, 522 s |
| tier 2 by name (`--only` Analyze, "Move the body", E99, critical, Reroll, "debug log") | f85a0071's tree before its commit | 251 passed, 0 failed, 0 skipped, 594 s |
| R7120-R7125 alone, red at the tree without their change, green with it | each commit's message | as written there |
| scenarios (`node cluster.mjs scenarios/<n>.mjs`, one at a time) | 769ffc61 | 63-class-trial 79/79; 89-proposal-card 12/12; 13-murder-signals 87/87; 17-assistant 47/47; 62-investigation 52/52; 50-lang 45/45; 30-security 302/304, 2 expected red (Foundry limits); 72-canary 162/165, 3 expected red (Foundry limits); 40-flow 89/89; 0 failed in each |
| `npm run quick` | before every push | green each time (lint 405 files, check 24 parts, gate 37/37) |

## Needs a local Foundry

- The case summary's replay at a table: a GM presses "Replay the summary" and only their screen plays the board, with
  its sound, in both themes, and under reduced motion the still frame (headless: R7125 reads the road with the
  switch off and no sound; nothing was drawn or heard).
- Analyze's roll card above its result card in a real chat log on v14 (the order follows from the awaits; read off the
  source, R7122, not seen in a real chat).
- The Polish checkbox label in Item tables' Room pools at a table with Foundry's core sheet (the finding above).

## Questions, with the default taken

| Question | Default taken |
| --- | --- |
| Q-E109-1: #11's "Tamper" - does it rename only the stage (tracker, Remnant's stage, the cards that name the stage), or also the attempts' words ("clean-up roll", the Clean-up window, Cleaning Tool)? | the stage only; the attempts keep their words. The handbooks still say "the clean-up" in 7 English lines (grep; not read one by one, so some may name the attempts), and their Polish: the handbook line's |
| Q-E109-2: #48 (H11) and #11 were built on the coordinator's default while the coordinator confirms them with the owner | built; each is one commit's lines (56c85378 for #11, daba7d5c for #48) |
| Q-E109-3: the replay plays with the table's sequences switch off, since the GM asked for it | plays; the live board still follows the switch |

## Checked, round 2 (14.11.2026, this machine)

| What | Tree | Result |
| --- | --- | --- |
| R7126-R7130 alone | c87c2e8c with the tests only, then with the code | red as named (5 failed), then 6 passed, 0 failed |
| tier 1, whole | 95bf8d12 (the status file and a tooltip-census reason line on top change no module file) | 1683 passed, 0 failed, 16 skipped, 0 red, 502 s |
| tier 2 by name (Refund last crossing, tier pool, DRPG Settings, E60-T8, E46-T, charge, floor, Key Remnant, Item tables, dashboard, Save) | 95bf8d12's tree before its commit | 310 passed, 0 failed, 2 skipped (env probes of the baseline), 392 s |
| scenarios, one at a time | 95bf8d12 | 50-lang 45/45; 51-lang-mixed 38/38; 70-movement 8/8; 88-flow-length 27/27; 62-investigation 52/52; 65-season 58/60, 2 expected red (Foundry limits); 61-gmstore-case 114/114; 66-rooms 77/77; 68-trial-zones 42/42; 30-security 302/304, 2 expected red (Foundry limits); 0 failed in each |

Needs a local Foundry (round 2): the held Key fee card's button at a table (the card drawn on a GM's browser, the press
reaching the primary, a second card while a key is still missing); the GM's floor tooltip on a multi-floor scene.

## Checked, round 3 (14.11.2026, this machine)

| What | Tree | Result |
| --- | --- | --- |
| tier 1, whole | f3f8e5a0 | 1700 passed, 0 failed, 16 skipped, 0 red, 522 s |
| radio sweep, both languages, Polish captures of 94733c59 with the rule | f3f8e5a0's tree | 42 windows, 1488 radio readings, green |
| scenarios, one at a time | f3f8e5a0 | 65-season 58/60, 2 expected red (Foundry limits); 50-lang 45/45; 51-lang-mixed 38/38; 62-investigation 52/52; 63-class-trial 79/79; 0 failed in each |

Needs a local Foundry (round 3): the Polish checkbox with Foundry's core sheet loaded (the harness has none).
