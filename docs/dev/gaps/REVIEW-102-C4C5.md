# REVIEW-102-C4C5 - E102's C4 and C5 tooltips, a text read

## What was read

- **Branch and commit:** `origin/claude/e102` at `91f6413a`, after the review fixes T1-T15 (`af5939de`).
- **Keys:** the 73 keys the two commits add, read at that tip. All 73 are new; no existing value changed.
  - 44 `DRPG.Tips.Gm.*` from C4, `6c2a7935` (the GM panels).
  - 29 `DRPG.Tips.Setup.*` from C5, `aafb5114` (setup, the sheet and the rest).
- **Who read it and when:** gaps-radio, 13.11.2026.
- **How:** for each key, the site where it is drawn was found and the code behind that control was read. Each claim the text makes is held to the line that decides it.
- **Rules applied:** REVIEW-102's text rules, docs/text-style.md and docs/glossary.json:
  - a rule stated in a tooltip must match the code;
  - EN and PL say the same;
  - neutral Polish (no gendered "you", no singular "they" turned plural);
  - a tooltip does not repeat its label;
  - no GM-only fact on a player's screen;
  - short and natural, as the owner put it: a player reads what their action does, a GM reads what matters.

Nothing was rendered, here or at a table. Every finding is from the code.

**Sureness of the medium findings.** All four medium findings were read twice:

| Finding | Second read |
| --- | --- |
| G1 | monocub.mjs:138-142 against the comment at :127 |
| G2 | config.mjs:621 `ITEM_DURABILITY = { 0: 1, 1: 1, 2: 2, 3: 3 }` and config.mjs:870-873 `USABLE_EFFECTS` |
| S1 | music-play.mjs:440-446 and `cueGivesWay` at :575-578 |
| S2 | anonymity.mjs:879-889, which writes `ownership.default` only |

**Mechanical checks, in a worktree at the tip.** Both green:
- `node tools/check.mjs parity`: 0 missing, 0 stray, 0 placeholders dropped.
- `node tools/check.mjs text`: 0 problems. On these keys it noted, without failing:
  - T7 flags "one Despair" in the Despair steppers. The 1 is fixed by the handler (despair.mjs:1233), so the word stays.
  - T15: `showAgainTooltip`'s `{warning}` has no fixture value.

## The findings, most severe first

Each key below is `DRPG.Tips.Gm.<key>` (prefix **G**) or `DRPG.Tips.Setup.<key>` (prefix **S**).

| # | Sev. | Key | In short |
| --- | --- | --- | --- |
| G1 | medium | inviteAsAMonocubTooltip | "Health and Sanity at zero" reads as spent; the code clears the marks (unhurt) |
| G2 | medium | tierTooltip | "Higher tiers last longer" is false for Tier 0-1 and for usables |
| S1 | medium | playTooltip | "until Reset music" - a state with its own music also ends the track |
| S2 | medium | setThemToObserverTooltip | "no longer owns them" - each sheet's own player keeps it |
| S3 | low-medium | tabsTierPoolsRoomTooltip | a Search draws from the room's table first |
| S4 | low-medium | resetTheSeasonTooltip | unsaved edits in Season setup are dropped |
| G3 | low | keepTheMastermindTooltip | "their player is told" - nothing is said to them |
| G4 | low | give2Tooltip (and giveTooltip) | one handler, two stories; give2 is wrong on when the pool pays |
| G5 | low | stateTooltip | "the inventory stays" - Truth Bullets can go |
| G6 | low | whichTableTooltip | "It sets the category and tier" - not always |
| S5 | low | aStudentWhoKnowsTooltip | asks when the student is in a room the passage joins, not "beside it" |
| S6 | low | allThePlayersPickTooltip | a student with no player opens here |
| S7 | low (code) | closeXTooltip | two cards are kept nowhere |
| S8 | low | showThePassageTooltip | "your room" is ambiguous; PL bare "przejście" |
| S9 | low | searchTokensStepperTooltip | "tokens" is not the glossary's Search Token |
| S10 | low | useTheTemplateTooltip | it replaces what is typed |
| G7 | low (PL) | whichRemnantTooltip | the PL word order reads the copy the wrong way round |
| S11 | low (PL) | categoryTooltip | "za nią" points at "tabeli" |
| G8, S12-S15 | low (style) | see below | wording |

