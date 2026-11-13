# Handbook numbers against the code

Commit 421f2395 (origin/main, module 1.2.109). Date 12.11.2026. Read-only: nothing in the repository was changed.

Handbooks: docs/handbooks/{gm-handbook,player-handbook,player-brochure}.{en,pl}.md. Source of truth: scripts/config.mjs, then the script that applies a value.

## Disagreements

| # | Handbook file:line (EN) | PL file:line | What the handbook says | Code file:line | What the code says | How you read the code (one line) |
|---|---|---|---|---|---|---|
| 1 | gm-handbook.en.md:686 | gm-handbook.pl.md:686 | The trap card "advises about 7-10 progress in total ... four to six actions" ("cztery do sześciu akcji") | scripts/murder-ui.mjs:884-895 (comment 878-882), lang/en.json:2152 | The card prints "roughly {fewest} to {actions}" with fewest = 4, most = 5 | `indirectCostText`: per Work = lowest project band (config.mjs:1637, +1) + `concealIntent.aloneBonus` (config.mjs:1941, +1) = 2; parts 4+3 -> ceil(4/2)+ceil(3/2) = 4, parts 6+4 -> 3+2 = 5. The code comment says the old "four to six" was replaced by "4 to 5" in E66 C4; the handbook kept the old pair. Certain. |
| 2 | player-brochure.en.md:69 | player-brochure.pl.md:69 | A trap's roll is "Eye vs 20" ("Eye przeciw 20") | scripts/config.mjs:3348-3349 | `MURDER_OPENING.victim`: threshold 20, traits ["eye", "head"] | The 20 agrees; the statistic list does not: Eye or Head, the GM picks (player-handbook.en.md:602 and gm-handbook.en.md:762 say Eye or Head). Unsure whether to count it: a statistic, not a number. Settled by deciding whether the brochure's short form is meant to drop Head. |
| 3 | player-handbook.en.md:869 | player-handbook.pl.md:869 | Under Stained Glass the new colour "arrives from the middle within about a second" | styles/motion.css:74, scripts/glass.mjs:3618-3619, 3845 (`dur = 1200`) | 1200 ms; gm-handbook.en.md:1133 says "about 1.2 seconds" for the same turn | Unsure: rounding, not a wrong number. The two handbooks give 1 s and 1.2 s for one animation. Settled by choosing one wording. |

No other handbook number was found to disagree with the code. Row 1 is the only certain disagreement.

## EN and PL differ

Method: every line pair of the three EN/PL handbook pairs (1385 + 882 + 78 lines) was compared mechanically for its digits (links and code spans stripped, decimal comma normalised), then for number words (EN two..fifty, twice; PL dwa/dwie/trzy/.../pięćdziesiąt with their case forms). Digits differ on 2 lines; number words on 33 lines, all of them Polish grammar ("oba", "obu", a dropped "one"), 5 checked by eye. No line gives a different rule number in the two languages.

| # | EN file:line | PL file:line | EN | PL | Note |
|---|---|---|---|---|---|
| 1 | gm-handbook.en.md:1095 | gm-handbook.pl.md:1095 | "in the gear's settings window (section 18)", "`SFX_VARIATION`: rate ±14%" | "w oknie Ustawień" (no section number), "tempo w granicach 14%" | A cross-reference dropped in PL; not a rule number. The ± sign is EN only. Code: config.mjs:4587 rate 0.14, floor 0.5 (both agree). |
| 2 | gm-handbook.en.md:424 | gm-handbook.pl.md:424 | "sets the spilled Despair back to 0" | "zeruje rozlany Despair" | Same meaning, the digit spelled as a verb. Not a difference. |

## Uncheckable

| Handbook file:line (EN) | Number | Why |
|---|---|---|
| player-handbook.en.md:92, gm-handbook.en.md:201-207 | a chapter is five sessions (3 Daily Life, 1 Investigation, 1 Trial) | No code holds it: the phase is set by hand (the GM handbook says so). |
| player-brochure.en.md:5, player-handbook.en.md:71 | a roll with Hope gives 1 Hope | Daggerheart's own rule, not the module's; config holds only the critical's 2 (config.mjs:1241). |
| player-handbook.en.md:171 | a co-owner's tile follows "about a second and a half late" | A measurement claim; no constant. |
| gm-handbook.en.md:312 | 16x16 pixel art | An asset size, not code. |
| gm-handbook.en.md:965, 1048 | layout measured at 1366x768 and 1920x1080 | Measurement claims, not values. |
| gm-handbook.en.md:79 | Dice So Nice 6.0 or later | Another module's version; not checked. |
| gm-handbook.en.md:133 | "Four rows stand apart" under First session | Not checked (season-setup.mjs rows not counted). |
| gm-handbook.en.md:565 | "which of the five links" (diagnoseVoice) | Not checked. |
| gm-handbook.en.md:1325 | "each of the module's four listeners (`refreshToken.*`)" | Not checked. |
| gm-handbook.en.md:1312-1325 | the measuring recipe's steps (three rooms, five seconds, etc.) | Instructions for a person, not rules of the game. |

