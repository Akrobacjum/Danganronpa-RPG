# E97 fix - the case map after the owner's review of 12.11.2026 (branch claude/e97-fix)

Kept by the fix line's agent. Last written 12.11.2026.

## For the coordinator

**State:** the three asks of the review are built, tested red then green, measured in Chromium, and pushed.
Base fa73b601. Commits on claude/e97-fix: 0db8dca9 (the work), and the commit that adds this file. CI on the head:
see "CI" at the end of this file.

The review (verbatim): "Rozmiar pol wnioskow, truth bullets i generalnie kazdego modulu jest za maly, przez co opisy sa
poucinane. Powiekszmy je by zawsze wyswietlaly cala swoja zawartosc, a edycja niech nie odbywa sie po prawej stronie
ekranu (usuwamy panel), tylko na samych modulach. Dodajmy ruch i oddalanie i przyblizanie 'kamery' na schemacie jesli
jeszcze go nie ma."

**The Map as the default view (the owner's decision relayed 12.11, "E97 tak"):** already so on this base since C9 -
`investigationView` answers "map" for a GM with no `investigationView` flag - and held by tier 1's R3652, which opens the
dashboard for a GM with no flag and expects `opened: "map"`. Checked by a mutant here: the default turned to "table"
-> R3652 failed (1 passed, 1 failed); put back -> green (2 passed). No code change needed.

### What changed

| Ask | What was built | Test |
| --- | --- | --- |
| 1. Nodes show their whole content | New `scripts/case-view.mjs` (a leaf, no import): `MAP_GEOMETRY`, `mapPlace`, `edgePath` moved there and re-exported by case-map.mjs under the same names (E99 reads them there). `mapPlace` takes each node's measured size; a column is a stack (12 px between nodes), as wide as its widest node, so no two nodes overlap by construction. `relayoutCaseMap` measures the drawn nodes in a browser (and again when fonts load and when a node's box changes size) and places nodes, column heads, the gap and the edges again; in jsdom every box reads 0 and the drawn numbers stand. A node is at least 240 x 54 (196 at C5), its head wraps instead of cutting the kind (the trial-mode pill no longer hides it), its name is whole, and its description stands under it (a Remnant's player text, a named Key slot's text, a schema node's note: new `text` on evidence nodes in case-schema.mjs `graphOf` / `caseGraph`). No line clamp, ellipsis, nowrap or fixed height on any node part. | R3660 (tier 0) |
| 2. Editing on the node, no side panel | The `<aside>` is gone. Each node's fields are a `<fieldset class="drpg-case-edit" data-drpg-edit=id>` in the canvas under its face, at the open width (352 px); the open one shown, the rest `hidden` but still in the form, so the Table's one Save writes them exactly as before (same field names, same `readDashboardForm`/`applyDashboardSave`). What the panel said of a node (state, room, author, who has it, mode, reach, "only the culprit", its own problems) opens with it; Move up / Move down and Remove are on the node. Opened by a click or Enter on its face (a native button, `aria-expanded`); closed by Escape (stopped there, so the window does not close) or a click on the graph's empty space (a drag is no click). The chapter's summary (counts, problems, Check consistency, who has what, the Key limit override, the Final Truth form) is a folded overview line over the graph; add / order are one row of tools over it. | R3661 (tier 0); the tier-2 "E97 C6" tests (a Remnant's and a schema node's fields saved from the Map) unchanged and green |
| 3. Camera | The graph's box never scrolls (`overflow: clip`); the canvas moves under one transform. Drag on empty space pans; the wheel zooms about the pointer (not over a text box or a picker); - / + / Fit to view in the graph's bottom right corner, and the keys + = - 0; zoom clamped 0.25..2; the pan keeps 48 px of the graph in view; a focused node or field, and an opened node, are brought into view. The buttons' and keys' zoom eases 160 ms unless motion is reduced (`body.drpg-reduced-motion` or the system query); wheel and drag never ease. The camera is the window's state (`reading.camera`), kept across redraws. | R3662 (tier 0) |
| 4. Names | New keys `DRPG.CaseMap.editLabel, toolsLabel, cameraLabel, zoomOut, zoomIn, zoomLevel, zoomFit` in EN and PL. The order picker lost its visible label (named by `aria-label` and title) so the tools keep one row at 1366x768 under the glass. The case realization's room picker gets a name: tier 2's "every control in the module's own chrome has a name to be read out" failed on it at fa73b601 when run with the "E97 C" tests (24 passed, 1 failed), green now. R3659 green. | R3661's `nameless: []` over every control of a drawn map |

Also in 0db8dca9:
- **The node rule outranks the glass's button rule.** stained-glass.css section 7 (`.drpg-panel button:not(...)` x4: 7
  classes, `white-space: nowrap`, 14 px sides, line-height 1.35) beat C5's node rule (5 classes): under the glass every
  node name stayed on one line, cut at the node's edge (seen in the sweep's first run: "The culprit came in wi"). The node
  rule has 8 classes now.
