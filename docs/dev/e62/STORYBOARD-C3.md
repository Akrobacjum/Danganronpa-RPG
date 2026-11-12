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

## The owner's answers to SB-C3 (12.11.2026, read from the page's answers, 18 of 18)

Approved as drawn or as proposed: #2 (order), #3 (3.6 s), #5 (only the glass goes out), #6-#10 (the whole Monocub
return, its order, 2.4 s, the existing "Monocub" sound only, the flag taken off with no animation), #11-#13 (Legacy as
drawn, the whole frame greys, the same timings), #14-#18 (the shared rules; only the victim's player sees it; the
sequences switch turns both off; a GM's correction plays no animation; a live mockup next).

Two changes, in the owner's words:

- #4, the fade's sound: "Z dzwiekiem". The fade has a sound. The coordinator's proposed default, being confirmed with the
  owner: a new Sound row "Death fade" / "Gaśnięcie" in the incident category, its default file the existing death sound,
  played once at the fade's start on the victim's screen only. The mockup carries it as a stub (a tag and an optional
  test tone).
- #1, the fade as drawn: "Martwy automatycznie staje sie obserwatorem z nowym tokenem obserwatora. Kurtyna pozostaje
  zgaszona do czasu az postac zostanie monocubem, wtedy jej token obserwatora zmienia sie w monocuba". The dead becomes a
  Spectator (E92's role) with a new spectator token; the curtain stays out until the character becomes a Monocub, and
  then the spectator token turns into the Monocub. The coordinator holds the open questions (a secret death against a
  spectator's view, the voice room against E72's room of the dead, where the token stands); not built and not in the
  mockup until the owner answers.

## The live mockup (MK-C3, round 1)

Review page: artifact `4kuhjmCmKNgygbUKuKvBUA` (private, link with the coordinator; Approve / Change / Hold for the fade,
the return and the sound row). Its copy without the review's decision code: `docs/dev/e62/mock-c3/index.html` with the
five layers it composes in `mock-c3/img/` (open it from a local server at the repository root, as the glass harness).

What it is: a canvas that composes three real glass-harness frames of a player's screen at 1366x768 (the full curtain;
every pane bare with its edges lit; every pane bare with its edges dimmed) inside `glass.mjs`'s own 20 pane outlines,
and Legacy's full and greyed frames inside its four groups' boxes, by the motion spec above. Controls: Stained Glass or
Legacy; play the fade or the return; Esc (button and key) to the end state; a scrubber; reduced motion and the table's
sequences switch (both: the end state at once, the sound still played); pulse off (the batches go out with no flicker,
only the edges flicker); slow x4; the test tone. Not Foundry; the pulse is static; the spectator token is not in it.

## The dead as Spectators: the owner's answers (12.11.2026, about 00:40 CET, relayed by the coordinator)

- A, "Tak": every death (murder, execution, any other) makes the dead a Spectator at the moment of death.
- B, "Tak": a dead Spectator sees only what a dead student sees today - not E92's full view (every room, every token,
  secret projects); the full view stays for a Spectator a GM sets, since the dead may come back as a Monocub.
- C, "Tak": the Spectator's token stands in the room where the body lies; the body stays a corpse; the token is hidden
  from the living, and a GM sees it at 0.3 (as E92).
- D, "Nie - od razu w obserwatora. Wiem ze to duza zmiana, ale mysle ze to lepsze": not E72's room of the account's own
  until the body is found; the dead goes straight into the Spectators' voice (Talk with the Spectators). E72 C8 ships
  the per-account dead room in 1.2.110; this reverses it for the dead. **The owner's accepted trade-off:** another dead
  student or a Spectator may hear of a secret death before the body is found.
- E (no answer, the default taken): on becoming a Monocub the same token turns into the Monocub's (image and role) and the
  curtain plays the return.
- F, "Tak": a dead student who never becomes a Monocub stays a Spectator to the season's end, the curtain out.
- The sound (no answer, the default taken): a new Sound row "Death fade" / "Gaśnięcie" in the incident category, its
  default file the existing death sound, played once at the fade's start on the victim's screen only.

## Spec: the dead as Spectators (part of E62 C3; no code before the coordinator schedules it, after 1.2.112)