### G1 - medium - `inviteAsAMonocubTooltip`: "Health and Sanity at zero" reads as spent, and the code clears them
- **Where it is drawn:** gm-students.mjs:137, the Students window.
- **What the code does:** `setMonocub` writes `hitPoints.value: 0` and `stress.value: 0` (monocub.mjs:138-142). Health and Sanity count marks (config.mjs:873), so 0 is unhurt. The code's own comment says so: "A MONOCUB STARTS CLEAN" (monocub.mjs:127).
- **Why it matters:** a GM who reads "Health ... at zero" takes the Monocub for spent.
- **Proposed:**
  - EN "Makes this dead student a Monocub now: no Hope, and Health and Sanity cleared"
  - PL „Od razu robi z tego martwego ucznia Monocuba: bez Hope, ze zdjętymi znacznikami Health i Sanity"

### G2 - medium - `tierTooltip`: "Higher tiers last longer" holds only from Tier 1 up, and only for a tool or weapon
- **Where it is drawn:** gm-items.mjs:530, the Give window's Tier select, shown for every category.
- **What the code does:**
  - Durability is `ITEM_DURABILITY = { 0: 1, 1: 1, 2: 2, 3: 3 }` (config.mjs:621), so Tier 1 lasts no longer than Tier 0.
  - For a usable, the tier is how much it restores. Its Tier 0 is a creative use, put to the GM (`USABLE_EFFECTS`, config.mjs:870-873).
  - "A Tier 0 item breaks after one roll" holds for a tool or weapon (config.mjs:607-610).
- **Proposed:**
  - EN "For a tool or weapon, how many bad rolls it takes; Tier 0 is spent by its first roll. For a usable, how much it restores"
  - PL „Dla narzędzia lub broni: ile złych rzutów wytrzyma; Tier 0 zużywa pierwszy rzut. Dla przedmiotu użytkowego: ile przywraca"

### S1 - medium - `playTooltip`: Reset music is not the only thing that ends the GM's track
- **Where it is drawn:** sound-panel.mjs:177.
- **What the code does:** when the music state moves to another state, the GM's track is stopped (`stopInterruption()`, music-play.mjs:445). This happens when the new state has a playlist mapped or is a silent state (`cueGivesWay`, music-play.mjs:440-442 and :575-578).
- **Proposed:**
  - EN "Plays the chosen track on repeat for the whole table, until Reset music or a state with its own music"
  - PL „Odtwarza wybrany utwór w pętli dla całego stołu, do Resetuj muzykę albo do stanu z własną muzyką"

### S2 - medium - `setThemToObserverTooltip`: the sheet's own player still owns it
- **Where it is drawn:** anonymity.mjs:824.
- **What the code does:** `fixExposed` writes `ownership.default` only (anonymity.mjs:883-885). A player who owns a student through their own entry keeps it.
- **Sureness:** that Foundry takes the higher of the default and the per-user level is Foundry's documented model, not measured here.
- **Proposed:**
  - EN "Lowers what every player gets on these sheets to Observer: they can open them, not edit them. Each sheet's own player keeps it"
  - PL „Obniża uprawnienia każdego gracza do tych arkuszy do Obserwatora: może je otworzyć, ale nie edytować. Właściciel arkusza go zachowuje"

