# Line P of 1.2.120: the planner's Move in every column (N119-6)

Shots for the owner, 21.11.2026. Each is the Investigation window on the Map, 1920x1080, drawn in Chromium by
`audit/case-map-sweep.mjs --shots --scale 2` from probe 08's captures `investigation--map-move` (before) and
`investigation--map-moved` (after): the probe's typed case under the sort "kind" (in the window: by kind), the
deduction "The killing was before 23:40, ..." (`probe08-d1`) open in the second column, then its Move down pressed.

| File | Code | What it shows |
| --- | --- | --- |
| `shots/1.2.119-glass-before.png`, `shots/1.2.119-legacy-before.png` | e515907d (v1.2.119) | the column before the press |
| `shots/1.2.119-glass-after.png`, `shots/1.2.119-legacy-after.png` | e515907d | after Move down: the sort box reads "By hand", and the column is drawn in the same order as before |
| `shots/1.2.120-glass-before.png`, `shots/1.2.120-legacy-before.png` | this line | the column before the press, the same as 1.2.119's |
| `shots/1.2.120-glass-after.png`, `shots/1.2.120-legacy-after.png` | this line | after Move down: the open deduction stands one place lower, below "The case was broken from inside", and its lines follow it |

Read off the captures' drawn tops (column 2, top to bottom, before any browser measuring):

- 1.2.119, before and after: d5, d1, d4, d2, c1 - the press wrote an order, and nothing moved.
- 1.2.120, before: d5, d1, d4, d2, c1; after: d5, d4, d1, d2, c1.

How they were made (from `audit/harness`, `npm ci` once):

    DRPG_CAPTURE_ONLY=investigation--map-move,investigation--map-moved DRPG_CAPTURE_OUT=<dir> node cluster.mjs probes/08-capture-windows.mjs
    node ../case-map-sweep.mjs <dir> --shots <shots> --ids '^investigation--map-move' --scale 2 --chromium /opt/pw-browsers/chromium

For 1.2.119 the capture ran with `DRPG_REPO` at a checkout of e515907d. The sweep page always runs this checkout's
`relayoutCaseMap` and stylesheet; on 1.2.119's captures the canvas names no sort, so that relayout places the column by
its inputs, as 1.2.119 does.

What the shots are not: Foundry's frame and stylesheet (the harness's capture). Both 1.2.119's and 1.2.120's shots show
nodes of the first column drawn over the toolbar at the top left, where the sweep's camera scrolled to reveal the open
node; it is there before this change and was not looked into here. The sweep itself read 0 cuts and 0 overlaps on all
eight pages (both themes, 1366x768 and 1920x1080, before and after).
