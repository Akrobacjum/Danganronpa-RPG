# E99 - status of the work line, branch claude/e97-98

The case schema at the trial and a summary for the players after the verdict. Started 12.11.2026 after E97/E98's
C1-C13 were pushed (1e1c61c). Plan: docs/dev/plans/E99.md on origin/claude/plan-130.

## Done (this commit)

- **C2, the modes' census**: trial-floor.mjs `MODE_STARTS` (each mode of floor-machine.mjs `MODES`: the console's
  start action, or `raisedByPlayer` for objection and rebuttal - Q-E99-10's default) and `modeCensus`. R3659.
- **C3, the ticks**: gm-stores.mjs `caseTickStore` (`caseTicks` under `gmCaseTicks`, ledger, not backed up, synced,
  cut with the trial's group; any GM - Q-E99-8), case-schema.mjs `caseTicks`, `setCaseTick`. R3661.
- **C6, the composer**: new scripts/case-summary.mjs `composeCaseSummary` - an allowlist: evidence on the schema a
  student found (public name and words), ticked deductions and counters by name, the solution only on a right vote
  (whole, Q-E99-4); local indexes, no ids, no author, no counts of what was not found (Q-E99-12). R3660 (markers in
  every place that must not cross). graphOf now carries a trace's public words (`text`).
- **C7, Show summary** (part): a "Show summary" button in the trial console after the verdict (greyed before it and
  in a Final Trial, Q-E99-5); a GM preview of exactly what goes out (Close the default, Send not under Enter); one
  public chat card that is the summary (Q-E99-6), sent once a chapter (a mark in the ticks store; Q-E99-9).
  `caseSummaryHtml`, R3662. R1364 follows the console's footer.

Red first: R3659-R3662 red at 1e1c61c (no MODE_STARTS, no caseTickStore, no case-summary.mjs), green here.

- **C4, hints after presentations**: new scripts/case-hints.mjs - `presentationHints` (E98's rule over what was
  presented: students other than the culprit presented strictly more than half of a conclusion's inputs, a ticked
  deduction counting; a bullet only the culprit presented is marked and counts for nothing; a hint is never a tick) and
  `casePresentations` (the chapter's Present cards through the GMs' answer key; a withdrawn Objection skipped, a refused
  one counted - its bullet was shown; a card with no Remnant behind it hints nothing and is counted for the GM).
  investigation.mjs exports `caseCulprit` (the first of the chapter's Blackened and killers, as the Map's reach reads).
  R3663, R3664, and the tier-2 "E99 C5" test's last step (a Present's read changes no tick).
- **C5, the schema at the trial (as a window)**: new scripts/case-trial.mjs - `trialSchemaHtml` (the Map's graph read
  only, the unrelated evidence folded, the presented and hinted nodes and the ticked ones marked; beside it a tick box per
  deduction, counter and solution and the node's mode start where MODE_STARTS has one, greyed with a reason while a
  floor is open), `openTrialSchema` (one window, a GM's, redrawn on the ticks, the schema, the Key plan, the floor and
  the chat's cards), `tickFromSchema`. The console's footer gains "Case schema" while a trial runs and after it;
  trial-floor-ui.mjs `startTrialMode` starts only what MODE_STARTS names. case-map.mjs `caseGraphHtml` takes `marks`.
  The Map's drawing rules in components.css now read `:is(.drpg-window-case, .drpg-window-case-trial)` (same
  specificity). R3665, R3666, tier-2 "E99 C5" (a click on a tick box reaches the store, a second click takes it off).
  R1364 follows the console's footer. Probe 08 captures `case-trial`.

**Deviation, owner to confirm (Q-E99-1).** The plan's default puts the schema in the console's middle, with the frame's
button opening it larger. Here it is a window of its own from the console's footer: the console's body is a live region
redrawn every second and its rebuild is E73's (the coordinator's line); `trialSchemaHtml` is the whole middle, so moving
it there is one call once E73 has the layout. The plan's 86-frame-work risk (the SVG redrawn every second) does not
arise in a window of its own, whose region redraws only on its watches.

Red first: R3663-R3666 and the tier-2 "E99 C5" test red at 946c031 (no case-hints.mjs, no case-trial.mjs), green here.

## Not done yet, and why

- **The animated board** (C7's board, D's "an animated board like the verdict's"): E61's verdict board, its event, its
  reduced-motion version and its Esc are not in this tree (E61 is ahead in the release order and not built). The chat
  card is the summary's static form; the board waits for E61.
- **C5's place in the console's middle**: waits for E73's console layout (above).
- **C5's frame glyph** (`case-map`, `node-check`): drawn in tools/glyphs.json, not declared in pixel-icons.css (E48's;
  the same note as E97's in docs/dev/e97/STATUS.md); the button and the boxes carry no glyph.
- **C1 three-digit stage ids**: touches tools/stages.mjs, the coordinator's; not done here (Q-E99-11 stays open).
- **C8 scenarios (63, 72 phases), C9 handbooks and glossary**: next.
- No tier-2 test of `showCaseSummary` yet (a verdict fixture is needed): the composer and the card are tested pure.

## Defaults taken, owner to confirm

Q-E99-2..-10 and -12 as the plan proposes (above where used). The card is posted under the speaker "Case summary",
public, with the flag `caseSummary`; its content is the payload's words and nothing else.

## Test results

- 9290ce0: tiers 0-1 1176 passed, 2 failed (R1322: the summary card's font-sizes not kit tokens; R173: no name for the
  store caseTicks) - fixed in the next commit; tier 2 by name 125 passed; 14 scenarios green (docs/dev/e97/STATUS.md).
- The fix: tiers 0-1 1178 passed, 0 failed, 16 skipped, 1 red (R3339, E48's); 50-lang green. Pushed.

## Screenshot pages

- Round 2 (12.11.2026, C5): https://claude.ai/artifact/SkARoVukvKdKVYEd5pSdub - the Case schema window, one deduction
  ticked, both themes, EN and PL, 1366x768 and 1920x1080, GM only (a player has no such window). Not Foundry: the
  module's sheets through the style harness. No presentation in the harness's world, so no "presented" or "hint" mark
  is on the shots. Seen: at 1366x768 under the glass the side list scrolls (its fourth row below the fold).