### S3 - low-medium - `tabsTierPoolsRoomTooltip`: a Search draws from the room's own table first
- **Where it is drawn:** tables-editor.mjs:1656.
- **What the code does:** `DRAW_STEPS` (tables-pools.mjs:977-981) tries, in order: the room's named table, then any room table, then the tier pools, then the built-in pools, then the spare.
- **Proposed:**
  - EN "One table for each category and tier. A Search draws from them when its room's own table has nothing to give"
  - PL „Po jednej tabeli na kategorię i Tier. Search losuje z nich, gdy tabela pokoju nie ma nic do dania"

### S4 - low-medium - `resetTheSeasonTooltip`: what is typed in Season setup and not saved is dropped
- **Where it is drawn:** season-setup.mjs:1180.
- **What the code does:**
  - On "reset", season-setup.mjs:1207 returns before `applyCampaignForm` (:1214), so nothing typed in the window is saved.
  - On a GM who is not the primary, the reset only warns (season-wipe.mjs:221-223).
- **Proposed:**
  - EN "Opens the season reset, which asks before it clears anything. Unsaved changes in this window are lost"
  - PL „Otwiera reset sezonu, który pyta, zanim cokolwiek wyczyści. Niezapisane zmiany w tym oknie przepadają"

### G3 - low - `keepTheMastermindTooltip`: "their player is told" - nothing reaches the player as words
- **Where it is drawn:** gm-stores.mjs:2365.
- **What the code does:** Keep runs `setMastermind` (gm-stores.mjs:2412), which ends in `notifyDoorAccess` (mastermind.mjs:155-169). That is a silent socket packet giving the lair door, sent only to an active player (mastermind.mjs:209-214, 378-387). No card or notice is shown.
- **Sureness:** medium. "Told" may be the line's word for that packet.
- **Proposed:**
  - EN "The picked student stays the Mastermind, and their player's door to the lair opens again"
  - PL „Wybrany uczeń zostaje Mastermindem, a jego gracz znów ma dostęp do kryjówki"

### G4 - low - `give2Tooltip` and `giveTooltip`: one handler, two stories
- **Where they are drawn:** gm-students.mjs:100 and monocub.mjs:782. Both buttons call `convertDespairToHope` (despair.mjs:770).
- **What the code does:** it grants the Hope now, and the pool owes it until the next time of day (`owes`).
  - `giveTooltip` says so.
  - `give2Tooltip`'s "Turns that much Despair into this Monocub's Hope at once" says the Despair leaves at once.
- **Same split on the donor select:** `monokumaPoolTooltip` (gm-students.mjs:97) and `despairPool2Tooltip` (monocub.mjs:780) are two texts for one `donorLabel` (despair.mjs:740-743). One key would do.
- **Proposed give2:**
  - EN "Gives this Monocub that much Hope now, without Apply; the pool pays at the next time of day"
  - PL „Od razu daje temu Monocubowi tyle Hope, bez Zastosuj; pula płaci przy następnej porze dnia"
- **PL wording:** `despairPool2Tooltip`'s „liczba to to, ile" reads better as „liczba mówi, ile ta pula może wydać".

### G5 - low - `stateTooltip`: "the inventory stays" is not always so
- **Where it is drawn:** gm-students.mjs:128.
- **What the code does:** setting "dead" on a death the GMs hold goes through `publishDeath` (`makeKnown`). That runs `destroyBullets` unless the kill kept them (chapter.mjs:539). "No announcement" holds: no card is posted.
- **Sureness:** medium.
- **Proposed:**
  - EN "Corrects the state quietly on Apply: no announcement, and the items stay"
  - PL „… a przedmioty zostają"
  - Optionally add "Truth Bullets go as at a found body".

### G6 - low - `whichTableTooltip`: "It sets the item's category and tier" overstates it
- **Where it is drawn:** gm-items.mjs:498.
- **What the code does:** the picked entry fills them in (`entryAs`, gm-items.mjs:570-596). Where nothing decides one, it stays at "- choose -", and both stay editable.
- **Proposed:**
  - EN "The item table to pick from. It and the item fill in the category and tier below"
  - PL „Tabela przedmiotów, z której wybierasz. Ona i przedmiot wypełniają kategorię i Tier poniżej"

