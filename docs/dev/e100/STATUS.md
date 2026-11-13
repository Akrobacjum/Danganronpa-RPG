# E100 - status of the work line, branch e100

The player screens' cleanup: the six items of the player-screens review (shot on main 1.2.108 in the harness, not
in Foundry; review page YH2SiTx2Rbv2s38YQgs8H3) that the owner approved on 12.11.2026, and a seventh (review #9)
the coordinator added the same day. Base: origin/main 4dfac3a9
(1.2.108). Not in this line: the Rest window's empty word (gaps line), module-mechanics sentences and the Status
explainer (texts line), the Hope Calls windows (E72).

## The owner's review of E100 (12.11.2026)

Passed on by the coordinator, the owner's words: "2. Dźwięk, muzyka i dźwięki komunikatora - nie zgadzam się na
zmianę. Wolę wersję z 1.2.108" and "5. Search - nie chowajmy w oknach akcji wyboru statystyki ani opisu akcji
NIGDY". Items 2 and 5 are **reverted** (`git revert`, 818c760e and 7f7e4209): the settings window, the Sound
window, Search's statistic and every test those two commits changed are as in 1.2.108; items 1, 3, 4, 6 and 7
stand. A standing rule from the owner for every action window: the statistic choice and the action's description
are never folded away, hidden or collapsed. Checked against it: item 6 changed words only; item 1 took away the
one place Move's description stood, so a Monocub's panel now shows it as a line under its tiles (R4107).

## R numbers

R4100-R4110 and R4112, tier 1, registry Since E100 (R4111 not used) (R4101 and R4104 removed with the reverts; their rows kept, marked) (set by hand: `tools/stages.json` has no E100 row, so `--write` stamps a new
row with the first unshipped stage, E61, and keeps a row's Since once written). Not R3917-R3922, which
`node tools/registry.mjs --next` gave on main: the e97-98 line already holds R3917 and R3918, e64 holds R3950-R3970
and the texts line wrote and dropped R4000. The registry's "Next free" line now reads R4113; whoever merges
re-runs `node tools/registry.mjs --write` (the file is generated, and conflicts with e64's and e97-98's).

## The items

| # | Review | What changed | Red test (red at) | Green |
| --- | --- | --- | --- | --- |
| 1 | #2 Move's window | `performAction(actor, "move")` opens nothing; action-briefing.mjs `briefing` and action-rolls.mjs `NEEDS_OWN_BRIEFING` removed; `DRPG.Action.gotIt` removed. In real code only a Monocub's panel draws a Move tile (a student has none, `ACTIONS.move` is `kind: "panel"`; the review's student model drew one): it is a still tile (a `div`, no `data-drpg-action`) with its price and "Drag your token" / "Przeciągnij token" on its face, no hover. The HUD's Move row's tooltip opens with "To move to another room, drag your token there." (outside an Eclipse; the Eclipse row already says "place anywhere", R997 pins it). `.drpg-briefing` left the stylesheets' window lists (only Move's window wore it). Since the owner's rule, the Monocub's panel also shows Move's description as a line under its tiles (`monocubMoveNote`, R4107). The same day the owner cut that line to "Za darmo" / "Free" (`DRPG.Move.free`, 81685ca2): only the price, not the whole description. | R4100 (4dfac3a9: the window asked once, `briefing` exported, Got it in both files, the tile a pressable button, no drag line) | 0dead12b |
| 2 | #3 Sound twice | **Reverted at the owner's word** (818c760e): 1.2.108's settings window and Sound window. What was built: the volumes and Messenger sounds in the Sound window alone, a button to it in the gear's Sound section. | R4101 (removed with the revert) | 55a7205b, reverted by 818c760e |
| 3 | #4 Verbose log | `debug` drawn in the gear's window for a GM alone (`GM_ONLY_CLIENT_KEYS`); a player's window has no Technical section left. **No road exists for a GM to switch it on for a player's browser** (read on 12.11.2026: a client setting, read by utils.mjs `debug` alone, written by no socket or bridge row), and none was added: kept GM-only. The GM handbook's voice recipe (section 20, Troubleshooting, step 6) now gives the player the console line `game.settings.set("danganronpa-rpg", "debug", true)`. | R4102 (55a7205b: the player's window drew the row and Technical) | a5dc2ba7 |
| 4 | #5 Notice filters | Chips All, For you, Not done; Announcements, From players, Evidence and Messenger in one select (`.drpg-notices-more`) after "More filters" / "Więcej filtrów", each with its count; a menu pick presses no chip, a chip resets the menu; a filter at 0 is disabled and moves the window back to All. | R4103 (a5dc2ba7: seven chips, no menu) | 693a1020 |
| 5 | #8 Search's statistic | **Reverted at the owner's word** (7f7e4209): the statistic choice stands open in Search as in 1.2.108. What was built: the proposal folded under "Another statistic". | R4104 (removed with the revert) | b123a686, reverted by 7f7e4209 |
| 6 | #10 Button words | One word per kind: rolls "Rzuć" / "Roll", the GM decides "Wyślij do GM-a" / "Send to the GM", leads on "Dalej" / "Next". The list is below. | R4105 (b123a686: "Rzut", Do it in five openers, "Send to GM", "Send it to the GM", "Roll it") | fa450138 |
| 7 | #9 The explainers' count | explain.mjs `phaseExplanation` (Daily Life's paragraph in the clock's window) and `actionsExplained` (the strip's window) fill `{actions}` with the shown character's own maximum (actions.mjs `actionsMax`, the number "Masz 3 z 3" beside it reads) and Wounded's sentence with that maximum less what a wound takes; with no character, or a Monokuma, the rule's (`baseActions`). Code only: the texts line rewords the keys (texts-e71 d640019e), no lang value changed here. R503's census gains the clock window's read of the character. | R4106 (6bc3b8c8: both answered the rule's number) | d168919c |
| 8 | the owner's rule, found by E93 and E72 | No fold in an action window: "Rolls: <statistic>" stands in the lead after the description (`drpg-briefing-rolls`), once, left out where the description names the statistic; Details keeps the cost, the room and the thresholds. An unpicked row keeps its description line (`.drpg-action-window` overrules the columns' `display: none`, the rule itself untouched so E72's Call-window override merges clean). | R4108, R4109 (bf0ce376) | fb04ba2a |
| 9 | the owner at a table on 1.2.108 | The sheet's Stop shows the table's word alone (no "Safeword" caption; tooltip and aria-label keep it). The left column no longer scrolls sideways: under the glass the brush behind the Equipped row overhung it by 5 px a side (278 in 274, Chromium); inside the column it stands in its box. The chosen tab is marked under the glass again: since E48 K2 its brush was Bone on the Bone bar; Ink now, its words Bone. Legacy: the chosen tab reads marked in the model; not reproduced there. | R4110, R4112, R3488 changed (fb04ba2a) | 69520df9 |
| 10 | the owner at a table: "W trialu usunięto tackę actions/move/hope, która jest nad projects. Przywróćmy ją." | The box that went in a trial is the GM's strip (the table's view, "Still to act"). Hidden on purpose since E23 C3a (the owner's Q-E23-3, 1.2.101): in a trial nobody spends the day's actions, and the count fell at an execution; with its one row gone the strip is not drawn at all. `quietActions` now leaves the row out only while an incident runs. A player's strip never went in a trial (measured headless, p1 in classTrial: actions, move, hope). GM handbook en/pl 230. | R1392 changed (69520df9: classTrial null), R1118 changed | d1451f72 |

Each commit's message holds its red and green readings and its gate.

## Item 6: every button changed

| Window | Button before (PL / EN) | After (PL / EN) | Key |
| --- | --- | --- | --- |
| Observe | Rzut / Roll | Rzuć / Roll | `DRPG.Action.roll` (PL changed) |
| Search | Rzut / Roll | Rzuć / Roll | `DRPG.Action.roll` |
| Tamper | Rzut / Roll | Rzuć / Roll | `DRPG.Action.roll` |
| Listen | Rzut / Roll | Rzuć / Roll | `DRPG.Action.roll` |
| Palm: Steal, Plant; Frisk unseen | Rzut / Roll | Rzuć / Roll | `DRPG.Action.roll` |
| Palm: Frisk openly (asks the person) | Zrób to / Do it | Poproś / Ask them | `DRPG.Action.askThem` (new) |
| Analyze (all four rows roll) | Zrób to / Do it | Rzuć / Roll | `DRPG.Action.roll` |
| Projects: Work on a project, Sabotage | Zrób to / Do it | Rzuć / Roll | `DRPG.Action.roll` |
| Projects: Propose a project (opens the proposal form) | Zrób to / Do it | Dalej / Next | `DRPG.Action.next` (new) |
| The project picker (the API's door to Work or Sabotage) | Zrób to / Do it | Rzuć / Roll | `DRPG.Action.roll` |
| Propose a project (the form) | Wyślij do GM-a / Send it to the GM | Wyślij do GM-a / Send to the GM | `DRPG.Project.proposeButton` (EN changed) |
| Dynamic Action and every request window to a GM | Wyślij do GM-a / Send to GM | Wyślij do GM-a / Send to the GM | `DRPG.Bridge.send` (EN changed) |
| Rest's picks (Short or Long Rest; Relief's too) | Zrób to / Do it | Odpocznij / Rest | `DRPG.Action.restNow` (new) |
| Level Up (one window since E101, the r112 merge) | Zrób to / Do it | Przyznaj / Grant | `DRPG.Advance.grant` |
| Infiltrate's rows (the r112 review's G1) | Zrób to / Do it | Rzuć / Roll on Dash, Shut the Door and Keep Watch; Dalej / Next on Listen, Tail, Force and Pick | `DRPG.Action.roll`, `DRPG.Action.next` |
| Crisis action with a roll | Rzuć / Roll it | Rzuć / Roll | `DRPG.Murder.briefRoll` (EN changed) |
| Move | Jasne / Got it | (window removed, item 1) | `DRPG.Action.gotIt` removed |

Kept, on purpose:
- Rest's first window (Short or Long Rest) keeps `chooseVariant`'s fallback, "Zrób to" / "Do it". E93 turns this window
  into Facilities (the rests and the room's actions, which do more than lead to a next window), and a word put here
  conflicted with e93's action-rest.mjs; its word is E93's. `DRPG.Action.proceed` stays as that fallback.
- `DRPG.Murder.briefTake` "Zrób to" / "Do it" on a crisis action with no roll: it does what its row names.
- Hope Calls' "Wydaj N" / "Spend N" (E72's windows) and the GM's windows are not touched.

## Texts

New and changed keys are in `docs/text-style.md`, section "E100: słowa przycisków i teksty ekranów gracza" (the
rows of items 2 and 5 left with the reverts). Handbooks: GM en/pl 1100 and 1300 (the verbose log), GM en 796 and
player en 602 (Roll). Everything items 2 and 5 wrote in the handbooks is back as in 1.2.108.

## Runs

Per commit: `npm run quick` (lint, check, gate), prose 527/527, tiers 0-1, the commits' own tier-2 tests by name.
Item 7: quick green; tiers 0-1 1258 passed, 1 failed (R503, the census row - added, re-run green with R4106), 16
skipped. At the
last commit of the six and its renumbering: quick green, tiers 0-1 1258 passed, 0 failed, 16 skipped; scenarios 75
(41/41, at item 2), 73 (32/32, at item 4) and 71 (41/41, at the renumbering).
After the reverts and R4107 (a006deb4): quick green; tiers 0-1 1258 passed, 0 failed, 16 skipped; tier 2 "the DRPG
Settings window saves" and "Search on Eye asks nobody" green; scenarios 75 and 71 41/41.
Tiers 0-1 at bf0ce376: 1258 passed, 0 failed, 16 skipped. Items 8 and 9 (at 69520df9): quick green; tiers 0-1 1262
passed, 0 failed, 16 skipped; scenario 71 41/41 on item 9's first cut.
Item 10 (d1451f72): quick green; tiers 0-1 1262 passed, 0 failed, 16 skipped; scenarios 14-quiet 7/7, 40-flow 88/88.
No run in a real Foundry; the review page's shots are the harness's (see the page).

## Open

1. **For the coordinator: the code rules file (`rules/code.md` in the agent folder) rows 49 and 52** still name `NEEDS_OWN_BRIEFING` and Move's
   briefing window (`briefing`) in action-rolls.mjs's and action-briefing.mjs's rows; both are gone (item 1). This line
   does not edit that folder.
2. `git merge-tree` at the last push (d1451f72): no conflict with origin/main, e72, e93 or texts-e71; with e64 and e97-98 only
   `docs/dev/R-REGISTRY.md`, the generated file (re-run `--write` after the merge).
3. The Monocub's Move tile and the HUD's tooltip are not seen at a table: the harness draws no tooltip and no real
   sheet (LIVE: look at a Monocub's sheet and hover the HUD's Move row).
4. Item 10 read the owner's "actions/move/hope" as the GM's strip: it is the only box above the Projects tray that a
   trial takes away (a player's strip, which does carry Actions, Move and Hope, stays in a trial in the harness and in
   the glass harness). If the owner saw it go on a player's page, that is not reproduced here: a table screenshot
   would settle it.
