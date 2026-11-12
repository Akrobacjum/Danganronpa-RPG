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

## Not done, and why

- C3 (death fade, Monocub return): the owner's 05.11 amend says these "get a storyboard and a mockup before E62 is built"; no such mockup exists in what I could read. Not started; owner's step.
- C5 (centre cards with rows sliding in): not started on this line yet.
- C6 (the interface following a recut per frame) and C7 (texture constant through a turn): the plan's two riskiest parts; not started. C7's first reading is now taken (`turn-baseline.json`, above).
- The HUD's phase label slide (Q6): not built.

## Defaults taken, owner to confirm

- Q1: E61 built the engine, Escape and the table's switch; E62 calls them. The switch off leaves the curtain's turn as it was before E62 (from the centre) and plays no flash or sound.
- Q2: E62 owns the trial's exit (here: a turn from the centre; no recut-following, C6 not built).
- Q3: the discovery flicker stays as its own effect (C4).
- Q5: every forward hour from the top, a rewind and a new day from the bottom, the Eclipse's end inward.
- Q7: the flicker lasts a fixed 1.6 s (four onsets), the sound's length not read.
- Flash rate: every table is held to at most 3 onsets in any second (`flashRate`, R3710).

## Review shots

Round 1: https://claude.ai/artifact/SwzgVUs65Qej3w7Gwwte76 - seven recordings with frame strips (E62-1, E62-2, E62-3 in both themes, E62-4, the discovery flicker in both themes); the glass harness in headless Chromium, not Foundry. The investigation recording is from after the onset fix (5dce8f1).