### S5 - low - `aStudentWhoKnowsTooltip`: when it asks
- **Where it is drawn:** passages-tab.mjs:135. The handler is at :338-351.
- **What the code does:**
  - It asks when the student is in a room the passage joins (`passageRoomsOnMap(...).includes(room)`), not when they are beside it.
  - For a public passage it always asks.
- **Proposed:**
  - EN "Takes the passage away from this student. If they are in a room it joins, asks: now or when they leave"
  - PL „Odbiera temu uczniowi tajne przejście. Jeśli jest w pokoju, który ono łączy, pyta: teraz czy przy wyjściu" (the PL text also lacked the comma in „Pyta, kiedy")

### S6 - low - `allThePlayersPickTooltip`: a student with no player is not handed to one
- **Where it is drawn:** level-up.mjs:1232.
- **What the code does:** `read(dialog, true)` answers "player" only when `playable`. Otherwise it answers "gm", and that window opens here (level-up.mjs:1216-1218, :1147).
- **Proposed:**
  - EN "Hands every Level Up to its player, whatever the rows say. A student with no player opens here"
  - PL „Oddaje każdy Level Up graczowi, niezależnie od wierszy. Uczeń bez gracza otworzy się tutaj"

### S7 - low (code) - `closeXTooltip`: "the notice history keeps it" is false for two cards
- **Where it is drawn:** popup.mjs:930, on every card.
- **What the code does:** two cards are shown with `record: false` and kept nowhere. Both are on a player's screen:
  - `showWaiting` (popup.mjs:1116);
  - the ready round's card (boundary.mjs:620).
- **Fix:** in code. Set the tooltip only where `record` is true; the text stays.

### S8 - low - `showThePassageTooltip`: "your room", and the Polish word
- **Where it is drawn:** sheet.mjs:2939, on the player's own sheet.
- **What the code does:** the student shown must be in the giver's current room (the claim at bridge-table.mjs:182). The window's note adds that the GMs are told (`DRPG.Passage.show.note`).
- **The wording:**
  - "Your room" can read as one's bedroom.
  - PL bare „przejście" is not the glossary's `secret-passage-word` („tajne przejście"), which T28 reads.
- **Sureness:** medium; the ambiguity is a reading.
- **Proposed:**
  - EN "Lets a student in the same room use the passage too. It costs no action; the GMs are told"
  - PL „Pozwala uczniowi w tym samym pokoju też korzystać z tajnego przejścia. Nie kosztuje akcji; GM-owie się o tym dowiedzą"

### S9 - low - `searchTokensStepperTooltip`: "tokens" is the map's word
- **Where it is drawn:** room-setup.mjs:344.
- **The term:** the glossary's `search-token` is "Search Token" in both languages.
- **What the code does:** "at once, without Apply" holds (room-setup.mjs:336-340; the field has no name).
- **Proposed:**
  - EN "Changes this room's Search Tokens at once, without Apply"
  - PL „Zmienia Search Tokens tego pokoju od razu, bez Zastosuj"

### S10 - low - `useTheTemplateTooltip`: it replaces what is typed
- **Where it is drawn:** messenger-app.mjs:325.
- **What the code does:** the click sets `area.value = noteTemplate()` (:327). The button is drawn only while the saved note is empty, so typed text that was not yet saved is lost.
- **Proposed:**
  - EN "Puts the GMs' questions in the box, in place of what is typed there"
  - PL „Wpisuje do pola pytania od GM-ów w miejsce tego, co już tam jest"

### G7 - low (PL) - `whichRemnantTooltip`: the word order turns the copy round
- **Where it is drawn:** gm-items.mjs:1006.
- **What the code does:** the trace is copied into the bullet (`bulletFromRemnant`, gm-items.mjs:1302).
- **The PL problem:** „Remnant na mapie, który kopiuje ten Truth Bullet" reads first as "the Remnant that copies this Truth Bullet".
- **Proposed:** PL „Remnant na mapie, z którego ten Truth Bullet powstaje jako kopia".

