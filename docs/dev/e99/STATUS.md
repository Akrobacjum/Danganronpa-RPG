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

## Not done yet, and why

- **The animated board** (C7's board, D's "an animated board like the verdict's"): E61's verdict board, its event, its
  reduced-motion version and its Esc are not in this tree (E61 is ahead in the release order and not built). The chat
  card is the summary's static form; the board waits for E61.
- **C4 hints after presentations, C5 the schema in the console** (Q-E99-1: the schema as the console's middle): the
  console's middle is E73's to rebuild and the coordinator's 1.2.105 line touches its neighbours; not started.
  Default when started: a "Case schema" window of its own from the console's frame, the same graph with tick boxes.
- **C1 three-digit stage ids**: touches tools/stages.mjs, the coordinator's; not done here (Q-E99-11 stays open).
- **C8 scenarios, C9 handbooks and screenshots**: after C4/C5.
- No tier-2 test of `showCaseSummary` yet (a verdict fixture is needed): the composer and the card are tested pure.

## Defaults taken, owner to confirm

Q-E99-2..-10 and -12 as the plan proposes (above where used). The card is posted under the speaker "Case summary",
public, with the flag `caseSummary`; its content is the payload's words and nothing else.
