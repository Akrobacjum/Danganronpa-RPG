# The Interface scale down to 25 % (1.2.115)

The owner, 14.11.2026: "Chcialbym powiekszyc tez zakres zmniejszenia ui (aktualnie minimum to 0.8, celujmy w 0.25".

What changed: settings.mjs `UI_SCALE` (0.25 to 1.4 by 0.05), `clampSlider`, `floorScaleOf` and the token
`--drpg-floor-scale`; the 29 served 11 px floors read it; under 80 % a window's header controls keep a 24 px target;
the setting's hint (EN, PL), the line under the slider while it is under 80 %, and the handbooks. R7331, R7332.

The pictures: the character sheet, the GM panel and the HUD at 25 % and 50 %, Monokuma Legacy and Stained Glass,
Chromium at deviceScaleFactor 2, 256 colours. The sheet is the stand-in of docs/dev/traits-115 (Daggerheart 2.12.8's
stylesheet, the window at 850 or 1120 px times the slider); the GM panel is the style harness's captured window at its
704 px times the slider; the HUD is the glass harness at 1366x768 with `?scale=`. The sheet and the GM panel take the
slider as their only factor; at a table the glass's geometry also takes the screen's own factor (0.7 to 1). The HUD's
four shots were taken again on 15.11.2026, after the glass harness learned to stamp `?scale=` as applyTheme does (the
slider on the screen's factor, e6c41260); before, they had the slider as the whole factor. `shots/` holds the two the
coordinator asked for the owner: the HUD under the glass at 1366x768, 25 % and 50 %. No Foundry stylesheet.

## Measured (Chromium, 14.11.2026; the HUD's rows 15.11.2026)

| | 25 % | 50 % | 100 % |
| --- | --- | --- | --- |
| a window's close button, Legacy | 24 x 24 (19 x 5 before the floor) | 26 x 24 | 35 x 13 (unchanged) |
| a window's close button, glass | 35 x 26 | 35 x 26 | 35 x 26 |
| the smallest type, GM panel Legacy / glass | 2.9 / 5.3 px | 5.8 / 10.5 px | 11 / 21 px |
| the HUD, Legacy (box, smallest type) | 219 x 96, 3.4 px | 234 x 110, 6.9 px | 430 x 134, 10 px |
| the HUD, glass | 81 x 126, 2.9 px | 152 x 156, 6 px | 292 x 249, 11.9 px |

audit/glass-sweep.mjs at 1920x1080 and 1366x768, GM and player, both themes, `--page "audit/glass-harness.html?scale=N"`:
on 14.11.2026, at 100 % green and red under it on the sweep's pins, which were written at 100 %. Since 15.11.2026 (the
harness's `?scale=` stamped as applyTheme stamps it, the pins read at each slider in glass-sweep.mjs `PINS_AT`, and the
three faults below fixed) GREEN at 100, 80, 50 and 25 %.

## What did not work at 25 %, measured on 14.11.2026, and what came of it

The voice tile and the sheet's column were fixed on 14.11.2026 (R7334), the room tile on 15.11.2026 (R7335): beside the
notices its toggle, pips and paddings kept their pixels while its box shrank, so at 25 % they lay over the name, and at
50 % on 1366x768 the open description was 0.8 lines tall; they follow the slider under 80 % now (4.2 lines there).

- Under the glass the voice tile is drawn 65 x 94 px: its microphone button stands outside it (x -7) and the speaker's
  name shows 0 px of its 72. At 50 % it holds.
- The character sheet's left column is held at 275 px times the slider (69 px at 25 %), but what is in it measured
  193 px wide on the stand-in (its portrait is the stand-in's image), so the sheet scrolls sideways inside its window:
  60 px under Legacy, 20 under the glass at 25 %; 5 and 3 px at 50 %.
- Under Legacy the GM panel's large buttons ("Set the season up", "Students", "Close") kept Chromium's own 13.3 px:
  Foundry's stylesheet, which sets a button's type, is not here, so whether they shrink at a table is not measured.
- The type is 3 to 6 px at 25 %, unreadable by design; the line under the slider says so.

## Not measured here

A real Foundry: its own window chrome, the drag of a window by its header at 25 %, and the screen factor at a table.
