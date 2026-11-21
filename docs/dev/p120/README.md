# Line P of 1.2.120: the planner (N119-6, OWN-119-1..3, the lines)

Shots for the owner, 21.11.2026, in Chromium. Each Map is the Investigation window at 1920x1080, drawn by
`audit/case-map-sweep.mjs --shots --scale 2` from probe 08's captures `investigation--map-move` (before) and
`investigation--map-moved` (after): the probe's typed case under the sort "By kind", with the deduction
"The killing was before 23:40, ..." (`probe08-d1`) open in the second column. "After" is the same window once that
deduction's Move down has been pressed.

## Sorting past the first column, and Move (items 2 and 3 of the owner's reports, and N119-6)

| File | Code | What it shows |
| --- | --- | --- |
| `shots/1.2.119-glass-before.png`, `shots/1.2.119-legacy-before.png` | e515907d (v1.2.119) | "By kind" picked, yet the second column stands in its inputs' order |
| `shots/1.2.119-glass-after.png`, `shots/1.2.119-legacy-after.png` | e515907d | after Move down: the sort box reads "By hand", and nothing moved |
| `shots/1.2.120-glass-before.png`, `shots/1.2.120-legacy-before.png` | this line | "By kind": the second column in kind and name order |
| `shots/1.2.120-glass-after.png`, `shots/1.2.120-legacy-after.png` | this line | after Move down: the open deduction one place lower (below the counter), its lines following it, "By hand" |

The second column, top to bottom, read off the captures' drawn tops (before any browser measures):

- 1.2.119, before and after: d5, d1, d4, d2, c1. The order the inputs give, whatever the sort; Move wrote an order and
  nothing moved.
- 1.2.120, before: d5, d4, d2, d1, c1 ("By kind": the deductions by name, then the counter). After: d5, d4, d2, c1, d1.

## A node under the pointer (item 2 of the owner's reports)

| File | Code | What it shows |
| --- | --- | --- |
| `shots/hover-1.2.119-glass.png` | e515907d | a deduction under the pointer under Stained Glass: a bone box, its name gone (1:1) |
| `shots/hover-1.2.119-legacy.png` | e515907d | the same under Monokuma Legacy, readable already (7.97:1) |
| `shots/hover-1.2.120-glass.png` | this line | under Stained Glass: the kit's light wash, the name readable (9.65:1) |
| `shots/hover-1.2.120-legacy.png` | this line | under Monokuma Legacy: unchanged (7.97:1) |

The ratios are `case-map-sweep.mjs`'s hover read: the name's ink against the ground it is drawn on under the pointer
(the window, the node's fill and the theme's brush, composited), by WCAG 2. The high-contrast switch was read too, by
the same probe: it changes nothing on a node under the pointer in either theme.

## Lines that skip a column (item 1 of the owner's reports, "Linie w planerze - niech omijaja nodes")

| File | Code | What it shows |
| --- | --- | --- |
| `shots/lines-1.2.119-glass.png`, `shots/lines-1.2.119-legacy.png` | e515907d | lines to a column further on cross the deductions standing between (the sweep reads them through "Somebody cleaned up after it", `probe08-d5`) |
| `shots/lines-1.2.120-glass.png`, `shots/lines-1.2.120-legacy.png` | this line | each such line runs at its Remnant's height through a gap the deductions' column leaves for it; the deductions moved down to make room |

From probe 08's capture `investigation--map-lanes`: the typed case with a deduction resting on a deduction and two
Remnants, and the solution resting on it and a Remnant, so lines skip one column and two; "By kind", every node closed.
`case-map-sweep.mjs` reads every drawn line against every node's box in Chromium after the measured relayout ("line ...
through ..."): on 1.2.119's code it named lines through `probe08-d5` on every page; on this line's, none, on 20 pages
(the lanes, crowded, typed and Move captures, both themes, both sizes). The 1.2.119 sweep ran from inside a checkout of
e515907d (its copy of the new sweep), so its relayout and routes are 1.2.119's.

## What the shots cannot show

A sort picked applying at once (and a node's fields written as they change) is about when the Map redraws, not how it
looks; it is held by tests, not by a shot.

## How they were made

From `audit/harness`, after `npm ci`:

    DRPG_CAPTURE_ONLY=investigation--map-move,investigation--map-moved DRPG_CAPTURE_OUT=<dir> node cluster.mjs probes/08-capture-windows.mjs
    node ../case-map-sweep.mjs <dir> --shots <shots> --ids '^investigation--map-move' --scale 2 --chromium /opt/pw-browsers/chromium

For 1.2.119 the capture ran with `DRPG_REPO` at a checkout of e515907d. The sweep page always runs this checkout's
`relayoutCaseMap` and stylesheet. On 1.2.119's captures the canvas names no sort, so that relayout places the second
column by its inputs, as 1.2.119 does. The hover shots were taken by a small probe kept outside the repository: the same
page as the sweep's, with the node hovered by Playwright's pointer. For 1.2.119 its server served e515907d's
stylesheets.

What the shots are not: Foundry's frame and stylesheet (the harness's capture).

## The toolbar: nodes drawn over it, and "By hand" drawn small

| File | Code | What it shows |
| --- | --- | --- |
| `shots/toolbar-1.2.119-glass.png`, `shots/toolbar-1.2.119-legacy.png` | e515907d | the window as the GM sees it (the camera on the open node, the graph clipped): the order's select at 11 px beside "Add a plan" at 21 under Stained Glass |
| `shots/toolbar-1.2.120-glass.png`, `shots/toolbar-1.2.120-legacy.png` | this line | the order's select at the theme's select size, as "Add a plan" (under Stained Glass "All open" then wraps to a second row at this window's 1100 px) |

| `shots/toolbar-600-1.2.119-glass.png`, `shots/toolbar-600-1.2.119-legacy.png` | e515907d | the window drawn 600 px wide (`--width 600`), the GM's view |
| `shots/toolbar-600-1.2.120-glass.png`, `shots/toolbar-600-1.2.120-legacy.png` | this line | the same: the tools wrap to rows, none over another |

THE TOOLBAR DOES NOT OVERLAP, NARROW OR WIDE (measured 21.11.2026, `case-map-sweep.mjs`'s toolbar read: every button
and select of the Map's tools and its view switch, by its box, against every other and against the window's content
box). Windows drawn 1120, 900, 720, 600 and 480 px wide, both themes, at 1366x768 and 1920x1080: no control over
another, none past the window's edge, on 1.2.119's code and on this line's; the read's planted control (a tool moved
over its neighbour) reads. What differed on 1.2.119 was the order select's size alone (above). Seen at 600 px and not
the toolbar's: the footer's "Preview realization" breaks inside its word ("REALIZATIO / N") under Stained Glass.

THE NODES OVER THE TOOLBAR WERE THE SHOTS', NOT THE WINDOW'S. The Map shots sent before 21.11.2026 04:30 UTC (this
folder's first versions) were taken by the sweep's whole-canvas shot, which lifts the graph's clip to show every node -
while the camera stood moved to reveal the open node, so the canvas spilled up over the toolbar. The "-view" shot of the
same page, the window as the GM sees it, has the graph clipped and nothing over the toolbar (`toolbar-*.png` here are
those). The sweep now puts the camera back to its origin before the whole-canvas shot, and every Map shot in this folder
was taken again with it, 1.2.119's included. The sweep read 0 cuts, 0 overlaps, no hover under AA, no line through a node and the toolbar's selects alike on all
twelve of this line's pages (the lanes and Move captures, both themes, 1366x768 and 1920x1080).
