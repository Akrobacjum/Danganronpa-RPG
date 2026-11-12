# The Class Trial's hand-over and exit - STATUS

The owner's decisions of 12.11.2026 ("Akcept wszystko" on the exit's defaults; "calosc blyska, bug pulsu" on the
entry). Base: 421f2395 (1.2.109).

## 1. The entry's hand-over (the blink)

What blinked (the seam report, measured on the glass harness in headless Chromium, 1366x768, deviceScaleFactor 1, a
frame about every 100 ms): the entry laid its copies of the curtain over the live one and left the live one standing,
so the glass was drawn twice from the first frame; a 10 % Bone wash stood over the whole screen at 900 ms; the copies'
pulse stood at the start while the live pulse ran, and the host went in one frame with the glow and the interface.

What changed:
- `.drpg-seq-pulse` is gone (sequence.mjs, danganronpa.css): no wash over the closed curtain. A seams-only pulse inside
  the closed canvas was not built: the closed look carries the curtain's own pulse of its moment.
- glass.mjs: `holdPulse` / `pulseNow` stop the pulse's clock from the moment the pieces are taken to the sequence's end;
  `holdCurtain` takes the live curtain and its glow to 0 under the copies and brings them back; `snapshotLook` bakes the
  glow into the sequence's looks; `rebuildAll` paints a recut without turning while the curtain is held.
- sequence.mjs: the copies rise over `handIn` (500 ms) as the live curtain falls, and fall over `hand` (400 ms) at the
  end as it rises; `coverBlocks` fades the clock, Despair, the event panel, the status, the tray and the launchers out
  with the tiles over `handIn` and back in over `handIn` from the opening, each by its own animation (a CSS transition
  lost the cascade to stained-glass.css's `transition` on the same blocks and went in one frame).

The probe (the seam report's probe.mjs, unchanged but for its port), whole-frame mean luma, the largest step between
consecutive frames (about 100-160 ms apart; "a frame" below) in each window, and that step per 100 ms; base one run, after
two runs (1366x768, deviceScaleFactor 1, GM):

| | start (host in to +700 ms) | at 900 ms | title in / out | end (from +3200 ms to the host gone +400) |
| --- | --- | --- | --- | --- |
| base 421f2395 | -11.3 in one frame | +13.5 then -7.9, -7.1 (the wash) | +7.7 / -8.0 | +6.1 / +7.1 |
| after | -3.8 / -4.6 a frame, 3.4 per 100 ms (the curtain closing and the blocks fading over 500 ms) | +0.9 | +7.2 / -3.2..-3.8 | +1.8 a frame, 1.5 per 100 ms |

The plain glass (x30-250, y470-640): base -8.7 in the first frame and +9.3 in the last; after, at most 1.4 at the start
and 1.9 at the end. The hand-back took 300 ms first (the seam report's 200-300): the exit's last frames read +3.1 and
+4.4 apart; at 400 ms at most +2.9 in six runs. What stays over 3 is the sequence's own content: the title arriving
(+7) and leaving (-3 to -4). Curve: scratchpad trialexit/shots/0-curve-after-entry-exit-harness.png (not in the
repository). Not measured: a real Foundry table (LIVE-E61-01), deviceScaleFactor 2, a player's browser.
