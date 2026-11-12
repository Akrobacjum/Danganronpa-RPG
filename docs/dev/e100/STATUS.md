# E100 - status of the work line, branch e100

The player screens' cleanup: the six items of the player-screens review (shot on main 1.2.108 in the harness, not
in Foundry; review page YH2SiTx2Rbv2s38YQgs8H3) that the owner approved on 12.11.2026, and a seventh (review #9)
the coordinator added the same day. Base: origin/main 4dfac3a9
(1.2.108). Not in this line: the Rest window's empty word (gaps line), module-mechanics sentences and the Status
explainer (texts line), the Hope Calls windows (E72).

## R numbers

R4100-R4106, tier 1, registry Since E100 (set by hand: `tools/stages.json` has no E100 row, so `--write` stamps a new
row with the first unshipped stage, E61, and keeps a row's Since once written). Not R3917-R3922, which
`node tools/registry.mjs --next` gave on main: the e97-98 line already holds R3917 and R3918, e64 holds R3950-R3970
and the texts line wrote and dropped R4000. The registry's "Next free" line now reads R4107; whoever merges
re-runs `node tools/registry.mjs --write` (the file is generated, and conflicts with e64's and e97-98's).

## The items

| # | Review | What changed | Red test (red at) | Green |
| --- | --- | --- | --- | --- |
| 1 | #2 Move's window | `performAction(actor, "move")` opens nothing; action-briefing.mjs `briefing` and action-rolls.mjs `NEEDS_OWN_BRIEFING` removed; `DRPG.Action.gotIt` removed. In real code only a Monocub's panel draws a Move tile (a student has none, `ACTIONS.move` is `kind: "panel"`; the review's student model drew one): it is a still tile (a `div`, no `data-drpg-action`) with its price and "Drag your token" / "Przeciągnij token" on its face, no hover. The HUD's Move row's tooltip opens with "To move to another room, drag your token there." (outside an Eclipse; the Eclipse row already says "place anywhere", R997 pins it). `.drpg-briefing` left the stylesheets' window lists (only Move's window wore it). | R4100 (4dfac3a9: the window asked once, `briefing` exported, Got it in both files, the tile a pressable button, no drag line) | 0dead12b |
| 2 | #3 Sound twice | The gear's Sound section names no setting and draws no slider: one button, "Open the Sound window" / "Otwórz okno Dźwięk", with a line, opens the Sound window; the Voice section stays (devices and push to talk are nowhere else). A GM's Sound window draws the sliders and Messenger sounds in both themes (under the glass it drew none). No setting lost: Messenger sounds is the Sound window's, the other 34 of the frozen 35 in a section each. The phone promise (R3140) moved with the volumes to the Sound window's range (`min-width: 0`). | R4101 (0dead12b: the gear's pane had two sliders and the Messenger sounds row, no button; a GM's Sound window under the glass no slider) | 55a7205b |
| 3 | #4 Verbose log | `debug` drawn in the gear's window for a GM alone (`GM_ONLY_CLIENT_KEYS`); a player's window has no Technical section left. **No road exists for a GM to switch it on for a player's browser** (read on 12.11.2026: a client setting, read by utils.mjs `debug` alone, written by no socket or bridge row), and none was added: kept GM-only. The GM handbook's voice recipe (section 20, Troubleshooting, step 6) now gives the player the console line `game.settings.set("danganronpa-rpg", "debug", true)`. | R4102 (55a7205b: the player's window drew the row and Technical) | a5dc2ba7 |
| 4 | #5 Notice filters | Chips All, For you, Not done; Announcements, From players, Evidence and Messenger in one select (`.drpg-notices-more`) after "More filters" / "Więcej filtrów", each with its count; a menu pick presses no chip, a chip resets the menu; a filter at 0 is disabled and moves the window back to All. | R4103 (a5dc2ba7: seven chips, no menu) | 693a1020 |
| 5 | #8 Search's statistic | `traitFieldHtml` with `fold`: the proposal (statistic and words of how) in a closed `details` under "Another statistic" / "Inna statystyka"; Eye is the first choice and what an unopened window proposes, which asks nobody. Search alone asks with `fold`; Dynamic and the crisis rows, where the statistic is the point, do not. | R4104 (693a1020: the field drawn open) | b123a686 |
| 6 | #10 Button words | One word per kind: rolls "Rzuć" / "Roll", the GM decides "Wyślij do GM-a" / "Send to the GM", leads on "Dalej" / "Next". The list is below. | R4105 (b123a686: "Rzut", Do it in five openers, "Send to GM", "Send it to the GM", "Roll it") | fa450138 |
| 7 | #9 The explainers' count | explain.mjs `phaseExplanation` (Daily Life's paragraph in the clock's window) and `actionsExplained` (the strip's window) fill `{actions}` with the shown character's own maximum (actions.mjs `actionsMax`, the number "Masz 3 z 3" beside it reads) and Wounded's sentence with that maximum less what a wound takes; with no character, or a Monokuma, the rule's (`baseActions`). Code only: the texts line rewords the keys (texts-e71 d640019e), no lang value changed here. R503's census gains the clock window's read of the character. | R4106 (6bc3b8c8: both answered the rule's number) | d168919c |

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
| Level Up: which kind; who picks | Zrób to / Do it | Dalej / Next | `DRPG.Action.next` |
| Crisis action with a roll | Rzuć / Roll it | Rzuć / Roll | `DRPG.Murder.briefRoll` (EN changed) |
| Move | Jasne / Got it | (window removed, item 1) | `DRPG.Action.gotIt` removed |

Kept, on purpose:
- Rest's first window (Short or Long Rest) keeps `chooseVariant`'s fallback, "Zrób to" / "Do it". E93 turns this window
  into Facilities (the rests and the room's actions, which do more than lead to a next window), and a word put here
  conflicted with e93's action-rest.mjs; its word is E93's. `DRPG.Action.proceed` stays as that fallback.
- `DRPG.Murder.briefTake` "Zrób to" / "Do it" on a crisis action with no roll: it does what its row names.
- Hope Calls' "Wydaj N" / "Spend N" (E72's windows) and the GM's windows are not touched.

## Texts

New and changed keys are in `docs/text-style.md`, section "E100: słowa przycisków i teksty ekranów gracza". Handbooks:
GM en/pl 602, 796 (Roll), 1078, 1100 (the Sound window), 1100 and 1300 (the verbose log); player en/pl 568 (Search's
Another statistic) and 859 (Open the Sound window); GM 79 and player 852 are left for the texts line (Open 2).

## Runs

Per commit: `npm run quick` (lint, check, gate), prose 527/527, tiers 0-1, the commits' own tier-2 tests by name.
Item 7: quick green; tiers 0-1 1258 passed, 1 failed (R503, the census row - added, re-run green with R4106), 16
skipped. At the
last commit of the six and its renumbering: quick green, tiers 0-1 1258 passed, 0 failed, 16 skipped; scenarios 75
(41/41, at item 2), 73 (32/32, at item 4) and 71 (41/41, at the renumbering).
No run in a real Foundry; the review page's shots are the harness's (see the page).

## Open

1. **For the coordinator: the code rules file (`rules/code.md` in the agent folder) rows 49 and 52** still name `NEEDS_OWN_BRIEFING` and Move's
   briefing window (`briefing`) in action-rolls.mjs's and action-briefing.mjs's rows; both are gone (item 1). This line
   does not edit that folder.
2. **Two handbook sentences left for the texts line's merge.** GM handbook line 79 ("This browser's own - language,
   theme, look, effects, volumes, the messenger's sounds and the voice - are the gear's window") and player handbook
   line 852 ("- the volumes and the voice apply as you move them") were rewritten by the texts line too; to keep away
   from that conflict they are not changed here. After both merge: line 79 should say the volumes and the messenger's
   sounds are the Sound window's, opened from the gear's Sound and voice section; line 852, that the voice applies as
   it is changed. The sections that hold the detail (GM 1078, 1100; player 859) say it already.
3. `git merge-tree` at the last push: no conflict with origin/main, e72, e93 or texts-e71; with e64 and e97-98 only
   `docs/dev/R-REGISTRY.md`, the generated file (re-run `--write` after the merge).
4. The Monocub's Move tile and the HUD's tooltip are not seen at a table: the harness draws no tooltip and no real
   sheet (LIVE: look at a Monocub's sheet and hover the HUD's Move row).
