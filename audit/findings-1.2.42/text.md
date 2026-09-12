# TEXT - findings

Domain: every user-facing string. Module danganronpa-rpg v1.2.42. No repository file was edited.

## Files read (with line counts)

| File | Lines | How |
|---|---|---|
| lang/en.json | 2859 | in full, 7 chunks |
| scripts/config.mjs | 4025 | in full (every label / short / hint / description / effect / failure / note / blurb) |
| scripts/gm-panel.mjs | 1200 | in full |
| scripts/season-setup.mjs | 917 | in full |
| scripts/investigation.mjs | 1425 | in full |
| scripts/diagnostics.mjs | 1235 | in full |
| scripts/sheet.mjs | 3935 | in full |
| Cross-checked use sites (grep -n / sed -n) | - | events.mjs, cleanup.mjs, action-rolls.mjs, murder.mjs, eclipse.mjs, handover.mjs, vote.mjs, remnants.mjs, day-summary.mjs, hud.mjs, look.mjs, states.mjs, migrate.mjs, safeword.mjs, tests.mjs (R1 key crawl) |

Scripts written for the audit (in scratchpad, not the repo): `deadkeys.mjs` (dead-key crawl), `testsonly.mjs`, `lengths.mjs` (string length by surface).

## Strengths

- The copy is unusually good. Almost every string says what the control does *and* why, in one register, and the notes at the top of config.mjs make the wording a first-class deliverable ("finished copy, not a working title").
- Numbers are mostly injected, not typed: `callEffect()` (config.mjs:2115) fills `{cost}`, `{hp}`, `{progress}` from the rule itself, so 13 of 14 Call sentences cannot drift. `Cleanup.intro`, `Character.initTooltip`, `Investigation.keyLimitLine`, `Overflow.*` all take their numbers from config.
- GM-only strings are consistently labelled as such in the key name (`observeGm`, `analyzeGm`, `gmLine`, `stashFoundGm`, `bodyMetaGm`, `reallyTooltip` "GM only") and every one I traced is rendered behind `game.user.isGM` or `whisperToGms`.
- The self-test `R1` (tests.mjs:410-450) crawls every literal key and fails on a missing one, and `plural()` families are handled. Only 8 keys in the whole file are dead (see item 7).
- Player-facing feedback deliberately withholds visibility bands (day-summary.mjs:80-86, `Summary.left`), and `Trial.presentIntro` promises "Never the GM's notes" - and `bulletBadges` (sheet.mjs:2626) honours it.
- Tooltips on tiles are kept to one line by design (sheet.mjs:3751-3765) and the measurement holds: only one tooltip in the module is over 120 characters.

## Findings

### TEXT-01 [severity: major] [category: text] [CONFIRMED]
**Where:** lang/en.json:2395 (`DRPG.Tamper.frameHint`), config.mjs:3394-3395, cleanup.mjs:1427, action-rolls.mjs:2627
**What happens:** The Tamper menu tells the player the frame-up "Needs 18 or more". The rule was lowered to 15 (D7) and the roll is scored against `def.threshold` = 15.
**Evidence:**
```
en.json:2395   "frameHint": "Leave something that points at somebody else. Needs 18 or more, and it plants a trace either way.",
config.mjs:3394  label: "Misleading trail", ... threshold: 15,
cleanup.mjs:1427 const threshold = Math.max(0, (def.threshold ?? 0) - relief);
```
The stale comment on ACTIONS.tamper (config.mjs:1302-1303, "reads a flat 18 off CLEANUP.actions.misleadingTrail") says the same wrong number.
**Fix:** Make it a `format` key: "Needs {n} or more" filled from `CLEANUP.actions.misleadingTrail.threshold` at action-rolls.mjs:2627; fix the comment at config.mjs:1302.
**Pitfalls:** Players are told the DC of only this one Tamper branch; decide whether to keep showing it at all (see TEXT-14).

### TEXT-02 [severity: major] [category: text] [CONFIRMED]
**Where:** lang/en.json:1824 (`DRPG.Calls.newRuleNote`), config.mjs:2076, call-effects.mjs:881
**What happens:** The New Rule dialog says "Twelve Despair buys a permanent change to the game." The Call costs 9 (D10f).
**Evidence:**
```
en.json:1824  "newRuleNote": "Twelve Despair buys a permanent change to the game. Make it count.",
config.mjs:2076  label: "New Rule", icon: "fa-gavel", cost: 9, target: "none", announces: true,
```
**Fix:** "{cost} Despair buys…" with `cost: DESPAIR_CALLS.newRule.cost` at call-effects.mjs:881, or drop the number.
**Pitfalls:** None.

### TEXT-03 [severity: major] [category: leak] [CONFIRMED]
**Where:** lang/en.json:849-850 (`DRPG.Events.openingTitle` / `openingMeta`), events.mjs:83-102
**What happens:** During Stage 4 of a *direct* murder the victim's own HUD shows the event card "A murder is under way / <victim name> · <room> / The opening roll decides how it begins". config.mjs:2477-2479 states the rule: "The victim never rolls, is never asked, and on a failure is never told anything happened." The card admits any owner of a seated actor, victim included, with no `indirect` check.
**Evidence:**
```
events.mjs:91  const seats = [state.killerId, state.victimId, state.thirdId].filter(Boolean);
events.mjs:92  if (!game.user.isGM && !seats.some(id => ids.has(id))) return null;
events.mjs:96  const who = game.user.isGM && killer && victim ? `${killer.name} → ${victim.name}` : (victim?.name ?? "");
events.mjs:100 title: game.i18n.localize("DRPG.Events.openingTitle"),
```
**Fix:** In `openingCard()` return `null` for a non-GM whose only seat is the victim's while `!state.indirect` (the indirect victim is the one rolling and may see it). Keep the killer's copy.
**Pitfalls:** hud.mjs `buildIncident` may have a sibling gate - check it applies the same rule so the two surfaces agree.

### TEXT-04 [severity: major] [category: text] [CONFIRMED]
**Where:** lang/en.json:2731 (`DRPG.Explain.phase.eclipse`), config.mjs:293-311, explain.mjs:79
**What happens:** The player-facing "Where things stand" window says an Eclipse lets "Everyone move once, anywhere on the map". Only the Night Eclipse is free placement; the other four give two connected-room crossings (`ECLIPSE_MOVES = 2`, `ECLIPSE_FREE_PLACEMENT = ["night"]`), and `Eclipse.announce` / `Hud.startEclipseNamed` say so.
**Evidence:**
```
en.json:2731 "eclipse": "The lights are out. Everyone moves once, anywhere on the map, and nobody can see who went where. …"
config.mjs:311 export const ECLIPSE_FREE_PLACEMENT = ["night"];
```
**Fix:** "Everyone places their token - up to two connected rooms, or anywhere at night - and nobody can see who went where."
**Pitfalls:** `Overflow.what.darkness` reduces the allowance; keep the sentence number-free or feed it from `eclipseAllowance`.