What exists (main, 1.2.109): E92's Spectator is a character flagged `spectator` (config.mjs `FLAGS.spectator`), owned by
an account with no student (monokuma.mjs `isSpectator`; spectator.mjs `spectatorViewer`, `watcherOf`); the flag is
public by design ("who watches is the table's to know", spectator.mjs's header). Voice routes a Spectator account by
voice.mjs `spectatorAccount` / `spectatorTalks` (`SPECTATOR_ROOM`) and a death kept secret to `DEAD_ROOM`
(voice.mjs, the routing of the dead); E72 C8 (1.2.110) gives each dead account its own room (voice-client.mjs
`deadRoomFor`). Death is two predicates (settings.mjs `isDeceased`, the table's; `isDeadForGm`, the GMs' and the
player's own copy) and becomes the table's only at `publishDeath` (chapter.mjs). A Monocub needs a published death
(monocub.mjs `eligibleForMonocub` reads `isDeceased`); `setMonocub` writes its flag.

### What changes where

1. **The role, without a public flag before the death is published.** A dead Spectator is a reading, not E92's flag:
   `deadWatcher(actor)` = dead by the reader's own predicate (`isDeadForGm` on a GM and on the player's own copy,
   `isDeceased` elsewhere) and not a Monocub. Nothing in world data says it before `publishDeath` (E05, R190, R9;
   world-secrets.mjs). E92's `FLAGS.spectator` and its full view stay the GM-set Spectator's alone (B). After
   publication nothing new is needed: the death is public.
2. **What the dead see.** Unchanged from today (B): a dead student's view. The changes are the curtain (bare glass, C3's
   fade), the token, the voice and the sound.
3. **The token (C).** Made by the primary GM at the moment its record of the death is written (the GMs' `deaths`
   store), in the scene and room where the body's token stands, hidden from the living (`hidden: true`), seen by a GM at
   0.3 as E92's. The body's own token stays the corpse. On whose actor: see Q1 below.
4. **Voice (D).** At the death the primary routes the dead account to `SPECTATOR_ROOM` (Talk with the Spectators), not to
   `DEAD_ROOM` nor E72 C8's `deadRoomFor`; voice.mjs's routing of the dead is the one place. The trade-off above is the
   owner's accepted choice; the handbook says it.
5. **The Monocub (E).** `setMonocub(actor, true)` turns the same token into the Monocub's token (its image and role)
   and the victim's curtain plays the return (MK-C3); `setMonocub(actor, false)` gives the Spectator back, bare glass at
   once (SB-C3 #10).
6. **Never a Monocub (F).** The Spectator token and bare glass stay to the season's end; the season reset removes the
   token (a row of season-reset.mjs's registry, walked by season-wipe.mjs `wipeSeason`).
7. **Corrections are silent (SB-C3 #17).** A death or a revive written from the Students window or Edit campaign makes
   or removes the token and sets the curtain with no animation; a death in play (murder, execution) plays the fade and
   its sound.
8. **Migration.** A clause of migrate.mjs's `CLAUSES`, run by `runMigrationOnLoad` on the primary GM when the version
   has moved (R178: no other road lifts data), idempotent like every clause; beside `bodiesToLay`: each student
   `isDeadForGm` and not a Monocub without a Spectator token gets one where its body's token stands, with no animation;
   one whose body has no token is listed for the GM (Pre-season's checks). On the player's next load the curtain is at
   bare glass at once.
9. **Sound.** A new `SFX_EVENTS` row "Death fade" / "Gaśnięcie" (incident), default the death file, played once at the
   fade's start on the victim's browser only (sfx-play.mjs `playSfx`, no socket); none under a correction.
10. **Files, as far as read:** settings.mjs (the predicate), chapter.mjs and the death's record (the moment), a new
    spectator-dead.mjs or spectator.mjs (the token, the conversion), voice.mjs (routing), monocub.mjs (`setMonocub`'s
    conversion), migrate.mjs (the lift), season-reset.mjs (the reset's row), glass.mjs and motion.css (the fade and the
    return), config.mjs and lang/ (the Sound row and texts, EN and PL), the handbooks (the trade-off), world-secrets.mjs
    (the rule for whatever Q1 decides).

### Questions left, each with the default this line would build on

| # | Question | Default |
| --- | --- | --- |
| Q-C3b-1 | A token made at a secret death is world data every browser receives, hidden or not (D2): a console reads that a new token stands in the body's room. Accept it, as the owner accepted the voice's (D), or make the token only at the death's publication? | Make it at the death (A, C), and write it beside D's trade-off; world-secrets.mjs gets a rule that the token carries no flag naming the death |
| Q-C3b-2 | Whose token: the student's own actor (a second token beside the corpse) or a new Spectator actor per student owned by the same player? | A new actor per student, owned by the player, named after the student: the module reads one token per student (rooms, movement, the body), and a second one would break those readings |
| Q-C3b-3 | May the dead move their Spectator token, as an E92 Spectator moves freely? | Yes, with no costs and no room rules, and the living never see it |
| Q-C3b-4 | A revive in play (not a correction): does the curtain play the return, and the token go? | The token goes, and the curtain plays the return (MK-C3's) |
| Q-C3b-5 | E72 C8's per-account dead room (1.2.110): kept for anything once the dead go to the Spectators' voice? | Retired for the dead; the trial's own rules for the dead in the Class Trial unchanged |
| Q-C3b-6 | Migration: an already-dead student whose body has no token anywhere | Listed for the GM in Pre-season's checks, no token made |
