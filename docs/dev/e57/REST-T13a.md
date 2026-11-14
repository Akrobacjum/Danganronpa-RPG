# E57 rest - T13 group 1: scripts/patches.mjs

Branch `claude/e57-t13a-113`, from `claude/e57-tools` at 6cd30a92. R block R7030-R7039 (R7030 used). 14.11.2026.

## Result

T13 (`uiLiterals`) in scripts/patches.mjs: 264 findings at the base, 0 now. Nothing in this slice is left as a report.
In the whole tree T13 went 737 -> 473 (the other 473 are the two other T13 lines' files). Its mode stays `report`: the
coordinator switches it after the merge, if the other lines reach 0 too.

None of the 264 literals was rewritten in place: they are the register's English, which the console,
`diagnosePatches()` and diagnostics.mjs's report keep (DB12). What a GM reads of them on a screen was moved into lang/
(below); the literals themselves are counted apart by the field they stand in.

## The detector change (ce47551)

More than a fifth of the slice would have been allow rows, so the detector was changed instead: T13 now counts apart
(`allowed`) a literal that is the own value of a property UI_LITERAL_ALLOW names for its file (scripts/tests-text.mjs
`fieldOf`: read back to the value's start, a grouping parenthesis read through, a call's not). Red first: the fixture
plants a register (fx-register.mjs), an allowed `why` in three pieces passes, a `target` and a `note` not allowed are
flagged; R1058's pin 6 -> 8. The other two T13 lines must merge it (the coordinator was told at ce47551).

## The allow rows (scripts/patches.mjs), one reason each

| Field | Reason |
| --- | --- |
| target | the code's name of a row, for the console, diagnosePatches() and the author; a screen shows DRPG.Contract.target.<key> (targetOf), and this only for a target of names alone |
| why | a row's reason, read only in diagnosePatches()'s console table and the source |
| when | when a row is installed: diagnosePatches()'s table, and a note of a row not in use (an ok row, which no screen shows) |
| fallback | the console's and the report's English; a screen shows DRPG.Contract.instead.<key> (insteadOf, R1562) |
| road | what fires a hook, for the console's note; Pre-season shows DRPG.Contract.road.<id> (unreadOf) |
| note | a probe's note, for the console and the report; Pre-season shows DRPG.Contract.unread.* (unreadOf) |
| what | SHEET_ANCHORS: read by nobody but the source |
| optional | SHEET_ANCHORS: written into a note of an ok row, which no screen shows |
| changed, unnamed, backstop, notFound, noApi | RELAY_FAILED: a failed relay row's note, console and report only |

## Moved into lang/ (eb1bbb4), en and pl

- `DRPG.Contract.target.*` - 35: 33 rows whose target is English words, and the held templates `held-flag` and
  `held-rtc`. Read by `targetOf` in the GM's notice, Pre-season's line and fold, and the newer-system window.
- `DRPG.Contract.unread.*` - 23: `hook`, `table`, `noMark`, `cannotTell` and 19 rows' own reasons (two by a probe's
  `unreadKey`: `token-class`, `relay-guard-catch-all`). Read by `unreadOf` in Pre-season's fold.
- `DRPG.Contract.road.*` - 11, one per hook row.

Measured on this tree: T2, T5, T15 and T17 find nothing in the new keys (the first wording made five T5 and two T17
findings, and two T15 and one T2; reworded). The 69 new Polish keys are unstamped (T9: they wait for a Polish read,
not red). Three rows the detector had passed as not text (livekit-toasts, push-to-talk-key, focus-chat) got keys too:
R7030 reads every worded target, not only the flagged ones.

## Questions, with the default taken

- Q-T13a-1: a target on a GM's screen keeps its code names beside a plain gloss (`DhTokenPlaceable.prototype._drawEffect
  (klasa tokenu Daggerheart)`), because the notice asks the GM to pass it to the author. Default: keep them; T29
  would cut them from a player's text, and this is a GM diagnostic.
- Q-T13a-2: where no row reason exists, Pre-season's fold now says "this browser cannot tell" or "the module's wrapper
  leaves no mark to read" in the table's language instead of the probe's English detail, which stays in the console and
  the report. Default: so.
