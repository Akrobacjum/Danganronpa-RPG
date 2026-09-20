# Typography

Two faces, both OFL, both shipped in `fonts/`. The rules below are the ones
`styles/stained-glass.css` follows; the audit page (`docs/design/`) shows them
on screen. Anything this file forbids is a defect, not a preference - there is
a test for the two that can be tested (`scripts/tests.mjs`).

## The faces

| Face | Token | Where | Rules |
|---|---|---|---|
| **Special Elite** | `--drpg-font-title` | window title (21px), campaign name on the clock (18px), event name (19px), character name (24px), the messenger's author line | never uppercase, never below 16px, **no letter-spacing**, one line; it is the typewriter of a case file, so it appears once per window: where the name of the thing is |
| **VT323** | `--drpg-font-chrome` | clock labels, pool names and counts, status strip, Projects tray, buttons, tabs, chips, tables, field labels, notices, launchers, action tiles, the ticker behind the clock | uppercase with 0.04-0.18em tracking on labels (the smaller the size, the wider the tracking); 11-15px at 100% scale; tabular numerals; **no bold, no italic** - the face has neither, so the browser fakes them |
| **VT323** | `--drpg-font-prose` | window body text, item descriptions, messenger messages | no uppercase, no tracking, at most 74 characters a line; emphasis by state colour, not by weight |
| **VT323** | `--drpg-font-stamp` | Ultimate, GM only, Blackened, the phase on the clock, ballots | uppercase, 14-15px, ink colour on a plate in the meaning's colour |

## The floor

`--drpg-sg-floor` is **11px** and nothing in the theme is set smaller at any
interface scale. The scale (80-140%) multiplies against it through
`max(var(--drpg-sg-floor), calc(...))`, so 80% does not take a 12px label to
9px. Below 11px VT323's five-pixel strokes start dropping out.

## Neither face has a bold or an italic

Both ship one weight and one style. `font-weight: 600` therefore does not pick
a bolder cut - there is none - and the browser smears the glyphs sideways
instead, which on a five-pixel face reads as a rendering fault. Milestone 9 in
`stained-glass.css` sets `font-weight: 400; font-style: normal` across the
module's own containers for that reason. Font Awesome is exempt and must be:
its class rules pick the glyph *with* the weight (900 solid, 400 regular), so
an icon that loses its weight loses its glyph.

## Uppercase and the boxes it has to fit

VT323's capitals are tall for its em, so a box sized for lowercase clips them:
"MONOKUMA" read as "MUNUKUMA" on a tablet in 1.2.27, and the same on
"AFTERNOON" and "STILL TO ACT". The rule is: any chrome box that carries
uppercase gets `line-height: 1.3` or more and no `overflow: hidden` unless
something inside it scrolls. An ellipsis is for a **name** somebody typed, never
for a label the module wrote itself.

## The pixel face is Monokuma Legacy's

Press Start 2P (`--drpg-font-pixel`) is the Legacy identity and its default.
Its two `!important` sweeps in `danganronpa.css` outrank almost every font rule
in `stained-glass.css`, so the two faces cannot share a client: `pixelFontOn()`
in `settings.mjs` returns true only under Legacy, and the switch is shown in
the Look window only there. See `fonts/README.md` for the files and the
licences.

## The screen's own factor

Every size above is for 2560 x 1440 at 100 %. Since 1.2.35 `applyTheme()`
multiplies the slider by the screen's factor - the short side against 1440p,
between 0.7 and 1 - so a 1280 x 800 tablet draws the panes at 70 % of the
monitor's and a 1080p screen at 75 %, while the 11 px floor keeps the type
readable at every factor. The Look window shows both numbers. Streaks and
veins on a coloured pane run parallel to the pane's longest edge.

## Monokuma Legacy takes the slider too

Until 1.2.43 the Interface scale moved nothing at all on a Legacy client:
`danganronpa.css` read neither `--drpg-ui-scale` nor `--drpg-type-scale`, so its
234 stated sizes were fixed and the only thing the slider changed was the number
in the Look window's own note. Measured at 80 / 100 / 140 %, every probe read the
same 28 / 15 / 11 px.

The factor that sheet takes is `--drpg-legacy-scale`, and it is **the slider
alone** - not the slider times the screen. That sheet was drawn at one size for
every screen, so wiring in the screen term would have shrunk every Legacy label
by 15 % at 1080p the day it shipped. Three factors now, one per job: geometry
takes `--drpg-ui-scale`, the glass's type takes `--drpg-type-scale`, and this
sheet takes `--drpg-legacy-scale`, which `applyTheme()` pins at 1 under the glass
so that theme does not move twice. It is published on `body` **and** on
`documentElement`, because the six `--drpg-text-*` rungs are declared on `:root`
and a custom property is substituted against the element its declaration sits on.

What the theme redeclares is Foundry's own ladder, `--font-size-8` ...
`--font-size-80`, because Daggerheart's sheet reads it 223 times and half of what
a player looks at on the character sheet is sized by Daggerheart, not by us.
The consequence is deliberate: under Legacy the slider now also moves Foundry's
sidebar, chat and settings windows, exactly as it has always done under the
glass. Every rung is N/16 rem, which is the value Foundry and Daggerheart already
state, so at 100 % the block changes nothing.

## Legacy's floor is 10px, and it is per rung

The 11px above is VT323's floor and the glass's. Press Start 2P is a bitmap face
drawn on an 8px grid, and the smallest size this module states for it is 10px -
`--drpg-text-xs`, which is 11px at 100 % - so 10px is where Legacy's shrinking
stops. Twelve of the 22 literals in the sheet and the rungs from 10 to 14 carry
`max(10px, ...)`; the rest cannot reach it at 80 % and state no floor, because a
floor a declaration cannot reach is a comment pretending to be code.

**The floor is per rung and not flat.** A flat 10px would have *grown* rungs 8
and 9 at 100 %, and rung 9 carries the pixel face's trait names, the sheet tabs
and a tile's cost. A rung already under 10px therefore floors at its own size: it
stops shrinking rather than starts growing. Rungs 15 and up need no floor at all
(15 x 0.8 is 12). Floors are stated in px on purpose - a bitmap face dies at a
real pixel size, not at a relative one.
