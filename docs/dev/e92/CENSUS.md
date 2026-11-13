# E92 C0 - the census: where a Spectator would be counted as a student

Written 12.11.2026 on claude/e92 (base 59d1935, E61 + E62 + E94). The plan's risk R1: a list that reads
`type === "character"` itself keeps counting the Spectator. This file classifies every such read, and the roster calls,
so each one is decided once. R3858 (tier 1) counts the `type === "character"` reads per file and fails on a new one
until it is classified here and counted there.

The Spectator is a `character` actor carrying the module flag `spectator` (config.mjs `FLAGS.spectator`), owned by its
account (the plan's Q-E92-3, default taken). Every list below answers one of three:

- **roster** - reads monokuma.mjs `studentActors` (or a list built on it); the flag leaves it there once (C1).
- **character here** - a Spectator is rightly a character: its owner's own actor, its sheet, its reserves, the audit's
  marks, a matching of users to actors. Nothing to change.
- **leave it out** - a student list or a gate that must not take a Spectator; the commit that does it is named.

## 1. `studentActors(` - 52 calls in 22 files: roster

gm-items 6, chapter 6, monokuma 5, vote 4, verdict 4, season-wipe 4, season-setup 4, trial-floor-ui 2, investigation 2,
gm-panel 2, call-pickers 2, voice 1, sequence 1, room-setup 1, migrate 1, mastermind 1, gm-students 1, frisk 1, fog 1,
diagnostics 1, bridge-guards 1, assignments 1. Every one is a student list (ballots, verdicts, Level Ups, the season's
cast, the trial's floor, the investigation's suspects, the Calls' targets, the day board's cast, the rooms per student,
the Despair pools) and leaves the Spectator by C1's change to `studentActors` and `studentCensus`. R3850 reads the main
ones.

## 2. `type === "character"` - 73 lines in 35 files at the base (74 after C1, 75 in 36 after C4; 77 in 38 in the 1.2.109 line after 1.2.108 was merged in, with dh-settings.mjs and trial-zones-ui.mjs; still 77 in 38 in 1.2.110 after E72, one more in gm-stores.mjs and one fewer in monocub.mjs)

| File:line (at 59d1935) | What it is | Class |
| --- | --- | --- |
| anonymity.mjs:468 `myCharacter` | this account's own character | character here |
| camera-view.mjs:235, 239 | a GM's Monokuma; a player's own character for the camera | character here |
| cleanup.mjs:3049 | a refund log line | character here |
| config.mjs:231 | a comment | - |
| dh-settings.mjs `isCharacterSettings` (from the release line, merged 12.11) | Daggerheart's character settings window over a character | character here |
| diagnostics.mjs:1772 | a timing probe on the first character | character here |
| events.mjs:150 | the opening card's own characters (the cast decides) | character here |
| fog.mjs:1827 `isMine` | which tokens are "mine" for the fog (the rooms I stand in) | leave it out (C4): a Spectator stands in no room it discovers |
| fog.mjs:2446, 2462 | `diagnoseFog`'s report | character here |
| fog.mjs:3312 | the layer's owned tokens | leave it out (C4, by `isMine`'s rule) |
| fog.mjs:4359 | whether this GM holds a Monokuma | character here |
| gm-stores.mjs:1334 | the trial cast store's `exists` | character here |
| gm-stores.mjs `fogSectionFor` (from E72 C10, merged 12.11 into 1.2.110) | the Monocubs a player owns, sent the rooms the class found | character here: a Spectator is never a Monocub (it never dies, C1) |
| gm-stores.mjs:2405 `enterCastByHand` | the GM's killer/victim pick | leave it out (C1) |
| gm-students.mjs:437 | the Students window's other characters | character here: the Spectators' group (C1) |
| gm-team-dialog.mjs:269 | assigning characters to accounts | character here: the GM gives the account its Spectator |
| hud.mjs:1384 | the GM's Monokuma | character here |
| monocub.mjs:99, 105, 742 | the Monocubs; the dead who may become one; the dead's roster (742 went with the old Monocubs window, E72 C6, merged 12.11 into 1.2.110) | character here: a Spectator never dies (no State on its row, C1) |
| monokuma.mjs:12 | a comment | - |
| monokuma.mjs:37, 81 | the Monokumas; every character's id (the audit's waits) | character here |
| monokuma.mjs:125, 131 `ownStudent`, `ownedStudents` | the account's student | leave it out (C1): a Spectator account has no student view |
| monokuma.mjs:150, 164 | `viewerOf` / several | leave it out (C1) |
| monokuma.mjs:220 `classCandidates` | Pre-season's NPC candidates | leave it out (C1) |
| monokuma.mjs `ownSpectator` (new in C1) | the account's own Spectator | character here |
| movement.mjs:1094 | a GM told a token was dropped | character here |
| movement.mjs:2495 | rotation locked on a character's token | character here |
| palm.mjs:287 | Palm's targets, after `othersInRoom` | roster-like: `othersInRoom` leaves it out (C1, `countsAsPresent`) |
| passages-gm.mjs:180, 1279, 3141 | the passage copy of an account; a cell's student; a copy retold | character here: a Spectator finds no passage (it acts not) |
| passages.mjs:196 `studentIdsOf` | the passages' students | leave it out (C1) |
| patches.mjs:493 | open character sheets | character here |
| player-status.mjs:110 | which change redraws the GM's strip | character here (the strip draws none for it: `sheetMode`, C5) |
| private-rolls.mjs:1358 | a message's living author's character | character here |
| projects-ui.mjs:1458 | a viewer's character for the killer's id | character here |
| projects.mjs:781 | the shared viewers' characters | character here |
| relay-guard.mjs:602, 606 | the relay's owner check | character here |
| reroll.mjs:2019 | a copied Remnant | character here |
| roll-dialog.mjs:510 | a student's roll window | character here (a Spectator throws nothing: no grid, C5) |
| roll-draw.mjs:265 | a sheet roll's actor | character here |
| settings.mjs:3221, 4249, 4264 | own characters; sheet hooks | character here |
| sfx.mjs:299 | whether this account is in the incident | character here |
| sheet-audit.mjs:783, 803, 927, 1215, 3226, 3320 | the audit's marks | character here: its flag is held there (C1, `GM_FLAGS`) |
| sheet.mjs:783, 805, 2871, 2959 | sheet renders | character here (the mode is `sheetMode`'s, C5) |
| spectator-dead.mjs `ownStudentOf` (E62 C3b fix, 13.11.2026) | the player's own student a moment names, on that player's browser | leave it out: a Spectator's flag is read beside it |
| spectator.mjs `watcherOf` (new in C4) | the account's own Spectator, for its map | character here |
| states.mjs:498 | a token's reserves | character here |
| trial-scene.mjs:195 `castActors` | the trial's cast | leave it out (C1) |
| trial-scene.mjs:200, 755, 966 | a hall token; the audit's waits | character here |
| trial-zones-ui.mjs `namesIn` (from 1.2.108, E73 C4) | the names a Logic Dive question is warned of | character here: a warning only, which a Spectator's name raises as a student's does; the question is not refused |
| user-match.mjs:223, 299, 300 | matching users to characters | character here |
| visibility.mjs:432, 1002 | own Truth Bullets; a diagnostic | character here |
| voice.mjs:492, 863, 1192, 1953 | who follows the voice rooms; the account's voice character | character here: the Spectator is placed by its token (C2) |

## 3. `type !== "character"` - 92 lines

These are early returns: a non-character goes, a character goes on, so a Spectator goes on as a student would. The ones
that decide something for it:

| Where | Class |
| --- | --- |
| movement.mjs `countsAsPresent` | leave it out (C1): nobody in the room |
| movement.mjs `onPreUpdateToken`, `judgeMove`, `crossingVerdict`, `judgeArrival` | leave it out (C3): a ghost, as a Monokuma |
| movement-audit.mjs `auditMove` | leave it out (C3): exempt, as a Monokuma |
| murder-rules.mjs `maybeThirdParty` | leave it out (C1) |
| fog.mjs `recordDiscovery` (a `!actor` gate) and the rooms "mine" | leave it out (C3, C4) |
| visibility.mjs `applyToToken`, `tokenShownTo`, `myRooms` | C4 |
| action-rolls.mjs `performAction` | the sheet draws no grid (C5); the GMs' guards are not changed for a Spectator (limit, below) |

The rest are a character's own sheet, items, reserves and audit, and stay as they are.

## 4. Limits

- The census is read off the source at 59d1935; a read spelt another way (`actor.type == "character"`, a Daggerheart
  helper) is not in it.
- A Spectator's own console can still ask the bridge for a student's action on its own character: the GMs' guards
  (`owns`) pass an owner, and no guard says "not a Spectator". The plan names the display (sheet and HUD in spectator
  mode) and not a guard; written as an open question in STATUS.md (Q-E92-7).
