# The tooltip sweep (1.2.115) - status

Branch `claude/tips-115` from main `9e7e3d78` (1.2.114). R numbers R7300-R7329. The owner's answer to Q-E57-8
(page DRPG-Q113, #81, 14.11.2026): "Robic teraz" - every control the module draws gets a tooltip or a hint.

## 1. The recount (C0)

Counted with E102's census (`tools/tooltip-census.mjs`, read-only; `node tools/check.mjs tooltips`), which rebuilt the
scanner the 395 came from (E57 prep, docs/dev/e57/MEASURE-coverage.md B.1) and was widened after REVIEW-102. Its method
and its limits are its header; it reads source, not a drawn window.

| | E57 prep (4dfac3a, 1.2.108) | E102 prep (421f239, 1.2.109) | here, 9e7e3d78 (1.2.114) |
| --- | ---: | ---: | ---: |
| control sites (closing words apart) | 542 | 549 | 647 in 92 files |
| with neither a tooltip nor a hint line near | 395 | 390 | 242 |
| of which a baseline row "none needed: ..." | - | - | 225 sites (224 rows) |
| of which "help in code" (a tooltip the census cannot follow, held by pattern) | - | - | 13 |
| of which "conditional" (a tooltip under a named condition) | - | - | 4 |

So E102 (1.2.112-1.2.114) had already given most of the 395 their tooltips. What the owner's "now" covers is the 225
sites E102 left as "none needed": that reason was the writing agent's, and the review page's verdict store was empty
when E102 built (docs/dev/e102/STATUS.md), so the owner never saw it. Measured 14.11.2026, `node tools/check.mjs
tooltips` on 9e7e3d78.

## 2. What was done

Each of the 224 rows was read against the code that draws the control and the code that runs it (M1), by one agent
per screen family (Actions, Trial, Gm, Setup, Case, More), each with the brief that docs/text-style.md and
docs/glossary.json set; the merge, the gate and the runs are this line's. The list - window, control, what it does,
today's label, reader, and what it has now - is `LIST.md` beside this file.

| Decision | Rows | What it means |
| --- | ---: | --- |
| tooltip | 174 | drawn through the kit (`tipAttr`, `tipText`, `setTip`, a tab's or a mode's `tooltip`); 208 new keys under `DRPG.Tips.Sweep.{Actions,Trial,Gm,Setup,Case,More}` (rows that draw several controls from one helper carry one key each), 3 E102 keys reused where their words fit word for word |
| hint | 36 | a help line drawn at the control already says it (O3); the row holds `{ fn, pattern }` of that line, read by the gate and by R7300 |
| help in code | 2 (+13 of E102) | a tooltip the census cannot follow: the GM panel's Give bars (modes built in a list) and the handbook tabs (`booksFor().map`) |
| label is enough | 9 | the list in section 3 |
| not met | 4 | two hidden checkboxes (Room setup's favours and hinders), a file input clicked by code, an empty chip toolbar |

Kit: `modeBar` draws a mode's `tooltip` as its button's data-tooltip (the Gm agent had patched the markup by string;
replaced); the census credits a mode's tooltip as it credits a tab's, its plant turned to one tipped mode and one bare.

Words, measured by script on the merged lang files: 208 keys, at most 23 words in each language, 14.9 on average in
English; no digit outside a placeholder, no long dash, none of the forbidden words, no "trace" or "ślad". Five failed
the text lint's X11 (a passive that hides who acts) on the first merge and were rewritten.

## 3. "Label is enough" (9 rows)

| Control | Why |
| --- | --- |
| call-gm.mjs `callCardHtml`: a card's answer buttons | each caller hands in its own ruling words (Approve, Refuse, Approve: {stat}...), and the markup is stored in a posted chat card, so its words would stay in the poster's language |
| gm-items.mjs `bulletCreatePane`: a Truth Bullet's name | the label says the player sees it, the placeholder gives an example, nothing is written until Give |
| gm-panel.mjs `nextLineHtml`: the Next button | it names the step it runs, the line beside it says why, and each step differs |
| gm-stores.mjs `openRestoreDialog`: the restore ticks | each tick's label is a full sentence of what it takes from the file |
| investigation.mjs `caseTraceFilters`: Left by, Room (2) | filters of Everyone/Anywhere and names; they only narrow the GM's table |
| level-up.mjs `buildContent`: Which improvement? | its options spell each improvement out |
| notice-history-app.mjs: the search box | typing is the whole effect; placeholder and aria-label say what it searches |
| voice-panel.mjs `deviceRow`: Microphone, Sound output | this computer's device names; only the chooser hears the change |

## 4. Status

| Step | State |
| --- | --- |
| C1 red: R7300 and the census retire "none needed" | done, 307f63fb: R7300 red (225 sites), `check.mjs tooltips` red (224 rows) |
| C2 the rows read, the tooltips wired, the keys merged, the baseline cut | done, 192aecb8: census 242 -> 70 sites, each a row of the six reasons; R7300 green |
| `npm run quick` | green at 192aecb8 (lint, 24 check parts, gate self-test) |
| full tier 1 | at 707b18f7 (`node run-tests.mjs --tier 1`, 14.11.2026, 524 s here): 1688 ran, 1673 passed, 0 failed, 16 skipped, 0 red. Before R4764 counted the voice tile's second setTip: 1672 / 1 failed (R4764) |
| scenario 95 (tooltips drawn) | 4/4 |
| the touched scenarios | section 5 |

## 5. Scenarios

`node cluster.mjs scenarios/<n>.mjs` at 192aecb8, one at a time, 14.11.2026: 95-tooltips-drawn 4/4; 62-investigation
52/52; 68-trial-zones 42/42; 41-trial-scene 52/52; 65-season 58/60 with 2 expected red (Foundry limits, as on main);
66-rooms 77/77; 71-sheet 42/42; 73-notice-history 32/32; 75-voice-tile 42/42; 76-passages 118/119 with 1 expected red
(a Foundry limit, as on main); 87-messenger-sound 36/36; 61-gmstore-case 114/114; 50-lang 45/45; 51-lang-mixed 38/38.
No tier-2 test was changed. Not run: the other scenarios (their windows were not edited, or only through a file
another of these drew), and 84 (never run).

## 6. Needs a local Foundry

- Whether Foundry v14 shows a `data-tooltip` over a control drawn disabled (E102's LIVE-E102-01, still open): this line
  used the kit's rule (`title` where a control can be disabled), and the notice history's filter chips, drawn disabled
  at a count of 0, carry `data-tooltip` through the chips builder's attrs.
- The tooltips at a real table, in both languages and both themes (delay, position, a long Polish one at 820 px): not
  measured; headless draws the attribute, not the bubble.

## 7. Found on the way (for the coordinator)

- **Possible module bug, Projects manager:** Create project and Share close the manager without saving; room, flag and
  tick changes made in its rows are lost (projects-ui.mjs `openProjectManager`). Not changed here; the Create
  project tooltip says so.
- **Possible module bug, Tables:** renaming a room table repoints no room; a room's "Draws from" keeps the old name and
  stops drawing from it (tables-editor.mjs). Not changed; the Rename tooltip says so.
- **Labels and texts for E71** (each in its row's note in LIST.md): `DRPG.Tips.Trial.killerTooltip` calls the murder
  window's trap box "Indirect murder"; `DRPG.Chapter.optNextMorning` writes "search tokens" in lower case (EN7);
  `DRPG.Advance.newExperiencePlaceholder` (PL) "kim są" for one student; `DRPG.Items.everyone` "Everyone" /
  "Wszystkim"; `DRPG.Tables.placeRolesNote` and the zone mode hints type numbers into prose (O5);
  `DRPG.Murder.betrayalRule` states different facts in EN and PL; `DRPG.Tamper.coverHint` ("one" form) and
  `DRPG.Remnant.cardEditNote` say more in Polish than in English; the Students row's Level Up label is a tooltip key
  (`DRPG.Advance.buttonTooltip`).
- **Old reasons that were wrong against the code** (why those rows are tooltips, not hints): the Check the rooms
  guide, the Fog tab's Discover all / Hide all (no note there), `DRPG.SearchTokens.roomSetupNote` (no words in either
  language; the line is `roomSetupLine`), `DRPG.Case.moveNote` (drawn only when nothing can be restored), the
  Mastermind note, the viewer ticks' note, the overview fold's contents, the tie select's "- not decided -".
- **The census's reader guess** marks several GM windows "player" (describeFind, askHopeCallApproval, the murder
  window, the GM Remnant card, ruleReply); the agents read the reader from the code.
- Room setup's `concealed` cell is built in `roomCells` and placed in no tab, so never drawn.

## 8. Questions with defaults

| # | Question | Default taken |
| --- | --- | --- |
| Q-T115-1 | A control whose own help line already says it: a tooltip too, or the line as its hint? | the line (36 rows "hint: ..."), by O3; each held by its pattern, so losing the line turns the gate red |
| Q-T115-2 | The two possible bugs of section 7: fix here? | no: a behaviour change outside a tooltip sweep; told to the coordinator, the tooltips describe what the code does today |

## 9. The three findings fixed (the coordinator's word of 14.11.2026, Q-T115-2 changed)

Each confirmed red first, then fixed, one commit each, from 389d3895.

| Finding | Red, measured | Fix | Commit |
| --- | --- | --- | --- |
| Projects manager: Create, Share (and a row's Edit) leave without the rows | tier-2 "the Projects manager keeps what its rows were changed to ...": the Gym on all three routes after a row picked the Hall | each route writes the rows as Save does (`applyProjectManager`) before it goes; Create's tooltip no longer says changes are lost, EN and PL | c1407a7a |
| A renamed room table leaves its rooms on the old name | tier-2 "a room table renamed in the Item tables window ...": both Kitchen pieces still named the old table | Rename points every room of every scene that named it at the new name (`repointRooms` through `setVaultRoom`), unless another table keeps the old name; the Rename tooltip says the rooms follow | 071a3c19 |
| Room setup's `concealed` cell, built for every room, drawn nowhere | R7301 (every cell `roomCells` builds is a tab's column) read "concealed" | removed, not wired: a stash's concealment is the Stashes tab's, per stash (ITEM-02); a room-wide box would be a second switch over the same fact | 867f3e0b |

Follow-up 1c820482: R503's census rows for `repointRooms`; R7301's cut by regex (check.mjs contract, rule 3). No
handbook stated any of the three behaviours. Tier-2 tests are named, not numbered, so of the R block only R7301 is
used by these fixes.

At 1c820482: `npm run quick` green; full tier 1 1689 ran, 1674 passed, 0 failed, 16 skipped, 0 red; the two tier-2
tests 2/2 with `--only`. Scenarios at 867f3e0b (only test files changed after): 40-flow 89/89, 62-investigation 52/52,
66-rooms 77/77, 74-room-tile 46/46, 76-passages 118/119 (1 expected red, as on main), 51-lang-mixed 38/38, 65-season
58/60 (2 expected red, as on main). The first tier 1 after the fixes read 2 failures: R503 (above) and one whose name
the run's kept tail does not show; the next run, with R503 fixed, read R503 alone.

## 10. "A completed project's action does not show in Facilities" (the owner, 14.11.2026, on 1.2.114)

The coordinator's five roads, each read on the GM's and on a player's browser (throwaway probe scenarios on the
harness's four clients, then the tests below). The row needs: project complete, not an indirect murder,
`standsAtProject`, `canSee`, a facility this browser can read, `facilityLive`.

| Road | Read headless | Result |
| --- | --- | --- |
| 1 public; completed by the module's progress, by p1's Work rolls through the bridge, and by the countdown written to its end; p1 opens Facilities; the GM reads the same actor | every link true on both browsers; the drawn window shows the row | green; held by scenario 99's facilities check (7b90cf10) |
| 2 secret, p1 an insider | the same | green; held by the same check |
| 3 action set before / after completion | both shown | green. Found beside it: a secret project REVEALED before it was completed got no `completedAt`, so a limited lifetime never ran out - fixed d949b11d (`bothHalves`) |
| 4 a project with no room | never shown (`standsAtProject` false) | the coordinator's default built, d77329e4: shown in every room to whoever `canSee` lets read it; both handbooks say it (Q-T115-3) |
| 5 two copies of "complete" | a countdown made in Daggerheart's own window flips direction on the module's first write to it (a room or an action from the manager): complete at once, and not complete once Daggerheart's tray shows it run out | fixed 50bab172 (`countsUp: false` stamped on the first row) |

**Which of these was the owner's case is not known.** Road 5 matches "it does not show" for a project the GM made in
Daggerheart's own Countdowns window and then gave a room or an action in the manager; road 4 for a project with no
room. Neither can be told from here.

**What the harness assumes that a real table may not** (what the owner should check at the table, on 1.2.115):
- A player's browser holds every scene with its regions and tokens (`game.scenes`): `standsAtProject` compares the
  scene the character's token stands on with the project's (its token's scene, else the first scene with a room of
  its name). With two scenes holding a room of the same name, or the project's token on another scene than the
  character's, the row is (rightly) not drawn - check that the project's token and the character stand on the same map.
- Daggerheart's own countdown controls: the harness writes the setting as its window would (current at the max for a
  module project, at 0 for one of Daggerheart's); how v14's Daggerheart window moves a module project's bar was not
  read here.
- The action's lifetime: an action of N times of day ends N times of day after completion and at the chapter's end;
  a project completed in an earlier session may simply have run out (the Projects window's line says how long it lasts).

To check at the table: a public project in the room the character stands in, completed, its action set in the manager
(Edit room action, a name typed, Save); the player opens Facilities. Then the same with a project made in
Daggerheart's own Countdowns window (fixed in 1.2.115, road 5).

## 11. Questions with defaults (continued)

| # | Question | Default taken |
| --- | --- | --- |
| Q-T115-3 | A completed project with no room ("abstract work anywhere"): where does its room action show? | in every room, to whoever knows the project (its insiders, or everyone if public) - the coordinator's default, built in d77329e4 |
