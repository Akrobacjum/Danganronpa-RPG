# E62 - status (work line claude/e61-62)

Updated 12.11.2026. The plan is `docs/dev/plans/E62.md` on `claude/plan-130` (read whole). Pattern: MK-R1, MK-R2 (read;
MK-R3's E62-3 timings come from the plan's reading of it: onsets 0, 360, 900, 1320, 1930, 2400 ms).

## Done

| Plan | What | Where |
| --- | --- | --- |
| C1 | A transition from the clock's one event, with its direction: `transitionFor(before, after)` (pure) - an hour forward from the top (E62-1, and the plan's Q5 default for every forward hour), a new day and a rewind from the bottom (E62-2), the Eclipse in from the centre and out inward (E62-4, 1.4 s), the trial's exit from the centre, the trial's entry left to E61. The curtain hears the body's attributes, so the clock's hooks hand it the direction (`hintTurn`, taken by the next turn within 1.5 s); `turnPlan` takes `how`, `groups`, `delays`; `paneOrder` (centre, inward, top, bottom, seeded random) | scripts/transitions.mjs (new), glass.mjs |
| C2 | The Investigation's entry (E62-3): six random groups of the panes on screen at MK-R3's onsets, each with the flash and one sound; Sound row "Pane flash" / "Błysk szyby" (varied pitch); nothing under reduced motion or with the switch off | transitions.mjs, glass.mjs, config.mjs, lang/pl.json, styles |
| C4 | The body's discovery flicker (Q3 default: kept): seams and pulse dim for 220 ms at 0, 450, 900, 1350 ms on every browser from `drpgBodyAnnounced` (rehearsals ignored); Legacy lights the clock, status, Despair bar and notice tile instead | transitions.mjs, styles |
| C8 (part) | Escape ends a running transition on this browser at its end state (`holdEscape` in the engine, `skipTurn` in glass.mjs); the switch is E61's `sequences` | sequence.mjs, glass.mjs |

Found by a recording, fixed: the turn's layers spaced the batches `gap` apart while the plan used the Investigation's
uneven onsets, and Chromium refused a negative duration (no turn drawn). `turnPlan` answers `batchDelay`; R3711 reads both.

## Tests