### S11 - low (PL) - `categoryTooltip`: „za nią" points at „tabeli"
- **Where it is drawn:** tables-editor.mjs:965.
- **What the code does:** the icon follows the category only while no picture is chosen (`paintItemPicture`, tables-editor.mjs:830-834).
- **The PL problem:** „za nią" attaches to the nearest feminine noun, „tabeli".
- **Proposed:**
  - EN "With the tier, decides which table the item joins. The icon changes with it unless you pick a picture"
  - PL „Razem z Tier wybiera tabelę, do której trafi przedmiot. Ikona zmienia się z kategorią, dopóki nie wybierzesz obrazka"

### G8, S12-S15 - low (style)
- **`tellThePlayerTooltip` (PL):** „bez słowa do gracza" is unnatural. Proposed: „Odznacz, żeby zabrać przedmiot bez informowania gracza".
- **`backUpTooltip` (PL):** in „…; żaden gracz nie powinien go zobaczyć", „go" can attach to „sekret". Proposed: „Zapisuje każdy sekret GM-a w tym świecie do pliku, którego żaden gracz nie powinien zobaczyć".
- **`chatNoteTabsTooltip`:** says "session" twice (EN and PL).
  - Both a player and a GM see the tab.
  - Proposed: EN "A note for the GMs, read before every session" / PL „Notatka dla GM-ów, czytana przed każdą sesją".
- **`sectionTooltip` (PL):** „Liczba to ustawienia" is unnatural.
  - The count is `s.shown.length + s.extra.count` (settings-window.mjs:241).
  - Proposed: EN "How many settings this section holds" / PL „Liczba ustawień w tej sekcji".
- **`roomPictureThumbnailTooltip`:** restates the thumbnail's aria-label ("Show the picture of {room}"). Optional: "Opens this room's picture at full size".
- **`goThroughTooltip` and `onALootedItemTooltip`:** each leaves out the condition the player meets. Both hold as written.
  - **Go through:** it goes only within one square of an end (movement.mjs:2137, :2156-2172). "Costs what a door costs" holds (movement.mjs:2181-2182).
  - **Looted item:** ticking takes nothing. "Take the ticked" takes them with one Hand roll (anonymity.mjs:417), plus a Shadow roll when somebody else is in the room (:419-423).
