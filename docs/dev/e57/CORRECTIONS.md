# The handbooks against the code: what was corrected (E57 C6-C8)

Each row is a fact the old handbook stated and the code does otherwise, corrected in the handbook, with the place in the code the
writer read. Gathered from the reports of the rewrite (1c1d818e) and of the fix pass (b2362972, 2cdd9a25) as each writer wrote
them; group names are the work split, not sections of the book. Section and fact ids (`s5.r9.f8`) are those of the facts at
28a92d8e (`docs/handbook-facts.<book>.en.json` before the rewrite). Where the code looks wrong instead, the handbook says what the
code does and the item is in STATUS-HANDBOOKS.md, "Code and UI text that look wrong".

Corrections later undone: B1 7 (Loaded Die "your next roll") was put back to "your next action roll": the prose in config.mjs:2530
says "next roll", but roll-dialog.mjs `grantsFor` (:984-991) loads it on an action roll only; the prose is in the code-looks-wrong list.

## The rewrite, group A (GM 0-1)

| Fact | Old | New | Code |
| --- | --- | --- | --- |
| s0.n1.f1 | Every number in this handbook is quoted from `scripts/config.mjs` | quoted from the module's code, most of them from its rules file (`scripts/config.mjs` in the appendix, with the two exceptions this section uses) | scripts/relay-guard.mjs:160-162 (`RECENT_MS`, `FEAR_STEPS_NOTED`), scripts/notice-history.mjs:131 (`BUDGET`), scripts/dice-sync.mjs:163 (`FUSE_WINDOW_MS`) |
| s1.r2.f3 | a newer version loads and the module tells the GM once per version | a newer version loads, and each GM is warned at every load until they tick that it should not be mentioned again on that computer | scripts/requirements.mjs:370-380 (any GM; silenced only when the stored version equals the running one), :400-401, :414 (client setting `systemWarningSilenced`, scope client, settings.mjs:1623) |
| s1.p3.f9 | the window gives each reason in the table's language | in that browser's language (its stored module language, else Foundry's, else English) | scripts/requirements.mjs:189-195 `requirementsLanguage` |
| s1.p9.f1 | the Next line reads *The season is not set up yet. Next in the Season checklist:* | reads *To set up:* and names the first row (DRPG.Panel.nextSeasonSetup "To set up: {step}."); the quieter line is *The Season checklist still waits on:* (DRPG.Panel.nextSeasonSetupAside) | scripts/gm-panel.mjs:978, :991, :1018-1022 |
| s1.p9.f8 | the season has started when the clock has moved past its first time of day | ... or the first Eclipse has refilled the students | scripts/gm-panel.mjs:995-1002 `seasonUnderway` (its comment: "or a boundary has refilled the cast (`refilledFor`, written by the first Eclipse)") |
| s1.n3.f70 | not which trace they came from | not which Remnant they came from (wording, glossary EN15; the same fact s1.p28.f2 states with "Remnant") | docs/glossary.json `remnant` |
| s1.p7.f4/f5 | the window's sentence quoted without its full stop; "a button that opens it" | *Start here: GM panel > Season setup.* (its first sentence) and the button named **Season setup** | lang/en.json DRPG.Season.startHereText; scripts/season-setup.mjs:1427-1428 (button DRPG.Season.title) |
Added from the code, in the appendix only: the newer-Daggerheart window runs the patch probe and names a place not found (requirements.mjs:383-390); **Show again** under Silenced warnings undoes the silence (diagnostics.mjs:2179-2182); only Player and Trusted Player accounts are matched, by the primary GM's browser, at its start and when a user connects, is made or renamed, or a student is made or renamed (user-match.mjs:8-10, :62-64); `firstOutstandingStep` skips optional rows (season-setup.mjs:742-743).
Checked and kept: 14.364/14.365 and 2.6.5/2.12.8 (module.json); the three required modules and their reasons (module.json, DRPG.Requirements.reason.*); "not installed" / "installed, but switched off" (DRPG.Requirements.state.*); the player's notice is permanent (requirements.mjs:104); Where to start once per browser, GM only, no campaign name and no students (season-setup.mjs:1401-1403, client setting settings.mjs:2512); Fear more than 4 steps in 10 seconds (relay-guard.mjs:160-162, :932); the dice look default *Everyone: Dice So Nice* (settings.mjs:1482, `default: "dsn"`); the minute of a look changing back (dice-sync.mjs:163, 60000 ms); *Music follows the game state*, *Separate voice in each room* and *Players' statistics without approval* default off (settings.mjs:1978, :1876, :3126); a Blackened who walked out of a wrong vote takes 4 picks where the others take 1 (config.mjs:3413-3416 `LEVEL_UP` standard 1, reinforced 3, and level-up.mjs:461-463: the Reinforced rides on the Standard as one offer); Give back's texts (DRPG.GiveBack.*); every setting name (DRPG.Settings.*.name, below).

## The rewrite, group B (GM 2-4)

- s2.p1.f3, s2.p1: Season setup also holds Edit campaign's **Next morning's line**, the **Scenes** part and **Reset the season** in a warning frame. Old: name, chapter, phase, day, session, time of day, safeword only. season-setup.mjs:809-826, 1155-1160, 1288-1292.
- s2.p1.f9: old "only Edit campaign scrolls"; new "the part above the row scrolls" (the body is Edit campaign, Scenes and the reset frame; the tiles are pinned). season-setup.mjs:1155-1161.
- s2.p1.f11: old "when it closes Season setup comes back"; new: Season setup is not closed or redrawn, it waits behind as left. season-setup.mjs:1099-1106 (E101 F4).
- s2.r11 (Sound files): row removed. season-setup.mjs:448-449. Dropped.
- New row, not in the old text: *Characters no player plays are marked* (optional, no button). season-setup.mjs:313-321; monokuma.mjs:266-269.
- s2.r4.f1: old "has max Health 4 and max Sanity 6"; new "at least" (a sheet below them needs it). character.mjs:29-32.
- s2.r12.f4, s2.r12.f7, s2.r14.f3: old "Room setup > Doors", "Room setup's Doors tab and Pre-season checks print the same count", "Open opens Room setup on Doors"; new: the **Rooms** tab (This is a room, No privacy and the count), no Pre-season checks. room-setup.mjs:377-381, 452-460, 636-637; season-setup.mjs:535.
- s2.r12.f1: "rounded by roomsWantedFor" is "rounded up". vault-store.mjs:1364-1366.
- s2.r13: the rooms row also requires Foundry's token vision and fog off and global light on for every scene with rooms. season-setup.mjs:497-501; fog.mjs:1066-1072.
- s2.r15 / s2.p4: the hall row is drawn under First session only (not in the main list), and First session's Foundry row opens Give back Foundry's settings (not the module list) and is drawn only while the settings are given back. season-setup.mjs:552, 628-641; Dice So Nice's Open only where Foundry has the module window, 643-652.
- s2.p6.f4, s2.p7, s2.p8, s2.p11: the further checks are Room pictures, Voice, Dice look and the anonymity audit; the Cast and Scenes parts are the checklist's rows, and the Foundry/Daggerheart contract moved to the Debug log's **Foundry and modules** (now in section 3). season-setup.mjs:1494-1509, 1440-1465; gm-panel.mjs:729-739.
- s2.p9: a fourth kind added (pictures not loaded in time, size not checked); a picture that does not load is a cross, the others a **!**. season-setup.mjs:1645-1653.
- s2.p11.f2 and s2.p12.f2: old "a cross for each"; new "a **!**" (warning state). season-setup.mjs:1560-1563, 1580-1583.
- s2.p12.f5: "the Debug log's Foundry and modules (Diagnostics)" kept, now pointed at section 3.
- s2.p13: the audit also lists Assistant GM owners, shared owners, no player owner, and Observer sheets while *Keep character sheets anonymous* is off. anonymity.mjs (keys `assistants`, `shared`, `orphaned`, `switchOff`).
- s2.r7.f5: "the item manager" named as its window title **Give / take items**. gm-items.mjs:382.
- s3.p1.f3, f6, f7, s3.p12: the panel has no table of the living cast; it shows one count line (*n students still have actions*), the Monocubs in it. gm-panel.mjs:1090-1099, 1121-1131.
- s3.p10.*, s4.n1.f3, s4.p9.f10, s4.p12.f7, f13: the button is **Skip the Eclipse** (`DRPG.Panel.advance`), not "Next time of day". gm-panel.mjs:1111-1117.
- s3.p2-s3.p8: new Next line steps the old list lacked: a readiness question still open (gm-panel.mjs:818-820), a chapter's end that stopped part way (829-832), a body two witnesses found waiting for your word (939-940). The setup line reads *To set up:* (`DRPG.Panel.nextSeasonSetup`), not "The season is not set up yet. Next in the Season checklist:"; the second line is *The Season checklist still waits on:* with **Open** (976-994, 1005-1010). When the season counts as started is said (seasonUnderway, 1001-1007).
- s3.p9.f2: each button now stands at its step; the Eclipse's question gives **End the Eclipse** too (nextGoKey, gm-panel.mjs:1037-1040).
- s3.r2.f2: Murder is greyed during an Eclipse only when no incident runs; with one it opens the incident tracker. gm-panel.mjs:247-254.
- s3.r3.f5: Settings is disabled, with its reason, for a GM without Foundry's settings permission. gm-panel.mjs:315-316.
- s3.r4.f2: the tile is **Fix voice** (`DRPG.Panel.voiceReset`), primary GM only; Diagnostics also holds **The case**. gm-panel.mjs:332-351; lang/en.json `DRPG.Voice.resetRefused`.
- s3.r4.f4: the Debug log's buttons are **Copy to clipboard** and **Clear the log** (only while it holds rows) and **Foundry and modules**. gm-panel.mjs:731-741.
- s3.p13: Students groups the rows (Students, Monokumas, Spectators, Not in the class); Role has Spectator, and a dead student's Spectator a fixed line; the columns are Hope, Despair → Hope, Crime witness; a Do column with Silence now and Refund last crossing; the withdraw button is **Withdraw**. gm-students.mjs:93-219, 286-298.
- s3.n1.f2: the box's label is *Keep their Truth Bullets (not a killing-game death)*. chapter.mjs:808-810.
- s4.p6: the turn also lapses unanswered Bribes and unclaimed Bounties. clock.mjs:806-809.
- s4.p9: a rewind from Morning goes back a day (clock.mjs:719-731); taken back, the seals of the time of day are put back rather than cleared (clock.mjs:739-741, 647-648).
- s4.p9.f10: old "after two presses ... two rewinds take back both"; new "up to 4 in a row". clock.mjs:494, 522, 596-621.
- s4.p10: the refill box refills actions and Search Tokens and nothing else of a boundary (gm-campaign.mjs:373-381; `DRPG.Panel.refilled`); the Eclipse warning comes only when the time of day, the day or the chapter moved (gm-campaign.mjs:358-365); phase to Class Trial during an Eclipse keeps the phase and applies the rest (gm-campaign.mjs:318-341).
- s4.n1: added that the module refills a boundary once (clock.mjs:370-384), and the Wounded note to the GMs (clock.mjs:851, 906-911).
- s4.p1.f8: "End of chapter" is the button **End the chapter**.

## The rewrite, group B1 (brochure)

1. s0.p2.f7 Wounded. Old: "one action fewer". New: "1 action fewer, outside the Class Trial". config.mjs:3384
   (`STATES.wounded.actionsLostIn: ["dailyLife", "investigation"]`), actions.mjs:24 (`WOUNDED_ACTIONS_LOST = 1`). Wounded per D21 as the code
   runs it; the phases are Daily Life, Investigation and Class Trial (config.mjs:349-353).
2. s4.n1.f3 durability. Old: "Tier 0-1: 1 point, Tier 2: 2, Tier 3: 3". New: "Tier 1: 1 point, Tier 2: 2, Tier 3: 3" plus "A Tier 0 tool
   breaks on its first roll, whatever the roll." config.mjs:617-633 (`ITEM_DURABILITY`'s comment: Tier 0's one is a single use), use-items.mjs:175
   (`rollSpends`); player-handbook.en.md:530 says the same.
3. s4.n1.f5. Old: "until you stash or throw them away (that leaves a Remnant)" - read as if stashing leaves one too. New: "throwing away
   leaves a Remnant". config.mjs:2055 (`BROKEN_ITEMS`, the throw-away roll), player-handbook.en.md:533.
4. s2.r8.f1 Palm's roll. Old: "Hand + Shadow". New: "Hand; Shadow to stay unseen" - Palm rolls Hand, and Shadow only for the unseen
   attempt (the Frisk's force is Body, in the row). config.mjs:1767 (`traits: ["hand"]`), 1816-1820 (`unseen`, `plant`, `frisk`, `rummage`).
5. s2.r1.f6/f7. Old: "Taking a weapon or a cleaning tool leaves a trace". New: "Taking a Murder Weapon or a Cleaning Tool leaves a Remnant."
   config.mjs:1539 (`leavesRemnant ... onlyFor: ["crimeTool", "cleaningTool"]`); names per ITEM_CATEGORIES (config.mjs:652ff), "Remnant" per EN15.
6. s3.r8.f2 Relief. Old: "A Short Rest right now." New: "A Short Rest right now, in any room, without Breath." config.mjs:2500-2502
   (`HOPE_CALLS.relief.effect`: any room, no Breath).
7. s3.r9.f2 Loaded Die. Old: "your next action roll". New: "your next roll". config.mjs:2530 ("For your next roll, a random one of the two
   dice is set to 12").
8. s2.r9.f2 Erase a Trace. Old: "Erase a Trace you know of in this room". New: "Erase a Trace you have found in this room ... or Reshape a
   Trace ..., neither on a Reinforced one". config.mjs:1850 (`ACTIONS.tamper.hint`: "unless it is Reinforced"), cleanup.mjs:189 and 332 (a
   Reinforced Remnant gets no DC, so neither choice can be taken).
9. s3.r2 Talent. Old: "**Talent** (GM)". New: "..., once the GM approves". config.mjs:2325 ("A GM approves, and you pay only then").
10. Action table order: now ACTION_GRID's (config.mjs:1941), as the sheet draws the tiles (Infiltrate and Palm after Analyze). No fact changed.
Checked and right as they stood (M1): Health 4 / Sanity 6 / Hope 2 / max 6 (config.mjs:304-308); critical 2 Hope (1261); 2 actions (313);
Eclipse 2 rooms, any room before Night (573, 590); Search 8/12/18, critical +1 tier (1529-1533); Observe miss 1 Sanity (1240); Analyze hint
14/18, Find Stash 16, Find Passage 16 (1607-1626); projects 12/18, critical +2 and the action back (1653-1657); rests 1 action pick 1 per time
of day, 2 actions pick 2 per session (2156-2158); Listen 14/18, Dash 12/18/crit 2/3/4 (1737-1741, 2195-2197); Palm 12/15, 8/13, Body 12,
Shadow 15 then Hand 10 (1767-1820); Tamper 9-18 (4479), reshape 3 lower (`transformAction.dcRelief`), Misleading Trail 15, cover 16 with
Sanity 1 on a Despair success, 1 or 2 on a miss (`CLEANUP.conceal.stress`), 1 action and no Sanity outside the killer's own clean-up
(cleanup.mjs:1987-1993 `tamperPriceSkip`; PRICE_CHAINS.tamper config.mjs:1471); Hope Call costs 1/1/2/2/3/2/4/4/6 (2311-2530); usables 3,
gear 2, 1 stowed (672, 965, 978); stash 3 (`VAULT_LIMIT`, 905); trap Eye or Head vs 20 (`MURDER_OPENING.victim`, 3699-3701; F3 already
applied before this pass); Leave a Clue 12, Secure a Trace 15, Self-Defense 18, Use an Item 15 (`CRISIS_ACTIONS`); drain Sanity then Health
on each victim turn after the first (murder-rules.mjs:2931, 3077-3079); Key Remnants 3-5, suspects 2-4 (`KEY_REMNANTS`, 1360-1388); Take from
the body one Hand roll, no action, lower roll easier Remnant (`LOOT`); Objection 30 s pick, 60 s, 120 s rebuttal, Closing Argument 300 s
(`TRIAL`, 4285-4300); Objection price action/Hope/Sanity (PRICE_CHAINS.objection); conviction more than half, tie wrong (vote.mjs:687-688,
971-986); Reinforced Level Up for a wrong verdict (`TRIAL.wrong`); notice history 250 for a player (notice-history.mjs:134); default safeword
"Safe Word" (settings.mjs:1179); the safeword dialog's default button is Stop it (safeword.mjs:388-401); the dead's voice in the Spectators'
room, the living hearing nothing (voice.mjs:946-952).
Not added (numbers a reader meets, left to the player handbook to keep the summary short): the Frisk's 60 s to answer and 30 s to force
(`TIMING.friskAnswerMs`, `friskForceMs`), the safeword's 60 s in which a second press posts no new card (`TIMING.safewordRepeatMs`), the
rests' amounts (all on a Long Rest, half on a Short Rest), the free crossings of Dash and Sprint before an action is charged, and a Direct
Murder's "unless another killing opened an incident first". The brochure states none of them before or after; none is false by omission.

## The rewrite, group C (GM 5-6)

- s5.r1.f3 / s5.p7.f3: "a room search token", "search tokens" -> "one of the room's Search Tokens" (EN7, glossary search-token).
- s5.r1.f5, s5.r1.f9, s5.r9.f5-f7, s5.r9.f9, s5.r9.f10, s5.r30.f1, s6.r5.f5, s6.r5.f15: "trace(s)" -> "Remnant(s)" (glossary remnant, EN15; the five names untouched).
- s5.r4.f9, s5.r4.f11: "neighbouring"/"neighbour" -> "neighboring"/"neighbor" (EN1); s5.p15.f1 "labelled" -> "labeled"; s6.r8.f5, s6.p3.f6 "greyed"/"greys" -> "grayed"/"grays".
- s5.p5.f10: "a Dynamic action" -> "a Dynamic Action" (glossary dynamic-action).
- s6.r13.f2: "the overflow" -> "the Overflow" (EN13).
- s5.r4.f4: "no GM needed" -> "with no ruling from you": Listen needs no ruling, but its roll is still drawn through a GM (features.md item 16; config.mjs ACTIONS.listen).
- s5.r9.f8: "(section 13)" -> "(section 13.3)", the Stage 6 rules' subsection.
- s5.p15.f5: quoted notice "*Someone else changed this character's Background meanwhile...*" -> "*Someone else changed this Background meanwhile...*" (lang/en.json:512 `DRPG.Sheet.biographyChanged`).
- s6.r1.f2: Support "Give another player advantage on one roll" -> "another student in the same room advantage on their next roll", and added "a student who already holds an unused Support cannot get another, and the spender keeps their Hope" (config.mjs:2312-2316 `HOPE_CALLS.support.effect`; EN12).
- s6.p6.f23, s6.p6.f27: "**Killing game rules** in the GM panel" -> "a tile of **Season setup**" (gm-panel.mjs:378-386 `SEASON_TILES`; R3582: no such tile in the GM panel's Between sessions).
- s6.p12.f3: card marker "thrown with no GM connected" -> "*Thrown with no GM connected - the GM will see it.*" (lang/en.json:5450 `DRPG.Rolls.unwitnessed`).
- Added (06 r10): the Bribe row, missing from the Hope Call table (config.mjs:2540-2543 `HOPE_CALLS.bribe`, cost 1; config.mjs:2319 "Bribe stays among the Hope Calls, which stay ten"); details stay in section 8.
- Added (05 p1, D113): the order budgets are paid in: a banked Burst pays the whole next action, a Long Rest's 2 included, before any action (actions.mjs:163-186 `spendAction`); a crossing takes the Free Move, a banked crossing, a Burst, then an action (actions.mjs:334-373 `takeMove`, `nextCrossingPrice`).
- Added (05 p1, Wounded per D21): a Monocub never loses an action to Wounded (actions.mjs:49 `actionBudget`); the floor of 1 is Panic's (config.mjs:2633 `panic ... floor: 1`, overflow.mjs:1086), and the Wounded rule reads `STATES.wounded.actionsLostIn` (config.mjs:3384, dailyLife and investigation).
- Added (05 r5, D091): a Plant into full pockets: the item stays with the planter, the action stays spent, the target is told nothing (palm.mjs:209-211 and 861-866, D42).
- Added (05 r5, A11): the searcher has 30 s to decide on forcing a Frisk (config.mjs:412 `TIMING.friskForceMs`); 60 s to answer kept (config.mjs:411). No "Consent" in the text.
- Added (05 r3): in a Class Trial with no action left, Analyze costs 1 Hope, or 1 Sanity once Hope is gone (config.mjs:1463-1469 `PRICE_CHAINS.analyze`, `stepsBeyondFirst: "classTrial"`; `ACTIONS.analyze.hint`).
- Added (05 p8, the 14.10 threshold item): the roll's card says "needed N" (lang/en.json:1069 `needed {n}`; tests-tier0.mjs:18337).
- Kept as the code runs it, checked: 2 actions (config.mjs:313); Search 8/12/18, critical +1 tier (action-search.mjs:83-89); Palm 12/15, Plant 8/13, Frisk Body 12, Hand 10 unseen 15 (config.mjs ACTIONS.palm); Infiltrate rows (config.mjs:2189-2211 INFILTRATE); Projects 12/18/critical; Sabotage 2/6/8, Shadow 16, -1 on Despair (config.mjs:2105-2115, ACTIONS.sabotage.simpleRepair); Dynamic bands 8/13/16/19 (config.mjs:2130-2135); Rest (config.mjs:2156-2164); critical 2 Hope (config.mjs:1260); Tamper 1 action, no Tamper with none left (config.mjs:1831-1837, PRICE_CHAINS.tamper); Hope Call costs 1/1/2/2/3/2/4/4/6/1; Despair Call costs as the table (config.mjs DESPAIR_CALLS); Motive 1-10, default 3 (config.mjs MOTIVE); locks (calls.mjs:66-125); five minutes, three minutes, eight seconds (config.mjs:366-376 TIMING).

## The rewrite, group D (GM 7-8)

- s8.r1.f1, s8.r1.f2 - old: Confusion's first tier "12" (+1 / -1). New: "11 or more". config.mjs:3521-3525 (`{ min: 11, grants: "bonus" }`, "FIRST TIER 11 (E64 C5a, 12.11.2026 ... it was 12)"), scored with `total >= tier.min` (utils.mjs:853-858 `resolveThreshold`). The 16 tier is `>= 16`. The critical is a double (config.mjs comment at 3521-3523, monocub.mjs:1495); the row now says "Critical (a double)".
- s8.p12.f38, f39 - old: "one Monocub move per time of day and two per game day". New: one **Confusion** per time of day and two per game day. Only Confusion has `caps` (config.mjs:3504); Tinker, Redeem, Ask for Hope and Ghost Bet have `caps: null`.
- s8.p12.f66, f67 - old: "a Monocub's abilities are one table, ... Confusion its one row (key `meddle`)". New (appendix): five rows, Confusion (`meddle`), Redeem, Ask for Hope, Tinker, Ghost Bet (config.mjs:3455-3625). f73 "A second ability is one row and one resolver" became "Another ability is one row and one resolver".
- s8.p12.f31 - old labels **Give 1**, **Give 2**. New: **Give 1 Hope**, **Give 2 Hope** (`DRPG.Monocub.askGive` "Give {n} Hope", lang/en.json:1356; monocub.mjs:1523).
- s8.p12.f34 - old: "one open at a time". New: one open at a time, and one left unanswered stops holding up the next when its time of day ends (monocub.mjs:726-739 `askMarkNow`, `askStillOpen`). Also added: Ask for Hope is not offered at full Hope (config.mjs:3576 `blocks: ["askOpen", "hopeFull"]`).
- Added for every Monocub tile but Ghost Bet: not in an Eclipse or a Class Trial (config.mjs:3498, 3556, 3575, 3597 `locks: ["eclipse", "classTrial"]`; Ghost Bet `locks: ["betWindow"]`). Ghost Bet: one at a time (monocub.mjs:847 "a Ghost Bet is placed already"). Tinker moves the project "forward or back" (`DRPG.Monocub.tinkerIntro`, `helpStep`/`hinderStep`).
- s8.p9.f6 - old quote *Not in the class: no actions, ballots or Level Ups.* New: *Not in the class: no actions, ballots, or Level Ups.* (`DRPG.Class.npcLine`, lang/en.json:3896).
- s8.p9.f10 - old quote *No player owns ... If one is an NPC, mark it Not in the class on its sheet.* (no such text in lang). New: the row *Characters no player plays are marked* (`DRPG.Season.step.npcs`, lang/en.json:5831) with *A character no player owns is probably an NPC: mark it Not in the class on its sheet, or leave it as it is.* (`DRPG.Season.hint.npcs`, 5832).
- s7.p2.f7 - the facts file read "Not for the Mastermind" as "Despair is not earned for the Mastermind". The code: the Mastermind is assigned like any student, and "- nobody -" is not for them (assignments.mjs:31-37; season-setup.mjs:403 `nobodyPublic`; `DRPG.Season.hint.nobodyPublic`). New: "Do not set the Mastermind to **- nobody -** ... The Season checklist warns you when the Mastermind feeds no pool (section 2)."
- s7.p4.f7 - old: "only a pool with nothing to spend refuses". New: "Only a pool with nothing to spend, or a receiver whose Hope is full, refuses" (despair.mjs:795-801, the comment of `convertDespairToHope`, and 883 `hopeAlreadyFull`).
- s7.p5.f12, f15 - old: "draws one effect ... for one time of day ... the effect covers the coming time of day". New: a state covers the coming time of day, a one-off (Rot, Earthquake) happens at once (overflow.mjs:830-835 `checkOverflow` runs `runOverflowEvent` at the draw; overflow.mjs `stampReading`/`overflowActive` comment "a one-off happened at the draw"; `DRPG.Overflow.gmHint` "a one-off happens at once").
- s7.r12.f2 - added "never its last point" (overflow.mjs:880, 918 `rotEverything`: an item on its last point is skipped, so a size above 1 never breaks one).
- s7.r10, s7.r11 - "your room actions" is now "the room's own actions, the ones you set in Room setup": Jitters and Power cut read the source "gm" (the room's own actions) against "project" (facilities.mjs:321-334 `facilityCost`, `facilityShut`; overflow.mjs:1060-1063 `jittersFor`, "a GM's room action"). Same rule, a name a GM reader cannot misread.
- s7.r2 - "search token" capitalized (EN7); "fuelled" -> "fueled" (EN1).
- The sizes in the Overflow table are config.mjs's defaults (OVERFLOW.effects `by: 1`); the sentence "The numbers below are the default sizes" is new, and the size column is named by its label **How much** (`DRPG.Overflow.amount`, overflow.mjs:1194).
- Checked and unchanged: pool cap 12 (config.mjs:310); threshold 20, range 6-60 (config.mjs:2582-2585); suggestion round(12 + living/2) held to the range (overflow.mjs:1153-1158); size 0-5 (overflow.mjs `BY_MAX`); Darkness to `ECLIPSE_MOVES` 2 (config.mjs:573, overflow.mjs:1107); Toll by 1, adds (config.mjs:2668); Confusion and Tinker 1 action + 1 Hope, Tinker 12 (config.mjs:3591-3610); Redeem +1 once a game day; Ghost Bet 4/3/2/1 (monocub.mjs:1881-1893); Bribe 1 Hope (config.mjs:2541); Fuel a Monocub 1 Despair for 1 Hope (config.mjs:2763-2766); Despair Calls shut in a Class Trial (calls.mjs:433); Panic stacks with Wounded, floor 1 (actions.mjs:39-73); Wounded costs a Monocub no action (actions.mjs:42-49).

## The rewrite, group E (GM 9)

| Fact | Old | New | Where in the code |
| --- | --- | --- | --- |
| s9.p36.f1, f44, f57, f75, f76 | the *Regional voice* setting, "regional voice on" | the setting **Separate voice in each room** | lang/en.json `DRPG.Settings.voiceEnabled.name`; scripts/settings.mjs registers `voiceEnabled` |
| s9.p36.f83-f87 | **Re-send everybody's voice room** (Diagnostics) | **Fix voice** in the GM panel's **Diagnostics** | scripts/gm-panel.mjs:332 (`labelKey: "DRPG.Panel.voiceReset"`), lang `DRPG.Panel.voiceReset` "Fix voice", `DRPG.Panel.section.fixes` "Diagnostics" |
| s9.p36.f69 | the listener's **Stop listening** | **Stop listening at** *room* on their voice tile | scripts/voice-tile.mjs:1170 (`DRPG.Listen.eavesdrop.stop` "Stop listening at {room}") |
| s9.r9 (Scenes row, last fact) | **Prepare the hall** | **Prepare the hall on Save** | scripts/trial-scene.mjs:1473 (`DRPG.TrialScene.prepareOnSave`) |
| s9.r1-s9.r8 (order) | tabs listed Rooms, Stashes, Doors, Passages, Searching, Facilities, Description, Fog | the window's order: Rooms, Doors, Passages, Searching, Facilities, Stashes, Description, Fog (no fact changed; the old order was flagged in e25-gm-report.md) | scripts/room-setup.mjs:377-391 `ROOM_SETUP_TABS` |
| s9.r3.f2, f3 | "which start the season locked (the reset copies the third column over the second)" | the two columns by their names, **Locked** and **Locked at start**, "the season reset copies the second column over the first" | lang `DRPG.Vault.lockedColumn`, `DRPG.Vault.lockedAtStartColumn` (and its hint "A season reset puts every door back to this.") |
| s9.r6.f16 | "a faint Subtle trace" | "a faint Subtle Remnant" (EN15; the glossary forbids "trace" in the handbooks) | scripts/config.mjs `FACILITIES.trace` `{ type: "neutral", visibility: "subtle", faint: true }` |
Numbers checked and kept: Search Tokens 3 per room, setting 0 to 10 (config.mjs:594 `ROOMS.searchTokensPerRoom`; settings.mjs:1518-1526 range); the Search answer's 5 s (config.mjs:379 `searchTokenAckMs: 5000`); the Refund's 5 s (movement.mjs:1299 `CROSSING_PRICE_MS = 5000`); the neighbor tolerance "about a third of a square" and "half a square" (movement.mjs:3819-3824 `pad = grid * 0.35`, `grid / 2`); room actions at most 8 with up to 4 effects, 1 action, the effect list and the three scopes (config.mjs:2240-2289 `FACILITIES`); the picture limits 4096 px and 8 MB (config.mjs:558 `ROOM_IMAGE_LIMITS`); Listen 14 (config.mjs:1738 `ACTIONS.listen.thresholds`); the eavesdrop block lifted 4 s later (eavesdrop-gm.mjs:54 `EAVESDROP_GRACE_MS = 4000`); Find Passage and Find Stash 16 (config.mjs:1620, 1626); the passage log's 200 rows (passages-gm.mjs:77 `PASSAGE_LOG_ROWS`); the wall audit's 1000 rows and half a minute (movement-audit.mjs:69 `AUDIT_ROWS_KEPT`, :29 `BURST_MS = 30_000`); the five links of `diagnoseVoice()` (diagnostics.mjs:1333); avclient-livekit 0.6.8 (voice-client.mjs:191, enforced.mjs:113).
Added from the items the plan names (each read against the code): the room tile paragraph (A8; room-tile.mjs header, the E25 gap in features.md A1), Room setup opened from the GM panel's **Between sessions** (gm-panel.mjs:285) by the red GM button, the walls and regions drawn with the scene controls in **Map tools** (A8; section 18), **Show the passage** by name (A10; `DRPG.Passage.show.button`), and the Mastermind's **Seal** on a passage into the lair (E91; `DRPG.Passage.list.seal`, its tooltip "Close this passage. Only a GM can open it again.", section 8).

## The rewrite, group F (GM 10-11)

- s10.p5.f7: the Tier 0 card's buttons were "Works, No effect and Refuse"; they are **Works - apply an effect**, **Works, no effect - use it up** and **It does not work** (use-items.mjs:607-609; lang/en.json:1111-1113 DRPG.Items.itemWorks/itemNoEffect/itemRefuse).
- s10.p5.f11, f12: "a Tamper trace", "a Preparation trace" -> "a Tamper Remnant", "a Prep Remnant" (config.mjs:1010-1011 and 1016-1019 REMNANT_TYPES labels; glossary `remnant`).
- s10.p7.f16: the editor's third tab was "Create an item"; it is **New item** (tables-editor.mjs:1650 DRPG.Tables.tabNewItem; "Create an item" is DRPG.Bridge.createItem, a bridge card's button).
- s10.p6.f22 and s11.r9.f4: Repair an item mends "a usable or a tool"; it mends a usable or any gear item, Murder Weapons and Cleaning Tools included (inventory.mjs:306-310 `repairable`: usable or `limitGroup === "gear"`).
- s10.p11.f20: the whisper was quoted as *somebody has been in your stash*; it reads *Something has been moved in your stash, and something is missing from it.* (stash-reach.mjs:637; lang/en.json:2803 DRPG.Vault.noticed). The sentence after it in the key ("You have no idea whose hands ...") is not quoted.
- s10.p11.f8: "once each time of day for each stash" is per reaching student and stash (stash-reach.mjs:364-366 `rifleKey` is thief, owner, scene, room); written "anybody ... once each time of day for each stash", unchanged in meaning, noted for the reviewer.
- s11.p6.f2: "five kinds" -> six: Repair the Lock is a preset too (passages-gm.mjs:446-455 `repairLock`; action-project.mjs:235-241; doors-gm.mjs:266-293). Added as table row s11.r10 with its offer, completion, Reroll (projects.mjs:1207-1229 `unrepairLock`) and the hand mend in the Broken column (room-setup.mjs:1041 `dropLockRepairs`, s11.p11).
- s11.p4.f5: "Progress rises only through Work on a project" contradicted the next sentence (Contribution, Patronage); rewritten as "A roll on Work on a project gives ...; besides the rolls, Contribution adds +1 ..." (config.mjs:1665-1669, 2376-2378, 2809-2815, 2693).
- s11.r14, s11.r15 (old rows "12", "18"): written as "12 to 17" and "18 or more" (config.mjs INDIRECT_MURDER.hideTraces thresholds, 2016-2021).
- s11.p11.f9: "four to five actions" in digits, "4 to 5" (T7), with how the card counts it, 2 progress a Work (murder-ui.mjs:897-907 `indirectCostText`; config.mjs:1666, 2007 aloneBonus).
- s12.n1.f2: the declaration card's buttons were "**Allow it** / **Refuse**"; the card offers "Allow: {stat}" on the killer's proposed statistic, "Change to: {stat}" on the other, "Refuse", or with no proposal "Allow: {stat}" per listed statistic (eclipse.mjs:633-676 `askGmToAllow`, `murderAllowChoices`; lang/en.json:1059-1060).
- s12.p3.f9, f11: End without advancing also puts back the Search Tokens, and its toast is quoted whole (clock.mjs:637-654 `takeBackBoundary`, snapshot.tokens; lang/en.json:4738 DRPG.Clock.takenBack).
- s12.p3.f5: the placement table's third button was "Close"; it is **Cancel** (boundary.mjs:217-221, `close: { role: "cancel" }`, the E21 rule that a withdrawn question says Cancel).
- s12.p2.f24: a Darkness draw also takes one off an ordinary Eclipse's 2, to 1 (overflow.mjs:1097-1108 `overflowCrossings`, config.mjs:2622-2625).
Added, true against the code and missing from the input:
- D091 (s10.p20): a Plant into full pockets does not go in; the item stays with the planter, who reads that the victim felt nothing; the victim is told nothing; the action stays spent (palm.mjs:209-212, 372-384, 861-911; lang DRPG.Steal.cardTheirHandsFull, cardUnfelt).
- Frisk (s10.p20): the target's 60 s to answer and the searcher's 30 s to decide on forcing (config.mjs:411-412 TIMING.friskAnswerMs, friskForceMs).
- s12.p10 and s12.p20: a Keep Watch takes its post as the Eclipse opens, the watcher is held to it, and the watch ends with a summary of how many entered and left (watch-gm.mjs:5-23, 96-150). features.md item 40 named it missing from GM.
- s12.p14: crossings a room action gave a student add to the Eclipse's 2 (eclipse.mjs:81-88 `eclipseAllowanceFor`, gm-stores `timedCrossingsOf`).
- s12.p18: a Morning Eclipse ended without advancing takes back the next day it opened on the boards, the morning line going back to the GM's draft (eclipse.mjs:466-474 `undoOpening`).
- s12.p15: no player is in voice in an Eclipse, the dead included (voice.mjs:1797-1809 `voiceClaim`: the Eclipse branch comes before any death rule).
- D071 (appendix-11): `game.drpg.setProjectMeta(countdownId, data)` (api.mjs:503; projects.mjs:2440-2451 `patchProjectMeta`).
- appendix-11: `TIMING.plantWindowMs` 120 s and `plantRequestMs` 5 s (config.mjs:380-384), the brief's "a planted item's 120 s" as an internal number.

## The rewrite, group G (GM 12-13)

| Fact id | Old | New | Code |
|---|---|---|---|
| s13.p21.f9, s13.p22.f8, f19, f20, f35, f36 | the after-incident screen's and the discovery window's button **A body is discovered** | **Body found** (its window's own button is Announce the body) - "A body is discovered" is the announcement card's title (`DRPG.Events.bodyTitle`, events.mjs:665) | murder-rules.mjs:3746 and chapter.mjs:2005 use `DRPG.Chapter.bodyTitle` "Body found"; chapter.mjs:2021 `DRPG.Chapter.announce` |
| s13.p2.f5 | the *indirect* checkbox | *A trap (the victim alone, losing double)* | `DRPG.Murder.indirect` |
| s13.p13.f1 | -3 while "a body of this chapter lies unfound" | "a body of this chapter that the roller knows of lies unfound" | cleanup.mjs:409-460 `freshSceneBonus` / `unfoundBodyIn` (a GM counts only the rows one of the roller's players may know) |
| s13.p16.f16, f18 | *You know this trace: it is on your sheet.* / *... of the trace you left.* | *You know this Remnant: it is on your sheet.* / *The new dice take back the Truth Bullet of the Remnant you left.* | `DRPG.Cleanup.authorsCopy`, `DRPG.Reroll.authorsCopyBack` |
| s13.p25.f3 | "That cannot be done now" | *That cannot be done now.* (with the full stop the key has) | `DRPG.Bridge.why.cannotNow` |
| (added, 13 p4) | - | a roller who closes the opening roll window is offered it 3 times in all, then the GMs are told and the tracker's re-ask asks again | config.mjs:435 `TIMING.openingAttempts` 3; murder-rules.mjs:4589-4627 `throwOpeningRoll`; `DRPG.Murder.openingDeclined` |
| (added, 13 p3) | - | the hindrance die "cannot be turned off" | `DRPG.RollDialog.forcedByHindrance`; watch-gm.mjs:41-46 `openingHindrance` |
| (added, 13 r12, r13, r14, p14) | only Use an Item named its failure cost | Self-Defense: a failure with Despair costs 1 extra; Survive: a failure costs 1 extra; Role Reversal: a failure with Despair costs 1 extra; "1 extra" is 1 more Health or Sanity | config.mjs `CRISIS_ACTIONS.selfDefence/survive/roleReversal.failureExtraDrain` ({despair:1} / 1 / {despair:1}); murder-rules.mjs:1873-1875 |
| (added, 13 p23) | - | a critical Misleading Trail or Move the Body gives back what paid | config.mjs `CLEANUP.actions.misleadingTrail/moveBody.refundStress.critical` 1; cleanup.mjs:2504-2508 (`handBack` of the paid step) |
| (added, 13 r33) | Success: free | free; a critical gives 1 Sanity back | config.mjs `CLEANUP.conceal.refundStress.critical` 1; cleanup.mjs:2091-2092 |
| all "trace(s)" | trace | Remnant (glossary `remnant`, forbidden "trace" in handbooks outside the five names) | docs/glossary.json entries[8] |
Checked and right as written: opening 8 Body/Hand, Night advantage, 20 Eye/Head with no night change, Key Remnants 5/4/3 and the floor 3, trap 5 (murder-rules.mjs:390, 701); drain 1/2 (`INCIDENT.drain`); Finishing Blow 5 x Health (`finishingBlowPerHp`); Defense cap 1 (`DEFENSE`, murder-rules.mjs:248-256); every crisis threshold and statistic list (`CRISIS_ACTIONS`); watch 18 (`INFILTRATE.keepWatch.hindranceAt`); re-ask 10 s (`TIMING.reaskCooldownMs`); erase DCs 9/12/15/18, minDc 8, warm -3, reshape 3 easier, 60/400 characters, quieter 1, refund 1 (`CLEANUP`); trail 15, Hidden Faint on a Hope failure; Move the Body 16, 1 per tool tier, `rooms` {hope 1, despair 1, critical 2} - read by cleanup.mjs:2623-2624 (`bodyReach`, `bodyLanding`), so the critical's 2 rooms are live, not the dead value e57-prep F5 found at 1.2.109; cover Shadow 16 and its 1/1/2 Sanity; Tamper's price (config.mjs:1471 `PRICE_CHAINS.tamper`, cleanup.mjs:1987-1994 `tamperPriceSkip`). `TAMPER` is not a config.mjs export; the Tamper tile is `ACTIONS.tamper` (config.mjs:1841), which carries no threshold by design. `murder-ui.mjs` `indirectCostText` (the trap card's "4 to 5" actions) is section 11's, not stated in 13.

## The rewrite, group H (GM 14-15)

- s14.r3.f4, f5 - old: Faint Remnants "cleared at chapter end unless tied to the murder". New: cleared when the GM ticks it in End the chapter, and only those neither tied to the murder nor reinforced. remnants.mjs:3338-3341 (`clearable`: faint, not reinforced, not tied), chapter.mjs:2433, 2322 (the `faint` option of End the chapter).
- s14.r6.f2 - old: a Broken item thrown away "while an incident runs or once this chapter's body is found, until its trial ends" leaves Tamper. New: thrown away by a student on a side of a running incident, during the Investigation, or once the chapter's body is found, until its trial ends. use-items.mjs:839-852 (`discardRemnantType`: the investigation or classTrial phase; a side of the running incident, `sideOf`; a body found); nothing is thrown away in a Class Trial, use-items.mjs:862.
- s14.r4, s14.r5 (no facts; the rows read "-") - now say what the kind is, from config.mjs TRUTH_BULLET_TYPES.prep.hint and .incident.hint (config.mjs:1105-1113).
- s14.p4.f2 - old: the Remnants tab shows the states as "undecided (-), Tied and Not tied". New: its **Tied to crime** column shows ?, Yes and No; the full words (Tied, Not tied) are the edit fields'. investigation.mjs:1830-1832 (TIE_OPTIONS, TIE_SHORT), 1961; lang/en.json DRPG.Remnant.crimeColumn, tieShortOpen/Tied/Untied.
- s14.p7.f20 - old: "Add a plan ... sets a column's order". New: a separate picker beside Add a plan sets it (`DRPG.CaseMap.sortLabel` "Order in a column", a title only). case-map.mjs:367-375.
- s14.p7.f32 - old: "what students other than the culprit hold". New: living students other than the culprit. case-schema.mjs:461, 476 (`reachability` keeps the living).
- s14.p8.f17 - old: the primary GM is asked once a chapter. Added the condition: only when the chapter has a case planned (a case-map row, or a Key slot not yet placed) and its realization has not run. case-realize.mjs:215-222 (`shouldAskAtBody`).
- s14.p8.f52 - the preset: added "and one while the chapter has none". investigation.mjs:2445-2450, case-schema.mjs `autopsyPresetOf`.
- s14.p8.f54 - added the condition: only a planned Autopsy with a name or words written goes out by itself. case-realize.mjs:246 (`autopsiesDue`: "with a name or words written").
- s14.p8.f57 - old: "send more by hand from the GM panel". New: the same window opens from the GM panel, the Investigation footer and the after-incident screen (merged with s14.p16.f1-f4). gm-panel.mjs:448, investigation.mjs:3245, murder-rules.mjs:3780 all call gm-items.mjs `issueAutopsyDialog`.
- s14.p14.f10, f12, f13 - old: the Analyze tile "always" offers the hint and Find Stash, and with no bullet "only those two remain". New: outside a Class Trial it also offers Find Passage (16, section 9.6), so three remain; in a Class Trial it offers only the bullets. action-analyze.mjs:46-50 (`ANALYZE_TRIAL_FILTER` shuts hint, stash and passage), 448-485 (the four rows), config.mjs:1626 (`passageThreshold: 16`).
- s14.p18.f28 - old: "`exportLedger()` and `importLedger()` are Back up and Restore". New (appendix): `backupCase()` and `restoreCase()` are, and the two old names are aliases. api.mjs:712-722; tools/api-surface.json alias rows.
- s14.p18.f1 - "the last copy's age" written as "the last backup's age", as the window says it (lang/en.json DRPG.Case.backupAgo, backupNever).
- Every other number checked and unchanged: OBSERVE_DC and ANALYZE_DC (config.mjs:1148-1153, 1318-1323), Neutral -> Prep and Final -> Key (OBSERVE_TYPE_ALIAS, config.mjs:1171), Autopsy as Neutral -> Key (ANALYZE_TYPE_ALIAS, config.mjs:1331), the secret project's 18 (PROJECT_OBSERVE.dc = OBSERVE_DC.hidden.prep, config.mjs:1221), the miss's 1 Sanity (OBSERVE_FAIL_STRESS, config.mjs:1240), hint 14 / 18 and Find Stash 16 (config.mjs:1603-1620), the trial's chain action / 1 Hope / 1 Sanity (PRICE_CHAINS.analyze, config.mjs:1463-1469, RESOLUTION_STRESS_COST 1), KEY_REMNANTS 5 / 3 / scale / 2-4 / bar 4 / 3 Despair (config.mjs:1360-1415), the opening's 5 / 4 / 3 (MURDER_OPENING.killer.keyRemnants, config.mjs:3679), `keyFeeOf` (investigation.mjs:646-672: living holders, the chapter found in, the bar the case's count where fewer), the reach rule past half (case-schema.mjs:463-492), Place at a random spot, reinforced and tied (investigation.mjs:1267-1282), Delete asks and refuses a reinforced one (investigation.mjs:3191-3206), Undo removes only what nobody found or Monokuma revealed (case-realize.mjs:157-178), the GM-online check before the price (action-analyze.mjs:121-133).

## The rewrite, group I (GM 16-18)

- s15.p12.f74. Old: "yours open here one after another, each saying whom it is for: +1 max Health, +1 max Sanity, +1 to a statistic, +1 to an experience, or a new experience at +2." New: "A Level Up offers three options: +1 to a statistic, +1 to an experience, or a new experience at +2; +1 Health and +1 Sanity are no longer options." The old list contradicted the same paragraph. scripts/config.mjs:3407-3411 (`LEVEL_UP_OPTIONS`: trait, experienceUp, experienceNew); scripts/level-up.mjs:850 ("They were options until 1.2.105"); the +2 is `STARTING.experienceValue`, config.mjs:316, read at level-up.mjs:880-886.
- s15.p12.f94. Old: "once per world, when you load the world". New: "once per world, when the primary GM loads the world". scripts/level-up.mjs:1440-1446 (`startDa39Migration` returns unless `isPrimaryGm()`).
- s15.p9.f16 (a condition the old text left out). New sentence: "A player who also plays a living student keeps their microphone." scripts/voice.mjs:1462 (the block goes to "every player whose every character is listed").
- Added, from the code: the dead's voice outside the trial (they talk with the Spectators, the living do not hear them; in the trial they are in the trial's one voice room): scripts/voice.mjs:946-952, 1819-1829. The modes table gets the three zone modes (who speaks, presents, objects; how long): scripts/trial-floor.mjs:95-108 (`MODE_RULES`), config.mjs:4388-4391. The text limits a GM is cut off at: the debate question 200 characters (config.mjs:4348, floor-machine.mjs:399, trial-floor-ui.mjs:343), a zone question 200 and each answer 80 (config.mjs:4391, zone-machine.mjs:151-153), a Scrum thesis 120 (config.mjs:4390), a Finding 240 (`answerLength * 3`, trial-zones.mjs:380, 393; trial-zones-ui.mjs:383).
- "a murder incident still open" -> "an incident still open" (s15.p9.f31-f33, s15.p11 Send's question): the running scene is the incident; **End the murder** stays as the button's label.
- Spelling (EN1): greyed -> grayed, colour -> color, recolours -> recolors, centre -> center. "as before" (the chapter ending from Edit campaign) and "as before 1.2.74" are version history: the first dropped as a pure repeat, the second in the appendix.
- Checked and true as written (no change): the debate 180 / at least 30 (config.mjs:4299, `debateMinSeconds` 30), 30 s to pick a bullet (4328), 60 + 120 s, the bar's 30 s and a Panic Round's 5 s, the 10 s note (4347), 270 minutes for 16 (4349), Testimony 60 (30-120) and Panic 15 (10 from 12, 10-15) (4360-4361), the Closing 30 / 300 / once / 30 s Pass window (4374), the zones 45 / 60 / 10 / 5 / 1-5 / Scrum 45, 120, 300, 20-40 (4388-4390), the Objection and Analyze price action, Hope, Sanity (config.mjs:1455-1468), the console 1280 px at 8 px (trial-floor-ui.mjs:1337-1344, 1621-1625), the sequences 3.4 s / 3.7 s / 1.5 s / 3 s (sequence.mjs:67, 71, 78) and 10 minutes late (sequence.mjs:91), the Level Ups 1 and 3 picks (config.mjs:3413-3416), the start 4 and 6 (config.mjs:305-306), the Monokuma pool 12 (`despairMax`). No Hope for the last voice of a Closing Argument: trial-modes.mjs:186 and floor-machine.mjs:116 ("no reward of any kind"); the section keeps "Nobody is paid Hope for the last word."

## The rewrite, group J (GM 19-20)

- s16.p4.f2: "reinforced traces" -> "Reinforced Remnants" (glossary `remnant`, EN15).
- s16.p7.f1-f3: one checkbox -> three boxes, the next chapter, the next session and the next morning (scripts/chapter.mjs:2327, 2332, 2335; DRPG.Chapter.optNextChapter, optNextSession, optNextMorning). Each box is now quoted by its label's start.
- s16.p7.f5: "search tokens" -> "Search Tokens" (EN7).
- s16.p2-p6: the boxes quoted by their labels (DRPG.Chapter.optReveal, optSweep, optFaint, optKeys, optEndTrial).
- s16.p9.f5: added to the cast row "the action budget, refilled, and each student's rests" - a group the old list left out (scripts/season-exceptions.mjs:59 `actions`; DRPG.Season.group.actions). The 30 groups and 5 sections checked: season-exceptions.mjs:36, 46-100. Hope back to 2: config.mjs:307 STARTING.hope, season-wipe.mjs:492. The clock group's readiness round and stopped End of chapter: season-wipe.mjs:684.
- s16.p9.f31: "the overflow" -> "the Overflow" (EN13); also in 17's World row.
- s17.p3.f3: the Play tab's reset named, **Stop the track** (DRPG.Music.reset).
- s17.r4.f1, s17.r5.f1: the catalog lacked 11 events of config.mjs SFX_EVENTS (5100 ff.): A wall is breached (World); Death fade, A Monocub interferes, Overrule, Straw Poll result, Logic Dive: right answer and wrong answer, Zone entered, An execution, The case summary, The trial ends (Incident). Added.
- s17.p9.f2: "a death is heard only by the GMs and the participants" -> plus "except the victim's player, who hears the death fade instead (the death's own sound while the death fade has no file)" (config.mjs SFX_EVENTS.death and .deathFade hints). s17.p9.f3: added that a body found is also heard by one player alone, once a body, when their student walks into a room where a body lies (SFX_EVENTS.bodyFound hint).
- s17.p4.f2: the order of states checked against scripts/music-states.mjs:97-174 (MUSIC_STATES), unchanged.
- s18.p1.f9 / s18.r*: checked against settings-window.mjs:75-80 (CLIENT_SECTIONS): **Pixel font** is named as a switch (Effects, Monokuma Legacy only: look.mjs:57-58); Technical is a GM's alone (settings-window.mjs:123-134).
- s18.r1.f6: "the glossary stays English" -> "game names such as Truth Bullet stay in English" (DRPG.Settings.language.hint).
- s18.p3.f30: "in the module's settings" -> "in the game's settings" (settings-window.mjs:92-93, GAME_SECTIONS `foundry`).
- s18 p5, p6: "colour" -> "color" throughout, "Colours" -> "Colors" (EN1, glossary `color`).
- s19.p1.f5: "spectator" -> "Spectator" (glossary `spectator`).
- s19.p6.f2: the old list named six things for seven questions ("consent to torture or romance"); torture and romance are two questions (DRPG.Note.q1-q7). Added "The first four are boundaries" (DRPG.Note.intro).
- s19 (new fact, the plan's F2-F5 "the safeword's 60 s"): "A player who presses again within a minute of the card posts nothing new; the card already up stands." (config.mjs:399 TIMING.safewordRepeatMs 60000; safeword.mjs:174-190, 318). The GM-side detail (a repeat's note shown but not kept again, safeword.mjs:95-106) is in the appendix.
- Numbers checked and kept: notices 150/250/40 (notice-history.mjs:131-137), stack 2/4 (popup.mjs:74, 335), safeword 3 s (config.mjs:407), SFX_VARIATION 0.14/0.5/0.18 (config.mjs:5009), interface scale 0.8-1.4 (settings.mjs:1856), Chapter 6 (chapter.mjs:2426 CHAPTERS_PER_SEASON), the Projects tray's five rows (projects-tray.mjs:403), the glass turn 1.2 s (MEASURE-numbers F3: glass.mjs `dur = 1200`; the player handbook says "about a second" for the same turn - the coordinator's to align).

## The rewrite, group K (GM 21)

- s20.r107.f2 (and f4): old "the panel's **Next time of day**"; new "the panel's **Skip the Eclipse**" - `DRPG.Panel.advance` = "Skip the Eclipse", scripts/gm-panel.mjs:1117 (the tile that runs boundary.mjs `nextTimeOfDay`, gm-panel.mjs:418-421). Section 3 (line 178) and 4 (line 219) of the handbook still say "Next time of day": not my sections, flag for their owners.
- s20.r107.f3: old "*Also refill* in Edit campaign"; new "**Also refill actions and Search Tokens** in **Edit campaign**" - `DRPG.Panel.alsoReset`, scripts/gm-campaign.mjs:182.
- s20.r117.f1: old 'the Doors tab's "starts locked" column'; new "the **Doors** tab's **Locked at start** column" - `DRPG.Vault.lockedAtStartColumn`, scripts/room-setup.mjs:269, 428.
- s20.r27.f1: old "its Copy button"; new "its **Copy to clipboard**" - `DRPG.Failures.copy`, scripts/gm-panel.mjs:736.
- s20.p2.f7: old 'say *GM only*'; new 'say *This part of the report can only run in a GM's browser.*' - `DRPG.Diagnose.gmOnly`, scripts/diagnostics.mjs:2165.
- s20.r109.f2: old "The button in the Play tab makes one"; new "**Create the “Situational” playlist** in the **Play** tab makes one" - `DRPG.Music.makeSituational`, scripts/sound-panel.mjs:174.
- s20.r111.f2: old "End the Class Trial from the console"; new "Press **End the trial** in the Class Trial console" - `DRPG.Floor.endTrial`, scripts/trial-floor-ui.mjs:585-588 (the handbook's own section 15, line 990, says the same).
- s20.r115.f2: old "Hope, Stress or Fear"; new "Hope, Sanity or Fear" - the module shows Daggerheart's Stress as Sanity (lang/en.json `DAGGERHEART.UI.Notifications.notEnoughStress` "You don't have enough Sanity"; the handbook names it Sanity elsewhere, e.g. line 248).
- s20.p4.f2: old '", red until a later stage" ... when a test is marked to fail'; new: the count ends with ", N red until a later stage" when tests marked so have failed as marked - scripts/tests.mjs:587 prints it only when the red count is not 0.
- s21.p2.f3 and f4: old "run **Pre-season checks** (no black-screen scenes, no readable sheets)"; new: the Season checklist's rows (the rooms row: no black-screen scene) and the further checks under them (no sheet a player can read) - since E101 Pre-season checks are drawn under the checklist's rows (scripts/season-setup.mjs:1368-1383 `fillMoreChecks`, 1497-1508 `preSessionReport`; handbook section 2, line 105); no button of that name opens them.
- s21.p4 (no fact id changed): "hat" kept, as the UI's word for the overflow's effects (`DRPG.Overflow.explainBody`, "draws one effect at random from the GM's hat"); written "the effects in the hat".

## The rewrite, group P1 (player 0-3)

- s1.p1.f5, f6: old "Your Ultimate is also a Hope Call: when it genuinely applies ..., it buys advantage" -> new "Your Ultimate also works through the **Talent** Hope Call (chapter 5): when it genuinely applies to your next roll and a GM approves, that roll gets advantage." scripts/config.mjs:2323-2327 (HOPE_CALLS.talent, choices experience/ultimate; the Ultimate Call is `inside: "talent"`, E72).
- s1.p5.f6, f8: old "a statistic, a maximum or Hope that nothing in play covers is put back at once ...; Health, Sanity or actions go to the GMs, who decide" -> new: holds with **Lock players' resources on the sheet** on (the default); a loss of Health, Sanity or actions stands, a gain nothing covers goes to the GMs; with it off such a change stands and the GMs can read it in their list. scripts/sheet-audit.mjs:27-39 (put back with the setting on; off "listed in `sheetWrites` and left standing"), :47-75 (a fall stands; gains flagged; off "listed instead"), :684-686 (default on); lang DRPG.Settings.lockPlayerResources.hint.
- s1.r15.f4: old "none in the Class Trial" -> new "in the Class Trial it costs you no action" (same rule, unambiguous). config.mjs:3376-3385 STATES.wounded.actionsLostIn ["dailyLife","investigation"]; actions.mjs:51-59.
- s1.p17.f13: old "Only if the GM switches this off is your look yours to set again" -> new "Only when the GM sets **Dice look for the table** to **Each player's own** is your look yours to set again." settings.mjs:1425-1434 (`diceLookChoice`: switch off = "own"), lang DRPG.Settings.forceDiceLook.choices. Added (features.md B2, E108): "With **Everyone: Daggerheart**, your Hope, Despair, advantage and disadvantage dice wear Daggerheart's own colors." dice-look.mjs:144-145 (`DAGGERHEART_DICE` hope, fear, advantage, disadvantage).
- s1.p19.f7-f9: old "**Talk with the Spectators** ... and **Go back to your room** brings you back. If the GM turned the voice tile off, that button is not there" -> one button with two labels: "the same button, now **Go back to your room**, brings you back; if the GM turned the voice tile off, the button is not there." voice-tile.mjs:1099-1130.
- s1.p19.f13: old "At the day's end you see only the end of the day and the school's mood" -> "the end-of-day board shows you only its heading and the school's mood". sequence.mjs:1062 ("a Spectator's browser shows the heading and the mood alone", `dayEndBoardFor`).
- s2.p8 (added, f3-f4's exception): "when the end-of-day board plays (below), the Evening's summary is part of it." day-summary.mjs:128-136 (`eveningFoldsIntoBoard`), sequence.mjs:1056-1061.
- s2.p17: added when it plays: "when Night falls or a chapter ends" (it plays at Evening to Night, not at Night's end). transitions.mjs:140-154 (`boardsOf`), sequence.mjs:1056-1058.
- s2.p18: added "when a new day begins". transitions.mjs:146-150.
- s2.p12.f4 (added condition): with the switch off "the trial's and the verdict's sounds still play then"; the switch named by its glossary/lang name **Full-screen sequences**. sequence.mjs:27-28, lang DRPG.Settings.sequences.hint.
- s2.p12.f5 and s2.p19.f1: old "If you join or reload within 10 minutes of one, it plays for you once." + "If you join after one of these moments, you miss it." -> new "If you join or reload within 10 minutes of the Class Trial's entry, the verdict or the start-of-day board, the newest of them that you have not seen plays for you once. Any other moment you join after, you miss." sequence.mjs:12-20 (only those three; the end-of-day board, the curtain's turn and the flicker play nothing late), :91 LATE_PLAY_MS 10 min, :1128-1146 (`lateSequence`: newest, unplayed).
- s3.p6.f6: added "a murder while it runs" to what still turns you back at a passage. passages-gm.mjs:2266 ("the character is held in the incident"); gm-handbook.en.md:595 lists a running incident.
- s3.p6 (added, E57 A10): "The Mastermind knows every secret passage." passages-gm.mjs:114-120 (`isMastermindActor`, the owner's Q7).
- s3.p18.f7: "When the GM's answer to your Search comes too late" -> "A Search that is not confirmed in time says *The search was not counted.*" (the player's view; the 5 s answer in the appendix). action-search.mjs:98-101, 129-130; config.mjs:379 TIMING.searchTokenAckMs 5000; search-tokens.mjs:786-809 (the late answer's token given back).
- Numbers checked and unchanged: TRAITS labels/shorts/hints config.mjs:283-290; spread :298; STARTING :304-322 (4, 6, 2/6, 2 actions, 2 experiences at +2, Tier 2 item); CRITICAL hope 2, clearsStress false :1260-1263; TIMES_OF_DAY :333; CHAPTERS_PER_SEASON 6 :356; ECLIPSE_MOVES 2 :573; ECLIPSE_FREE_PLACEMENT ["night"] :590; search tokens default 3 (:594) and range 0-10 (settings.mjs:1518-1526); half a second = roll-draw.mjs:394 DRAW_SIGN_MS 600; Sprint/Burst/Behind Closed Doors/Chained/crisis action names config.mjs:2424, 2447, 2715, 2748, 3990, 4134, 4181, 4269. "about a second and a half late" (room tile) is a measurement with no constant (MEASURE-numbers), kept as written, in the appendix.

## The rewrite, group P2 (player 4-6)

Corrected:
- s4.p22.f1 "Kind offers five besides a project of your own" -> "six", with a sixth row **Repair the Lock** (Hand, Trivial 3: a lock that Force the Door or a breach broke, on a door of the room you stand in; finished, the lock holds again for everyone). scripts/passages-gm.mjs:446-455 (PASSAGE_PRESETS.repairLock), scripts/action-project.mjs:236-241 (offered where a door of the room has a forced lock), lang DRPG.Project.preset.repairLock and DRPG.Project.repairLockNote. The bullet's lead became "Projects that change a wall, a lock or an item."
- s4.p23.f3 / f5: the re-check and the Reroll take-back now name the lock too ("a seal or a lock's repair"): doors-gm.mjs:243-248 (header: "Judged at the approval and again at the completion ... taken back (a Reroll), it is broken again"), doors-gm.mjs:287 `unrepairLock`.
- s4.p39.f9 "It is loud: the rooms next to either room hear ..." read as always; the code makes it loud only on a success and on a miss with Despair (doors-gm.mjs:174-181, `loud = forced || !withHope`). New text: "A success, and a miss with Despair, is loud: ...".
- s4.p46.f5 "within a minute" -> "within 60 seconds" (config.mjs:411 TIMING.friskAnswerMs 60000; lang DRPG.Frisk.askClock).
- s4.p2.f15 the Palm example title "*Palm - Hand, beat 10*" -> "*Palm - Hand, beat 12*": 10 is the unseen Frisk's hand, a take is 12 (config.mjs:1804 ACTIONS.palm.threshold 12; palm.mjs:51-67). Not false before, but read as a take.
- s4.p13 (Ask for a hint): the hint is not offered in a Class Trial either (config.mjs ACTIONS.analyze.hint "In a Class Trial you can only identify one"; player handbook 12, line 773). Now one sentence for all three, 04 p18.
- s4.p47.f3 "never Sanity" holds for everyone but the killer's own clean-up, which pays 1 Sanity (cleanup.mjs:1987-1994 `tamperPriceSkip`; config.mjs PRICE_CHAINS.tamper 1471-1476; chapter 10 says so at line 713). Added the pointer "The killer's own clean-up after a murder is priced in Sanity instead (chapter 10)." (O13).
Added (true in the code, missing from the text; one clause each):
- Shut the Door: the Body roll is the barricade's strength (doors-gm.mjs:103-105) and a tie holds against a force (doors-gm.mjs:21, 164 `sum > holds.barricade`); it leaves a Faint, Subtle Remnant (doors-gm.mjs:107, 448).
- Force the Door: each attempt at a held door leaves a Remnant, Evident when loud, Subtle otherwise (doors-gm.mjs:183-184); a forced lock is repaired by Repair the Lock (pointer).
- Pick the Lock: a critical opens too (doors-gm.mjs:211); its Remnant by band - Hidden at 18+ or a critical, Subtle below 18 or on a miss with Hope, Evident on a miss with Despair (doors-gm.mjs:455-459 `pickTrace`).
- Frisk: the force is decided within 30 seconds (config.mjs:412 TIMING.friskForceMs 30000; lang DRPG.Frisk.forceText "You have {s} seconds to decide"); an open ask is once per student each time of day, a second ask gives the action back (frisk.mjs:783, 452 FRISK_REFUNDED; lang DRPG.Frisk.askedAlready). The cost "1 action" moved to the paragraph's first sentence (M3).
- Echoes: not in an incident or a Class Trial either; the card names the room even one you have never been in (echoes-gm.mjs:15-19).
- Listening at the door also ends when you die (eavesdrop-gm.mjs:20-22).
- Misleading Trail: a critical gives back what the attempt cost (config.mjs:4746-4755 CLEANUP.actions.misleadingTrail.refundStress.critical 1; cleanup.mjs:2504-2507).
- Tamper's cover roll: a critical gives back 1 Sanity (config.mjs:4813-4823 CLEANUP.conceal.refundStress.critical 1; cleanup.mjs:2091-2092). See (c).
- Direct Murder: "unless another killing opened one first" (config.mjs ACTIONS.directMurder.description).
- Wounded: "1 in Daily Life and the Investigation" kept as the code runs it (config.mjs STATES.wounded.actionsLostIn ["dailyLife", "investigation"]; actions.mjs:39-72); the Class Trial does not take the action, which the wording already implies.
Checked and unchanged (M1): Search 8/12/18, critical +1 tier, a missed critical Tier 1 (action-search.mjs:83-89); Observe miss 1 Sanity (OBSERVE_FAIL_STRESS), secret project 18 (PROJECT_OBSERVE = OBSERVE_DC.hidden.prep); Analyze 14/18, Find Stash 16, Find Passage 16 (ACTIONS.analyze); Projects 12/18, critical +2 and the action back, scales 3/4/6/8 (PROJECT_SCALE), description 1000 (PROJECT_DESCRIPTION_MAX); Sabotage 2/6/8, cover 16 (ACTIONS.sabotage.simpleRepair, SABOTAGE_CONCEAL); presets' statistics and sizes (PASSAGE_PRESETS); Dynamic 8/13/16/19, tiers, Remnants (DYNAMIC_THRESHOLDS), "You keep your action" (lang DRPG.Action.dynamicRefused); Rest costs, picks, frequency, options (REST); Listen 14/18; Tail Shadow 15, two seconds (crossing-settle.mjs:26 SETTLE_MS 2000); Dash 12/18/critical 2/3/4; Shut maxExits 2; Force lockDc 18; Pick dc 15, clean 18, cover 16; Keep Watch dc 12, hindranceAt 18, Despair miss 1 Sanity (watch-gm.mjs:19-20); Palm 12/8/10 and 15/13/15, Frisk Body 12 (ACTIONS.palm); Tamper DCs 9/12/15/18, minDc 8, fresh 3, reshape 3, limits 60/400, trail 15, cover 16 and its 1/1/2 Sanity (CLEANUP).

## The rewrite, group P3 (player 7-9)

- s5.r1.f2: "Give another player advantage on one roll" -> "Give another student in your room advantage on their next roll", and added "A student who already holds an unused Support cannot get another, and you keep your Hope." - config.mjs:2312-2316 (HOPE_CALLS.support.effect).
- s5.r2.f4: "the experience adds its level" -> "adds its value" - config.mjs:2335-2336 (HOPE_CALLS.experience.effect, "adds the value of one experience").
- s5.r3.f2: "a project being worked on in the room you are in" -> "a project in your room that is not finished or frozen, with no action and no Work roll" - config.mjs:2376-2379.
- s5.r7: added "a crossing or a Long Rest included" - config.mjs:2459-2460 (HOPE_CALLS.burst.effect).
- s5.r8: added "in any room" and "Back out of choosing what to restore, and the Hope you paid comes back." - config.mjs:2500-2502 (HOPE_CALLS.relief.effect).
- s5.p2 (new sentence): "A roll that only goes with an action, such as Palm's roll to stay unseen, an opening roll or a roll to conceal your intent, spends none." - roll-draw.mjs:1808-1811 and 1848-1851 (`remember: false` rolls, `SPENDS_NO_CALL`).
- s6.p2 (new sentence): the darkenings' sizes are defaults the GM may tune (0-5) - overflow.mjs:74-81, 126-134 (`BY_MAX`, `setOverflowRules`).
- s6.r17.f2: "a free-placement Eclipse is pulled back to two rooms" -> "is held to the usual 2 crossings" - overflow.mjs:1101-1106, config.mjs:573 (`ECLIPSE_MOVES` 2 is a count of crossings).
- s6.p3.f1-f2: added "1 Eclipse crossing" to the floors - overflow.mjs:1107 (`floor ?? 1`), config darkness `floor: 1`.
- s7.n2.f8: a Cleaning Tool on Move the Body takes its tier off the threshold and gives no advantage - cleanup.mjs:2338-2342 (`key !== "moveBody"`).
- s7.p7.f2: "only Analyze's Find Stash at 16+" -> "at 16+ or a critical" - stash-reach.mjs:728, config.mjs:1620.
- s8.p1.f3: "taking a weapon" -> "a Search that turns up a Murder Weapon or a Cleaning Tool" - config.mjs:1539 (`ACTIONS.search.leavesRemnant.onlyFor`).
- s8.r5.f3: "the one a Search for a tool, a Sabotage or a Misleading Trail leaves" -> "among them the Prep Remnant left by a Search that turns up a Murder Weapon or a Cleaning Tool, a Sabotage, a Dynamic Action, work on a murder project or a failed Misleading Trail, and the Tamper Remnant a clean-up leaves" - config.mjs:1539, 1930 (Sabotage), 4591-4593 (clean-up outcomes), action-dynamic.mjs:148, action-project.mjs:785, cleanup.mjs:2547 (a Misleading Trail's Remnant is Faint only on a failure).
- s9.p2 (new sentence): "a success with Despair also gives the project +1 progress" - config.mjs:2003, action-project.mjs:722-728.
- s9.p2.f8: "Alone, the project simply gains +1" -> "Alone, you roll nothing for this, and the project gains +1" - action-project.mjs:712-748.
- s9.p3.f2: "searching" -> "a successful Search there"; the stash and passage hunts "hit or miss" - config.mjs:3234-3235, 3283-3284, 3293-3294 (TRAP_TRIGGERS hints).
- Style, not fact: s6.r2.f3 "Yes, sometimes he helps" -> "Sometimes Monokuma helps" (EN4); "trace" -> "Remnant" in 05 p2 (EN15); "greyed" -> "grayed", "favour" -> "favor", "search token" -> "Search Token", "overflow" -> "Overflow", "indirect murder" -> "Indirect Murder" (EN1, EN7, EN13, EN6); the hands-full item's rhetorical question made a statement (X21) and "simply" dropped (X10); the Tip now points to "section 10".
Checked and left as they were: every Hope Call cost (config.mjs:2311-2577), Hope max 6 and +2 on a critical (config.mjs:304-308, 1260), every Despair Call cost and amount (config.mjs:2705-2940), pool 12, Overflow 20 (6-60) and its 13 effects (config.mjs:2580-2700), the one darkening drawn (overflow.mjs:807), Rot and Earthquake (overflow.mjs:880-958), the one-minute hindering grace (config.mjs:4864), tiers, durability and single use (config.mjs:604-633, use-items.mjs:175-179), carry limits 3/2/1 and stash 3 (config.mjs:652-960), throwing away only a broken item (lang `DRPG.Items.discardOnlyBroken`), the Observe and Analyze ladders cell by cell (config.mjs:1148-1152, 1318-1322), Indirect Murder parts, 7-10, Shadow 16, alone +1, Hide the Traces 12/18/critical (config.mjs:1996-2024, 3040-3046), trap triggers and modifiers (config.mjs:3212-3335), the Loaded Die only on an action roll (roll-dialog.mjs:977-992).
Plan items checked here: the trap card's "four to five" actions (F2) is in the GMs' Murder window (murder-ui.mjs:242, opened from the GM panel), so it is not added to the player text; the planted item's 120 s (TIMING.plantWindowMs) goes to the appendix as an internal number; Wounded (D21) appears only as "on top of Wounded" in the Panic row, which holds; "murder" (the act, the murder plan) and "incident" (the running scene, in Holding ready) are used as the code does.

## The rewrite, group P4 (player 10-12)

Corrected:
- s10.r11.f3 Self-Defense "One attempt." -> "A hit spends it and a miss does not". applyUnlocks marks it spent only on a
  hit that opens something and is called only on a success: scripts/murder-rules.mjs:1821-1834 and 2630-2634.
- s10.r11.f8 "An item usable as a weapon gives advantage" -> "A weapon in hand gives advantage": murder-rules.mjs:201
  (`hasWeapon` = `equippedWeapon`, 1348); config.mjs:3941 `weaponAdvantage`.
- s10.r13 (added) Role Reversal also has weapon advantage: config.mjs:4018 `weaponAdvantage: true`, murder-rules.mjs:201.
- s10.r14.f4 Use an Item "a success with Despair leaves a trace and nothing else" -> "a hit with Despair does not use
  it. Every hit leaves a Remnant", and a critical keeps the turn: config.mjs:3831 (hint), useItem.remnant and
  criticalKeepsTurn (config.mjs:3839).
- s10.r18.f4/f5 "Unarmed: disadvantage, and a success snatches an improvised weapon" -> "With no weapon in hand you roll
  at disadvantage, and if you carry none at all, a hit snatches an improvised weapon": murder-rules.mjs:1374
  (`carriesWeapon`), 1819 (`wasUnarmed`); config.mjs:4102.
- s10.r18.f6 improvised weapon: Tier 2 on a critical too: config.mjs:4128 `unarmedImprovises { hope: 2, despair: 1,
  critical: 2 }`. Tier 0 rated "from 0 to 2": config.mjs:4119 `tierZeroNegotiable { min: 0, max: 2 }`.
- s10.r21.f1 "the Tamper table, chapter 4" -> "section 4" (the handbook's own numbering).
- s10.p17.f2 *You know this trace: it is on your sheet.* -> *You know this Remnant: it is on your sheet.*:
  lang/en.json:2369 `DRPG.Cleanup.authorsCopy`.
- s10.r25.f3/f4 Escape Together: a critical restores the victim too, and the immunity is "you both": config.mjs:4190
  (`sharedEscape.critical`) and the hint ("a critical gives you and the victim immunity"); `restores` kept as the
  note says (the GM applies it).
- s10.r19.f2 "five times" -> "5 times" (T7; INCIDENT.finishingBlowPerHp 5). s10.r16.f2/s10.r17.f2 "two turns" -> "2 turns"
  (T7; config.mjs:4081, 4093 `hinders.turns: 2`).
Added (rules the code runs that the section did not state):
- Key Remnants per opening band: Hope 5, Despair 4, critical 3 (config.mjs:3679, murder-rules.mjs:701); a trap's case
  keeps the prepared 5 (murder-rules.mjs:390, 833 writes no keyRemnants) - 10 r2-r4, 11 p3.
- A failed Direct Murder opening: the action is spent and can be tried again in another time of day (config.mjs:3684) - 10 r1.
- A trap noticed with Despair: the project behind it stays active (config.mjs:3742) - 10 r6.
- The opening cannot be skipped: its window opens again, up to 3 times, then the GM is told (TIMING.openingAttempts,
  config.mjs:435; murder-rules.mjs:4589-4625; DRPG.Murder.openingRequired) - 10 p4 (the brief's F2-F5 item).
- A victim's watch of 18+ or a critical puts a hindrance die on the killer's opening: a pointer to section 4's Keep Watch
  (murder-rules.mjs `rollOpening` hindrance) - 10 p6.
- With no proposal the GM picks and the killer is told to say in their thread how (DRPG.TraitRuling.openingKiller,
  murder-rules.mjs:4448) - 10 p6; the trap victim's line is DRPG.TraitRuling.openingVictim.
- The Remnants of each crisis action: Strike Hidden/Subtle, none on a critical (config.mjs:4067); Pin Them Down and Keep
  Your Distance: a critical blocks both, Despair hit Subtle, Despair miss Evident (config.mjs pin/keepDistance,
  murder-rules.mjs `applyHindrance` `blocked` store); the crisis action with a weapon: the weapon's Remnants tied to the crime,
  Despair hit Subtle; Finishing Blow: Despair hit Evident (config.mjs:4148); Self-Defense: Evident hit or miss
  (config.mjs:3987); Self-Defense critical keeps the turn (config.mjs:3967); Role Reversal critical leaves an Incident
  Remnant (Evident, Reinforced); Double Role Reversal: Evident, the old killer cannot take Role Reversal
  (murder-rules.mjs:2719), the third takes the killers' turns (config.mjs:4233 `alsoTakesThird`); Partners in Crime:
  Subtle, the victim loses Role Reversal (config.mjs:4254).
- Take from the Body's bands named by visibility: under 12 Evident, 12-17 Subtle, 18+ or a critical Hidden (config.mjs:4838
  LOOT; handover.mjs:647 `lootVisibilityOf`) - 11 p5.
- Move the Body: never into or through a bedroom (cleanup.mjs:3509 `bodyReach`) - 10 r24. The critical's 2 rooms are
  read (cleanup.mjs:2622-2624 `bodyLanding` with `def.rooms`), so the handbook's "two away, only a critical" is right.
Rephrased, same fact: "as the GMs' side reads it, which can count somebody your screen does not show" -> "even somebody
your screen does not show" (s11.p4.f12).

## The rewrite, group P5 (player 13-14)

- s12.p7.f13 / f14: old "*No GM has your vote yet* means your browser keeps it and sends it when a GM connects"; new "means it goes out as soon as a GM connects" - the label's text now (lang/en.json `DRPG.Vote.notReceived` "No GM has your vote yet. It goes out as soon as a GM connects."); the browser keeping it is in the appendix.
- s12.p6.f13 / f14: old "the GM confirms one of the volunteers or picks someone"; new "One of the volunteers is drawn, and the GM confirms them or picks someone else" - scripts/config.mjs:4366-4374 (`TRIAL.modes.closing`: "a draw among the volunteers that the GM confirms or changes").
- Added (12 p9): the speaker's **Pass** in the first 30 seconds hands the choice back to the GM, later it ends the Closing Argument as **Done** does - config.mjs:4371-4374 `passWindowSeconds: 30`, floor-machine.mjs:168, lang `DRPG.Trial.turn.closingPassEarly`, `closingPass`; the volunteer window's **Not me** (`DRPG.Trial.claim.no`).
- Added (12 p9): the Closing Argument pays no Hope to whoever speaks last - config.mjs:4364-4369 (amend 7 of 14.10, the plan's item).
- Added (12 p1): Wounded takes no action in the trial - config.mjs:3372-3385 `STATES.wounded.actionsLostIn: ["dailyLife", "investigation"]`, actions.mjs:51-59 (D21 item; section 1 already says "none in the Class Trial").
- Added (12 p4): nobody objects in open discussion - trial-floor.mjs:228 (`modeAllows` with no floor answers only speak and present).
- Added (12 r1-r6, columns 4-5): who may object and who presents in each mode, read from trial-floor.mjs:95-108 `MODE_RULES` (an Objection presents for everyone; Rebuttal objection only at the pair; Testimony, Panic Round, Closing present: holder; Closing exchange: the pair, trial-floor.mjs:233-236).
- Added (13 p2): a GM's **Silence now** also sends a dead student's voice to the Spectators - voice.mjs:1228-1229 `deathVoiceGone` (`state.silencedDead`); said as "or a GM moves your voice".
- s13.p15.f4: old "One ask at a time"; new "One ask at a time: you can ask again once a GM has answered, or at the next time of day" - monocub.mjs:727-741 `askStillOpen` (the open mark lasts its time of day), 1537-1555 `answerHopeAsk` (cleared on either answer).
- Added (13 p21): Confusion, Tinker, Redeem and Ask for Hope are closed in an Eclipse and in a Class Trial; Ghost Bet is not - config.mjs:3498, 3556, 3575, 3597 (`locks: ["eclipse", "classTrial"]`), 3620 (`bet.locks: ["betWindow"]`), monocub.mjs:703-707 `CUB_LOCKS`.
- s13.p7.f4: "the Faint traces" -> "the Faint Remnants" (glossary `remnant`: lowercase "trace" is forbidden in the handbooks; EN15).
- s12.p13.f7: "simply" dropped (X10); s13.p18.f1 "favour" -> "favor", s13.p4.f6 "greyed" -> "grayed" (EN1); s12.p4.f11 "greyed" -> "grayed".
- s12.p11.f2: "before this rule" -> "when those were options" (the rule's history, E64 C6, in the appendix).
- 13 p4: the Take's roll is not repeated; a pointer to section 11, where the Hand roll, the Shadow cover and the Remnant are (player-handbook.en.md:762; lang `DRPG.Loot.brief`, `takeTooltip`). Checked: one Hand roll, no action, Shadow 16 with others in the room.
Checked and found right (M1), kept: debate 180 s (config.mjs:4299), Objection 60 / Rebuttal 120 (4318-4319), pick 30 s (4328), Testimony 60, 30-120 and Panic 15 / 10 from 12 (4360-4361), Closing 30 / 300 / once (4374), a second of speech (4400 `speakerMs: 1000`), Analyze's and an Objection's price action - Hope - Sanity (config.mjs:1455-1470, `RESOLUTION_STRESS_COST` 1 at 1453), Level Up picks 1 and 3 (3413-3416, `reinforced` 3415), new experience +2 (`STARTING.experienceValue` 316, level-up.mjs:880-884), the stat rises (3426-3430), wrong verdict: Despair filled and a new rule (4427-4434), voting for self, Monokuma and the dead (4411-4413), no ballot for the dead (4424 `deadCastBallots: false`), Monocub 0 Hope and the budget (actions.mjs:49), Confusion 1 action + 1 Hope, 11/16, caps 1 a time of day and 2 a day (config.mjs:3484-3540 `MONOCUB.abilities.meddle`), Tinker 12 (3604), a move to order costs its action only (`executionCost` 3506, 3603), Ghost Bet 4/3/2/1/0 (monocub.mjs:1881-1893), Ask for Hope 1 or 2 (monocub.mjs:1527), the dead's voice (voice.mjs:1205-1230, 946-952), the trial's microphone block and the Monocub's lines (voice.mjs:1290-1340, 1488-1518, 1558-1567, 1646-1710).

## The rewrite, group P6 (player 15-16)

- s15.p1.f11: old "from which room, when it was pressed on a sheet"; new "and, when the game knows where your character stands, from which room". The key in Foundry's Controls and `game.drpg.safeword()` now pass the user's own character too (E22 C5d): safeword.mjs:366-383 `callerStudent`, :420-433, api.mjs:838.
- s16.p1.f11: old "it shows only the mode (Discussion, Debate, Objection or Rebuttal)"; new: the mode in place of the time of day, one of Discussion, Debate, Objection, Rebuttal, Testimony, Panic Round, Closing Argument, Straw Poll, Logic Dive or Scrum Debate, with a pointer to section 12; "only" dropped because the row can also carry the Objection button, the dead's line and a Scrum camp's line. hud.mjs:1140-1170 `trialSlotFace`, :1190-1226, lang/en.json `DRPG.Hud.trial.*`.
- s16.p5.f3, f4, f6: old "a foot for each crossing left, or, in a placement where you may pick any room, one full foot that stays available ... A Monocub's feet are always solid"; new: the Move row is always two feet, the first the Free Move (solid while there), the second the Eclipse's (dimmed outside one); in an Eclipse the first solid with one crossing left, the second with two, a Call's third shows as two with the number on pointing; free placement both solid; a Monocub's first foot always solid, both in an Eclipse. sheet.mjs:1670-1701 `moveSlots`, :1704-1706; player-status.mjs:378-385, :470-510.
- s16.p8.f1, f4: old order "the clock, the room tile, the Despair rows, the Event panel, your status strip and the Projects tray ... status strip and the Projects tray come first, before the Despair rows"; new: the clock, the room tile with the voice tile on its right, your status strip and the Projects tray, the Despair rows, the Event panel. styles/narrow.css:110-121, narrow.mjs:54-66.
- s16.p20.f2: old "under Stained Glass glass pulse, state name behind the clock and glass blurs the map" (all three after Interface scale); new: **State name behind the clock** in Look, **Glass pulse** and **Glass blurs the map** in Effects and accessibility, each Stained Glass only. settings-window.mjs:82-87 `CLIENT_SECTIONS`, look.mjs:56-60 `themeOnlyKeys`.
- s14.p3.f9 / s16.n1.f5 (murder versus incident): "During a killing" and "a murder's fight" are the running scene, so "While an incident runs" and "A roll in an incident" (messenger.mjs:373, secret.mjs `cardWriter`; private-rolls.mjs `relayIncidentDice`).

## The fix pass, the brochure

- Tamper cover-roll Sanity: "1 on Despair, 1-2 if you are caught" -> 1 on a success with Despair or a failure, 2 on a failure with Despair (handbook 04.md Tamper warning).
- Incident drain: now gives the numbers, 1 Sanity per turn from the second on, 2 alone with a trap (handbook 10.md WARNING).
- Self-Defense: "unlocks Survive and Role Reversal" -> "a hit opens Role Reversal, with Hope Survive too" (handbook 10.md:56: Despair opens Role Reversal only).
- Escape Together is not free (above).

## The fix pass, GM 7-9

None changed in meaning. Pointers corrected: breach -> 11.3 (11.md "### 11.3 A breach"); Role column -> section 3; section 1 -> 1.6.

## The fix pass, the other groups

Their reports were returned as messages, not files; their corrections are in b2362972 and 2cdd9a25 and were not listed one by one here.
