# The six statistics in one row (1.2.115)

The owner on 1.2.114 (14.11.2026, a photo of an 850 px sheet under Stained Glass, the six as 3 over 3): "Podoba mi sie
pomysl by wysrodkowac, ale koniecznie w 1 rzedzie."

What changed: danganronpa.css "THE SIX STATISTICS IN ONE ROW", sheet-header.mjs `fitTraitRow` / `traitFitStep`,
R5760 (the cascade) and R7330 (the order of the steps).

The pictures: the sheet's header at 667, 850 and 1300 px, Monokuma Legacy and Stained Glass, before (21973f06) and after,
Chromium at deviceScaleFactor 2, saved at 256 colours. The page is Daggerheart 2.12.8's stylesheet built from its source
with the module's seven sheets, the header written from header.hbs with the module's additions. No Foundry stylesheet
(not on this machine) and no Font Awesome (its icons are grey squares).

## Measured (Chromium, 14.11.2026)

"Shadow" with its plate, the widest of the six:

| | beside its mark | padding cut | letter-spacing 0 | mark above |
| --- | --- | --- | --- | --- |
| Legacy (pixel face, 11 px, its floor) | 86 px | 84 | 84 (no tracking to take) | 74 |
| Stained Glass (VT323, 21 px, its floor) | 89 | 87 | 77 | 59 |

The step each sheet takes, 100 % (the row's width in brackets):

| sheet | Legacy | Stained Glass |
| --- | --- | --- |
| 667 px (362) | short names (LEG BOD HAN EYE SHA HEA), mark above, one row | mark above, one row |
| 850 px (545) | mark above, one row | gap, padding, letter-spacing; one row |
| 1120 px (815) | as drawn, one row | as drawn, one row |
| 1300 px | as drawn, one row | as drawn, one row |

The step before three over three is the short names (the coordinator's, for the owner's "koniecznie w 1 rzedzie"): a
statistic is then as wide as its value's box, 52 px times the slider, and the full name stays the plate's tooltip and
aria-label. At 140 % (a sheet opens 1.4 times as wide: Legacy 1190, the glass 1568): one row in both themes; Legacy
narrowed by hand to 934 px takes the short names (legacy-934-140pct-after.png). Three over three is left only for a row
under about 322 px at 100 % (a Legacy sheet under about 630 px) and 447 px at 140 % (a 667 px sheet at 140 %, both
themes). In every case measured no mark stands on its neighbour's plate and nothing runs out of
the header.

## Not measured here

A real Foundry: its own stylesheet, the fonts as the table loads them, a sheet resized by hand (the fitter listens for
the row's width), and the moment the fonts arrive after the first draw.
