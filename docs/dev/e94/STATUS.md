# E94 - status (work line claude/e61-62)

Updated 12.11.2026. The plan is `docs/dev/plans/E94.md` on `claude/plan-130` (read whole); the pattern is MK-R2 #4, #5 and
the questions #8-#11 (read with the Artifact tool, `mock/seq/day-start.js`, `day-end.js`).

## Done

| Plan | What | Where |
| --- | --- | --- |
| C2 | The start-of-day board on E61's engine: at a new day (the Night-to-Morning roll-over, heard as E62's `newDay` from the clock's one event), on every connected browser, about 5 s, gone by itself, Esc earlier; the day, the chapter, the hour and the cast in its order, the dead by the published flag alone (`isDeceased`, never a death the GMs keep) greyed in place with "we remember", never struck through; the alive count; the morning line drawn only when there is one; still under reduced motion (5 s), nothing with the table's switch off; its chime in the Sound row "Start of the day" / "Początek dnia"; the host lets the table's clicks through | scripts/sequence.mjs (`dayStartBoard`, `dayStartElement`, `playDayStart`), transitions.mjs, config.mjs, lang, danganronpa.css |
| C1 | The GM's morning line: a field "Next morning's line" / "Zdanie na następny poranek" in Edit campaign (a textarea, 200 characters), kept as this GM's client setting `morningLineDraft` - in no world data - until the Night-to-Morning advance folds it into the clock's one write (`dayStartPatch`, `morningLine`) and clears the draft; any other move of the clock clears the line; empty draws nothing | gm-campaign.mjs (`morningLineRow`), settings.mjs, clock.mjs (`advanceTimeOfDay`), sequence.mjs (`morningLineOf`, `dayStartPatch`), lang |
| C3 | The end-of-day board, before the start-of-day board at the same roll-over (E62's `newDay`; `playDayEnd`, then `playDayStart` through the engine's new `then`, which runs on the end or on Esc, never when another sequence cuts it): this browser's own rows of the day (a player's own student's, a GM's the table's: `dayRowsFor`), the module's public cards of the day (no whisper, no blind roll: `publicCardsOf`), the school's mood as its word (no number of Hope or Despair since 6b98f6c9, the owner's word of 12.11); about 6 s, Esc earlier, still under reduced motion, nothing with the switch off; its chime "End of the day" / "Koniec dnia". Kept as one sticky card in this browser's notice history (day-summary.mjs `keepDayEndCard`), which stands in for the Night's own summary while the switch is on (`nightFoldsIntoBoard`) | sequence.mjs (`dayEndBoard`, `dayEndElement`, `playDayEnd`), transitions.mjs, day-summary.mjs, config.mjs, lang, danganronpa.css |
| C4 | The school's mood: three words (Calm / Spokój, Uneasy / Niepokój, Close to spilling / Na krawędzi) from one share, rewritten on the owner's word of 12.11 (6b98f6c9; until then the Overflow's count against its threshold alone): the living students' Hope over that Hope plus the Monocubs' Hope, the Monokumas' Despair and the Overflow count; calm from config.mjs `MOOD_SHARES.calm` (0.6), uneasy from `.uneasy` (0.4), close to spilling below, nothing dark at all calm (`moodBand`). The four inputs are read on the GM who advances the clock (`moodInputs`: a death by the published flag alone, and the Overflow count only a GM holds) and written into the clock as the word alone; world-secrets: the clock may never hold `overflowCount` or `overflowThreshold` (R190 fixtures, red without the rule) | sequence.mjs (`moodBand`, `moodInputs`, `MOOD_BANDS`), config.mjs (`MOOD_SHARES`), clock.mjs, world-secrets.mjs |
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

## The owner's change of 12.11.2026 (after e1154c1)

The owner, on the review page, through the coordinator (verbatim): "Chowamy hope i despair w podsumowaniu; pokazujemy
tylko nastroj szkoly liczony z proporcji cale hope uczniow vs hope monocubow + despair monokumow + despair overflow.
Matma tajna, jedynie widoczny nastroj." (It revoked an earlier word of the same hour that would have shown Hope,
Despair and the Overflow on the board; nothing of that one was built.)

