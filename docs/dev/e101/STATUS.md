# E101 - the GM screens' cleanup: status

The owner said yes on 12.11.2026 to the GM screens' review (artifact T8eePyz1, shot on main 1.2.108 in the harness,
not Foundry). Seven numbered items, plus the smaller structural proposals beside each window that no other line holds.
Base: origin/main 4dfac3a (1.2.108). Branch: `claude/e101`.

R numbers: E101 takes R4050-R4099 (the open lines hold R3750s, R3800s and R3900-R3966); used so far R4050-R4064.
Registry Since: the rows read E61, the stamp `node tools/registry.mjs --write` gives (the first stage tools/stages.json
has not shipped); `--stage E101` is refused, E101 not being a stage of that file. Until 12.11 this line said E101, which
no row carried.

## Items

| Item | What changed | Red test | Green |
| --- | --- | --- | --- |
| 7 (#8) Music and Vary the sounds into the Sound window | settings-window.mjs's audio section ("Voice" now) drops `musicEnabled` and `sfxVary`; `SOUND_WINDOW_SETTINGS` names them; sound-panel.mjs `soundSettingSwitch` draws Music follows the game state above the Music tab's table and Vary the sounds before the Effects tab's table (`soundEffectsPane` over sfx.mjs `soundEffectsHtml({ lead })`); `wireSoundDialog` saves each as it is flipped. Both settings stay registered as they were (world, Boolean): no setting lost. | R4050 red at 4dfac3a (both in the audio section, no switch, no `SOUND_WINDOW_SETTINGS`) | R4050; tier 2 E101-T7 (flips each in the opened window, puts them back); R3420 changed on purpose (the Sound window counts as a place); R2028 still green (the hint is a `div`, not a loose paragraph) |
| 6 (#7) Despair Flow | gm-team-dialog.mjs `despairFlowLayout`: one pool holder and no Assistant GM to grant or revoke opens on Overflow, Pools/Monokumas/Students folded behind one Show button (panes stay in the form); the Monokumas tab lists Monokumas alone with their pool; the Monokuma box is gone. Its readers checked first (at 4dfac3a): `readTeamDraft`, `paintTeamDraft`, `wireMonokumaLive`, `saveGmTeam` (setMonokuma), `readAssignmentForm`, tier 2 E15-T8; nothing outside the window. `DRPG.Monokuma.panelIntro` says where the role is set; `noneYet` when there is none. | R4051 red at 4dfac3a (no `despairFlowLayout` / `despairFlowMarkup`) | R4051; tier 2 E101-T6 (the shared-pool warning on two Monokumas made by `setMonokuma`, put back); E15-T8, R2030 changed on purpose |
| 2 (#3) Season checklist + Pre-season checks | One window: the checklist's footer has Close only, no closing note; the further checks (room pictures, voice, dice look, anonymity audit) fill a slot under the rows once the window stands (`fillMoreChecks` -> `preSessionReport`). Each check once: no cast or scenes part (the rows ask them; the characters no player owns are a new optional row `npcs`; a room scene still on Foundry's own vision, the one check only Pre-season made, is the rooms row's through fog.mjs `sceneVisionReady`); no given-back part (What the module holds is drawn only while given back, with that line); Sound files row removed; the hall-tokens row merged into the Scenes row; the Monokuma row opens the Students window (item 6). The technical lines - the contract and the dice look's console command - are `foundryReport`, opened by a Foundry and modules button in the Debug log (Diagnostics): a tile of its own would have needed a glyph in tests-glyphs.mjs and pixel-icons.css, which e72 and e93 both edit. `runPreSessionChecks` and `drpg-window-preseason` are gone. | R4052 red at 4dfac3a | R4052; changed on purpose: R1132, R1358, R1376, R1524, R1532, R1541, R1553, R1558, R1562, R2033, R3584 (tier 1), E46-T4 (tier 2); scenario 84 edited to read the checklist's cast row (84 not run: local gate only, and this line never runs it) |
| Smaller: Game settings | Voice in Foundry's window, Replace Daggerheart's Fear, the module's windows for Foundry's tools, no file browser for players and the token shield into "Foundry and the system"; "GM tools and map" renamed "Map" (it keeps Rooms decide what players can see alone) | R4053 red at 4dfac3a | R4053; R3420 sizes changed on purpose |
| Smaller: GM panel | the students line is the count alone; the Now section's Students tile is the door | R4054 red | R4054; R3345, tier 2 "Students shows each acting student's actions" changed on purpose |
| Smaller: Season setup | Reset the season out of the footer into a warning frame at the body's foot (`seasonResetPart`), End the chapter's shape | R4055 red | R4055; R1358, R3532, R3533, R3580 changed on purpose |
| Smaller: Level Up | what was earned and who picks in one window, button Grant (`DRPG.Advance.grant`); take-back rows keep their own words | R4056 red | R4056; R1352's census and the narrow menus' count changed; tier 2 E47-T6 answers the one window |
| Smaller: Item tables | the Tier pools tab: no New Tier pool field, no Rename (Delete stays); Create table is the Room pools tab's | R4057 red | R4057; R973, R2021 changed on purpose |
| Smaller: not done here | Notices window filters (E100's, the coordinator); the Students window's State column (after 1.2.109, E92's Spectator); Monocub window and Final Trial verdict (E72); every rename and text shortening (texts line); Room setup's Search toggles in two columns and the picture frame's label (with items 3-5, after e93) | - | - |
| Table note 1: the GM panel's top not centred | The clock with its phase and Next time of day are two rows (gm-panel.mjs `buildPanelContent`: `.drpg-gmp-clockline`, `.drpg-gmp-advance-row`), each a flex row centred on the block in components.css. Cause, measured in Chromium on probe 08's capture with `.application button { display: flex }` planted as Foundry's core sheet has it: `text-align: center` does not centre a block-level flex button; Next time of day stood at 17 px of a 704 px window. The Students door on the students line was gone already (23e59845). | R4058 red at 251b0136 | R4058; R3540 changed on purpose (two rules name the standing block) |
| Table note 2: Give / take items, no separate Give buttons | gm-items.mjs `openItemManager`: the Give tab asks What (Item, Truth Bullet, Room key) and From (From the tables / Create new; From a Remnant / Write a new one; none for a key) and shows that one form in the hub (`hubGivePane`, `wireHubGive`); the footer has one Give (primary) and Take's three doors. Give reads the shown form (`readHubGive`), the hub closes, the give runs as its own window's would (`giveItemNow`, `giveBulletNow`, `giveKeyNow`, split out of `gmGiveItemDialog`, `giveTruthBulletDialog`, `giveKeyDialog`, which stay for the messenger and the suite), and the hub opens again on the same student and choice. Give is off while the shown form cannot give. The five panes stand in one form, so the new bullet's name is `bulletName` and the recipient is the hub's `who`. The from words are the specific ones, not "Existing / New" (two keys if the owner wants those). New keys `DRPG.Items.giveWhat`, `whatItem`, `whatBullet`, `whatKey`, `giveFrom`, `fromTables`, `giveButton` (EN, PL). Probe 08 rows `item-manager--item-new`, `--bullet`, `--bullet-new`, `--key` (`click` takes a list). | R4060 and tier 2 E101-T5 red at 251b0136 | R4060; E101-T5 (gives an item and a Truth Bullet through the drawn hub, takes them away); changed on purpose: R974, the footer roles' census (OPEN_B), the two tier-2 tests that hand a trace over from the hub ("a copy made between the death and the discovery ...", "a loot after the close ...") |
| Table note 3: the settings window changes size | settings-window.mjs `holdSectionHeight`: on render (and once the fonts are ready) each section shown in turn, the content column's min-height set to the tallest; both `openSettingsWindow` and `openGameSettingsWindow`. NOT REPRODUCED: in the style harness (Chromium, 1920x1080) Game settings stood 933 px in every section before and 934 px after; the guard is kept, and the size at a table is still to be looked at. | R4059 red at 251b0136 (no function) | R4059 |
| Table note 4: Season setup refreshes when a child window closes | season-setup.mjs `wireSeasonTiles` opens the tile's window and nothing else: no `handOff`, no close and reopen of Season setup (the checklist's rows keep their round trip). | tier 2 E101-T4 red at 251b0136 | E101-T4 (the same window, the typed name and the scroll after Despair Flow came and went); R3581, R1524, R74 changed on purpose |
| Table note 5: Interface scale's field and hint | ui-kit.mjs `wireStepper`'s - and + land on the step's places (0.9 + 0.05 read 0.9500000000000001, which a narrow field showed as 0.95000000); settings-window.mjs draws a stored number short, and Interface scale's row says one sentence with no tooltip (new `DRPG.SettingsWindow.uiScaleHint`) over the total on this screen (new `DRPG.SettingsWindow.scaleNow`, `scaleNow`). The setting's own hint is left as it is (the texts line rewrites it). The overlap is read as Foundry's tooltip of the hint's rest drawn over the line under it: not reproduced (the harness has no tooltip). | R4061 red at 2e10420d | R4061 |
| Table note 6: the microphone's mode | components.css draws each of voice-panel.mjs's two radio labels as a button, pressed while its radio is checked (`:has(> input:checked)`), the radio itself hidden; the radios, their names and the writes are as they were. In the harness a click on either label already checked it and wrote the mode before the change; what the table saw is read as the drawing (Foundry's and the glass's radio together). To look at again at a table. | R4062 red at 2e10420d (no rule) | R4062; R542 and scenario 75 unchanged and green |
| Table note 7 (with 3): the settings window keeps one size | Measured in Chromium at 1366x768 with `[hidden] { display: none !important }` planted (whether Foundry's sheet has that rule is not read here): the player's window 520 / 569 / 621 / 402 px by section without `holdSectionHeight`, 621 px in each with it; the GM's 520 / 569 / 402 / 402 px, 570 px with it. | - | R4059 |
| Table note 8: the Class Trial console's row of modes scrolls | components.css: the picker wraps and has no scroll (E99 round 5 had made it one row with `overflow-x: auto`). Measured in Chromium, 1366x768, Straw Poll seeded: under the glass the row was 4 px wider than its box (1250 / 1246: the brush stands 5 px out of each start) and scrolled; after, it scrolls in neither theme. | R4063 red at 2e10420d | R4063 |
| Table note 9: Sound and Music in one column | components.css: a volume row spans the section's columns, its control and line a column wide. The player's window with voice: 718 px under the glass (621 before), 573 under Legacy (499), within 768. | R4064 red at 2e10420d | R4064 |
| 3 (#4) Room setup: one line about Apply, Search's "arrows" | Branch `claude/e101b` (from 338d20d0, origin/claude/e93 4eef965a merged in). room-setup.mjs draws `DRPG.Vault.applyLine` over the tabs (what Apply saves, and the three parts that write at once); the five repeats go: the passages' intro is `DRPG.Passage.tab.introLine`, Search's tokens line `DRPG.SearchTokens.roomSetupLine` (no arrows: - and +), the room actions' line `DRPG.Facility.editor.tabLine`, no line under Fog. New keys only (EN, PL): the texts line rewrites the old ones, which stay. | R4470 red at eb9431dc | R4470 |
| 4 (#5) Room setup: one Rooms tab, Doors for locks and neighbours | The first tab is Rooms (`DRPG.Vault.tabRooms`, key still `bedrooms`): This is a room, Whose bedroom, No privacy, with the room count; Doors holds Locked, Locked at start, Broken (e93) and Neighbours. Cells, names and Apply's read unchanged: only the pane a column stands in moved. Short lines `roomsIntro`, `notSharedLine`, `doorsLine`, `neighboursLine` (the neighbours' whole rules stay in that line's tooltip). The Season checklist's "every region decided" row opens Rooms. | R4470 red at eb9431dc | R4470; changed on purpose R2010, R2013 |
| 5 (#6) Room setup > Scenes into Season setup | Room setup has no Scenes tab (eight tabs; a scene with no room opens on Rooms). season-setup.mjs `seasonScenesPart`: trial-scene.mjs's part under one sentence (`DRPG.Season.scenesLine`; `scenesTabHtml` takes `lead`), wired as the tab was, Save held with the reason while one scene stands for both or a running trial locks the hall (`holdSeasonSave`, as `setApplyBlock`), and Save's backstops then `applyScenesTab` after Edit campaign's write. The checklist's Scenes row and `game.drpg.openTrialCast` open Season setup. | R4471 red at eb9431dc | R4471, tier 2 E101-T9; changed on purpose R120, R2011, R3580, tier 2 "the Scenes tab links the school ..." and E46-T1, scenario 41 (a0, l1, o2, l2 on Season setup) |
| 1 (#2) Edit campaign into Season setup | E49 A1e had already put Edit campaign's rows at Season setup's top; what Season setup lacked was E94's next morning's line, a field of Edit campaign's own window, which only `game.drpg.editClock` opens. Season setup's block draws it after the six (`morningLineRow`), `readSeasonForm` reads it and Save keeps it on this browser (`morningLineDraft`) before the clock is written, as Edit campaign's Apply does. Default taken: `game.drpg.editClock`'s window stays as it is (a console door to the same rows). The GM handbook's Season setup paragraph (line 103) waits for texts-e71, which rewrites it | R4475, tier 2 E101-T12 red at eb0cd30a | R4475, E101-T12; R3580's field list changed on purpose |

Items 3-5 were done on 13.11 on `claude/e101b`, e93 merged in (the coordinator, 12.11 night). Until then they waited for e93 (the coordinator, 12.11):  e93 rewrites the same lines of room-setup.mjs (the Doors tab's columns, ROOM_SETUP_TABS, the Rest tab) and the texts line (claude/texts-e71) rewrites the room tabs' texts (searchIntro, scenesIntro, notSharedNote, fogIntro, stashesNote, setupIntro ...). Any version of items 3-5 conflicts with both at merge.

## The review page

https://claude.ai/artifact/YKCBjKepPEWvZcubdp46Y3 (private, the owner's): each changed window before (the review's own
shots, main 1.2.108) and after (this branch), PL first then EN, Stained Glass and Legacy, 1366x768; harness captures
(probe 08, `DRPG_CAPTURE_ONLY`, `DRPG_CAPTURE_LANG`) drawn in audit/style-harness.html in Chromium, not Foundry.

## Runs (this branch, 12.11.2026)

- `npm run quick`: lint 0 problems, check 17 parts green, gate self-test 37/37 (after the names fix).
- Tiers 0-1 (`node run-tests.mjs --tier 1`): 1255 passed, 0 failed, 16 skipped, 0 red (1270 ran, 397 s).
- Tier 2 by name (E101, E15-T8, E46-T4, E50-T1, E20-T2, the Mastermind's no-pool warning, Season setup's undecided region, the game's settings window saves, every test named Season checklist or Despair Flow): 36 passed, 0 failed.
- After the smaller proposals (23e59845): scenarios 00-boot 33/33, 50-lang 44/44, 63-class-trial 75/75, 65-season 57/59 (2 expected red), 71-sheet 41/41, 88-flow-length 26/26, 41-trial-scene 51/51, 33-bridge-paths 74/74, 61-gmstore-case 113/113, 83-roll-integrity 110/110, 30-security 273/274 (1 expected red); 0 failed. After 560b94d4 (lang keys moved clear of texts-e71 d640019e): tiers 0-1 1260 passed, 0 failed, 16 skipped; 50-lang 44/44.
- Scenarios on items 7, 6 and 2 together (`node cluster.mjs`): 11-killer-secrecy 14/14; 30-security 273/274 with 1 expected red (foundry-secret-door-type); 33-bridge-paths 74/74; 41-trial-scene 51/51; 61-gmstore-case 113/113; 65-season 57/59 with 2 expected red (Foundry limits); 66-rooms 76/76; 72-canary 132/136 with 4 expected red; 87-messenger-sound 35/35; 0 failed in each. 84-viewports edited, not run (local gate only).

- The table notes (12.11.2026, on the tree of the two commits for them): `npm run quick` lint 0 problems, check 17 parts
  green, gate self-test 37/37; tiers 0-1 1263 passed, 0 failed, 16 skipped, 0 red (1278 ran, 417 s); tier 2 by name
  (R4060, E101-T4, E101-T5, R1524, R3580, R3581, E49-A1e, E51-T17, the two trace hand-overs from the hub, every test
  named Give or Truth Bullet): 0 failed; scenarios 00-boot 33/33, 41-trial-scene 51/51, 50-lang 44/44,
  61-gmstore-case 113/113, 65-season 57/59 (2 expected red), 88-flow-length 26/26, 71-sheet 41/41, 0 failed in each.

- Table notes 5-9 (12.11.2026): `npm run quick` green (lint 0, check 17 parts, gate 37/37); tiers 0-1 1267 passed,
  0 failed, 16 skipped, 0 red (before a test-only change: three served-file reads moved to the kit's `lfText`, the four
  new tests run again after, green); scenarios 00-boot 33/33, 50-lang 44/44, 75-voice-tile 41/41, 63-class-trial 75/75,
  41-trial-scene 51/51, 88-flow-length 26/26, 0 failed in each.

## The table notes' review page

https://claude.ai/artifact/Co7mFGUoBsRaEAJaVkw1GK (private, the owner's): notes 1 and 2 before (251b0136) and after, notes 5, 6, 8 and 9 before (2e10420d) and after,
PL first then EN, both themes, 1366x768; notes 3 and 4 in words (nothing to see in a still). Harness captures in the
style harness, not Foundry; the GM panel's shots carry `.application button { display: flex }` planted on both sides.

## Follow-ups after the texts line lands (left out to avoid a conflict)

The texts line (claude/texts-e71) rewrites these same lines; each is one edit after its merge:

- lang/en.json and pl.json `DRPG.Settings.musicEnabled.hint`: drop "Map the playlists first: GM panel, Sound, Music." (the switch is on that tab now).
- GM handbook EN/PL line 79 (Module settings worth knowing): take *Music follows the game state* and *Vary the sounds you hear often* out of the game settings' list and say they are the Sound window's.
- GM handbook EN/PL the Sound window's Music line (EN 1073): "Requires the *Music follows the game state* switch at the top of this tab".
- GM handbook EN/PL step 4 of the quick start (line 46), the Sound files row (121), the First session paragraph (133), and the Pre-season checks list (140-148): rewrite for the one window (drafted and reverted before commit because of the conflict; this line redoes it after the merge).
- GM handbook EN/PL line 1336 (the pre-session list): "read its further checks and its rooms row".
- GM handbook EN/PL line 621 (Item tables; e64 edits it): Rename table stands on the Room pools tab only, and the Tier pools tab has no New Tier pool field.

## Follow-ups of items 3-5 after the texts line lands (claude/e101b)

The texts line rewrites these keys, so items 3-5 left their words as they were: each still names Room setup's Scenes tab,
the Doors tab for This is a room, or Apply where the scenes part's button is now Season setup's Save. One sweep after
texts-e71 merges, EN and PL: `DRPG.TrialScene.noZones`, `startTrialNoHall`, `hallDark`, `noWayBack`, `sameScene`,
`hallInTrial`, `hallFirstInTrial` (the last three are Save's held reason: "Apply waits"); `DRPG.Season.hint.roomsMarked`,
`hint.scenes`, `hint.hallTokens`; the room checks' `detail` and `unmarked` and `flagUnjudged` (Doors tab); PL
`reportNote` (karta Drzwi); and the GM handbook's Room setup and Season setup sections. The new words items 3-5 needed
are new keys (`DRPG.Vault.applyLine` ... `DRPG.TrialScene.prepareOnSave`); the old keys they replace stay until that
sweep. Not this line's: e93's Polish tab name "Facilities" (`DRPG.Vault.tabFacilities`) is still the English word.

## Keys left in the lang files

Not read by the code after item 2, kept so the texts line's edits of them merge: `DRPG.Season.note`, `DRPG.Season.step.sound`, `hint.sound`, `step.hallTokens`, `hint.hallTokens`, `DRPG.Panel.seasonChecks`, `DRPG.Panel.checksSetup`, `DRPG.Fog.checksScenes`, `DRPG.Monokuma.isMonokuma`. One sweep removes them once the lines are merged.

## The r112 review's fixes (REVIEW-112, e93 line bfed7ead; 13.11.2026)

The coordinator's list from the e93 line's read of r112 at d2aa9940, fixed on claude/r112 after the 1.2.109 merge, red
first where a test can say it. One commit each, or a few lows together.

| Finding | Commit | Red first | What changed |
| --- | --- | --- | --- |
| S1 (high) | 36c50449 | E101-T10 (tier 2): the old hall active and given the way back | Season setup writes the scenes before `applyCampaignForm`, so a Save that enters the trial enters the hall it links |
| S2 | 36c50449 | E101-T11 (tier 2): the typed campaign name lost | a clash or a hall lock drops the scenes part alone, warns, and writes the rest |
| P1 | 2895e28e | R4106's wounded case | Wounded's sentence: both numbers from `actionBudget` |
| G1, G2, G3 | f0e5cf87 | R4105 (infiltrate: no key) | Infiltrate's rows say Roll (Dash, Shut, Keep Watch) or Next (Listen, Tail, Force, Pick); R4105 names Tail, Force, Pick and counts `chooseVariant`'s callers; R4105's title and E100's STATUS say Grant |
| S3, S4, S8 (part) | 318935b9 | - (texts) | five texts name Season setup (four in new keys: texts-e71 rewrites the old ones); roomsVision's light the right way round (read in fog.mjs first); api.mjs comment |
| P2, P4 | 59e1997a | R4472 | `moveDragSaid`: no "drag" in a trial or an incident; a locked Move tile without the line, focusable, labelled; the Monocub's Free line follows its Free Move |
| S5 | 9f36f34d | R1514's Season setup stand-in | the checklist's exclusion names its own class |
| S6 | 4ce28ad0 | R4473 | Despair Flow keeps the pool of a row it drew no select for |
| S7 | 77eb1074 | R4470's neighbours reading | the neighbours' rules in a `<details>` |
| P3 | f4feb42c | - (tests) | R4109, R4110, R4112 must read a rule first; R4110 compares the chosen tab's drawn brush with an unchosen one's |
| G4, P5, handbook | d6bbb2a8 | - (docs) | E100's button rule named as O11's exception; the stale `briefing()` comment; the GM handbook's further checks, No privacy on Rooms, the zones in Season setup |

Decided by default, as the coordinator set it: Tail keeps Roll. After the press a GM picks the statistic
(trait-ruling.mjs `traitFor`) and the two rolls then follow on their own, so the press does more than send a request.

Left for after texts-e71 (it rewrites the lines beside them): the GM handbook's section 1 step 4 (line 46), the
checklist table's rows and the end checklist's Season setup line (1362: merge-tree against texts-e71 686d12f5 conflicted on it); `DRPG.Season.step.hallTokens` and `hint.hallTokens` (read by no code; texts-e71 edits them);
the old keys `Floor.startTrialNoHall`, `TrialScene.hallDark`, `noWayBack` and `Season.hint.scenes`, read by no code
since 318935b9. R3580's title (the reviewer's S8) now says what its body holds: the footer Save and Cancel, Reset the
season in its frame in the body since E101.
