# E55 step 4 - the sheet's rules by part: measured, indexed, not moved

14.11.2026, on claude/e55-113 at e8f83c90. The plan (PLAN.md step 4, Q-E55-2 = sections inside the existing sheets) gathers
the character and item sheet's rules into sections by part, each block moved "only past rules it does not tie with",
the ties read by R1323's cascade on the sheet's stand-in.

## What a move would cross (measured)

`tools/movable.mjs.txt` (beside this file) reads each sheet rule - a selector naming `.sheet.actor`, the header or
sidebar sheet, the item sheet, the tab bar, the inventory, the action panel or its tiles - and asks whether it could move
to the end of its sheet without passing a rule that may tie with it: a later declaration of the same property family
(a shorthand and its longhands), the same importance, a selector of equal weight, and subjects that could be one element
(the only proof of "could not" it uses: the two subjects name different ids or different tags, or different
pseudo-elements). Of danganronpa.css's **487** sheet rules, **121** could; of stained-glass.css's **169**, **69**.
So three of four of the base sheet's sheet rules stand somewhere a text reading cannot prove a move safe: proving each
needs the cascade on the markup the rule is aimed at (Daggerheart 2.12.8's sheet: `audit/sheet-column/` holds only its
left column; the look freeze's sheet parts are the module's stand-in, not the system's whole sheet). Moving the 121 alone
would leave the sheet in two places per part, the opposite of the goal, and would part each moved rule from the
comment beside it that records why it is written so.

## What was done instead

- Step 3's merges on the sheet (S3 commits): the item sheet's portrait, four parts of the character sheet (traits,
  the resource numerals, the inventory row, the row buttons' glyphs), the stat-named label, the action tiles' Bone, the
  glass's action pip, its tab bar and the glass checkbox: each one rule now.
- The index below: where each part's rules stand today, by the sheets' own banners, read by `tools/sheetidx.py.txt`.

## Q-E55-9 (for the owner, through the coordinator)

The sheet's split as sections: move rules with a cascade proof per move (a stand-in of Daggerheart's whole character and
item sheet in the style harness first, read by the freezes), or keep the rules beside their reasons and keep this
index? Default taken: the index; the split waits for that stand-in, which is its own piece of work.

## The index (generated at e8f83c90)

### styles/danganronpa.css: 487 rules of the sheets in 73 sections

| Section (its banner) | Rules, by part |
| --- | --- |
| Danganronpa RPG - theme tokens | actions 1 |
| DARK-FIRST - the module's surfaces do not follow the client's theme | item sheet 1 |
| Danganronpa RPG - sheet cosmetics | sidebar 1 |
| TRAIT FRAMES - purple rectangles instead of the golden crest | header 4 |
| WHITE LABELS | sidebar 6, header 4, tabs 3 |
| ULTIMATE | header 1 |
| ACTION BUDGET | actions 12 |
| PIXEL HOPE | header 5, actions 1 |
| FOCUS | actions 1 |
| PLAYER-LOCKED FIELDS | header 6 |
| ACTION PANEL (top of the Features tab) | actions 10 |
| INVENTORY GROUPS | inventory 4, header 1 |
| THE PACK'S OWN GROUPS | inventory 16, actions 3 |
| HOPE CALLS / DESPAIR CALLS | actions 18 |
| MONOKUMA SHEETS | actions 2 |
| PIXEL FONT (opt-in: "Pixel font" in module settings) | tabs 1 |
| THE PAUSE BANNER | header 4, actions 3, tabs 1, frame 1 |
| ADVANCEMENT | header 7 |
| CARRIED ITEMS - held ready, and used up | inventory 1 |
| used up, and still in the way | inventory 2 |
| THE KILLING GAME'S RULES | sidebar 2, frame 1, actions 1, header 1 |
| the tray glyph, and the grid that chooses it | frame 7 |
| A TILE ANSWERS THE PRESS | actions 2 |
| SOMETHING GOING OUT | header 3, actions 1 |
| THE ARRIVAL FLARE (F5.5, 2026-08-25) | header 3, actions 1 |
| TRAITS ARE THE GM'S TO SET | header 1, actions 1 |
| THE SHEET IS THIS GAME'S SHEET | sidebar 8, header 1 |
| HIT TARGETS | header 1 |
| LABELS THAT FIT | actions 3 |
| THE SAFEWORD | frame 2, sidebar 1 |
| LEGIBILITY UNDER THE RED PALETTE | actions 3, inventory 2 |
| THE SHEET SITS ON INK | frame 1, sidebar 1, actions 1 |
| GOLD BELONGS TO HOPE | sidebar 2, inventory 2 |
| TAKING OVER THE BASE INTERFACE | header 10, frame 8, actions 1, sidebar 1 |
| STAGE 3 - ONE FONT, ONE SCALE, AND WHITE AS A SURFACE | tabs 5, actions 3, frame 2, header 2 |
| THE SPLIT | sidebar 7 |
| HEADERS AND TABS, AGAINST THE REAL MARKUP | tabs 2, actions 1 |
| TWO COLLISIONS FROM THE INVERSION, BOTH MEASURED | sidebar 1, inventory 1 |
| Health AND STRESS AS PROPER BARS | sidebar 11 |
| …AND THEN AS A FLAT BAR, DRAWN BY THIS MODULE | sidebar 27, header 2, frame 1 |
| THE FONT REALLY MEANS EVERYWHERE | frame 2 |
| STAGE 4 - THE ACTION GLYPHS, DRAWN RATHER THAN BORROWED | actions 13 |
| THE FIVE THAT WERE STILL WEARING FONT AWESOME | actions 7 |
| THE RESOURCE BARS, DRAWN RATHER THAN DELEGATED | sidebar 2 |
| THE LAST OF DAGGERHEART'S COLOUR | tabs 2, header 1, frame 1 |
| STAGE 5, FIRST TRANCHE - THE SEVEN HOPE CALLS | actions 17 |
| STAGE 5, SECOND TRANCHE - THE FOURTEEN DESPAIR CALLS | actions 30 |
| E14 - A CALL THAT IS STANDING, AND THE TWO ROWS THAT SAY SO | actions 3 |
| THE FILL IS THE BOX | sidebar 3 |
| STAGE 7 - THE HOPE CALLS FOLD AWAY | frame 1 |
| STAGE 6a - THE COST STRIPE | actions 7 |
| STAGE 8a - NOTHING HERE TO DO IT TO | actions 4 |
| STAGE 8c - THE ULTIMATE IS A TITLE | header 5 |
| THE SHEET SURVIVES A NARROW WINDOW | frame 7, actions 3, header 3, inventory 3, sidebar 2 |
| A4 - A TILE THAT CANNOT HOLD ITS LABEL STOPS BEING SQUARE | actions 1 |
| BLOCKED BY THE ECLIPSE, NOT BY THE PURSE | actions 1 |
| THE MODULE'S OWN WINDOWS READ IN THE MODULE'S OWN INK | actions 1 |
| ONE HOPE, ONE GOLD | header 2 |
| WHAT YOU HAVE, AND WHAT IS RIDING ON THE NEXT ROLL - SIDE BY SIDE | actions 2 |
| ITEM SHEETS (1.0.1) | item sheet 11 |
| SOMEBODY ELSE'S CHARACTER SHEET (E9) | frame 1 |
| the item card | item sheet 4 |
| flat bars | sidebar 1 |
| THE ITEM ROW BUTTONS | inventory 6, frame 1 |
| THE DROPDOWN, AND THE HALF OF IT THE PAGE DOES NOT OWN | frame 17 |
| THE ITEM ROW BUTTONS, ONE SIZE UP | inventory 5 |
| THE FOUR TILES THE DRAWN SET NEVER REACHED | actions 6 |
| TWO SMALL EVICTIONS AROUND THE PIXEL SET | inventory 1, frame 1 |
| HIGH CONTRAST (W-7, Dawid 18.09) | actions 1 |
| FORCED COLOURS - the interface when the browser is repainting it | actions 2 |
| THE STATS SCALE WITH THE MODULE (Dawid, 22.09: "statystyki postaci nie skaluja sie z | sidebar 6, header 5, frame 1, actions 1 |
| MONOKUMA LEGACY TO PARITY (E48 K6, 11.11.2026; D29 = 2: "Legacy zostaje i dochodzi do parytetu") | actions 8, frame 2, tabs 1 |
| E105 FT, BATCH 3 - FOUNDRY'S AND DAGGERHEART'S CHROME IN THE MODULE'S DRESS, BOTH THEMES | frame 13, inventory 7, item sheet 6 |

### styles/stained-glass.css: 169 rules of the sheets in 35 sections

| Section (its banner) | Rules, by part |
| --- | --- |
| ONE TYPE SCALE, AND EVERY SURFACE IS ON IT | actions 2 |
| motion under the theme: the glass and the light on its seams move, the elements stand | actions 2 |
| the character sheet: two materials | sidebar 1, header 1 |
| Milestone 4: the brush on everything clickable, one field, one table, the | actions 7, inventory 1 |
| Milestone 5: nothing jumps. The state colour slides over the turn on every | actions 1 |
| the sheet's tiles: the audit's tile. Icon, name, cost; the edge in the tile's colour, the | actions 13 |
| the sheet: text on the glass band reads through a shadow, section heads are quiet caps over a | header 2, actions 1 |
| Milestone 7: the sheet's tab bar, the resource bars, the fields of every window. | tabs 8, sidebar 8 |
| corrections from the full mock (every module sheet loaded) | actions 6, tabs 3, sidebar 1 |
| Corrections from the live screens of 1.2.25. | actions 1 |
| the sheet's Daggerheart parts speak the chrome face: section titles as quiet caps over a hairline, | inventory 6, frame 5, header 2, actions 1 |
| Milestone 8: the audit's remaining families - the choice row, the other tab bars, the footer row, | frame 1 |
| A9. Neither face has a bold or an italic | sidebar 1 |
| A8. The faces reach the rest of the module | item sheet 2, frame 1 |
| C-H. The header's own widgets | header 4, actions 1, sidebar 1 |
| C-I4. The roll's two faces are cut dice | header 1 |
| 5. A window's band is the curtain's glass, not a lighter copy of it | header 1 |
| 7. The brush keeps off the letters | actions 3 |
| 5b. A dialog's title is a title | actions 1 |
| AUDIT "SZKLO POD LUPA", ROUND 1.2.41 | sidebar 5, actions 3, frame 2, header 2, tabs 1, inventory 1 |
| NOTHING IN THIS THEME IS ROUNDED | actions 1, frame 1 |
| the sheet, brought to the audit page point by point | header 4, frame 1 |
| the checkbox and the radio: the audit page's, not Foundry's, and ONE definition | frame 11 |
| THREE POINTS THE SHEET STILL OWED THE AUDIT PAGE | actions 10, header 1 |
| three more points, measured against the audit page | sidebar 3 |
| THE ROUND OF 07.09: eight things, one by one | frame 4, sidebar 2, tabs 1 |
| THE LAST FOUR THINGS THE AUDIT PAGE DOES AND THE MODULE DID NOT (07.09) | frame 7, actions 2, sidebar 1 |
| THE PLAYER'S STATUS STRIP GETS THE SAME MARKS AS THE SHEET (07.09) | frame 4 |
| THE PROSE RUNG | frame 3 |
| STEP 4: THE TITLE FACE APPEARS ONCE PER WINDOW | frame 2 |
| STEP 5: HOVER AND SELECTED ARE TOLD APART BY THE EDGE | actions 2 |
| AND NOTHING OPAQUE ON TOP OF IT | sidebar 1 |
| 2. THE VALUE STEP, WHICH THE FLOOR HAD SWALLOWED | sidebar 1 |
| 4. THE FOUR CONTRAST FAMILIES | actions 3 |
| 5. A SCRIM UNDER RUNNING TEXT | frame 1 |

### styles/components.css: 21 rules of the sheets in 2 sections

| Section (its banner) | Rules, by part |
| --- | --- |
| WHAT FOUNDRY LEFT OPEN (E105 FT, batch 1, 11.11.2026; the owner: "Chcialbym pozbyc sie z calego modu | frame 8 |
| Daggerheart's character settings window (E49, 1.2.105; scripts/dh-settings.mjs; the owner's 11.11.20 | tabs 13 |