### TEXT-05 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:1301 (`DRPG.Investigation.createNote`), investigation.mjs:341-394, 1195
**What happens:** "Apply places that Key Remnant there: … at the centre of the region." The dashboard's button is **Save** (`DRPG.Assign.save`, investigation.mjs:1195) and the clue is dropped at a random point (`randomPointIn`, "Not the centre").
**Fix:** "Save places that Key Remnant there: reinforced, tied to the crime, somewhere inside the room."
**Pitfalls:** `Mastermind.finalAddNote` (en.json:791) already says "somewhere inside the room" - use the same words.

### TEXT-06 [severity: minor] [category: text] [CONFIRMED]
**Where:** config.mjs:3854 (`SFX_EVENTS.cleanupFailed.hint`) vs config.mjs:3209-3214
**What happens:** The Sound panel row says a Despair failure "adds an Obvious trace to the one they were trying to remove". Since D8 both failures leave a *Faint Tamper Remnant* - Subtle on Hope, Evident on Despair - and nothing is Obvious.
**Evidence:**
```
config.mjs:3854 hint: "Heard by the killer. The Sanity is spent either way, and a failure with Despair adds an Obvious trace to the one they were trying to remove.",
config.mjs:3213 failureHope: { removes: false, leaves: { visibility: "subtle", faint: true } },
config.mjs:3214 failureDespair: { removes: false, leaves: { visibility: "evident", faint: true } }
```
**Fix:** "…and a failure leaves a Tamper Remnant of its own beside the one they were scrubbing."

### TEXT-07 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:1175 (`DRPG.Murder.killerChooses`) vs en.json:1255-1257 and murder.mjs:1936-1940
**What happens:** The summary line offers three options - "2 Health, 2 Sanity, or 1 of each" - but the killer's dialog (`criticalChoiceIntro`, "Take both marks off the same place") offers only two, and the code applies `{[choice]: 2}`. The "1 of each" branch does not exist.
**Fix:** "Critical - the killer chooses: both marks off Health, or both off Sanity."

### TEXT-08 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:932 (`DRPG.Vote.tied`) vs 972 (`DRPG.Vote.tiedVerdictNote`), vote.mjs:566
**What happens:** The public result card states as a rule "A tie. That is a loss for the students." while the GM's verdict note says "unless something else settled it at the table, this counts as getting it wrong." The table is told one thing, the GM another.
**Fix:** Public: "A tie. Unless the table settles it, that counts as a wrong vote." Or drop the second clause from the GM note.

### TEXT-09 [severity: minor] [category: leak] [SUSPECTED]
**Where:** lang/en.json:1548 (`DRPG.Handover.alreadyHasIt`), handover.mjs:132 and 240
**What happens:** When a player shares a Truth Bullet, the *giver* is whispered "{who} already found that trace themselves." - a fact about another player's evidence the giver had no way to know. The same key is reused for a duplicate room key (handover.mjs:132), where "found that trace" is simply wrong wording.
**Fix:** Two keys: for bullets, a neutral "Nothing changed hands." or let the copy go through as a harmless duplicate; for keys, "{who} already has a key to that room."
**Pitfalls:** Refusing silently reads as a bug (the comment at handover.mjs:124 says so) - the neutral wording keeps the notice, drops the disclosure.

