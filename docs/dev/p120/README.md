# Line P of 1.2.120: the planner (N119-6, OWN-119-1..3)

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

## What the shots cannot show

Item 1 (a sort picked applies at once) is about when the Map redraws, not how it looks; it is held by tests, not by a
shot.

## How they were made

From `audit/harness`, after `npm ci`:

    DRPG_CAPTURE_ONLY=investigation--map-move,investigation--map-moved DRPG_CAPTURE_OUT=<dir> node cluster.mjs probes/08-capture-windows.mjs
    node ../case-map-sweep.mjs <dir> --shots <shots> --ids '^investigation--map-move' --scale 2 --chromium /opt/pw-browsers/chromium

For 1.2.119 the capture ran with `DRPG_REPO` at a checkout of e515907d. The sweep page always runs this checkout's
`relayoutCaseMap` and stylesheet. On 1.2.119's captures the canvas names no sort, so that relayout places the second
column by its inputs, as 1.2.119 does. The hover shots were taken by a small probe kept outside the repository: the same
page as the sweep's, with the node hovered by Playwright's pointer. For 1.2.119 its server served e515907d's
stylesheets.

What the shots are not: Foundry's frame and stylesheet (the harness's capture). In the Map shots, some nodes of the first
column are drawn over the toolbar at the top left, where the sweep's camera scrolled to reveal the open node. This shows
in 1.2.119's shots as well, so it is older than this line, and it was not looked into here. The sweep read 0 cuts,
0 overlaps and no hover under AA on all eight of this line's pages (both themes, 1366x768 and 1920x1080, before and
after).
