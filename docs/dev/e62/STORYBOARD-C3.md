# E62 C3 storyboard: the death fade and the Monocub's return (SB-C3, round 1)

Written 12.11.2026 on main at 421f2395 (1.2.109). Design only: no module code, no lang keys. The owner's amend of 05.11
(MK-R3, docs/dev/plans/E62.md on the planning line, amendments table) says both effects "get a storyboard and a mockup
before E62 is built"; none existed (docs/dev/e62/STATUS.md, "C3 ... Not started; owner's step"). This is the storyboard;
the mockup with motion follows the owner's answers.

Review page: artifact `8gni5URmiXM78qBjfid8S1` (private, link with the coordinator; Polish first, an English summary under each
group; Approve / Change / Hold per group and per question; answers kept in the page's database under `answers/`).

## What the pictures are and are not

- Drawn in the glass harness (`audit/glass-harness.html?role=player`, and `&theme=legacy`) in headless Chromium, with the
  module's stylesheets from module.json, a player's screen at 1366x768, deviceScaleFactor 1. Not Foundry.
- The fade's code does not exist. Stained Glass frames are composed on the harness's own curtain: the canvases
  `glass.mjs` drew (`canvas.sg`, `canvas.pulse`, `canvas.seamline`) and its pane outlines (`window.__glass.LAST.panes`,
  20 panes at this size). "Bare glass" is a greyed, darker copy of the glass canvas (`grayscale(1)`,
  `brightness(0.72 - 0.3 x edges)`) laid inside the outlines of the panes already out, over a neutral fill; the pulse
  canvas is faded by opacity; the seam canvas is greyed (`brightness(0.42)`) last. The room tile's and voice tile's art
  is greyed with its pane's batch (CSS filter). The stand-in dialog of the harness is hidden.
- Monokuma Legacy has no curtain: its frames are greyed group by group with a CSS filter (`grayscale`,
  `brightness(1 - 0.25 x a)`).
- The harness draws English text only, so the screens are English; the page's captions and questions are Polish.
- The composition script lives outside the repository (the scratchpad of this line); the method above is all it does.

## Who sees it, and what starts it (from the rulings, not new)

- Only the victim's player (ruling (a), 10.10). The GM and other players see nothing; the effect sends no packet and
  writes nothing (ruling (b); E05's secret of an unfound death).
- Death: the player's own copy of the death row (`pendingDeath`, hook `drpgDeathsChanged`), known or not (b).
- Monocub: the Monocub flag on the victim's character, the hook sfx.mjs already plays the "Monocub" sound on
  (sfx.mjs `onActorFlagged`). A dead student who never becomes a Monocub stays at bare glass (c).
- A reload or late join shows the rest state with no animation. The body-discovery flicker (C4) plays over bare glass
  and returns to it (10.10 14:10).

## Motion spec

Batches (Stained Glass, the 20 panes at 1366x768 by `LAST.panes` index), outside in, the player's own tools last:
1. top slivers 13-18; 2. bottom slivers 8-12 and 19; 3. rail, three, tray (1-3); 4. clock, notes, room tile (0, 5, 6);
5. voice tile and launchers (4, 7). Legacy groups: the Despair bar (`#ui-top`); status and projects
(`#ui-right-column-1`); the clock with the room tile (`#ui-left-column-1`); the voice tile with the launchers.

### Death fade, 3.6 s (MK-R3 allows 3-4 s)

| Frame | ms | What moves | Sound |
| --- | --- | --- | --- |
| D1 | 0 | Nothing; the victim's state is set on the client at once | none |
| D2 | 0-870 | Batch 1 goes out 0-180 (`--drpg-ease-leave`); batch 2 starts at 600, its colour back for 90 ms at 780, out for good at 870 | none |
| D3 | 1200-1470 | Batch 3, the same pattern (start, flicker at +180, end at +270); the pulse goes with each batch's colour | none |
| D4 | 1800-2670 | Batch 4 at 1800, batch 5 at 2400 | none |
| D5 | 3000-3390 | All glass bare, pulse off; the edges flicker twice (3000, 3300) | none |
| D6 | 3600 | Rest: bare glass, edges dimmed | none |

At most 3 flickers in any 1000 ms window over the whole screen (the C2 check, reused). Pulse off in the settings: only
the edges flicker. Reduced motion, Esc, and the table's sequences switch off: D6 at once.

### Monocub return, 2.4 s (MK-R3 allows 2-3 s)

| Frame | ms | What moves | Sound |
| --- | --- | --- | --- |
| M1 | 0 | Nothing; the flag is set | the existing "Monocub" |
| M2 | 0-200 | Edges: on 0-90, off 90-200, on from 200 (`--drpg-ease-arrive`) | - |
| M3 | 500-890 | Pulse back at 500; batch 5 at 600 (flicker at +180, settled at +270) | - |
| M4 | 1000-2070 | Batches 4, 3, 2 at 1000, 1400, 1800 | - |
| M5 | 2200-2470 | Batch 1 at 2200; rest at about 2.4 s | - |

Legacy: the same timings, four groups, each flickering once.

## Questions on the page (each with its default)

| # | Question | Default |
| --- | --- | --- |
| 1 | The death fade (Stained Glass) as drawn | approve |
| 2 | Batch order | outside in, the voice tile with the mic last (others: random groups as E62-3; top to bottom) |
| 3 | Length | 3.6 s |
| 4 | Sound | none new: the death is secret until found, and the victim's speakers may carry over voice; the existing "death" plays as today at the announcement |
| 5 | What goes out | the glass only (pane colour, pulse, edges) and the notice host's and tile button's accent; the HUD's text, Despair and Hope stay coloured |
| 6 | The Monocub return (Stained Glass) as drawn | approve |
| 7 | Order | edges, pulse, then colours from the player's tools outward |
| 8 | Length | 2.4 s |
| 9 | Sound | the existing "Monocub" only, no new Sound row |
| 10 | The Monocub flag taken off by a GM | bare glass at once, no animation |
| 11 | Legacy as drawn | approve |
| 12 | Legacy: what greys | the whole frame with its content (text stays readable) |
| 13 | Legacy timings | the same as Stained Glass, four groups |
| 14 | The shared rules | approve |
| 15 | Who sees it | only the victim's player, per ruling (a); this round's brief said "on every screen", which conflicts with (a) and with the death's secrecy |
| 16 | The table's sequences switch | turns both effects off: the rest state at once |
| 17 | A death or Monocub written as a GM's correction (Students window, Edit campaign) | no animation, the rest state at once, as Edit campaign never plays animations; a death in play (murder, execution) plays the fade |
| 18 | The next step | a live mockup in the glass harness at 1366x768, Stained Glass then Legacy, then C3's code |

## Shots

`shots-c3/strip-glass-death.jpg`, `strip-glass-monocub.jpg`, `strip-legacy-death.jpg`, `strip-legacy-monocub.jpg`:
contact strips of the frames above at half size, each frame labelled with its id and time. The full-size frames are on
the review page.
