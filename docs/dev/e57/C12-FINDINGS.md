# E57 C12: the text lints after the four text lines

Read on 14.11.2026 at 63f91dd3 (claude/e57-tools with claude/e71-a d575470c, e71-b cbdd5015, e71-c b21d49bc and e71-d b37cbbbf merged in, then
C12's commits), by `node tools/check.mjs text --all`, which prints every finding. "After the merges" is the same command at fd85baa7, the
last merge, before C12. The handbooks line (claude/handbooks-113) has not landed: a finding marked "handbooks" is in docs/handbooks/*.md
as they stand on the base.

## Each detector

| Test | Detector | Mode now | MODES' FAIL stage | Read | After the merges | Now | Where the findings now stand |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | configPlaceholders | fail | E65 | 547 | 0 | 0 | - |
| T1 | pluralForms | fail | E65 | 258 | 0 | 0 | - |
| T2 | pairParity | fail | E65 | 6421 | 0 | 0 | - |
| T3 | familyFormats | fail | E65 | 3794 | 0 | 0 | - |
| T4 | lengthOver | report | E71 | 3338 | 325 | 325 | lang/pl 149, lang/en 130, config prose 46 |
| T5 | patterns | report | E71 | 237896 | 212 | 212 | lang/pl 131, lang/en 62, config prose 19 |
| T6 | dashesIn | fail | E65 | 107663 | 3 | 3 | - |
| T7 | ruleNumberWords | report | E25 | 13420 | 23 | 23 | lang/pl 13, lang/en 6, config prose 4 |
| T8 | glossaryHits | report | E25 | 68 | 28 | 27 | handbooks 27 |
| T9 | staleTranslations | fail | E57 | 6968 | 212 | 0 | - |
| T11 | loanGender | report | E71 | 9410 | 15 | 12 | handbooks 12 |
| T12 | loanDeclension | report | E71 | 9410 | 17 | 17 | handbooks 17 |
| T13 | uiLiterals | report | E71 | 3472 | 737 | 737 | scripts 737 |
| T14 | tableWordProblems | fail | E65 | 15 | 0 | 0 | - |
| T15 | renderChecks | fail | E71 | 24452 | 114 | 0 | - |
| T16 | secondPersonToMany | fail | E71 | 1592 | 12 | 0 | - |
| T17 | oxfordComma | report | null | 13420 | 66 | 66 | lang/en 51, config prose 11, lang/pl 4 |
| T18 | telegraph | report | null | 13420 | 27 | 27 | lang/pl 11, lang/en 8, config prose 8 |
| T19 | contractions | report | null | 6452 | 7 | 7 | lang/en 7 |
| T20 | localeCalls | fail | E66 | 253 | 0 | 0 | - |
| T21 | monokumaVoice | fail | E71 | 18304 | 1 | 0 | - |
| T22 | mirror | report | null | 6452 | 617 | 611 | a pair (en and pl) 611 |
| T23 | itemQuotes | report | null | 13420 | 1 | 1 | lang/pl 1 |
| T24 | colonChains | fail | E71 | 13420 | 5 | 0 | - |
| T25 | bareLeft | fail | E71 | 13420 | 0 | 0 | - |
| T27 | naturalnessBefore | report | null | 60 | 0 | 0 | - |
| T28 | retiredHits | fail | E66 | 318 | 0 | 0 | - |

## The findings of the small detectors still reports

Each stands in a text another line owns: the handbooks the handbooks line's, lang/ and config.mjs's prose the four text lines'.

### T7 (23)

- lang/en.json DRPG.Actions.woundedTooltip: "th left, so one action fewer per t" - "one action": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/en.json DRPG.Tips.Gm.minusTooltip: "Takes one Despair from this p" - "one Despair": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/en.json DRPG.Tips.Gm.plusTooltip: "Adds one Despair to this poo" - "one Despair": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/en.json DRPG.Murder.crisisBrief: "One action a turn. A r" - "One action": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/en.json DRPG.Calls.burst.one: "le price of one action, even a Lon" - "one action": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/en.json DRPG.Calls.burst.other: "le price of one action, even a Lon" - "one action": a rule's number written as a word; it comes from a placeholder (T7, M5)
- config.mjs's prose DRPG.Config.HOPE_CALLS.freeCrit.effect: "one of the two dice is set to 1" - "two dice": a rule's number written as a word; it comes from a placeholder (T7, M5)
- config.mjs's prose DRPG.Config.DESPAIR_CALLS.bounty.effect: "ng student: one Hope for the fir" - "one Hope": a rule's number written as a word; it comes from a placeholder (T7, M5)
- config.mjs's prose DRPG.Config.MONOCUB.abilities.meddle.critical.help: "They get one spent action back." - "one spent action": a rule's number written as a word; it comes from a placeholder (T7, M5)
- config.mjs's prose DRPG.Config.CRISIS_ACTIONS.selfDefence.hint: "ts you take one this turn without a r" - "one this turn": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.Actions.pipTooltip: "ka odejmuje jedną akcję." - "jedną akcję": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.Tips.Gm.minusTooltip: "Zabiera jeden Despair z tej puli" - "jeden Despair": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.Tips.Gm.plusTooltip: "Dodaje jeden Despair do tej puli" - "jeden Despair": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.Murder.crisisBrief: "Jedna akcja na turę. Za" - "Jedna akcja": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.Calls.burst.one: "a całą cenę jednej akcji, nawet Long" - "jednej akcji": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.Calls.burst.few: "a całą cenę jednej akcji, nawet Long" - "jednej akcji": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.Calls.burst.many: "a całą cenę jednej akcji, nawet Long" - "jednej akcji": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.Calls.burst.other: "a całą cenę jednej akcji, nawet Long" - "jednej akcji": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.RollDialog.freeCritArmed: "a ten rzut: jedna kość, losowo Hop" - "jedna kość": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.Explain.status.actionsWhat: "rę dnia. Po jednej akcji kosztują pr" - "jednej akcji": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.Config.HOPE_CALLS.freeCrit.effect: "cie jedna z dwóch kości, losowo, st" - "dwóch kości": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.Config.MONOCUB.abilities.meddle.critical.help: "ć odzyskuje jedną wydaną akcję." - "jedną wydaną akcję": a rule's number written as a word; it comes from a placeholder (T7, M5)
- lang/pl.json DRPG.Config.MONOCUB.abilities.meddle.critical.hinder: "ostać traci jedną akcję." - "jedną akcję": a rule's number written as a word; it comes from a placeholder (T7, M5)

### T8 (27)

- docs/handbooks/gm-handbook.pl.md:581: "ski w rogu, kafel powiadomień i stos na w" - "kafel powiadomień" is forbidden, the glossary says "kafelek powiadomień" (glossary notice-tile, A7; holds from E81)
- docs/handbooks/gm-handbook.en.md:274: "pening or a Dynamic action, and Resolv" - "Dynamic action" is written "Dynamic Action" (glossary dynamic-action, D33a, DB3, DB16; holds from E66)
- docs/handbooks/gm-handbook.pl.md:274: "twarcia ani akcji Dynamic, a Resolve" - "akcji Dynamic" is forbidden, the glossary says "Dynamic Action" (glossary dynamic-action, D33a, DB3, DB16; holds from E66)
- docs/handbooks/gm-handbook.en.md:88: "background (Room Setup's Descripti" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:186: "lapsed) / **Room Setup**, **Item t" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:287: "r it</ins> (Room Setup > Rests); t" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:472: "he one in **Room Setup**, so to ev" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:484: "1 Rooms and Room Setup" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:486: "d as one** (Room Setup > Doors, **" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:486: "e region in Room Setup. A change m" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:486: "hbors list (Room Setup > Doors, be" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:486: "e room, and Room Setup writes to e" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:488: "**Room Setup** (Between" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:500: "very scene: Room Setup opened on a" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:508: "piece's own Room Setup values (the" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:550: "ocked door (Room Setup > Doors);" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:639: "ted at from Room Setup. A Search i" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:645: "y else - in Room Setup or with `ga" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:649: "load and at Room Setup's Apply - p" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:651: "room where Room Setup gives them" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:651: "its cell in Room Setup) is found o" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:1024: "a season in Room Setup's **Scenes*" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:1041: "cenes part (Room Setup's **Scenes*" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:1087: "bedroom as Room Setup assigns it," - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:1362: "ted at from Room Setup, and a room" - "Room Setup" is written "Room setup" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.pl.md:88: "adka Opis w Room Setup: "Każda prz" - "Room Setup" is forbidden, the glossary says "Ustawienia pokoi" (glossary window-room-setup, D31, E44 plan; holds from E44)
- docs/handbooks/gm-handbook.en.md:972: "ame log the Investigation Dashboard's footer op" - "Investigation Dashboard" is forbidden, the glossary says "Investigation" (glossary window-investigation, D31, E44 plan; holds from E44)

### T11 (12)

- docs/handbooks/gm-handbook.pl.md:170: "2. Eclipse jest otwart" - "otwarty" is masculine, and Eclipse is neuter (DB28, DB39; glossary eclipse; T11, a candidate)
- docs/handbooks/gm-handbook.pl.md:373: "awny: jedno Hope dla pierwsz" - "jedno" is neuter, and Hope is masculine (DB28, DB39; glossary hope; T11, a candidate)
- docs/handbooks/gm-handbook.pl.md:375: "e albo, gdy Eclipse nie jest uż" - "używany" is masculine, and Eclipse is neuter (DB28, DB39; glossary eclipse; T11, a candidate)
- docs/handbooks/gm-handbook.pl.md:558: "y na koniec Eclipse, który końc" - "który" is masculine, and Eclipse is neuter (DB28, DB39; glossary eclipse; T11, a candidate)
- docs/handbooks/gm-handbook.pl.md:1153: "więc zmiana Hope, która prze" - "która" is feminine, and Hope is masculine (DB28, DB39; glossary hope; T11, a candidate)
- docs/handbooks/player-handbook.pl.md:94: "on , jedna Class Trial . GM może r" - "jedna" is feminine, and Class Trial is masculine (DB28, DB39; glossary class-trial; T11, a candidate)
- docs/handbooks/player-handbook.pl.md:376: "przez cały Eclipse - kto wchod" - "cały" is masculine, and Eclipse is neuter (DB28, DB39; glossary eclipse; T11, a candidate)
- docs/handbooks/player-handbook.pl.md:376: "Przez cały Eclipse zostajesz n" - "cały" is masculine, and Eclipse is neuter (DB28, DB39; glossary eclipse; T11, a candidate)
- docs/handbooks/player-handbook.pl.md:480: "Despair do overflow, który zaci" - "który" is masculine, and Overflow is neuter (DB28, DB39; glossary overflow; T11, a candidate)
- docs/handbooks/player-handbook.pl.md:492: "ocub: jedno Hope dla pierwsz" - "jedno" is neuter, and Hope is masculine (DB28, DB39; glossary hope; T11, a candidate)
- docs/handbooks/player-handbook.pl.md:743: "ałać - poza Eclipse, który nie" - "który" is masculine, and Eclipse is neuter (DB28, DB39; glossary eclipse; T11, a candidate)
- docs/handbooks/player-handbook.pl.md:850: "M-ów: jedno Hope dla pierwsz" - "jedno" is neuter, and Hope is masculine (DB28, DB39; glossary hope; T11, a candidate)

### T12 (17)

- docs/handbooks/gm-handbook.pl.md:231: "karty: stop safewordu, Class Tria" - safeword does not decline, "safewordu" gives it a case ending (DB4; glossary safeword; T12, a candidate)
- docs/handbooks/gm-handbook.pl.md:241: "igation - w Class Trialu nie kosztuj" - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/gm-handbook.pl.md:430: "e w trakcie Class Trialu i tak przyc" - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/gm-handbook.pl.md:1008: "bi kopii. W Class Trialu wiersz Trut" - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/gm-handbook.pl.md:1010: "ofonu; poza Class Trialem jest wyszar" - Class Trial does not decline, "Class Trialem" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/gm-handbook.pl.md:1029: "u : podczas Class Trialu kafelek pok" - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/player-brochure.pl.md:70: "o ujawnić w Class Trialu." - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/player-handbook.pl.md:52: "poskłada; w Class Trialu żadnej /" - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/player-handbook.pl.md:509: "?"; werdykt Class Trialu go opróżnia" - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/player-handbook.pl.md:756: "mą rzecz, a do tego Truth Bullet zapisujący," - "do" takes the genitive, which DB4 writes "Truth Bulletu" (glossary truth-bullet; T12, a candidate)
- docs/handbooks/player-handbook.pl.md:767: "zedmioty. W Class Trialu Analyze tyl" - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/player-handbook.pl.md:767: "rzejścia; w Class Trialu Analyze kos" - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/player-handbook.pl.md:771: "na stół. W Class Trialu Truth Bulle" - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/player-handbook.pl.md:773: "m na karcie Class Trialu i na kartac" - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/player-handbook.pl.md:773: "ie ma; poza Class Trialem jest wyszar" - Class Trial does not decline, "Class Trialem" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/player-handbook.pl.md:784: "* na karcie Class Trialu). Gdy przeg" - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)
- docs/handbooks/player-handbook.pl.md:784: "yb, a karta Class Trialu na panelu z" - Class Trial does not decline, "Class Trialu" gives it a case ending (DB4; glossary class-trial; T12, a candidate)

### T19 (7)

- lang/en.json DRPG.Action.noRoom: "ter's token isn't in any room" - "isn't" in a rule (toast); DB8 writes it in full (T19)
- lang/en.json DRPG.Action.substitute: "looking for isn't here. You f" - "isn't" in a rule (unclassified); DB8 writes it in full (T19)
- lang/en.json DRPG.Monocub.silencedNote: "r way. They can't discuss it" - "can't" in a prohibition text; DB8 writes it in full (T19)
- lang/en.json DRPG.Monocub.tinkerRefused: "Tinker doesn't reach it. Y" - "doesn't" in a rule (unclassified); DB8 writes it in full (T19)
- lang/en.json DRPG.Monocub.meddleRefused: "Confusion doesn't reach them." - "doesn't" in a rule (unclassified); DB8 writes it in full (T19)
- lang/en.json DRPG.Monocub.silenceOn: "You're a witness:" - "You're" in a prohibition text; DB8 writes it in full (T19)
- lang/en.json DRPG.Monocub.silencedTooltip: "You're a witness:" - "You're" in a prohibition text; DB8 writes it in full (T19)

### T23 (1)

- lang/pl.json DRPG.Action.found: "sz „<strong>{item}</strong>” (" - an item's name stands in „{item}” (DB31; T23)

## T9, read (C12's sheet beside the code)

After the four merges T9 found 212 Polish keys whose English the text lines had moved and whose Polish they had not (and 1715 moved
in both languages, 116 new). The 212 were read, each English before and after beside the Polish and the code that uses the key: 169
still say what the English says and were stamped as they are; 43 no longer did (a changed fact, a renamed button, a clause added) and
were corrected in lang/pl.json, then stamped (the corrections are the C12 commit's diff of lang/pl.json). One was left as it is and
stamped: DRPG.Advance.who.playerHint - English now names "a card" and "the Level Up button", the Polish says "powiadomienie" and "przycisk";
docs/text-style.md section 7 (PL-d) quotes this Polish as its example, so a change belongs with the guide's owner. The 1715 rewritten
and 116 new keys are not read here: they were written in both languages by the text lines, and stay unstamped, listed by
`node tools/stale-pl.mjs --sheet`, and not red.

## gm-store.mjs: the 25 English strings T13 lists

- Lines 634-680 (20): the reasons `sectionProblem` and `gmsRefusal` give a refused packet or file section. They are written to a GM's
  console (`env.log.warn`, "The GM store refused ... : <reason>") and to the case file's warning (gm-stores.mjs, "was refused:
  <reason>"); no window shows them. English on purpose, as the bridge's run reasons are and as diagnostics.mjs's console is (CLAUDE.md:
  "diagnostics.mjs's console stays English"). Decision: allowed, as engine reasons, not T13 findings.
- Lines 844, 1142, 1292, 1496 (5): `env.text?.(key, data) ?? "<English>"`. The module's stores are always built with `text`
  (gm-stores.mjs:1981, `game.i18n` with `plural`), so a table's browser shows the key's words in its language; the English stands only
  for an engine built with no text function (the suite's and the harness's own stores). Decision: allowed, as fallbacks no table reads.
T13 stays a report (737 findings, below), so no allow row is written yet; when it turns to FAIL these are its rows, with the two reasons
above.

## What was switched, and what was moved to 1.2.114

Switched to FAIL in C12, each at 0 on this tree (the "After the merges" column is what each found before):
- T25 bareLeft - nothing to do.
- T21 monokumaVoice - its one Polish text reworded to the English.
- T24 colonChains - two readouts allowed (tests-text.mjs COLON_CHAIN_ALLOW, each with its reason and the file it is drawn in), one
  English sentence split.
- T16 secondPersonToMany - six keys allowed, each read by one person at its call site (SECOND_PERSON_ALLOW, each with the site and why).
- T15 renderChecks - 33 placeholder names given values in tools/text-render.mjs (the findings were the render's, not the texts').
- T9 staleTranslations - FAIL since C1; 212 read and stamped here, 43 Polish corrected.

Moved to 1.2.114, each a report with its count now (the coordinator's word of 14.11.2026: a mode that cannot be made green by the
release stays a report): T4 lengthOver 325 (lang and config prose), T5 patterns 212 (lang and config prose), T7 ruleNumberWords 23 (a
rule number in words should come from a placeholder, M5: code and text together, the keys' owners'), T8 glossaryHits 27, T11 loanGender
12 and T12 loanDeclension 17 (all three now in the handbooks alone: T8's one lang finding and T11's three were fixed in C12), T13
uiLiterals 737 (scripts; gm-store.mjs's 25 decided above). T17, T18, T19, T22, T23 and T27 have no FAIL stage in MODES and stay reports.