- The end-of-day board shows no Hope and no Despair: the day's rows, what the school saw and the mood (R3722, red at
  b07dec9). The counting-up and its styles are gone.
- The mood is one share: the living students' Hope over that Hope plus the Monocubs' Hope, the Monokumas' Despair (each
  Monokuma's pool, `getDespair`) and the Overflow count; calm from 0.6, uneasy from 0.4, close to spilling below;
  nothing dark at all is calm (`moodBand`, `moodInputs`; the bars are config.mjs `MOOD_SHARES`). R3723 rewritten, red
  at b07dec9. The GM handbook says it in one line; the player handbook names only the three words.
- Published as the word alone: the clock's world-secrets row keeps the Overflow's names out, and a new tier-2 test
  ("E94 C4: the school's mood reaches the world as its word alone") writes the mood the GM works out from this world
  through `setClock` and reads the stored clock - the setting every player's browser is sent - for the word, nothing
  added beside it and no hit of the rule; red at b07dec9 (no `moodInputs`), green now. What a player's console could
  read beyond world data is 72-canary's (green).
- Monocubs: the sheet's Hope; E72's purse is not on this branch.
- Shots: the review page's new first section (https://claude.ai/artifact/2P85CshwTa2cNyQz4GW7UP, version 2), both
  themes, EN and PL, 1366x768, player, still; the Despair bar above the board is the harness's HUD under it.

Defaults taken, owner to confirm (added): the bars 0.6 and 0.4; a student dead by the published flag leaves the count,
a death only the GMs know does not (so the mood never moves on an unfound body); the mood is worked out on the GM who
advances the clock, not only the primary - every GM holds the same inputs (Hope and Despair are world data, the
Overflow count is in the GMs' shared store), and routing it to the primary would need a new bridge request for no
other gain.

## The owner's note on the end board's spacing (12.11.2026)

"W podsumowaniu dnia powiekszylbym odstep miedzy rozdzialem a reszta": the end board's chapter line has 22 more of the
sequence's units below it (styles/danganronpa.css; the start board keeps its spacing). Measured in Chromium on the glass
harness at 1366x768, both themes, EN and PL: the gap from the chapter line to the columns 12 px before, 31 px after; the
board inside the screen in all four (its bottom at 581-610 px of 768), nothing overflowing. R3731, red at 463d12f. Shots:
the review page's first section (version 5). The coordinator confirmed (12.11, the owner's "Tak"): the bars 0.6 / 0.4 and
the mood worked out on the GM who advances the clock are final.

## Not done

- C5's Spectator case: main has no Spectator role yet (E92 builds it on its own branch). Against main, an account with
  no student sees the start board as everybody does, and an end board of its own with no rows ("a quiet day"), no Hope,
  Despair and the mood. **For the E92 merge**: the plan wants a Spectator to see the start board and no end board of its
  own; in `playDayEnd` (sequence.mjs) answer `then("none")` at once for a Spectator, before `dayEndReads`, and add the
  case to R3722. Nothing in this line names E92's predicate, so the merge has to write it.
  **Done on the 1.2.109 line (12.11.2026), on the owner's word "Dostaje tylko koniec dnia i nastroj szkoly"**: a
  Spectator gets an end board of its own after all, holding the day's heading and the mood's word and nothing else
  (sequence.mjs `dayEndBoardFor`, `dayEndBoard`'s `watcher`; the day's reads are not made); R3868 and scenario 93's
  part "board", both red at 7872146d.
- C5's frame-work reading (86-frame-work with the boards): not extended. The boards play once a day, not per move; their
  frame time is LIVE-E94-01.

## Defaults taken, owner to confirm

- Q-E94-2: "the GM starts the day" is the Night-to-Morning advance; no new button.
- Q-E94-4: ~~a client that loads after the day began gets no board (the engine's rule: nothing plays from before ready).~~
  **Answered by the owner, 13.11.2026: "Przez 10 minut"** (with Q-E61-1): within 10 minutes of the day's start a browser that
  loads plays the start-of-day board once; the end-of-day board is not played late. claude/gaps-111, 1.2.111 (R4934, scenario 96).
- Q-E94-3: the mood is three words; a player never gets a number (and since the owner's word of 12.11, the end board shows no Hope or Despair either).
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