- **The node's state rules reached no node at C5.** hover, held, planned, unrelated, counter and solution were written
  lighter than the node rule (4 classes against 5), so none of those looks applied in either theme. They take the node
  rule's selector now. This changes the look of held / planned / counter / solution nodes from what the round-1
  screenshots showed (they now look as C5's comments described).
- The "Rests on" checklist no longer scrolls in a 12rem box (the brief: no inner scroll); its labels at line-height 1.3
  (under Legacy's pixel face their lines overlapped).
- Edges meet a node at its face's middle, not the middle of face and open fields together.
- GM handbook EN and PL: the Map paragraph rewritten (open on the node, Escape / empty space, the overview line, the
  camera).
- Probe 08 seeds one long Remnant (a long name and player text) and words on a deduction, dropped with the case.
- `audit/case-map-sweep.mjs` (new; eslint.config.mjs gives it the browser globals as for glass-sweep.mjs): the Chromium
  measurement below.
- R3651 and R3655 (C5's and C7's tests) adjusted: R3651 reads a place's x and y (a place carries w and h now) and its
  edge literal follows `MAP_GEOMETRY.nodeW`; R3655 reads the open node's problems on the node. Both promise what they
  did; registry rows regenerated.

### Red and green

| Run | Result |
| --- | --- |
| Red: the new tests-tier0.mjs on fa73b601 (`DRPG_REPO=<worktree> node run-tests.mjs --tier 0 --only R3660 --only R3661 --only R3662 --only R3655 --only R3651`) | 2 passed, 4 failed: R3660 "there is no case-view.mjs with relayoutCaseMap", R3661 "the open node draws no fields on itself - they stand in a side panel: {aside:1,open:null}", R3662 "there is no case-view.mjs with zoomAt", R3655 (problems not on the node) |
| Green, same five | 6 passed, 0 failed |
| Mutants (each put back after) | C5's fixed `height: 54px` on the node rule -> R3660 red; Escape without `stopPropagation` -> R3661 red; the ease kept under reduced motion -> R3662 red |
| Tiers 0-1, head of 0db8dca9's tree | 1245 tests ran: 1230 passed, 0 failed, 16 skipped, 0 red (385 s) |
| Tier 2 by name: "E97 C" and "every control in the module's own chrome has a name to be read out" | 25 passed, 0 failed (fa73b601: 24 passed, 1 failed - the realization's room picker) |
| 61-gmstore-case | 113/113 |
| 62-investigation | 51/51 |
| `npm run quick` | green (lint 304 files 0 problems; check 17 parts green, parity and prose among them; gate self-test 37/37) |

Not run: scenario 84 (as told), the whole tier 2, the other scenarios (only the two that read the case map), the local
gate.

### The look, measured in Chromium

`node audit/case-map-sweep.mjs <en> <pl> --chromium /opt/pw-browsers/chromium`, on probe 08's three Map captures
(`DRPG_CAPTURE_ONLY=investigation--map,investigation--map-node,investigation--map-trace`, EN and `DRPG_CAPTURE_LANG=pl`),
at 1366x768 and 1920x1080, Stained Glass and Monokuma Legacy (pixel font). The page imports scripts/case-view.mjs and
runs `relayoutCaseMap` and, with a node open, `wireCaseCamera`'s reveal, as the Map runs them.

- **Controls:** C5's box put back (`height: 54px; overflow: hidden` at the node rule's weight) read 64 cuts; the drawn
  places kept while every node is 120 px tall read 8 overlaps. Both faults seen.
- **24 pages, 0 cut, 0 overlaps;** every open node's face inside the viewport after the reveal (8 of 8 pages with a node
  open).
- Numbers (nodes 12 on every page):

| Theme, size | Graph viewport | Tallest closed node | Tallest open node (deduction / Remnant) | Canvas, nothing open |
| --- | --- | --- | --- | --- |
| Glass 1366x768 | 972 x 337 | 365 px | 1019 / 948 px | 840 x 1027 (EN), 840 x 1172 (PL) |
| Glass 1920x1080 | 972 x 641 | 365 px | 1019 / 948 px | the same |
| Legacy 1366x768 | 972 x 346 | 285 px | 767 (EN), 783 (PL) / 664 (EN), 651 (PL) px | 840 x 908 (EN), 840 x 983 (PL) |
| Legacy 1920x1080 | 972 x 650 | 285 px | the same | the same |

  Before the tools went to one row and the camera to the corner the glass viewport was 289 px at 1366x768. The tallest
  closed node is the seeded long Remnant (a 98-character name and a 190-character description). An open deduction is
  tall because "Rests on" lists every other node of the chapter whole (no inner scroll); the camera brings its top into
  view and the GM pans or zooms to the rest.

Screenshots: in the session's scratchpad only, not in git.

### What was not measured

- **Not in Foundry.** The sweep reads probe 08's captures under the module's sheets in Chromium, not Foundry's frame, its
  stylesheet or real data; the window's frame is the style harness's. How the camera feels with a mouse and a trackpad
  (wheel steps, pinch, a drag) was driven only by synthetic events (R3662 in jsdom; the reveal in Chromium). A real
  table's check of LIVE-E97-* style items would cover it.
- **The click-outside close** is read on the graph's empty space only; a click elsewhere in the window (toolbar,
  footer) leaves the node open, by choice: Save in the footer must not shut the fields it reads.
- **Escape vs Foundry's own Escape handling**: the keydown is stopped at the graph (default prevented, propagation
  stopped; R3661 reads that nothing outside the map heard it). Whether Foundry v14's keybinding manager listens in a
  capturing phase above it was not read from v14's source; if it does, Escape would close the window as well.
- The glass's general button rule still gives the tools' and camera's buttons its 14 px sides (not a cut; noted).
- Touch: `touch-action: none` on the graph and pointer events are used; no touch device was tried.

### Open to the coordinator / owner

- The overview line is the one block of the Map that is not on a node (the chapter's own fields: the Key limit
  override and the Final Truth form belong to no node). It stands over the graph, folded by default. If the owner wants
  even those on a node, the Final Truth form could move onto a Final Truth node.
- Nodes are 240 px wide closed (from 196). Wider would lower tall nodes further but widen the map; the owner may want
  another number.
- `.claude/rules/code.md`'s file table has no row for case-view.mjs (nor for case-schema/layout/map, as STATUS.md
  says); `.claude/` is not this line's to edit.