## Counts

- Handbook numbers in the EN files after removing versions, dates, stage/test ids, headings' numbers and section references (mechanical count): 582 (GM) + 310 (player) + 89 (brochure) = 981 digit tokens, plus number words. Many are repeats of one rule (the brochure repeats the player handbook, which repeats the GM handbook) or are not rules (examples, list numbering, a table's own row count).
- Distinct rule-stating numbers classified, counted by hand from my working list (approximate, +-10): about 307.
  - DISAGREE: 1 certain (row 1), 2 unsure (rows 2-3).
  - AGREE: about 294.
  - UNCHECKABLE / not checked: 10 (table above).
  - EN/PL differ on a rule number: 0 (2 non-rule line differences listed).
- Lines read:
  - player-brochure.en.md in full (78 lines).
  - player-handbook.en.md and gm-handbook.en.md through a sentence extract of every sentence holding a digit or a number word (422 and 1059 extract lines), plus about 40 whole lines re-read for context; PL lines only where the mechanical comparison flagged them (about 10).
  - scripts/config.mjs lines 245-4707 with comment lines stripped (1928 code lines), plus about 200 comment lines (TIMING 353-457, ECLIPSE 555-579, moveBody 4352-4375).
  - Targeted reads in scripts/: settings.mjs (search tokens 1329-1337, UI scale 1662-1669), overflow.mjs (73-78, 1050-1061, 1107-1125), eclipse.mjs (65-79), actions.mjs (39-63), movement.mjs (1182, 1230, 3618-3651, 3730-3749), clock.mjs (397), notice-history.mjs (113-137), popup.mjs (71, 327-332), vote.mjs (690), case-schema.mjs (297), zone-machine.mjs (60), stash-reach.mjs (364-370), cleanup.mjs (376-410, 2538-2565, 3403-3423), murder-ui.mjs (871-895), murder-rules.mjs (1956-2010), bridge-guards.mjs (2021-2081), relay-guard.mjs (158-166), sheet-audit.mjs (220-325), movement-audit.mjs (65-66), passages-gm.mjs (77), dice-sync.mjs (159-167), roll-draw.mjs (903), diagnostics.mjs (1855-1938), sequence.mjs (50-63), trial-floor-ui.mjs (1328-1335, 1604-1608), hud.mjs (205-218), hud-elapsed.mjs (99), music-play.mjs (90-117), season-exceptions.mjs (37-102), tables-editor.mjs (53-61), tables-pools.mjs (pool tiers), despair-award.mjs (125-175), projects-tray.mjs (301), module.json, lang/en.json (Note q1-q7, indirectCost). About 450 lines.