### TEXT-10 [severity: minor] [category: text] [CONFIRMED]
**Where:** gm-panel.mjs:1024-1025
**What happens:** Two inline English strings in the panel's roster column bypass i18n.
**Evidence:**
```
gm-panel.mjs:1025  hasFreeMove(a) ? "free Move available" : "free Move used"}"></i>`;
```
**Fix:** Reuse `DRPG.Actions.freeMoveAvailable` / `freeMoveSpent` (en.json:381-382), which also fixes the capitalisation (the column header is `Panel.freeMove` "Free Move").

### TEXT-11 [severity: minor] [category: text] [CONFIRMED]
**Where:** diagnostics.mjs:1211, 1150
**What happens:** The season-setup report says "Fix it in GM Team." - the tile is called "Despair Flow" (`Panel.despairFlow`, en.json:2257) and the window "Whose Despair feeds which Monokuma". Line 1150 calls the state "Broken Down"; everywhere else it is "Breakdown" (`States.drpgBreakdown.name`, `Character.initNote`).
**Fix:** "Fix it in GM panel, Despair Flow." / "Wounded and in Breakdown".

### TEXT-12 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:1283 (`DRPG.Investigation.difficulty`), investigation.mjs:534, 977, 1114, 1168
**What happens:** One label, "Difficulty", heads two different things: the clue scale (Trivial / Standard / Complex / Desperate, column at :1114) and the visibility select (Obvious / Evident / Subtle / Hidden, at :534 and :1168). The Truth Bullet card calls the second "How hard the original was to spot" (`TruthBullet.visibility`).
**Fix:** Use `DRPG.TruthBullet.visibility` (or a short "Visibility") for the selects; keep "Difficulty" for the scale.

### TEXT-13 [severity: nit] [category: text] [CONFIRMED]
**Where:** lang/en.json:1299 (`DRPG.Investigation.pickRoom` = "- create in -"), investigation.mjs:532, 1163
**What happens:** A placeholder option string is used as a form *label* ("- create in -  [select]") in the Create-here dialog and the Final tab.
**Fix:** A label key: "Room".

### TEXT-14 [severity: minor] [category: leak] [CONFIRMED - design question]
**Where:** en.json:612 (`Analyze.findStashHint` "{n}+ opens one hiding place"), en.json:2395 (`Tamper.frameHint` "Needs 18"), en.json:1216/1252 (`Murder.thresholdShort` / `briefThreshold` "Beat {n}"), en.json:527/534 (`Action.dynamicHint` / `dynamicDescription` "gentler thresholds")
**What happens:** These are the only places a DC reaches a player's screen. Crisis thresholds are printed on every crisis tile (action-rolls.mjs:2774, murder.mjs:906) - config.mjs:2604-2607 says the outcome prose is "shown to the GM", but the threshold line is player-facing. Search, Observe, Analyze, Listen and Project never show theirs. Either the module shows DCs to players or it does not; today it does for the murder engine and two Analyze/Tamper branches only.
**Fix:** Decide once. If DCs stay hidden, drop `{n}+` from `findStashHint`, the number from `frameHint`, and `briefThreshold`; if they are shown, say so in the Search/Observe briefings too.
**Pitfalls:** The crisis grid was designed around visible thresholds ("Beat 15") - removing them changes the feel of Stage 5; this is a rules-owner decision.

### TEXT-15 [severity: nit] [category: text] [CONFIRMED]
**Where:** lang/en.json:1493 (`DRPG.Chapter.tidyNote`), chapter.mjs:833
**What happens:** A changelog sentence in the end-of-chapter dialog: "These three were only ever reachable from the Investigation window, which is a screen a GM opens in the middle of a case rather than at the end of one." It explains why the checkboxes moved, not what they do. Same family: `Vote.blackenedRuleIntro` (:955) cites "the guide", `Season.note` (:2636) "Nothing here is done for you that you would not have done yourself."
**Fix:** Delete `tidyNote`; "the guide gives them" -> "they get"; `Season.note` -> "Every row is something a season needs, in the order a season is built."

### TEXT-16 [severity: nit] [category: text] [CONFIRMED]
**Where:** lang/en.json:2244-2249 (`DRPG.Panel.section.fixes` = "Repairs"), gm-panel.mjs:217-239
**What happens:** The "Repairs" section contains exactly one tile, "Debug log". Nothing in it repairs anything.
**Fix:** Rename the section "Diagnostics" (or fold the tile into "Between sessions").

### TEXT-17 [severity: nit] [category: text] [CONFIRMED]
**Where:** lang/en.json:2293-2294 (`Panel.checksSetup` "Season setup", `Panel.seasonChecks` "Pre-season checks"), season-setup.mjs:511-513
**What happens:** The checks window is titled "Pre-season checks" and its first heading is "Season setup" - the name of the window the GM just came from (tile `Season.title` "Set the season up"). Three near-identical names for two windows.
**Fix:** Heading "Cast" or "Characters" for the `diagnoseCharacters` report.

### TEXT-18 [severity: nit] [category: hygiene] [CONFIRMED]
**Where:** investigation.mjs:4-7 (header comment: "3-8 graczy") vs config.mjs:981 (`suspectRange: [2, 4]`) and `Investigation.plannerIntro` ("{min}-{max}").
**What happens:** The file's opening comment quotes the old rule. The UI is right.
**Fix:** Update the comment.

### TEXT-19 [severity: nit] [category: text] [CONFIRMED]
**Where:** lang/en.json:2564 (`DRPG.Safeword.word` = "MISIUBOMBO"), migrate.mjs:407, safeword.mjs:50
**What happens:** The key is live only as a migration source (migrate.mjs:407 reads it to carry a pre-E15 world's word forward). It is no longer a display string, but sits in the middle of the display strings and a translator will translate it, which would break the migration comparison at migrate.mjs:408 for that language.
**Fix:** Add a `_comment` sibling or move it under a `Legacy` namespace; tell translators not to touch it.

## 1. Strings too long for where they are shown

Method: `lengths.mjs` maps every `dataset.tooltip = …("KEY")`, `data-tooltip="${…("KEY")`, `tooltip: "KEY"`, `ui.notifications.*(…("KEY")` and `label: game.i18n.localize("KEY")` in scripts/ to the en.json value (`.other` for plural families). 30 tooltip keys, 254 notification keys, 151 button labels, 4 HUD text keys measured. Config `hint` strings drawn as tile tooltips were measured separately.

