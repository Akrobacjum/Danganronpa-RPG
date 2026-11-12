# E101 - the GM screens' cleanup: status

The owner said yes on 12.11.2026 to the GM screens' review (artifact T8eePyz1, shot on main 1.2.108 in the harness,
not Foundry). Seven numbered items, plus the smaller structural proposals beside each window that no other line holds.
Base: origin/main 4dfac3a (1.2.108). Branch: `claude/e101`.

R numbers: E101 takes R4050-R4099 (the open lines hold R3750s, R3800s and R3900-R3966); used so far R4050-R4057.
Registry Since: E101.

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
| 3 (#4) Room setup: one line about Apply, Search's "arrows" | not started | - | - |
| 4 (#5) Room setup: Rooms tab, Doors' headers | not started | - | - |
| 5 (#6) Room setup > Scenes into Season setup | not started | - | - |
| 1 (#2) Edit campaign into Season setup | waits for 1.2.109 on main and merged here | - | - |

Items 3-5 wait for e93 on main and merged here (the coordinator, 12.11):  e93 rewrites the same lines of room-setup.mjs (the Doors tab's columns, ROOM_SETUP_TABS, the Rest tab) and the texts line (claude/texts-e71) rewrites the room tabs' texts (searchIntro, scenesIntro, notSharedNote, fogIntro, stashesNote, setupIntro ...). Any version of items 3-5 conflicts with both at merge.

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

## Follow-ups after the texts line lands (left out to avoid a conflict)

The texts line (claude/texts-e71) rewrites these same lines; each is one edit after its merge:

- lang/en.json and pl.json `DRPG.Settings.musicEnabled.hint`: drop "Map the playlists first: GM panel, Sound, Music." (the switch is on that tab now).
- GM handbook EN/PL line 79 (Module settings worth knowing): take *Music follows the game state* and *Vary the sounds you hear often* out of the game settings' list and say they are the Sound window's.
- GM handbook EN/PL the Sound window's Music line (EN 1073): "Requires the *Music follows the game state* switch at the top of this tab".
- GM handbook EN/PL step 4 of the quick start (line 46), the Sound files row (121), the First session paragraph (133), and the Pre-season checks list (140-148): rewrite for the one window (drafted and reverted before commit because of the conflict; this line redoes it after the merge).
- GM handbook EN/PL line 1336 (the pre-session list): "read its further checks and its rooms row".
- GM handbook EN/PL line 621 (Item tables; e64 edits it): Rename table stands on the Room pools tab only, and the Tier pools tab has no New Tier pool field.

## Keys left in the lang files

Not read by the code after item 2, kept so the texts line's edits of them merge: `DRPG.Season.note`, `DRPG.Season.step.sound`, `hint.sound`, `step.hallTokens`, `hint.hallTokens`, `DRPG.Panel.seasonChecks`, `DRPG.Panel.checksSetup`, `DRPG.Fog.checksScenes`, `DRPG.Monokuma.isMonokuma`. One sweep removes them once the lines are merged.
