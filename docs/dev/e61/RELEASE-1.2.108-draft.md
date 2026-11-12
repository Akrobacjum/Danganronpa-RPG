# 1.2.108 - The Class Trial's entry and the verdict's cut-in, the clock's turns with a direction, the Investigation's flashes and the body's flicker, the day's boards

A draft for the release line (E61, E62 and E94 on the E61/E62 work line's branch, 12.11.2026), written on the work line; the
release line writes the file under `.github/release-notes/` from it. Commits are named by their short hash.

## What changed

### The Class Trial's entry (E61 C1, C3, C4; the owner's reviews of rounds 1-4, accepted as built at 98e004c, 12.11.2026)

The owner accepted the curtain's animation at round 5 (98e004c, 12.11.2026, at 1366x768 and 1920x1080): "Zatwierdzam
animacje kurtyny - SUPER!".

Every road into the Class Trial plays one full-screen entry on every screen at the table, from the clock's one event
(`drpgPhaseChanged`): about a second of closing, the title **CLASS TRIAL** with the chapter's line from 1400 ms, the
opening from 2500 ms, 3.4 s in all (`scripts/sequence.mjs`).

- **Stained Glass** (1db3f62, 8ab5124): the standing panes keep their place, and the hole they leave closes with new
  panes of the curtain's own kind - convex, of the standing panes' corner count and size range, cut by straight lines
  (`scripts/glass-close.mjs` `fillHole`). Each new pane keeps its size from its first frame and slides out from behind
  an edge it shares with glass already there, along that edge's normal, drawn only inside its own place
  (`slidePlan`, `slideAt`); the closed curtain is the curtain's own paint (`curtainPaint`) of the whole cut; the
  opening is the reverse onto the trial's cut. The panes' colour turns from the Investigation's blue to the trial's
  pink in eight batches, outer first.
- **Above 1366x768** (98e004c): the new panes keep 1366x768's share of the screen - the standing cut is built of fixed
  pixel sizes, so its panes alone would make them half as large at 1920x1080 - with a grid at the curtain's slants and
  the rim's small pieces joined with a neighbour; at 1366x768 and below the fill is the one the owner accepted.
- **Monokuma Legacy** and wherever no curtain is cut: two black lids with a red edge, the same title and times.
- **Esc** skips the one playing on that screen; **reduced motion** shows a still frame (the closed curtain and the
  title for 1.5 s); the room and voice tiles are covered for its span and come back with it.
- **The table's switch**: the game's settings have **Full-screen sequences** / **Sekwencje na cały ekran**, on by
  default; off, none of the moments below plays - the entry, the cut-in, the clock's turns and flashes, the body's
  flicker, the day's boards - and only the entry's and the verdict's sounds still play (the setting's hint says so
  since e1154c1).
- **Sounds**: new rows **trialStart** and **verdictCut** in the Sound window (incident); the vote's count's row is now
  labelled "The vote's result" / "Wynik głosowania" (its key is kept).

Measured (glass harness in headless Chromium, the real cut, 7 sizes 1280x720-2560x1440, GM and player): 0 overlapping
pairs of panes in each of 92 frames (every 20 ms of the closing and the opening); 0 frames with a pane drawn at
another size; every pane wholly behind its edge (within 1 px) at its start; every point of a 6 px grid in exactly one
pane; the new panes' median area 18,502-35,202 px² beside the standing panes' 19,192-30,618 px². Building the pieces
takes 162-611 ms once, before the closing (4 cores, no GPU, software rendering).

### The verdict's cut-in (E61 C5; round 2's motion)

The GM's verdict card plays a cut-in on every screen (3.7 s): the sentenced's portrait and name, the votes as counted
(`trialProgress`), the stamp - **GUILTY** / **WINNY** when the class got it right, **NOT GUILTY** / **NIEWINNY** when
not - and the card's sentence; nobody sentenced, neither portrait nor stamp. It reads only the card's new flag
`verdictCut: { sentenced, right }` and the public record; nothing of the Blackened. The count's rows come in one after
another, each bar after its row, the sentence eased in (8937575). Esc and reduced motion as the entry (the last frame
for 3 s).

### The clock's turns (E62 C1, C2, C4, C8 part)

- Each change of the clock turns the curtain in its own direction: an hour forward from the top, a new day and a rewind
  from the bottom, the Eclipse in from the centre and out inward, the trial's exit from the centre (`transitionFor`).
- The Investigation's entry: six random groups of panes flash at 0, 360, 900, 1320, 1930 and 2400 ms, each with the new
  sound row **Pane flash** / **Błysk szyby** (varied pitch). No table sees more than 3 onsets in any second.
- The body's discovery: the seams and pulse dim for 220 ms four times (0, 450, 900, 1350 ms) on every browser; under
  Legacy the clock, status, Despair bar and notice tile light instead. Rehearsals play nothing.
- Esc ends a running turn at its end state; reduced motion and the switch off turn nothing new.

### The day's boards (E94 C1-C4)

At the Night-to-Morning roll-over every connected browser shows two boards, one after the other (e1154c1 for C1, C3, C4):

