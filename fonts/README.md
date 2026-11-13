# Pixel font

**Press Start 2P** ships with the module and is on by default. Turn it off with
the *Pixel font* setting.

    pixel.woff2       latin       (12.5 KB)
    pixel-ext.woff2   latin-ext   (9.4 KB)

Split the same way Google Fonts serves it, so Polish letters in a campaign name
(ą, ę, ł, ś, ż…) resolve from the latin-ext file instead of falling back to a
different typeface part-way through a word.

## Polish capitals

A capital's mark sits above the letter with one empty font pixel between them:
the acute of Ó (pixel.woff2) and of Ć Ń Ś Ź, and the dot of Ż (pixel-ext.woff2),
from y 1125 to 1250 on a letter that ends at 1000. Before 13.11.2026 the mark sat
straight on the letter's top row, and at the trial's subtitle (24 px, one font
pixel 3 px) Ó read as O. `node audit/glass-sweep.mjs --accents` fails when any of
Ą Ć Ę Ł Ń Ó Ś Ź Ż reads like its base letter in the sequences' title or line, in
both themes. A redraw changes the `?v=` query on the `@font-face` rules in
`styles/danganronpa.css`, or browsers keep the old file.

## Licence

Press Start 2P by CodeMan38, released under the **SIL Open Font License 1.1**,
which permits redistribution alongside this module.

## Swapping the font - read this first

Replace `pixel.woff2` (and optionally `pixel-ext.woff2`) with any `.woff2`. No
code changes needed; the `@font-face` rules point at these filenames.

**But you will almost certainly have to retune the sizes.** Pixel faces differ
wildly in advance width and x-height, and the `body.drpg-pixel-font` size block
in `styles/danganronpa.css` is tuned for Press Start 2P specifically:

| Font | Character | Sizing |
|---|---|---|
| **Press Start 2P** | Very wide, tall x-height | Needs sizes pulled **down** and `letter-spacing: 0` - what the CSS does now |
| **VT323** | Condensed, small x-height | Needs sizes pushed **up**, roughly 1.4x |
| **Silkscreen** | Middle ground | Close to current values |

Swapping the file without adjusting that block is what makes labels overflow
their containers.

## Where it applies

Interface chrome only: the campaign HUD, Despair rows, character name,
Ultimate, trait labels and values, tab labels, the action panel, and this
module's dialogs.

Deliberately **not** applied to journals, chat message bodies, or an editable
field outside the character sheet and the module's windows. A 5x7 pixel face is
punishing to read in paragraphs, and this game runs on written investigation
notes.

The backstory on the character sheet is the one textarea in the pixel face, on
purpose (the owner's D10, E24): at the small step (13 px at 100 %) with a line
height of 1.7, so the face the player chose stays and the paragraph stays
readable. Without the pixel face it is 15 px at 100 %; under Stained Glass the
prose size. Measured in Chromium on `audit/style-harness.html?sheet=parts`; on a
table it is E24's live check of the biography's type (AUDIT 9.2).

## Stained Glass theme faces

Two more OFL faces, used only when the *Theme* setting is **Stained Glass**
(see `styles/stained-glass.css` and `docs/design/typography.md`):

    VT323-Regular.woff2            latin       chrome, prose, stamps
    VT323-LatinExt.woff2           latin-ext   (Polish letters)
    SpecialElite-Regular.woff2     latin       titles only
    SpecialElite-LatinExt.woff2    latin-ext

VT323 by **Peter Hull**, Special Elite by **Astigmatic**, both under the **SIL Open
Font License 1.1**. Split into latin and latin-ext the same way Google Fonts serves
them, for the same reason as the pixel font above.

**Two other faces were tried and sent back (07.09.2026).** Micro 5 was carried for a
day - its capital is 0.45 em against VT323's 0.56, so the floor had to rise 14 px to 17
to keep the same letter on screen, and even there "MURDER" read as "NURDER" in a table.
Pixelify Sans went the other way, 0.65 em and 46 % wider than VT323 on the same string.
VT323 is the chrome face and the floor is 21 px, which is that capital at 11.7.

Their four woff2 files and four `@font-face` blocks stayed behind after the decision and
were removed in 1.2.41 - 28.5 KB that every player downloaded and no rule ever named. The
measurements are kept in the type note in `styles/stained-glass.css`; only the faces went.
