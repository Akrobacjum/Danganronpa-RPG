# E94 - status (work line claude/e61-62)

Updated 12.11.2026. The plan is `docs/dev/plans/E94.md` on `claude/plan-130` (read whole); the pattern is MK-R2 #4, #5 and
the questions #8-#11 (read with the Artifact tool, `mock/seq/day-start.js`, `day-end.js`).

## Done

| Plan | What | Where |
| --- | --- | --- |
| C2 | The start-of-day board on E61's engine: at a new day (the Night-to-Morning roll-over, heard as E62's `newDay` from the clock's one event), on every connected browser, about 5 s, gone by itself, Esc earlier; the day, the chapter, the hour and the cast in its order, the dead by the published flag alone (`isDeceased`, never a death the GMs keep) greyed in place with "we remember", never struck through; the alive count; the morning line drawn only when there is one; still under reduced motion (5 s), nothing with the table's switch off; its chime in the Sound row "Start of the day" / "Początek dnia"; the host lets the table's clicks through | scripts/sequence.mjs (`dayStartBoard`, `dayStartElement`, `playDayStart`), transitions.mjs, config.mjs, lang, danganronpa.css |

Tests: R3714, R3715 (tier 1).

## Not done

- C1, the GM's morning line: no field to write it yet, so the board never shows one (MK-R2 #10's "empty is hidden" holds).
- C3, the end-of-day board, and C4, the school's mood band: not started. The mood needs a band the primary GM computes and publishes, since a player's `overflowCount` is 0 (plan section 2) - a world-secrets rule with it.
- C5's Spectator case, handbooks: not started.

## Defaults taken, owner to confirm

- Q-E94-2: "the GM starts the day" is the Night-to-Morning advance; no new button.
- Q-E94-4: a client that loads after the day began gets no board (the engine's rule: nothing plays from before ready).
- The board plays over E62-2's curtain turn from the bottom; both from the same event.
- The time of day on the board is `TIME_OF_DAY_LABELS`, which Foundry's i18n turns Polish at init; the review shots on the glass harness (no i18n init) show it in English.

## Review shots

Round 1: https://claude.ai/artifact/HqY4QnLaPzDwoDGQa8Qpkp - the board still in both themes, EN and PL, and recorded in motion in both themes. Found by the recording and fixed: the rise's transform replaced the board's centring rule (4987f71). The glass harness in headless Chromium, not Foundry.