- **The end-of-day board** (about 6 s): this browser's own actions of the day (a player's own student's; a GM's the
  table's), the module's public cards of the day (no whisper, no blind roll), and **the school's mood** - Calm /
  Spokój, Uneasy / Niepokój, Close to spilling / Na krawędzi. No Hope or Despair numbers (the owner, 12.11). The mood
  weighs the living students' Hope against the Monocubs' Hope, the Monokumas' Despair and the Overflow, on the GM who
  advances the clock, and only the word is published; the inputs and the bars (config.mjs `MOOD_SHARES`) stay the
  GMs'. It stays as one card in the notice history and stands in for the Night's own summary.
- **The start-of-day board** (about 5 s): the day, the chapter, the hour, the cast in its order with the dead by the
  published flag alone, and the GM's **morning line**, typed in Edit campaign's new field **Next morning's line** /
  **Zdanie na następny poranek**: it stays in that GM's browser until the advance puts it in the clock, and an empty
  one shows nothing.
- Esc skips each; reduced motion shows each still; new sound rows **End of the day** and **Start of the day**, which
  do not play with the switch off.

### Fixed

- The stylesheet held a stray merge marker from this line's own merge (6049386), which swallowed the Monokuma Legacy
  rule for Foundry's notifications after it; removed, and R3726 holds the served files free of markers (e1154c1).

## Not in this release

- E61 C7: the floors' cross-section (needs LIVE-E61-06 at a table first).
- E62 C3 (the death fade and the Monocub's return: the owner's amend asks for a storyboard and a mockup first), C6 and C7 (the interface following a recut, the texture through a turn); the HUD's phase label slide (R3728) and C5's centre cards (R3729, R3730) are on the branch for 1.2.109.
- E94 C5's Spectator case: no Spectator role on main yet (E92); the merge note is in docs/dev/e94/STATUS.md.
- E61 C6, the four-client scenario (two GMs, reloads during a sequence, two fast events): not built in this round.

## Known gaps

- **Smoothness at a real table is not measured.** Every frame figure above is the glass harness in headless Chromium
  with software rendering, which ran at about ten frames a second; LIVE-E61-01 is the entry at 1366x768 and 1920x1080
  in both themes, as GM and as player, on a real Foundry v14.
- **0-2 new panes a screen fall outside the standing panes' range** (area, corners, angle, width, length for width),
  each where the standing panes force it: a crack narrower than any pane (8-24 px), a wedge between two of their edges,
  a notch at a corner, or a triangle at 1280 px wide, where the standing panes are all quads.
- **The review page's frame strips are drawn on a held clock** with the module's own `slideAt`, not filmed: a
  real-time headless recording at 1920x1080 caught only 2-3 frames of the closing. They show where each pane is at a
  moment, not how smoothly it gets there.
- **The at-rest cut is not scaled**: above 1366x768 the standing panes are smaller in share of the screen than at
  1366x768 (1.19 % against 2.27 % at 1920x1080); only the entry's new panes follow 1366x768's proportions. One draw
  swings by about a tenth (GM 1920x1080 2.14 % against 2.09 % at 1366x768, player 2.45 % against 1.76 %, in Chromium,
  one seed each); over eight seeds 0.94 and 1.04.
- **R3703 is loosened for one case**: on its 1600x900 cut it allows one new pane outside the standing panes' range, a
  630 px² chip in a notch between two standing and two new panes that no cut through its neighbours' corners or edges
  splits into two panes in range; the 1366x768 and 1440x900 cuts still hold none (round 5, 98e004c).
- **The layout turn's texture** (the room tile hidden, not a clock change) falls to 39 % of rest in one square at
  1600x900 in the glass sweep's `--turn` reading, against E23-04's 80 %; the same at E62's base d03c509, so older than
  this release (docs/dev/e62/turn-baseline.json, the reference for E62 C7).
- The microphone's keybinding while a sequence covers the voice tile: LIVE-E61-08.
- A client that loads after the event plays nothing (Q-E61-1 and Q-E94-4 defaults, owner to confirm); the lead line's
  widths are read from the code (`paintGlass`'s 1.2, 0.5 and 0.7 px), not measured in pixels.

## Checked

- Tiers 0-1 whole, headless, at 98e004c: 1247 passed, 0 failed, 16 skipped. R3700-R3719 green by name; R3703, R3716,
  R3718 and R3719 red at 8ab5124 or 1db3f62 as their comments say.
- Scenarios 14, 74 and 75 (the ones reading glass.mjs and the stylesheet) green at 1db3f62; the wider set for E61, E62
  and E94 green at their own commits (STATUS files).
- `node tools/check.mjs` 17/17 green, `npm run lint` green.
- `node audit/glass-sweep.mjs`: green at 8937575 and at 8ab5124 (2 themes x 2 roles x 25 sizes, 46 with glass, 0
  failing; the second run without the notice check); rounds 4 and 5 change no at-rest cut.
- CI: run 482 (8937575) green; later runs were cancelled when CI moved to the release train (12.11), whose run on the
  merged head is the authoritative one.
- Not run: the local gate (no v14 sandbox on this line).