| Surface | Key | Chars | Where shown | Proposed |
|---|---|---|---|---|
| Tooltip (>120) | `DRPG.Hud.bodyFoundTooltip` (en.json:445) | 147 | hud.mjs:1441, the HUD "Body found" chip | "A body has been found and nobody is searching yet. The clock waits for the GM." |
| Tile tooltip | `CRISIS_ACTIONS.finishingBlow.hint` (config.mjs:3891) | 212 | crisis tile hover (action-rolls.mjs `openCrisisMenu`) | "End the incident now. Threshold is five times their remaining Health - free at 0. A critical here also buys a free Stage 6 action." |
| Tile tooltip | `CRISIS_ACTIONS.useItem.hint` (config.mjs:3638) | 156 | Use button during an incident | "Get something out while this is happening. Works on a critical or a Hope success; a Despair success only leaves a trace." |
| Tile tooltip | `HOPE_CALLS.freeCrit.effect` (config.mjs:1734) | 150 | Loaded Die tile hover, chat card | "One die is set to 12, the other is thrown. A critical only if that one is a 12 too." |
| Tile tooltip | `HOPE_CALLS.relief.effect` (config.mjs:1712) | 113 (borderline) | Relief tile | "A Short Rest now - no action, no marked room, and it does not use up this time of day's." (already tight; keep) |
| Notification (>140) | `DRPG.Music.noSituational` (en.json:1006) | 176 | music.mjs:1064 toast | Shorten the toast to "No playlist called “{name}”. Create it below." and leave the explanation in the panel text. |
| Notification | `DRPG.Eclipse.actionsLocked` (en.json:1929) | 153 | action-rolls.mjs:138 warn (also tile tooltip) | "Placement only. Actions are already back; nothing spends them but a Direct Murder until the lights come up." |
| Notification | `DRPG.Clock.eclipseStillOn` (en.json:2209) | 152 | gm-panel.mjs:1188 warn | "The clock moved but the Eclipse is still running - end it from the HUD. Until then placement is free and murders are refused." |
| Notification | `DRPG.Anonymity.blocked` (en.json:2359) | 150 | anonymity.mjs:401 warn | "Blocked: every player would own “{actor}”, and an owner is never redacted. Give Owner to their one player only." |
| Button label (>24) | `DRPG.Assign.title` (en.json:401) | 34 | gm-team-dialog.mjs:299 dialog button | "Despair Flow" (it already is the tile's name) |
| Button label | `DRPG.Observe.pickConfirm` (en.json:1578) | 32 | observe.mjs:234 | "That one" |
| Button label | `DRPG.Eclipse.endAndAdvance` (en.json:1931) | 30 | gm-panel.mjs:877 | "End and move the clock" |
| Button label | `DRPG.Advance.kind.reinforced` (en.json) | 28 | level-up.mjs:64 | "Reinforced (pick 3)" |
| Button label | `DRPG.Trap.rearm` | 28 | traps.mjs:281 | "Keep watching" |
| Button label | `DRPG.Chapter.endTitle` | 28 | trial-floor-ui.mjs:475 | "End the chapter" |
| Button label | `DRPG.Analyze.askHint` (en.json:592) | 27 | action-rolls.mjs:3680 menu row | "Ask for a hint" |
| Button label | `DRPG.Monokuma.panelTitle` | 27 | gm-team-dialog.mjs:298 | "Monokumas" |
| Button label | `DRPG.Voice.stopEavesdrop` | 27 | voice.mjs:1263 | "Leave" |
| Button label | `DRPG.Chapter.stageSixNo` | 26 | chapter.mjs:250 | "Keep it running" |
| Button label | `DRPG.TruthBullet.autopsyTitle` | 26 | investigation.mjs:1265 footer button | "Autopsy" |
| Button label | `DRPG.Observe.anything` (en.json:1560) | 25 | action-rolls.mjs:3462 menu row | "Examine a point of interest" is the menu row label, fine as a row; as a button use "Point of interest" |
| HUD label (>14) | `DRPG.Hud.roomTokens` (en.json:457) | 47 | hud.mjs:1340 room strip text | "{left}/{max} searches" (the tooltip `roomTokensTooltip` keeps the sentence) |
| HUD label | `DRPG.Hud.roomNoProject` (en.json:456) | 20 | hud.mjs:1265 | "No project" / "Project here" |
| HUD label | `DRPG.Hud.elapsed` | 16 | hud.mjs:1520 | "{minutes} min" |
| Tile label (>14) | `DESPAIR_CALLS.behindClosedDoors.label` "Behind Closed Doors", `publicAnnouncement.label` "Public Announcement" (config.mjs:1886, 2039) | 19 | Despair Call tiles; `fitTileText` scales *every* grid down to fit the longest word, and these two are the longest labels | "Closed Doors", "Announcement" (the effect line already explains) |

Everything else is inside its budget. Sound-panel `hint`s over 120 chars (config.mjs:3676-3894, 12 rows) are table cells, not tooltips, and read fine there.

## 2. Wording that does not match what the control does

| Key (en.json line) | Says | Actually | Evidence |
|---|---|---|---|
| `Tamper.frameHint` (2395) | "Needs 18 or more" | threshold 15 | TEXT-01 |
| `Calls.newRuleNote` (1824) | "Twelve Despair" | cost 9 | TEXT-02 |
| `Explain.phase.eclipse` (2731) | "moves once, anywhere on the map" | 2 connected crossings; free only at night | TEXT-04 |
| `Investigation.createNote` (1301) | "Apply … at the centre of the region" | button is Save; random point inside region | TEXT-05 |
| `SFX_EVENTS.cleanupFailed.hint` (config 3854) | "adds an Obvious trace" | Faint Tamper Remnant, Subtle/Evident | TEXT-06 |
| `Murder.killerChooses` (1175) | "2 Health, 2 Sanity, or 1 of each" | two options only | TEXT-07 |
| `Vote.tied` (932) vs `tiedVerdictNote` (972) | tie is a loss / tie may be settled at the table | contradictory | TEXT-08 |
| `Handover.alreadyHasIt` (1548) on a room key | "already found that trace" | it is a key, not a trace | handover.mjs:132 |
| `Cleanup.gmAttemptsLeft` (1063) | "closing destroys the tools that were used" | only the Crime Tool goes at close; the Cleaning Tool goes at body discovery | config.mjs:3338-3341 `destroysTools: ["crimeTool"]`, `destroysToolsOnDiscovery: ["cleaningTool"]` |
| `Investigation.unfoundKeys` (1325) | "of the four Key Remnants" | `KEY_REMNANTS.unfoundBar` = 4 today, but the sentence hard-codes it while `prepared` is 5 - reads as "there were four" | config.mjs:998; pass `bar` |
| `Investigation.plannerIntro` (1281), `whichSlot`/`noSlot` (1322-1323) | "Five clues", "Not one of the five" | `KEY_REMNANTS.prepared` = 5, hard-coded | config.mjs:954 |
| `Hud.startEclipseNamed` (450), `Eclipse.noMovesLeft` (1927) | "(2 crossings)", "Both Eclipse crossings" | `ECLIPSE_MOVES` = 2, but `Overflow.what.darkness` lowers it to 1 during a darkening | config.mjs:1814-1817; movement.mjs:233 uses `allowance` - the sentence does not |
| `Panel.section.fixes` (2247) "Repairs" | repairs | contains only the debug log | TEXT-16 |
| `Panel.nextAllDone` (2233) "Move the clock on." + "Do it" | moves the clock | opens the *Edit campaign* form (`jump`) with nothing pre-advanced | gm-panel.mjs:992, 185 |
| `Investigation.difficulty` (1283) | one word | two different axes | TEXT-12 |
| `diagnostics.mjs:1211` "Fix it in GM Team." | a tile called GM Team | tile is "Despair Flow" | TEXT-11 |
| `Monocub.giveHope` (662) "Turn a Monokuma's Despair into Hope" / `Mastermind.dialogIntro` (735) "the same trade a Monocub gets" | Monocub trade is 1:1 | `DESPAIR_CALLS.fuelTheCub` is 1:1 - consistent; but `Monocub.needHope` (679) says "Ask a GM to convert some Despair" while the sheet route is the *Fuel a Monocub* Call - name the Call | config.mjs:1931 |
| `Action.murderConfirm` (511) "This opens a direct murder…The action is spent even if the conditions fail." | opens now | action-rolls.mjs:3932 is the *non-Eclipse* path; in an Eclipse the declaration is parked (`murderParked`) and nothing opens until the lights come up - the two dialogs describe two flows with no cross-reference | action-rolls.mjs:3932, eclipse.mjs:495-530 |

## 3. Terminology drift

| Concept | Variants (keys) | Recommend |
|---|---|---|
| **Remnant / trace / clue** | "Remnant" in 56 keys (`Remnant.*`, `TruthBullet.pickRemnant`, `Investigation.onMap`, `Cleanup.rerollLost`), "trace" in 78 (`Cleanup.which`, `Investigation.tabTraces`, `Remnant.tokenName` "Trace", `Summary.left`, `Action.leavesRemnant` = "Leaves a trace behind."), "clue" in 7 (`Investigation.clue`, `plannerIntro`, `neverOnePerson`, `whichSlot`, `Mastermind.finalAddNote`) | Player-facing = **trace** (what you leave/find), rules term = **Remnant** (typed: Key/Faint/Prep/Tamper/Final Truth Remnant), GM planning = **clue** is fine but confine it to the Key Remnant planner. Fix the mixed sentences: `Remnant.reinforced` "That Remnant is reinforced" (player toast) -> "That trace…"; `Observe.whichRemnant` "Which Remnant are they closest to?" beside `Observe.pickTitle` "Observe - which trace?" -> one word. |
| **Stash / hiding place / drawer / Vault** | key namespace `DRPG.Vault.*` (0 strings say "vault"); "stash" 33 keys; "hiding place" 5 (`Analyze.findStash*`, `Vault.noticed`, `Vault.stole`); "drawer" 2 (`Vault.stashesNote`, `Vault.noBullets`) | **stash**; "hidden stash" for a concealed one. Rename the *strings* only - the `Vault` namespace and `VAULT_LIMIT` are identifiers. |
| **Monokuma / GM / Gamemaster / GM team / Assistant GM / DM** | "GM" 132 keys; "Monokuma" 43 (the actor *and* the user with a pool: `Assign.monokuma`, `Despair.noCandidates` "Full Gamemasters have one already"); "Gamemaster" 3 (`Monokuma.panelIntro`, `panelNote`, `Despair.noCandidates`); "GM team" (gm-panel tile key `gmTeam`, diagnostics:1211); "GMs" plural throughout `Mastermind.confirmed`, `Trial.presentIntro` | **GM** for the human/role, **Monokuma** for the in-fiction actor and its Despair pool, never "Gamemaster" (Foundry's role name - keep only where the role is meant: `Despair.noCandidates`). |
| **Sanity / Stress** | "Sanity" in 39 keys and all DAGGERHEART overrides; "stress" survives only in key names (`goalStress`, `failStress`, `noStressForThis`, `stressSpent`, `stressBack`) and config comments; `USABLE_KINDS.stress.label` "Sanity Relief" vs `TIER_EFFECTS.usable` "(sanity relief)" lower-case | Consistent for players. Capitalise "Sanity Relief" in `TIER_EFFECTS.usable.1/2` (config.mjs:487-488) to match the table names. |
| **time of day / phase / period / state** | "time of day" 61 keys (Morning…Night); "phase" = Daily Life/Investigation/Class Trial in `Clock.phase`, `Floor.startTrialStepPhase`; BUT `Settings.hudTicker.hint` (296) "The name of the phase running" and `Summary.lede` "What you did during {phase}" use "phase" for the *time of day*; `Music.state.*`, `Musicintro` "state", `Look.ticker` "State name behind the clock" use "state" for the same ticker | **time of day** (Morning…), **phase** (Daily Life…), **state** only for the music/ticker mapping. Fix `Settings.hudTicker.hint` and `Summary.lede`. |
| **killer / Blackened / murderer** | "killer" 35 keys (engine: `Murder.killer`, `Cleanup.gmNothingHere`, `Vote.verdictNoteKnown` "every killer walks away"), "Blackened" 21 (trial/vote); `Murder.escapeKiller` "{killer} is not Blackened" mixes both in one line correctly | **killer** during the incident and Stage 6; **Blackened** from the body's discovery onward (trial, vote, Level Up). `Vote.verdictNoteKnown` -> "every Blackened walks away". |
| **student / character / player** | "student" 24, "character" 43, "player" 46. Same window: `Panel.whoIsAlive` "Players" lists *characters*; `Investigation.student` "Student" column; `Items.whichCharacterHub` "Which student"; `Calls.whichPlayer` "Which character?"; `Project.player` "Player" (a share target = a user); `Chapter.deathTitle` "A character dies"; `Vault.roomRatio` "living students"; `Explain.room.noActor` "No character is assigned to you" | **student** = a living cast member in the fiction, **character** = the actor/sheet, **player** = the human/user. Rename `Panel.whoIsAlive` to "Students" (its rows are actors), `Calls.whichPlayer` to "Which student?", keep `Project.player` (it *is* a user). |
| **Final Truth Remnant / Final Key Remnant / Final** | `REMNANT_TYPES.final.label` "Final Truth Remnant", `Mastermind.finalTruthReminder` "Final Truth Remnant", `Remnant.finalSubject` "Final Truth"; `Mastermind.finalRemnantsTitle` "Final Key Remnants", `finalPlacedIn` "Final Key Remnant placed", `Season.hint.mastermind` "the Final Key Remnants"; `Chapter.optSweep` "Faint and Final stay" | **Final Truth Remnant** (the type's own label). Rename the dashboard tab and `finalPlacedIn`. |
| **Level Up / Level up / advancement** | "Level Up" 15 keys; `SFX_EVENTS.levelUp.label` "Level up"; `Season.resetAdvances` "advancement(s)"; `Advance.*` namespace | **Level Up** everywhere a player reads it; "advancement" only in the reset tally is tolerable but "Level Ups" is clearer. |
| **Free Move / free Move** | "Free Move" 5 (`Panel.freeMove`, `Explain.status.moveTitle`, `Move.freeAvailable`), "free Move" 9 (`Actions.freeMoveLeft`, `Move.freeSpent`, `Overflow.what.fog`), gm-panel.mjs:1025 inline | Pick one; the glossary form is **Free Move** (a named rule, like Direct Murder). |
| **Nonstop Debate / debate / Debate / OBJECTION / Objection** | `Floor.mode.debate` "Nonstop Debate", `Hud.trial.debate` "Debate", `Floor.openDebate` "Open Debate"; `Floor.mode.objection` "OBJECTION", `Hud.trial.objection` "Objection", `Music.state.trialObjection` "Objection", `Trial.objectionShort` "OBJECTION", `Popup.kind.objection` "Objection" | Capital **OBJECTION** only on the banner and the button that shouts it; "Objection" as a noun elsewhere. "Nonstop Debate" for the mode name, "the debate" in prose. |
| **Analyze / Analyse** | Labels: "Analyze" (action, `Analyze.*` strings); key names `analyseBullet`, `analyseBulletHint`; config.mjs:700 "unanalysed", 763 "Analyse it", 773 "analysed", 1094 "analyse" in *player-facing* `TRUTH_BULLET_TYPES.neutral.hint` and `REMNANT_TYPES.key.hint` | American **Analyze** (the action's name). Fix config.mjs:700, 763, 773. The rest of the copy is British ("colour", "centre", "Self-defence") - that is fine as long as the glossary word is fixed. |
| **Role reversal / Role Reversal** | `CRISIS_ACTIONS.roleReversal.label` "Role reversal"; `MURDER_OPENING.killer.despair` "loses access to Role Reversal"; `Murder.freeResolution` "Take Survive or Role reversal" | **Role reversal** (the label). Fix config.mjs:2509. |
| **Search tokens / searches** | `SearchTokens.*` "search tokens", `Action.searchTokensLeft` "Searches left here"; `Hud.roomTokens` "search tokens" | Player-facing **searches left**, GM setup **search tokens**. |
| **Room Setup / Room setup** | `Vault.manageTitle` "Room setup", `Tables.newPoolNote` "Room Setup's “Draws from”", `Tables.poolCreated` "Room Setup", `Season.hint.*` "Room Setup" | **Room Setup** (window name). |
| **Give / take items / Items / Give an item** | `Items.manage` "Give / take items", `Items.hubButton` "Items", `Items.buttonTooltip` "Give or take an item", references in `Chapter.typeless`, `TruthBullet.migrated`, `Vault.inspectNote` | Keep "Give / take items" as the window's name; the footer button "Items" is fine as a short. |
| **Wounded / Breakdown / Broken Down** | `States.*` "Wounded", "Breakdown"; diagnostics.mjs:1150 "Broken Down" | **Breakdown**. |

## 4. GM-only information a player could read

Method: every key whose text mentions a threshold/DC, the killer's identity, the Mastermind, the answer key or a GM instruction was grepped to its use site and the branch checked for `isGM` / `whisperToGms`.

| Key | Reaches a player? | Verdict |
|---|---|---|
| `Events.openingTitle` / `openingMeta` (849-850) | **Yes** - the direct-murder victim's HUD during Stage 4 (events.mjs:83-102) | **Leak, CONFIRMED** - TEXT-03 |
| `Handover.alreadyHasIt` (1548) | Yes - whispered to the giver about the recipient's evidence | **Leak, SUSPECTED** (may be tolerated) - TEXT-09 |
| `Tamper.frameHint` (2395), `Analyze.findStashHint` (612) | Yes - DC printed on the menu row | DC disclosed (and one is wrong) - TEXT-01/14 |
| `Murder.thresholdShort` (1216), `briefThreshold` (1252) | Yes - every crisis tile / briefing | DC disclosed by design; config.mjs:2606 says the prose is for the GM - the *number* is not. TEXT-14 |
| `Action.dynamicHint` / `dynamicDescription` (527/534) | Yes | Mentions "thresholds" generically; no number. Acceptable. |
| `Overflow.playerHint` (1872) | Yes - `{max}` is the threshold | The count is veiled, the threshold is shown; `Overflow.explainVeil` says the veil is a courtesy. Acceptable, but say "at a threshold" if the number is meant to be private. |
| `Cleanup.reinforcedFlag` (1096) | Yes - the killer's trace picker (cleanup.mjs:266) | By design (Stage 6 rule says reinforced traces stay). OK. |
| `Cleanup.seenCleaning` (1076), `Action.sabotageSeen` (523) | Witnesses in the room + GMs (cleanup.mjs:1210-1220) / whole table (action-rolls.mjs:2481) | Names the actor, which is the rule ("Despair shows you to the room"). OK. `sabotageSeen` is public to the *whole table*, not the room - confirm that is intended (the comment says so). |
| `Events.incidentSub` "{killer} against {victim}" (852) | Only GMs and seated actors (events.mjs:108-115) | OK. |
| `Murder.keyCount` (1108), `nightNoteDirect` (1231), `openingRemnantNote`, `resolutionNote`, `escapeKiller`, `ranOut`, `victimDead` | `whisperToGms` / GM tracker only (murder.mjs:3303-3308, 1832-1834, 490) | OK. |
| `Action.observeGm` / `analyzeGm` (504/510), `Cleanup.gmLine` (1049), `Investigation.neverOnePerson` (1280), `Vote.verdictIntroKnown`, `Mastermind.*` | GM cards/dialogs only | OK. `Mastermind.privacyWarning` is a good touch. |
| `TruthBullet.really` / `reallyTooltip` (1630-1631) | `game.user.isGM` guard (sheet.mjs:2626) | OK. |
| `Remnant.digestTitle`, `foundTitle` | `whisperToGms` (remnants.mjs:530) | OK. |
| `Summary.left` "left a trace behind" | Yes, the player's own end-of-time-of-day summary | Tells a player *that* their Search/Sabotage left a trace, never its band - matches `Action.leavesRemnant` on the briefing. OK. |
| `Hud.trialTooltip` "runs from the GM's console" (465), `Hud.bodyFoundTooltip` "until the GM starts the Investigation" | Yes | GM instructions on a player HUD - harmless but addressed to the wrong reader. Reword neutrally: "The debate is opened by the GM." |
| `Chapter.deathNote` (1425), `Chapter.stageSixWhat` (1439) "lets {killer} see the traces they left" | GM dialogs (chapter.mjs) | OK. |
| `Items.overCapNote` (611) "A GM grant ignores the carry limit" | GM give-item dialog (gm-items.mjs:516) | OK; `Inventory.overCap` (player toast) says "Allowed - a GM granted it." - fine. |

## 5. Typos, grammar, capitalisation of glossary terms

- config.mjs:700 `REMNANT_TYPES.key.hint` "unanalysed"; :763 "Analyse it"; :773 "analysed" - glossary is **Analyze** (`ACTIONS.analyze.label`, `Analyze.*`). Key names `Analyze.analyseBullet` / `analyseBulletHint` (en.json:594, 606) mix spellings (identifiers; harmless but grep-hostile).
- config.mjs:2509 "Role Reversal" vs label "Role reversal" (:2787).
- config.mjs:487-488 "(sanity relief)" lower-case vs `USABLE_KINDS.stress.label` "Sanity Relief".
- config.mjs:3919 `SFX_EVENTS.levelUp.label` "Level up" vs "Level Up" everywhere else.
- gm-panel.mjs:1025 "free Move" vs header "Free Move" (`Panel.freeMove`); en.json `Actions.freeMoveLeft` "free Move unused" vs `Explain.status.moveTitle` "Free Move".
- en.json:2164 `Tables.roomBreakdown` uses straight escaped quotes `\"Room - Murder Weapons\"` where every other string uses “ ”.
- en.json:1350 `Vault.stashesNote` "does NOT come", :1389 `fogIntro` "rooms they have BEEN to", :2648 `Season.hint.resources` "Wounded AND in Breakdown", :1880 `Overflow.setupIntro` "ONE thing", :1893 `Overflow.what.silence` - shouted emphasis in running UI text; the module otherwise never does this. Use plain words or `<strong>` where HTML is allowed.
- en.json:1108 `Murder.keyCount` "This case will leave {n} Key Remnants." - no plural family; `n` can be 3 (fine) but `Investigation.leftoverKeys` (1331) "{n} Key Remnant(s)", `Chapter.doneSweep/doneFaint/doneKeys` (1487-1489) "(s)" where the module otherwise has `.one/.other` families. Convert to `plural()`.
- en.json:362-365 `Listen.anonymous.one` "{n} person in {room}. You cannot tell who." - with n = 1, "You cannot tell who" is right; OK. `Vote.silent.one` "1 ballot never came back" hard-codes "1" where the sibling uses `{n}` - harmless.
- en.json:1437 `Chapter.vaultPending` "A stash is still their own sheet, so stashed bullets are in the count above and everything else they put away stays there to be found." - two clauses joined by "so" that do not follow; reads as a leftover.
- en.json:2636 `Season.note` "Nothing here is done for you that you would not have done yourself." - double negative, unclear.
- en.json:955 `Vote.blackenedRuleIntro` "the guide gives them" - "the guide" is a meta reference the player never sees but the GM should not need either.
- en.json:1493 `Chapter.tidyNote` - changelog prose in a dialog (TEXT-15).
- en.json:1841 `Calls.gatherBanner` "AN ANNOUNCEMENT FROM MONOKUMA" - fine; but `Calls.gatherTitle` "Public Announcement" vs `Calls.gatherShort` "Assembly" vs `Events.ticker.assembly` "Assembly" vs `SFX_EVENTS.publicAnnouncement.label` "An assembly is called" - two names for one Call; choose **Assembly** for the event, keep "Public Announcement" as the Call's name.
- en.json:1299 `Investigation.pickRoom` "- create in -" used as a label (TEXT-13); `Project.anyTrait` "- player chooses -" and `Project.anyRoom` "- any room -" are option texts, fine.
- en.json:2731 `Explain.phase.investigation` "What you fail to find, you will not have." - reads as a threat, fine tonally but grammatically odd; "What you do not find, you will not have."
- diagnostics.mjs:1150 "Broken Down" (state is "Breakdown").
- en.json:1631 `TruthBullet.reallyTooltip` "GM only - what this Truth Bullet actually is." and :1618 `realType` "What it really is (GM only)" - consistent, good.
- Capitalisation of "Class Trial"/"trial": `Floor.endTrial` "End the trial", `Floor.trialClosed` "The Class Trial is over", `Panel.nextTrialOutlived` "End the trial." - lower-case "trial" as the common noun is consistent; OK.
- "Killing Game Rule" (`Calls.newRuleTitle` "New Killing Game Rule") vs "killing game rules" (`Rules.manageTitle` "Killing game rules", `DESPAIR_CALLS.newRule.effect` "killing game rule") - pick "killing game" lower-case as prose, "New Rule" as the Call.
- "Hope Calls"/"Calls": `Eclipse.callsLocked` "Every Call unlocks" - fine.

## 6. Glossary - terms that must stay in English (key count = number of en.json keys whose value contains the term)

| Term | Keys | Notes |
|---|---|---|
| Truth Bullet(s) | 60 | + types Key / Neutral / Faint / Prep / Incident / Tamper / Autopsy / Final Truth Bullet (config `TRUTH_BULLET_TYPES`) |
| Despair | 66 | also Despair Call, Despair pool, Despair overflow |
| Hope | 58 | also Hope Call |
| time of day | 61 | Morning / Noon / Afternoon / Evening / Night (config `TIME_OF_DAY_LABELS`) |
| Remnant(s) | 56 | Key Remnant 23, Faint Remnant, Prep Remnant, Incident Remnant, Tamper Remnant, Autopsy Remnant, Final Truth Remnant |
| Monokuma(s) | 43 | proper noun; also "Monokuma Legacy" theme (3) |
| Sanity | 39 | replaces Daggerheart "Stress"; also "Sanity Relief" |
| Eclipse | 37 | "{time} Eclipse" |
| Blackened | 21 | |
| Health | 19 | replaces "Hit Points" |
| Mastermind | 18 | |
| Monocub | 17 | |
| Faint | 17 | as a type/tag |
| Class Trial | 16 | |
| Level Up / Reinforced Level Up | 15 / 3 | |
| Investigation | 14 | phase name |
| Stage 4 / 5 / 6 | 1 / 3 / 10 | guide's stage numbers, appear in UI |
| Direct Murder / direct murder | 6 / 16 | action name (capitalised) vs prose |
| Hope Call(s) / Despair Call(s) | 10 / 8 | and every Call name: Support, Experience, Ultimate, Contribution, Reroll, Sprint, Burst, Relief, Resolve, Loaded Die; Obstacle, Approval, Behind Closed Doors, Pain, Paranoia, Chained, Silence, Fuel a Monocub, Game Integrity, Patronage, Feed the Overflow, Contraband, Public Announcement, Motive, New Rule (config `HOPE_CALLS`/`DESPAIR_CALLS` labels; appear in en.json only via `{call}`) |
| OBJECTION / Objection | 10 / 6 | |
| Nonstop Debate | 3 | |
| Daily Life | 5 | phase |
| Free Move | 14 (both spellings) | |
| Search / Observe / Analyze / Listen / Palm / Rest / Projects / Tamper / Dynamic action | 18 / 8 / 7 / 4 / 0 / 10 / 10 / 3 / 4 | the action tiles (config `ACTIONS` labels); "Palm" and "Tamper" reach en.json only through tile labels |
| Short Rest / Long Rest; Sleep / Meal / Breath | 3 / 3 | config `REST` |
| Confusion | 5 | the Monocub's Meddle (key stays `meddle`) |
| Wounded / Breakdown | 4 / 5 | status effects |
| Ultimate | 5 | |
| Motive | 7 | |
| Key Remnant plan scale: Trivial / Standard / Complex / Desperate | config only | `KEY_REMNANTS.scaleLabels`, `PROJECT_SCALE` |
| Visibility bands: Obvious / Evident / Subtle / Hidden | 2 / 0 / 0 / 1 in en.json; config `REMNANT_VISIBILITY_LABELS` | `Remnant.difficulty.*` "Slight/Modest/Firm/Deep lead" are the player-facing aliases |
| Tier (0-3) | 24 | |
| Murder Weapon / Cleaning Tool / Tool / Usable / Room Key | 3 / 3 / - / 1 / 1 | config `ITEM_CATEGORIES` |
| Statistic (Eye / Head / Body / Leg / Hand / Shadow) | 10 | config `TRAITS`; DAGGERHEART overrides |
| Experience | 17 | Daggerheart term kept |
| Reinforced | 14 | property of a trace |
| Safeword | 7 | the word itself is a setting |
| Stained Glass / Monokuma Legacy | 4 / 3 | theme names |
| Situational | 1 | playlist name, matched by string (`SITUATIONAL_PLAYLIST`) - **must not be translated** |
| Crisis action names: Use an item, Leave a clue, Secure a trace, Self-defence, Survive, Role reversal, Strike, Pin them down, Keep your distance, Attack with a weapon, Finishing blow, Escape together, Double role reversal, Partners in crime, Averted eyes | config only | |
| Stage 6 actions: Erase a trace, Misleading trail, Move the body, Reshape a trace | 3 (`Misleading trail`) | |
| Overflow effects: Darkness, Shift, Panic, Despair, Silence, Fog, Rot, Earthquake | 1 each | `Overflow.name.*` |
| Window names: GM panel (5), Room Setup (3), Season setup (3), Despair Flow (2), Give / take items (6), Investigation Dashboard (3), Item Tables (1), Sound (5), Messenger (5) | | referenced by name from other strings - translate consistently or the cross-references break |
| DAGGERHEART.* overrides | 70 keys | relabel the system's own terms (Fear -> Despair, Stress -> Sanity, Countdown -> Project, Trait -> Statistic); a translation must override the *system's* language file the same way |

## 7. Dead strings

Method (`deadkeys.mjs`): flatten `DRPG.*` in en.json (2212 leaf keys, `.one/.other` counted separately); collect every `"DRPG.x.y"` / `'…'` / backtick literal from scripts/**/*.mjs and every template prefix `` `DRPG.x.${` `` and `"DRPG.x." +`; a key is live if it or its plural parent is an exact literal, or starts with a template prefix. Three broad prefixes were then examined by hand: `` `DRPG.Murder.${key}` `` (murder.mjs:677) only ever takes `victimUnderAttack` / `victimTrapSprung`; `` `DRPG.Look.${key}` `` (look.mjs:27) is `t()` called with legend/theme/uiScale/note/pixelFont/pulse/ticker/reducedMotion; `"DRPG.Clock." + slot` (clock summary) covers `Clock.*`. With those narrowed:

- **Total leaf keys: 2212. Live: 2204. Dead: 8** (0.36%).
- Dead keys (all eight):
  1. `DRPG.Sound.launcherTooltip` (en.json:876)
  2. `DRPG.Look.redraw` (872) - no `t("redraw")` in look.mjs
  3. `DRPG.Investigation.clue` (1284) - the planner column is `Investigation.difficulty` now
  4. `DRPG.Murder.addThird` (1135)
  5. `DRPG.Murder.whoWalkedIn` (1136)
  6. `DRPG.Murder.nobodyElse` (1137) - the "Somebody walks in" GM control no longer exists in the tracker
  7. `DRPG.Murder.noStressLeft` (1166) - superseded by `spentHealth` (Z3)
  8. `DRPG.Murder.betrayalConfirm` (1244) - the betrayal dialog uses `betrayalButton`
- Referenced only from tests.mjs (live, but only a test names them): `Murder.betrayTileLabel`, `Murder.betrayTileHint` (en.json:1249-1250) - the sheet's betrayal route now goes through the Direct Murder tile (sheet.mjs:3137-3149), so these two are dead in production; `Tests.alreadyRunning`, `Season.step/hint.resources` are legitimately test-referenced (the latter also via the `DRPG.Season.step.${key}` template).
- Not dead but worth flagging: `DRPG.Safeword.word` (2564) is read only by the migration (TEXT-19).
- The run does not count keys under `GAME` / `DAGGERHEART` (system overrides, referenced by the system, not by this module).

Sample of dead keys requested (20): there are only 8 + 2, listed above in full.

## Live checks recommended (things statics cannot settle)

1. TEXT-03: open a direct murder with the victim's player logged in and confirm the "A murder is under way" card appears on their HUD before the opening roll lands (and check hud.mjs `buildIncident` for the same gate).
2. TEXT-09: share a Truth Bullet with somebody who already copied the same trace and read what the giver's whisper says.
3. Tile fit: with the pixel font on, check whether "Behind Closed Doors" / "Public Announcement" drive `--drpg-tile-text` to the 0.68 floor on a Monokuma sheet (sheet.mjs:943, 952-967) - the longest word is what scales *every* grid.
4. `Hud.roomTokens` (47 chars) in the room strip at 80% interface scale - does it wrap or clip?
5. Whether `Action.sabotageSeen` is meant to be public to the whole table (action-rolls.mjs:2481, comment says yes) while `Cleanup.seenCleaning` is room-only (cleanup.mjs:1196-1220) - two "you were seen" events with different audiences; the players will notice the asymmetry.

## Hygiene metrics

- Longest strings: `Season.roomGuide` (en.json:2686, 402 chars, dialog paragraph - fine), `Overflow.explainBody` (1910, 367), `Vault.stashesIntro` (1349, 224), `Investigation.neverOnePerson` (1280, 214). All are GM paragraphs, not controls.
- Hard-coded rule numbers inside sentences that config.mjs also owns: `Calls.newRuleNote` (12 vs 9), `Tamper.frameHint` (18 vs 15), `Investigation.plannerIntro` / `whichSlot` / `noSlot` (five), `Investigation.unfoundKeys` (four), `Hud.startEclipseNamed` / `Eclipse.noMovesLeft` (2 / "Both"), `Overflow.explainBody` ("holds twelve", "eight in the hat"), `Cleanup.moveHint` / `noStressForThis` ("1 Sanity" - matches `RESOLUTION_STRESS_COST` but is typed), `Action.observeGm` ("1 Sanity", documented as deliberate at config.mjs:858-861), `Hud.elapsedTooltip` ("15 minutes, red at 30" - matches hud.mjs:1446-1447). Ten sentences; the module's own rule (config.mjs:2100-2113) says these should be filled from the table.
- Duplicated concepts across keys: `Cleanup.trailAction` = `Tamper.trailAction` = `Tamper.frame` ("Misleading trail", 3 keys); `Vault.stowTooltip`/`takeTooltip` vs `Items.useStashed`/`equipStashed`/`discardStashed` all restate "take it out first"; `Cleanup.moveAction` = `Cleanup.moveTitle` ("Move the body"); `Investigation.notFound` = `Investigation.finalNobody`; `Investigation.foundBy` = `finalFoundBy`; `Despair.poolsTitle` = `Despair.widgetTitle` ("Despair Pools"); `Look.title` = `Look.launcherTooltip` ("Settings"). Merge candidates: 7 pairs.
- Inline English that bypasses i18n in the five domain files: gm-panel.mjs:1025 (two tooltips); gm-panel.mjs:332 "Danganronpa RPG v…" (brand, acceptable); diagnostics.mjs (whole file - console/whisper reports for the GM, deliberately untranslated); investigation.mjs:1165 `<option value="">-</option>`; season-setup.mjs:340 marks ✓ – ✗ and :431 `{ error: "✕", warning: "!", info: "·" }`. sheet.mjs has none.
- Stale comments about wording: config.mjs:1302-1303 ("flat 18"), config.mjs:1519-1520 (REST header "bedroom only", corrected three lines below), investigation.mjs:7 ("3-8 graczy"), config.mjs:3596-3600 (SFX count "Forty-two … thirty-five" - the paragraph explains its own staleness).
