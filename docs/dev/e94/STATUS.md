# E94 - status (work line claude/e61-62)

Updated 12.11.2026. The plan is `docs/dev/plans/E94.md` on `claude/plan-130` (read whole); the pattern is MK-R2 #4, #5 and
the questions #8-#11 (read with the Artifact tool, `mock/seq/day-start.js`, `day-end.js`).

## Done

| Plan | What | Where |
| --- | --- | --- |
| C2 | The start-of-day board on E61's engine: at a new day (the Night-to-Morning roll-over, heard as E62's `newDay` from the clock's one event), on every connected browser, about 5 s, gone by itself, Esc earlier; the day, the chapter, the hour and the cast in its order, the dead by the published flag alone (`isDeceased`, never a death the GMs keep) greyed in place with "we remember", never struck through; the alive count; the morning line drawn only when there is one; still under reduced motion (5 s), nothing with the table's switch off; its chime in the Sound row "Start of the day" / "Początek dnia"; the host lets the table's clicks through | scripts/sequence.mjs (`dayStartBoard`, `dayStartElement`, `playDayStart`), transitions.mjs, config.mjs, lang, danganronpa.css |
| C1 | The GM's morning line: a field "Next morning's line" / "Zdanie na następny poranek" in Edit campaign (a textarea, 200 characters), kept as this GM's client setting `morningLineDraft` - in no world data - until the Night-to-Morning advance folds it into the clock's one write (`dayStartPatch`, `morningLine`) and clears the draft; any other move of the clock clears the line; empty draws nothing | gm-campaign.mjs (`morningLineRow`), settings.mjs, clock.mjs (`advanceTimeOfDay`), sequence.mjs (`morningLineOf`, `dayStartPatch`), lang |
| C3 | The end-of-day board, before the start-of-day board at the same roll-over (E62's `newDay`; `playDayEnd`, then `playDayStart` through the engine's new `then`, which runs on the end or on Esc, never when another sequence cuts it): this browser's own rows of the day (a player's own student's, a GM's the table's: `dayRowsFor`), the module's public cards of the day (no whisper, no blind roll: `publicCardsOf`), the viewer's own student's Hope (a player's only), Despair as the HUD shows it to everybody, the school's mood; about 6 s, Esc earlier, still under reduced motion, nothing with the switch off; its chime "End of the day" / "Koniec dnia". Kept as one sticky card in this browser's notice history (day-summary.mjs `keepDayEndCard`), which stands in for the Night's own summary while the switch is on (`nightFoldsIntoBoard`) | sequence.mjs (`dayEndBoard`, `dayEndElement`, `playDayEnd`), transitions.mjs, day-summary.mjs, config.mjs, lang, danganronpa.css |
| C4 | The school's mood: three words (Calm / Spokój, Uneasy / Niepokój, Close to spilling / Na krawędzi) from the Overflow's count against its threshold X (below 1/3, below 2/3, from 2/3: `moodBand`), read on the GM who advances the clock - a player's `overflowCount` is 0 - and written into the clock as the word alone; world-secrets: the clock may never hold `overflowCount` or `overflowThreshold` (R190 fixtures, red without the rule) | sequence.mjs (`moodBand`, `MOOD_BANDS`), clock.mjs, world-secrets.mjs |
| C5 (part) | Handbooks (GM section 4, player "Full-screen moments", EN and PL); the two chimes in the Sound window; glossary entries | docs/handbooks, docs/glossary.json |

Found on the way: the stylesheet held a stray `=======` from this line's merge 6049386 (styles/danganronpa.css), which
swallowed the rule after it (`body.drpg-theme-monokuma-legacy #notifications .notification`); removed, and R3726 holds
the served scripts, styles and lang files free of conflict markers.

The clock stamps `dayStartedAt` on a day change (`setClock`; R3725), which the end board's rows and cards are read from.

Tests: R3714, R3715 (tier 1); R3720-R3726 (E94 C1, C3, C4), all seven red at 7bbbd3c and green at e1154c1; R3715 changed
for C3 (the end board plays first). R190 gained the mood's two fixtures; R472 a census row for `keepDayEndCard`; R2058
the morning line's row in Edit campaign.

Results (12.11.2026, at 1262ebe): tiers 0-1 whole 1190 ran, 1174 passed, 0 failed, 16 skipped, 1 red (expected). An
earlier whole run (5180954) failed R1157, the plural census: the board's "alive: 6 of 8" put a count before an
agreeing word outside a plural family; reworded as a ratio ("Alive: 6/8", "Ocaleli: 6/8") in 1262ebe. Scenarios that
read the changed files (config.mjs, lang/*.json; sequence.mjs and transitions.mjs are named by none): 00, 10, 13, 20,
30, 33, 40, 50, 61 (alone), 62, 66, 71, 72, 81, 83, 86, 87, 88 green at 5180954; 00, 33, 50, 62, 72 green again at
1262ebe after the language change.

Results (12.11.2026, at e1154c1): tiers 0-1 whole 1270 ran, 1255 passed, 0 failed, 16 skipped, 0 red; an earlier whole
run on the uncommitted tree failed R472 (the census had no row for the board's card), R2058 (Edit campaign's fields now
end on the morning line) and R3700 (sequence.mjs put up the card itself, against the engine's A7 rule) - the card moved
to day-summary.mjs with a census row, and R2058's list was extended. R3720-R3727, R190, R472, R2058, R3700 green by name.
Scenarios that read the changed files, each `--only NN` (84 left out): 00, 10, 13, 40, 50, 61, 62, 63, 65, 72, 73, 86,
88 green; 00, 40 and 72 again after the world-secrets row. `npm run quick` green (lint, check 17/17, the gate's
self-test 37/37). No tier-2 test of this line's.

## Not done

- C5's Spectator case: main has no Spectator role yet (E92 builds it on its own branch). Against main, an account with
  no student sees the start board as everybody does, and an end board of its own with no rows ("a quiet day"), no Hope,
  Despair and the mood. **For the E92 merge**: the plan wants a Spectator to see the start board and no end board of its
  own; in `playDayEnd` (sequence.mjs) answer `then("none")` at once for a Spectator, before `dayEndReads`, and add the
  case to R3722. Nothing in this line names E92's predicate, so the merge has to write it.
- C5's frame-work reading (86-frame-work with the boards): not extended. The boards play once a day, not per move; their
  frame time is LIVE-E94-01.

## Defaults taken, owner to confirm

- Q-E94-2: "the GM starts the day" is the Night-to-Morning advance; no new button.
- Q-E94-4: a client that loads after the day began gets no board (the engine's rule: nothing plays from before ready).
- Q-E94-3: the mood is three words; a player never gets a number.
- Q-E94-5: the Night's own summary folds into the end board while the switch is on (one card, not two); with the switch
  off the summary shows as before. A Night Eclipse's summary at its start is unchanged.
- The morning line is a client draft of the GM who types it; with two GMs the line of the GM who advances the clock is
  used, and another GM's draft stays in that GM's browser.
- The end board stands about 6 s (6 s still), and stays as one sticky card in the notice history.
- Esc on the end board skips to the start board, which a second Esc skips.
- The board plays over E62-2's curtain turn from the bottom; both from the same event.
- The time of day on the board is `TIME_OF_DAY_LABELS`, which Foundry's i18n turns Polish at init; the review shots on the glass harness (no i18n init) show it in English.

## Review shots

Round 2 (C1, C3, C4): https://claude.ai/artifact/2P85CshwTa2cNyQz4GW7UP - the end board and the start board with a morning
line, both themes, EN and PL, 1366x768 and 1920x1080, stills (reduced motion), the player's view; sample data typed in,
not a played day; the glass harness in headless Chromium, not Foundry.


Round 1: https://claude.ai/artifact/HqY4QnLaPzDwoDGQa8Qpkp - the board still in both themes, EN and PL, and recorded in motion in both themes. Found by the recording and fixed: the rise's transform replaced the board's centring rule (4987f71). The glass harness in headless Chromium, not Foundry.