What the AGREE count covers, by group (not row by row): starting values and the trait spread; the day's structure, actions, Free Move, Wounded/Panic and the floor of 1; Eclipse 2 crossings, the Night free placement and Darkness's fallback to 2; search tokens 3 (0-10) and the 5 s ack; every action threshold (Search, Observe and Analyze tables cell by cell, project bands and scales, the five project kinds and Repair, Dynamic bands, Rest, Listen, Palm/Frisk incl. 60 s, Tamper erase/reshape/trail/cover with its Sanity costs and the -3 warm scene); all 10 Hope Call and 15 Despair Call costs and their amounts; Motive 1-10/3; the pool 12; the overflow 20 (6-60), the 12 + half suggestion, the 0-5 size cap, 8 effects, each by 1, floor 1; item tiers, durability, carry limits 3/2/1, stash 3 and the rifle once per time of day; indirect murder parts, 7-10, Shadow 16, alone +1, Hide the Traces bands; opening rolls 8/20 and Key Remnants 5/4/3, floor 3, 2-4, the fee below 4 x 3 = 12; drain 1/2; every crisis action threshold and its extras; resolution costs 1 Sanity / 1 Health; looting bands 12/18 and cover 16; the trial's 180/30 s debate, 30/60/120 s Objection, Testimony 60 (30-120), Panic 15 (10 from 12, 10-15), Closing 30/300 s once, the +-30 s and 5 s bar, the 10 s note, 270 min for 16, the majority floor(n/2)+1, the straw poll's two thirds, Logic Dive 1-5/60/10/5 s, Scrum 45/300/20-40 s and its two worked examples; Level Ups 1/3/+2 and the 4 picks; Monocub 0 Hope, the action budget, Confusion 1+1 and 12/16; the messenger's 5 min / 3 min / 8 s / 3 asks; safeword 3 s; notices 150/250/40 and the stack 2/4; interface scale 80-140%; passages log 200, move audit 1000 and 30 s; relay 4 steps in 10 s; dice look 60 s; traces 30 s; sheetWrites 24 h; rollFlags 30 min; perf 50; fps 5 s, 60 frames or 1 s, 33/50 ms; rewind and Eclipse take-back 5 min; crossing refund 5 s; HUD 15/30 min and the 1 min beat; opening re-ask 10 s; last 3 turns; sequences 3.4 s, 1.5 s, 3 s; console 1280 px at 8 px; reset 30 groups in 5 sections; 20 RollTables; 7 note questions, the first 4 boundaries; Foundry 14.364/14.365, Daggerheart 2.6.5; rooms 1.5 per student, 10% uncovered, 4096 px / 8 MB; neighbours 0.35 grid ("about a third") and half a square; music 1.5 + 0.4 s ("about two seconds") and 4 s; projects tray 5 rows; chapters 1-6.

## Config numbers no handbook states

Looked at: every entry of TIMING (25), and the numeric fields of the other tables named in the brief (about 120 more). The ones a player or a GM meets and no handbook states:

- `TIMING.friskForceMs` 30 s (config.mjs:401): how long the searcher has to decide on forcing a refused or unanswered Frisk. The handbooks give the target's 60 s only.
- `TIMING.friskRollMs` 10 s and `friskGraceMs` 5 s (config.mjs:412, 418): the last-second force's roll and grace.
- `TIMING.plantWindowMs` 120 s and `plantRequestMs` 5 s (config.mjs:370, 373): how long after a token spend a Search may still ask for a planted item.
- `TIMING.safewordRepeatMs` 60 s (config.mjs:388): a second press within a minute is logged, not posted again.
- `TIMING.openingAttempts` 3 (config.mjs:424): how many times an opening roll is re-offered before the murder is abandoned (the GM handbook gives only the 10 s between asks).
- `TIMING.pendingObserveTtlMs` 60 min (config.mjs:420): an Observe waiting for its ruling is swept after an hour.
- `TIMING.projectChangeMs` 30 s, `diceSettleMs` 6 s, `gmStoreSyncMs` 8 s, `gmStoreOpenMs` 16 s, `gmStoreTombstoneDays` 30, `secretCardsKept` 500 (config.mjs:364, 375, 436, 447, 456, 422).
- `CLEANUP.actions.misleadingTrail.refundStress.critical` 1 (config.mjs:4350): a critical trail gives the Sanity back; the handbooks say so for Move the Body and reshape, not for the trail.
- `CLEANUP.actions.moveBody.rooms.critical` 2 (config.mjs:4369; its comment at 4357-4361 says E64 "makes the critical's two rooms work"): no handbook states it, and the code does not use it - cleanup.mjs:3403-3411 `bodyDestinations` offers only the connected rooms, and cleanup.mjs:2551-2552 says `def.rooms` stays only "as the reach". The handbooks (player-handbook.en.md:658, gm-handbook.en.md:829) match the code; the config comment does not.
- `MOOD_SHARES` calm 0.6, uneasy 0.4 (config.mjs:2058): the end-of-day mood bands; gm-handbook.en.md:232 names the inputs, not the shares.
- `TRIAL.modes.topicLength` 200, `zones.questionLength` 200, `answerLength` 80, `scrum.thesisLength` 120, `round.graceSeconds` 1 (config.mjs:3935-3976).
- `SEQUENCE_TIMES.dayStart.still` 5 s and `dayEnd.still` 6 s (scripts/sequence.mjs:59, 61): the day boards' still frames under reduced motion (the handbook gives the trial entry's 1.5 s and the verdict's 3 s only).
- `SFX_VARIATION.gain` 0.18 (config.mjs:4587): "small gain changes" in gm-handbook.en.md:1095.
- `ROOM_IMAGE_LIMITS.atOnce` 3 and `probeMs` 8 s (config.mjs:547).
