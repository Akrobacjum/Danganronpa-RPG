# E105 - the closing curtain under the open windows, the title over them

Branch `curtain-under`, from 58e0fd06 (the 1.2.111 line). Local commits only; the coordinator merges.

The owner's ask (13.11.2026, verbatim): "Animacja zamkniecia kurtyny - zamkniecie kurtyny niech bedzie pod otwartymi
oknami, napis i jego tlo na otwartych oknach."

## State

- Done: the reading below; R5380, R5381, R5382 red then green; sequence.mjs and danganronpa.css changed; LIVE-E105-01;
  the shots (section 6); the quick gate and scenarios 63, 74, 93 (section 5).
- Commits (local, not pushed): 6ea64bac (the two layers), bb2a8a49 (the title's grounds whole over the windows), and this
  file's last numbers.
- Blockers: none. Not done: no review page (the coordinator's override); tools/stages.json left alone.

## 1. What the stacking was (58e0fd06)

Which sequences close a curtain: only the trial's entry and its exit. Both are `drawTrialEntry`
(scripts/sequence.mjs:330 before E105, 344 after; called by `playTrialEntry` and `playTrialExit`): under Stained Glass the
panes (`.drpg-seq-glass.is-close`, `canvas.drpg-seq-closed`, `.drpg-seq-glass.is-open`), under Monokuma Legacy, on a
stacked screen or with no curtain cut the two lids (`.drpg-seq-lid`). The other sequences close no curtain:
the verdict's cut-in (`drawVerdictCut`, a band and portraits), the start-of-day and end-of-day boards (`drawDayStart`,
`drawDayEnd`, a panel in the middle). The phase and hour transitions of scripts/transitions.mjs turn the live curtain
(glass.mjs `hintTurn`, at z 1, under the whole interface) and close nothing; the discovery's flicker is a class. So the
change is for the two trial edges alone; the cut-in and the boards keep their one host over the windows (default taken,
owner to confirm).

- The host: one `div#drpg-sequence` appended to the body (scripts/sequence.mjs:151, :160), `position: fixed; inset: 0;
  z-index: 99980; pointer-events: auto; contain: strict` (styles/danganronpa.css:18180-18199). A fixed box is a stacking
  context, so the curtain AND the title stood at 99980 together, over every window, and the host took every click: an
  open window was under the closing curtain and could not be clicked for the 3.4 s (1.5 s still).
- During a sequence `#drpg-popups` was raised to 99990 (danganronpa.css:18202) in both themes, and Foundry tools / Map
  tools (`.drpg-foundry-window`, the sidebar in a window: chrome) hidden (:18203).
- The live curtain (`#drpg-curtain`) and its frost (`#drpg-curtain-frost`, the backdrop blur, stained-glass.css:417)
  are body children at z 1, just under `#interface` (glass.mjs `STYLE` :3497, `layerIndex` :3498, `place` :3532,
  `mount` :3537). During the trial edges the live curtain is held at 0 (`glass.hold`) under the sequence's own copies.
  The sequence's layers carry no backdrop-filter.
- What the module stacks between (its sheets' text): `#interface`'s columns at `--z-index-app` 30 (Foundry's; the glass
  harness's stand-in, audit/glass-harness.html:65), the notice stack under Stained Glass and the evidence stage and the
  empty Legacy tile at 29 (danganronpa.css:6011, :6037, :17947), Foundry tools' window at 30 (components.css:1634; 31
  on a stacked screen, narrow.css:409), the corner's launchers at 70 (base.css:50, components.css:1996, :2035,
  danganronpa.css:13635, :13698), the messenger roster and the expanded sidebar at 71 (base.css:113,
  danganronpa.css:8047); over the windows the raised objection 99989 (:6059), the Legacy notice stack 99990 (:5984),
  the stacked Legacy roster 99991 (narrow.css:536).

## 2. How Foundry v14 stacks windows: confirmed and assumed

- ASSUMED, not read in v14's source (none in this repository): ApplicationV2 windows are body children, raised by
  `bringToFront`, which writes the next number of a running counter on the element's `style.zIndex`; the counter starts
  at `--z-index-window` = 100, so the first window is 101 and every raise adds one. The harness models exactly that
  (audit/harness/lib/shim.mjs:1381 `let maxZ = 100`, :1526 `bringToFront`), "modelled from v13's ApplicationV2 as
  remembered" (shim.mjs:1373-1379); LIVE-E23-04 is the older check of the raise. scripts/stacking.mjs's header reads the
  same counter ("sheet 101, dialog 102").
- ASSUMED: `--z-index-app` is 30 on v14 (danganronpa.css:8041 calls it "the glass harness's reading of v14").
- NOT KNOWN: whether v14 caps the counter or wraps it; whether a `modal: true` DialogV2 is opened with `showModal()`
  (the browser's top layer, over any z-index - then a modal window, Safeword's and a few sheet and table-editor dialogs,
  stands over the title too); where v14 puts its own notifications, tooltips and context menus. LIVE-E105-01
  (audit/AUDIT-1.2.42.md 9.2, item 508) asks the table for all of it, and R5380 run at the table (`game.drpg.runTests()`)
  reads the page's real `--z-index-window` and every open window's z-index.

## 3. What it is now

- sequence.mjs `drawTrialEntry` draws in two layers, `seqLayer` (:330): `.drpg-seq-curtain` (the panes, the closed
  curtain, the lids) and `.drpg-seq-top` (the title band, its background and the chapter's line), both
  `aria-hidden`, appended to the host in that order (:353). The glass's fade in over `handIn` and out over `hand` move
  to the curtain layer (they were the host's; the title has its own fade).
- danganronpa.css (THE SEQUENCES, after :18203): for the trial edges (`#drpg-sequence[data-drpg-sequence-look]`) the host
  is `display: contents`; `.drpg-seq-curtain` is fixed at `calc(var(--z-index-window, 100) - 2)` = 98, `pointer-events:
  auto`; `.drpg-seq-top` fixed at 99980, `pointer-events: none`; under Stained Glass the notice stack stands at
  `calc(var(--z-index-window, 100) - 1)` = 99 for the span (over the curtain, under the windows, as it stands there
  outside a sequence); under Monokuma Legacy it keeps 99990 (over the windows and the title, as before).
- Order from the bottom: board 0 - live curtain and frost 1 - interface 30 - corner 70-71 - closing curtain 98 - glass
  notice stack 99 - windows 101+ - title 99980 - raised objection 99989 - Legacy notices 99990 - stacked roster 99991.
- Both themes, desk and stacked (the glass and the lids alike), motion and still: one rule set; reduced motion changes no
  layer (R5381 reads the still frame).
- In the title layer the chapter line's dark shard (90 % until now) and the glass's band (Despair pink at 95 %) are whole
  (bb2a8a49, R5382): the first shots showed a window's title and words through both, across the line, once the title
  stood over the windows. On the closed curtain the difference is 5-10 % of the ground; outside the trial's edges the
  tokens are as they were.

## 4. Defaults taken, owner to confirm

1. The closing curtain stays over the board and the interface chrome (sidebar, hotbar, the module's HUD, the corner's
   buttons, Foundry tools and Map tools - those two stay hidden for the span as before); only windows rise above it.
2. The title band, its background and the chapter's line stand over every window and every chrome; the notice stack under
   Monokuma Legacy (99990), a raised objection (99989) and Foundry's own error toasts stay over the title, as they stood
   over the old host (MK-R1: "the notice tile stays on top").
3. Windows stay clickable during the sequence; a click on the title over a window goes through to the window
   (`pointer-events: none` on the title's layer).
4. A window opened during the sequence is raised by Foundry's counter over the curtain like any other.
5. Under Stained Glass the notice stack stands over the curtain and under the windows for the span (it was raised to
   99990, over the windows, before); under Monokuma Legacy over both, as before.
6. The verdict's cut-in and the day's boards are unchanged: one host at 99980 over the windows (they close no curtain).
7. Escape still ends the sequence first (its capture listener), so the first Escape does not close a window; the next does.
8. The title's band and the chapter line's shard are opaque over the windows (they were 95 % and 90 %); the gap between
   the band and the line, which showed the curtain, now shows what stands there - a window's header in the 393x852 shot.
9. float-text.mjs still drops a floating field when a sequence starts (its rule "a sequence stands over everything");
   with the windows over the curtain that is no longer needed for the trial's edges, left as it is (no change asked).

## 5. Tests and numbers

- R5380 (tier 1): the cascade from the sheets' text, both themes, desk and stacked, entry and exit, glass and lids. Red at
  58e0fd06: the host had no `display: contents`, no layer had a position or a z-index, the glass notice stack read 99990.
- R5381 (tier 1): the DOM of the entry (glass in motion, lids in motion and still) and the exit: two layers, the curtain's
  children, the title in the top layer alone, the fades' targets. Red at 58e0fd06: the host's children were the panes,
  the lids and the title; the fades in and out were the host's (`["host"]`).
- R5382 (tier 1): over the windows the band's and the shard's grounds are opaque, both themes. Red at 6ea64bac:
  `{"glass":{"band":true,"sub":true},"legacy":{"band":false,"sub":true}}` (see-through).
- Green on the edited tree: R5380, R5381 with R3704, R3705, R4420, R4422, R4402: 8 passed, 0 failed (34.3 s); then
  R5380-R5382 with R4402: 5 passed, 0 failed.
- `node audit/glass-sweep.mjs --title-contrast` (Chromium, the glass harness): TITLE CONTRAST GREEN, the chapter line's
  glyphs and their 5 px surround 12.74-17.49 at the 1st percentile, both themes, entry and exit, 1366x768 and 393x852;
  the controls read 3.15-3.72, under 4.5 as they must. Its harness window has no z-index (z auto), so there it stands
  under the curtain: this run reads the line over the curtain, not over a window. The plain sweep was not run: quick.sh
  runs it for glass.mjs, glass-harness.html, glass-sweep.mjs or narrow.css, and none of them changed.
- QUICK at bb2a8a49 (quick.sh, QUICK_MAX_SCEN=3): lint/check/gate ok; prose ok; own(8) ok - the tier-2 tests that read
  sequence.mjs or the curtain, by name ("the trial's entry and exit play from Start and End the trial", "the trial's exits
  say what happened", "E94 C4: the school's mood", "E110 day boards A", "E110 day boards B", "the curtain is recut when
  the tab comes back", "E48-K5 - switching theme", "a phone is told apart from a desk"): 12 passed, 0 failed; scenario
  63-class-trial 79/79 (122.8 s), 74-room-tile 44/44 (85.5 s), 93-spectator 17/17 (28.7 s) - the three that
  `git grep` finds naming sequence.mjs, drpg-seq, drpg-curtain or data-drpg-sequence in audit/harness/scenarios; t01 RED:
  1406 passed, 1 failed (R3712), 16 skipped, 519.1 s wall, under another line's load. R3712 read a write of
  `gmClockBeat` (the primary GM's clock beat, gm-stores.mjs) inside its window - a setting neither this stage nor its
  test touches; alone it passed twice (2 passed, 0 failed each), and tiers 0-1 whole again at bb2a8a49 (this file aside):
  1422 tests ran, 1407 passed, 0 failed, 16 skipped, 0 red, 507.4 s wall. Read as the beat's timing under load, not
  measured further.
- What jsdom cannot measure: layout, painting, compositing, z-order as drawn, backdrop filters, hit testing. Those are
  the shots below (Chromium, the glass harness: no real Foundry) and LIVE-E105-01.

## 6. The shots

Folder: `shots-e105/` in the session's scratchpad, beside the worktrees (outside the repository; its full path is in
the coordinator's report), made by `shoot.mjs` there: the glass harness (audit/glass-harness.html, the module's real sheets and the
real sequence.mjs, played on a held clock with every Web Animation paused at its time), deviceScaleFactor 2, both themes,
1366x768 for the entry and the exit and 393x852 for the entry; the harness's window raised to 101 as Foundry's counter
would, a second window (z 102) opened 500 ms in, while the curtain closes. Two frames each: `-1-closing` (500 ms) and
`-2-closed-title` (1800 ms, the title in). `before-*` are the same at 58e0fd06 (a throwaway worktree, removed), `after-*`
at bb2a8a49, `r1-see-through/` at 6ea64bac (the band and shard still see-through). Looked at, each:
- before: the closing panes and the lids cover both windows (the second window too); the title over the curtain.
- after: both windows stand over the closing panes and the lids for the whole span; the band, its ground and the chapter
  line stand over the windows; Legacy's lids and Stained Glass's panes alike; the notice button stays on the curtain.
- Hit tests (`after-hits.json`, `elementFromPoint`): a window's footer -> the window; a point of the band over a window ->
  the window (the title lets clicks through); a point with no window -> the curtain layer. Before: the closed curtain or a
  lid at the window, the band at the band. z read: curtain 98, title 99980, notices 99 under Stained Glass, 29 (the empty
  Legacy tile, as before) or 99990 under Monokuma Legacy.
What the shots are NOT: no real Foundry (the harness's stand-in DOM and no Foundry sheet: its window layer is set by hand
to 101 and 102, not by v14's counter), no real sheet or module window (the harness's dialog markup), no canvas board, no
GPU compositing of a real table; the 393x852 run drew the glass's panes, so the flat-glass lids under Stained Glass were
not shot (the same layer rules as Legacy's lids, read by R5380).