- **Notes, not findings:**
  - **`roleTooltip` ("at once"):** making a player's character a Monokuma asks first (gm-students.mjs:216).
  - **`undoKeepTooltip`:** starts with "Undo:", its button's label. It is written into a chat card the primary builds (sheet-audit.mjs:2788, 2805), so it is in the primary's language (REVIEW-102's #16).
  - **`tabsPoolsMonokumasStudentsTooltip`:** sits on the Pools tab only (gm-team-dialog.mjs:528).

## Checked and clean

### C4, `DRPG.Tips.Gm.*`

| Key | Checked at |
| --- | --- |
| minusTooltip, plusTooltip | despair.mjs:1233-1235; a player's button is hidden and disabled (:1246, 1258-1262) |
| whichStudentTooltip | gm-items.mjs:233 |
| categoryTooltip | gm-items.mjs:527 |
| whatThePlayerIsTooltip | gm-items.mjs:990, 1151-1153 |
| whatItReallyIsTooltip | gm-items.mjs:1025; truth-bullets.mjs:420-424 |
| howHardTheOriginalTooltip | gm-items.mjs:1027; analyze.mjs:190-194 |
| giveAnItemTooltip | gm-items.mjs:869, 919 |
| giveATruthBulletTooltip | gm-items.mjs:1288, 1322 |
| poolNameTooltip | gm-team-dialog.mjs:434 |
| revokeThePoolFromTooltip | gm-team-dialog.mjs:446; despair.mjs:187-210 |
| monokumaTooltip | gm-team-dialog.mjs:474 |
| despairPoolTooltip | gm-team-dialog.mjs:477 |
| showAgainTooltip | diagnostics.mjs:2218, 2234 |
| openTooltip | gm-panel.mjs:1035 |
| studentsTooltip | gm-panel.mjs:1161 |
| copyToClipboardTooltip | gm-panel.mjs:764, 780-787 |
| clearTheLogTooltip | gm-panel.mjs:766, 795; utils.mjs:291 |
| doNotMentionFoundTooltip | requirements.mjs:400, 325-331 |
| giveTooltip | gm-students.mjs:100; despair.mjs:770-795 |
| aCharacterDiesTooltip | gm-students.mjs:135, 375 |
| amountTooltip | gm-students.mjs:99, monocub.mjs:781; despair.mjs:793 |
| levelUpTooltip | gm-students.mjs:178, 390 |
| campaignNameTooltip | gm-campaign.mjs:170; clock.mjs:47-48 |
| phaseTooltip | gm-campaign.mjs:174, 319-330 |
| chapterTooltip | gm-campaign.mjs:173, 220; season-setup.mjs:828 |
| restoreFromAFileTooltip | gm-stores.mjs:2368, 2464, 2531-2560 |
| moveThemIntoTheTooltip | gm-stores.mjs:2369, 2381-2386 |
| clearTheMastermindTooltip | gm-stores.mjs:2373; mastermind.mjs:292-295 |
| enterTooltip | gm-stores.mjs:2498, 2505 |

The meaning of tellThePlayerTooltip, backUpTooltip, monokumaPoolTooltip and despairPool2Tooltip holds too. Their wording is in G4 and G8.

### C5, `DRPG.Tips.Setup.*`

| Key | Checked at |
| --- | --- |
| iPickThePlayerTooltip | level-up.mjs:1211, 1147, 1155 |
| applyTooltip | level-up.mjs:602, 624-631 |
| handThemOutTooltip | level-up.mjs:1231, 1143-1151 |
| aStudentSNameTooltip | passages-tab.mjs:102, 322-323 |
| aStudentKnownAtTooltip | passages-tab.mjs:137, 324; passages-gm.mjs:1809-1812 |
| aRowSActionTooltip | passages-tab.mjs:191, 337 |
| playlistForAStateTooltip | sound-panel.mjs:103, 229-230 |
| resetMusicTooltip | sound-panel.mjs:179; music-play.mjs:1175-1205 |
| nameInATableTooltip | tables-editor.mjs:344, 350, 1394 |
| deleteTableTooltip | tables-editor.mjs:1055, 1213 |
| addAnItemTooltip | tables-editor.mjs:1667, 1574-1585 |
| createTableTooltip | tables-editor.mjs:1674, 1524 |
| installReinstallTooltip | tables-editor.mjs:1681, 89-114 |

### Across both commits

- **Polish:** no gendered past and no singular-turned-plural in the 73 PL texts. A regex scan found none of `-łeś`/`-łaś`. The second person to the one acting (`cię`, `twoim`, `ty`) is allowed by V1/P2 (docs/text-style.md:465, :473).
- **GM-only facts:** none on a player's screen. The player-facing keys are:
  - C5's Go through, Show the passage, the loot pick, the Note tab, the template, a notice's close, the room picture, the settings section and Level Up's Apply;
  - C4's Despair steppers, whose buttons a player gets hidden and disabled.

## Not checked

- **Whether a tooltip shows at all:** on a disabled control (the Play button, sound-panel.mjs:176, and REVIEW-102's #5 sites). That needs a browser at a table.
- **The GM gate of every C4 window:** not traced one by one. C4's windows are the GM panel's, and only the Despair steppers' gate was read.
- **The HUD's campaign name:** that a player sees it was read from hud.mjs:344, not opened as a player.