R3708-R3713 (tier 1); R3727 (tier 1, 12.11.2026, the coordinator's list): two changes of the clock 120 ms apart end on
the second - the first's flashes still to come dropped (1 flicker lit, not 3), the second's direction handed, Escape held
for the second. Not red first: it guards C8's `clearFlashes`; green at 7bbbd3c and at e1154c1, and red (3 flickers) with
that line taken out on a scratch run.

Results (12.11.2026, at 5dce8f1): tiers 0-1 whole 1188 ran, 1172 passed, 0 failed, 16 skipped, 1 red (expected);
R3708-R3713 green by name. Scenarios that read the files E62 changes (glass.mjs, module.mjs, config.mjs, lang/pl.json;
84 left out), each `--only NN`: 10, 13, 14, 20, 30, 33, 40, 50, 61 (alone), 62, 66, 71, 72, 74, 75, 81, 83, 86, 87, 88
all green. `node tools/check.mjs` 17/17, lint green.

## Added 12.11.2026 (the coordinator's list for 1.2.108)

- Handbooks: the GM handbook's section 4 (the clock's turns and the day's boards) and the player handbook's "Full-screen
  moments", EN and PL.
- The `sequences` setting's hint (EN, PL) names everything the switch stops - the entry, the cut-in, the clock's turns and
  flashes, the body's flicker, the day's boards - and says only the entry's and the verdict's sounds still play. Read in
  the code: the pane flash's sound is scheduled inside the switch's branch (`onClockHeard`), so it does not play with the
  switch off; the day chimes do not either (`playDayEnd` is not called).
- AUDIT 9.2: LIVE-E62-01 (the turns, flashes, flicker and two close changes at a real table).
- The `--turn` baseline: `docs/dev/e62/turn-baseline.json`, the glass sweep's `--turn --json` at b07dec9 (the code of
  e1154c1), 12.11.2026, headless Chromium with software rendering on this machine (4 cores, nothing else running): the
  default four turns (phase-recut, phase, hour, layout) at 1600x900 and 1366x768, GM and player, Stained Glass - 16
  readings; the three planted controls each read. It is the reference for C6 and C7 (`--against` it), a shape and not a
  table's number. It reads RED on one turn: **layout** at 1600x900, both roles, the texture inside the turn down to 39 %
  of rest in the square at 256,256 (the E23-04 bar is 80 %). The same reading at E62's base d03c509 (`--kinds layout
  --sizes 1600x900 --root` a checkout of it): 39 % at the same square, both roles - so it predates E62 and is not this
  line's to fix here; it is the texture question C7 is about. The other 14 readings pass.

## 1.2.109 (the coordinator's list of 12.11.2026)

- **The HUD's phase label slide** (Q6 default, owner to confirm): a new phase's label slides in from the right and fades
  in over the turn's length (840 ms; nothing under reduced motion), resuming across redraws as the time label does
  (hud.mjs `slidePhase`, called by `renderHud`). R3728, red at 6b98f6c. Shots: the review page's section "1.2.109 · E62 ·
  zegar", frames at 0-840 ms, both themes, on the glass harness's static clock. Checked: tiers 0-1 whole 1256 passed, 0
  failed, 16 skipped; scenarios 13, 40, 41, 63 green; check 17/17, lint green.

- **C5, the centre cards** (Q8 default: raised over the windows until touched, owner to confirm): `showPopup`'s new
  `centre` puts a card on the middle stage the trial's evidence uses (no history button there), raised until its first
  pointerdown; a chat card asks for it with `popupCentre`, honoured from a GM's card only (R472 census row). The day
  summary waits for the clock's turn (`summaryDelay`: the turn's length, 0 with none, under reduced motion or with the
  switch off) and stands in the centre, its rows sliding in 160 ms apart from 150 ms (none under reduced motion). The
  body's card ("Body found!") stands in the centre for everyone. Both are kept in the history as before. R3729, R3730,
  red at 6230945. Q4 ("card rules in the centre", 04.10) stays out: no card is named. Shots: the review page's section
  "1.2.109 · E62 C5", both themes, EN and PL, 1366x768 and 1920x1080. Not shot: 393x852.
  Checked: tiers 0-1 whole 1258 passed, 0 failed, 16 skipped; scenarios 13, 15, 30, 40, 50, 61, 62, 63, 72, 73, 75 green;
  check 17/17, lint green.

- **C7, texture through a turn - measured, not changed; waits on the owner.** The `--turn` baseline (turn-baseline.json,
  the code of e1154c1) holds every turn of the clock above E23-04's 80 % bar: phase, hour and the phase recut read their
  worst 64 px square at 81-130 % of rest (12 readings: both sizes, both roles; two at 81 %, close to the bar), and E96's
  first-frame check ("still") holds on every recolour. The layout turn at 1366x768 moved no frame to read. The one
  reading under the bar is the **layout** turn (the room tile hidden) at 1600x900, both roles: 39 % in the square
  at 256,256, the same at E62's base d03c509. Frozen frames of that turn (12.11.2026, the glass harness, GM, pulse off,
  at 100, 300, 500, 700, 900, 1100 ms and after) read: at rest the square is inside the room tile's picture; when the
  tile goes, the glass that framed it has no new pane to become, so it fades out over the new glass in its batch (E23
  C1b's design: "an old pane nothing comes from fades in the batch of its distance"); at 100 ms that fading layer
  flattens the grid under it, and from 300 ms the square stands as it does after. So the dip is a vanishing pane's
  crossfade, not texture lost on a pane that moves. That is my reading of the frames, not a proof by planting.
  What it waits on: the owner's choice of how a pane that vanishes leaves. **Proposed default**: it leaves in the turn's
  first 120 ms (gone before the moving panes are under way), so no frame holds the old and the new glass half and half;
  the alternative is to slide it off under its neighbour. Either is a look change to review in motion. And the owner's
  1.2.103 report ("textures and effects still change while the curtain animates") is not reproduced on the clock's turns
  here: a table check of it is LIVE-E62-01's.

## Not done, and why

- C3 (death fade, Monocub return): the owner's 05.11 amend says these "get a storyboard and a mockup before E62 is built"; no such mockup exists in what I could read. Not started; owner's step.
- C6 (the interface following a recut per frame): the plan's riskiest part; not started (below, 1.2.109).
  Built in 1.2.113 (fix-113p, 13.11.2026; the owner's decision that every audit change goes in 1.2.113, A113-C5-8):
  the blocks the cut seats - the room tile beside the notices with its picture, the voice tile and its portrait, the
  notice tile and its plate - ride from the box they stood in to their new box on the turn's curve, clock and 700 ms,
  by `translate` and `scale` (glass.mjs `FOLLOWERS`, `followFrames`, `followTurn`; R6052, R6053). Measured with
  `node audit/glass-sweep.mjs --follow` (both roles, 1600x900 and 1920x1080, the phase recut and the layout turn): the
  notice tile, the one rider these turns move, 0 px off its rest when the panes begin to move, against 14.2-46.9 px in
  one frame at ceb9e9c8 (its top edge 92.9 px with the rides emptied, the control); a ride's clock 0 ms off its pane's.
  `--turn` reads as at ceb9e9c8 on the two recuts (its two reds there, the layout turn at 1600x900 39 % and the phase
  recut at 1920x1080 73 %, are the base's too). Not done of the plan's C6: the room tile under the clock and its picture
  step at the recut as before (the clock's column lays the tile, and the picture riding alone read 51 % on `--turn`);
  the interface scale and the narrow breakpoints are not touched (no recut turn changes them); per-frame screenshots
  at 1366x768 and 1920x1080 in both themes were not taken.

## Defaults taken, owner to confirm

- Q1: E61 built the engine, Escape and the table's switch; E62 calls them. The switch off leaves the curtain's turn as it was before E62 (from the centre) and plays no flash or sound.
- Q2: E62 owns the trial's exit (here: a turn from the centre; no recut-following, C6 not built).
- Q3: the discovery flicker stays as its own effect (C4).
- Q5: every forward hour from the top, a rewind and a new day from the bottom, the Eclipse's end inward.
- Q7: the flicker lasts a fixed 1.6 s (four onsets), the sound's length not read.
- Flash rate: every table is held to at most 3 onsets in any second (`flashRate`, R3710).

## Review shots

Round 1: https://claude.ai/artifact/SwzgVUs65Qej3w7Gwwte76 - seven recordings with frame strips (E62-1, E62-2, E62-3 in both themes, E62-4, the discovery flicker in both themes); the glass harness in headless Chromium, not Foundry. The investigation recording is from after the onset fix (5dce8f1).

## C3b, the dead as Spectators (13.11.2026; built on the e72 line, ships with 1.2.112)

Spec: docs/dev/e62/STORYBOARD-C3.md on the e62-c3 line (e64968c6), the owner's Q-C3b-1..6 and Q-C3b-7 (accepted as
proposed, 13.11 about 01:35 CET). The curtain's fade and return are another line's: the hook `drpgDeadSpectator` is
called on the victim's browser and nothing listens yet.

| What | Where |
| --- | --- |
| At a death, a GM makes the student's Spectator: a new actor with the student's name, sheet image and token image, owned by the student's players alone, E92's flag, and a token where the body's token stands; the body's token stays the corpse | spectator-dead.mjs, chapter.mjs |
| The link: the GMs' deaths row (`watcher`) while the death is kept; `FLAGS.watcherOf` on the Spectator once it is public | spectator-dead.mjs, config.mjs |
| A revive and the season reset take the Spectator away; a Monocub's own token too, for a Monocub revived as it stands | spectator-dead.mjs, chapter.mjs |
| The Monocub (Q-C3b-7): the Spectator's token is re-linked to the student (`FLAGS.cubToken`) where it stands, the Spectator actor goes, the corpse stays; a Monocub no more gets a Spectator back on that token | spectator-dead.mjs, monocub.mjs |
| A Monocub's place is its own token, its body's place the corpse (`locateActor`/`gmPlaceOf` with `body`, `placesOf`, `bodyPlaceOf`); the corpse is no walker (the veto and the GMs' judge refuse its move) and no eye (`myRooms`, fog's `isMine`) | movement.mjs, spectator.mjs, body-tile.mjs, cleanup.mjs, visibility.mjs, fog.mjs |
| The dead's view stays a dead student's: the Spectator's token is no eye of its owner | visibility.mjs |
| Voice: the silenced dead go to the Spectators' room (Q-C3b-5); the Spectator has no voice row and is never the trial's voice of its account | voice.mjs |
| The Sound row "Death fade" / "Gaśnięcie" (incident; empty, the death's file), on the victim's browser at a fade that is not silent | config.mjs, sfx-play.mjs, spectator-dead.mjs |
| The Students window draws a dead student's Spectator's Role as words, and a Role change of it is refused with a notice | gm-students.mjs, monokuma.mjs |
| The curtain's listener of `drpgDeadSpectator` (SB-C3, MK-C3): the death fade (3.6 s, five batches outside in), the Monocub's return (to 2.47 s, the player's tools first), bare glass as the rest state while dead (a reload shows it at once), Legacy's four groups greyed; a correction, reduced motion, the sequences switch off and Escape go to the end state at once | death-fade.mjs, stained-glass.css, danganronpa.css |

Tests: R4550-R4559 (tier 1); tier 2 "E62 C3b ..." (six); scenario 94-dead-spectator (ci, 14 checks); the drawn check
`node audit/death-fade-drawn.mjs` (Chromium, the glass harness, three sizes, both themes; not in CI). Each red first on
the tree before it, as a measured failure, but "a Spectator keeps its images", which holds E92's behaviour (green
before by design).

### Defaults taken (the coordinator's 13.11: they stand, on the owner's list)

The owner confirmed the C3b defaults on 13.11.2026, relayed by the coordinator: "E62 c3b wszystko sie zgadza". The
coordinator takes 874f7706 as C3b's head for 1.2.112.

1. The Spectator's token is not Foundry-hidden (that hides it from its owner too): the module hides it from other players
   as E92 does. The spec said `hidden: true`.
2. After the publication the link is `FLAGS.watcherOf` on the Spectator; it names a public death only.
3. The player's own copy of the deaths row is not given the link: nothing on the player's browser needs it.
4. A9's play-out stays: until the first trigger the dead keep their room's voice, then the Spectators' room; Silence now
   moves them there at once.
5. The row's "A character dies" window counts as in play (the fade); the Students window's dropdown, the publication and
   the season reset are silent.
6. The module has no Monocub image: the Monocub's token keeps the student's token image.
7. No migration (Q-C3b-6); voice-client.mjs `deadRoomFor` stays exported, routed to by nothing.
8. The curtain's batches are read off each pane's block (glass.mjs `LAST.panes[].tone`) at every size, the storyboard's
   pane indices at 1366x768 read as: 1 the top slivers, 2 the bottom slivers, 3 the rail, the status, the event strip
   and the tray, 4 the clock, the notes and the room tile, 5 the voice tile, the tiles' row and the launchers.
9. Bare glass greys the frost under the glass as well as the glass: the glass is translucent, and a filter on its canvas
   alone left what a player sees coloured (the drawn check measured 0.23 against 0.27 lit). The launchers' and the
   interface's own colours stay (the storyboard's #5); the room tile's and the voice tile's art grey with their batches.
10. The Monocub's return rests lit at 2470 ms, the end of the storyboard's M5, not at 2400, which cut batch 1's last step.
11. A kept death's copy reaches the victim before its moment; the rest state follows the copy only after 1.5 s with no
    moment heard (a body with no token), so the fade's first frame is not bare.
