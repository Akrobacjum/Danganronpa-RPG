# E99 - status of the work line, branch claude/e97-98

The case schema at the trial and a summary for the players after the verdict. Started 12.11.2026 after E97/E98's
C1-C13 were pushed (1e1c61c). Plan: docs/dev/plans/E99.md on origin/claude/plan-130.

**Read first (12.11.2026, round 6).** The release is **1.2.108 = E73 + E99** (E92 rides later). The state of E99 is the
last sections - rounds 5 and 6 and "Plan defaults, as built" below; the earlier sections are kept as the record and are
**superseded** where they describe the Case schema as a window of its own ("the window stays as the second way", the
side list of tick boxes, the footer's Case schema button - all removed in round 5 by the owner's 13:15) or say the
schema's place "waits for E73" (E73 merged at fd3c07d; the schema stands in the console's right-hand part).

## Done (this commit)

- **C2, the modes' census**: trial-floor.mjs `MODE_STARTS` (each mode of floor-machine.mjs `MODES`: the console's
  start action, or `raisedByPlayer` for objection and rebuttal - Q-E99-10's default) and `modeCensus`. R3670.
- **C3, the ticks**: gm-stores.mjs `caseTickStore` (`caseTicks` under `gmCaseTicks`, ledger, not backed up, synced,
  cut with the trial's group; any GM - Q-E99-8), case-schema.mjs `caseTicks`, `setCaseTick`. R3672.
- **C6, the composer**: new scripts/case-summary.mjs `composeCaseSummary` - an allowlist: evidence on the schema a
  student found (public name and words), ticked deductions and counters by name, the solution only on a right vote
  (whole, Q-E99-4); local indexes, no ids, no author, no counts of what was not found (Q-E99-12). R3671 (markers in
  every place that must not cross). graphOf now carries a trace's public words (`text`).
- **C7, Show summary** (part): a "Show summary" button in the trial console after the verdict (greyed before it and
  in a Final Trial, Q-E99-5); a GM preview of exactly what goes out (Close the default, Send not under Enter); one
  public chat card that is the summary (Q-E99-6), sent once a chapter (a mark in the ticks store; Q-E99-9).
  `caseSummaryHtml`, R3673. R1364 follows the console's footer.

Red first: R3670-R3673 red at 1e1c61c (no MODE_STARTS, no caseTickStore, no case-summary.mjs), green here.

- **C4, hints after presentations**: new scripts/case-hints.mjs - `presentationHints` (E98's rule over what was
  presented: students other than the culprit presented strictly more than half of a conclusion's inputs, a ticked
  deduction counting; a bullet only the culprit presented is marked and counts for nothing; a hint is never a tick) and
  `casePresentations` (the chapter's Present cards through the GMs' answer key; a withdrawn Objection skipped, a refused
  one counted - its bullet was shown; a card with no Remnant behind it hints nothing and is counted for the GM).
  investigation.mjs exports `caseCulprit` (the first of the chapter's Blackened and killers, as the Map's reach reads).
  R3674, R3675, and the tier-2 "E99 C5" test's last step (a Present's read changes no tick).
- **C5, the schema at the trial (as a window)**: new scripts/case-trial.mjs - `trialSchemaHtml` (the Map's graph read
  only, the unrelated evidence folded, the presented and hinted nodes and the ticked ones marked; beside it a tick box per
  deduction, counter and solution and the node's mode start where MODE_STARTS has one, greyed with a reason while a
  floor is open), `openTrialSchema` (one window, a GM's, redrawn on the ticks, the schema, the Key plan, the floor and
  the chat's cards), `tickFromSchema`. The console's footer gains "Case schema" while a trial runs and after it;
  trial-floor-ui.mjs `startTrialMode` starts only what MODE_STARTS names. case-map.mjs `caseGraphHtml` takes `marks`.
  The Map's drawing rules in components.css now read `:is(.drpg-window-case, .drpg-window-case-trial)` (same
  specificity). R3676, R3677, tier-2 "E99 C5" (a click on a tick box reaches the store, a second click takes it off).
  R1364 follows the console's footer. Probe 08 captures `case-trial`.

**Q-E99-1, answered (12.11, about 11:00 Warsaw; the owner's "E99 tak" to the coordinator's question, relayed by the coordinator): the schema stands in the middle of the Class Trial screen.** Done after c73f5d7, below. What follows was the earlier deviation:

**Deviation, owner to confirm (Q-E99-1), superseded.** The plan's default puts the schema in the console's middle, with the frame's
button opening it larger. Here it is a window of its own from the console's footer: the console's body is a live region
redrawn every second and its rebuild is E73's (the coordinator's line); `trialSchemaHtml` is the whole middle, so moving
it there is one call once E73 has the layout. The plan's 86-frame-work risk (the SVG redrawn every second) does not
arise in a window of its own, whose region redraws only on its watches.

Red first: R3674-R3677 and the tier-2 "E99 C5" test red at 946c031 (no case-hints.mjs, no case-trial.mjs), green here.

- **C5 fix (R1317)**: tiers 0-1 on c6d1e96 failed R1317 - the window's region read the clock and the incident's
  setting without declaring them, so it would not have redrawn on either. It now watches `clock` and `murderState` (and
  the Blackened register, a GM store, which R1317 does not read), and R1317 opens the window among its openers.
- **C8, the scenarios**: 72-canary's `summary` phase (after its wrong verdict: a ticked deduction's GM note, an unticked
  deduction and the solution's name and words as markers; Show summary sent; every player scanned, p1's and p2's world
  data and chat read; p1's card holds the ticked deduction and no id of Chie's). Four seeds in lib/canary.mjs. A mutant
  composer that passes unticked deductions is caught: the marker found in the chat card on p1, p2 and p3 (measured,
  then reverted). 63-class-trial's part S (after I's correct verdict, gm3 connected for it): a tick on gm2 read on
  gm3 and gm3's on gm2; gm2's Show summary on p1 with both ticks and the solution. 63: 74/74 (71 before).
  Not done of C8's list: a hint after p1's Present in 63 (tier 1 R3674 and R3675 hold the rule and the read), the
  console's census in the DOM in 63 (R3670, R3676), the board on p1-p4 (E61).
- **C9, the text**: the GM handbook's section 15 in both languages (the schema at the trial, ticking, hints, Show
  summary); glossary `case-schema`, `case-summary` (E99, open); AUDIT 9.2 items 481-483 (LIVE-E99-01, -04, -05; -02 and
  -03 are the board's, E61). The player handbook's trial section waits for the board (what it shows).

## Not done yet, and why

- **The animated board** (C7's board, D's "an animated board like the verdict's"): E61's verdict board, its event, its
  reduced-motion version and its Esc are not in this tree (E61 is ahead in the release order and not built). The chat
  card is the summary's static form; the board waits for E61.
- ~~C5's place in the console's middle: waits for E73's console layout~~ - done (fd3c07d, rounds 5-6).
- **C5's frame glyph** (`case-map`, `node-check`): drawn in tools/glyphs.json, not declared in pixel-icons.css (E48's;
  the same note as E97's in docs/dev/e97/STATUS.md); the button and the boxes carry no glyph.
- **C1 three-digit stage ids**: touches tools/stages.mjs, the coordinator's; not done here (Q-E99-11 stays open).
- No tier-2 test of `showCaseSummary` yet (a verdict fixture is needed): the composer and the card are tested pure.

## Defaults taken, owner to confirm (corrected 12.11.2026, round 6)

Superseded: this section said Q-E99-2..-10 and -12 were all taken as the plan proposes. What is built, default by
default, is in "Plan defaults, as built" at the end of this file.

## Test results

- 9290ce0: tiers 0-1 1176 passed, 2 failed (R1322: the summary card's font-sizes not kit tokens; R173: no name for the
  store caseTicks) - fixed in the next commit; tier 2 by name 125 passed; 14 scenarios green (docs/dev/e97/STATUS.md).
- The fix: tiers 0-1 1178 passed, 0 failed, 16 skipped, 1 red (R3339, E48's); 50-lang green. Pushed.

## Screenshot pages

- Round 2 (12.11.2026, C5): https://claude.ai/artifact/SkARoVukvKdKVYEd5pSdub - the Case schema window, one deduction
  ticked, both themes, EN and PL, 1366x768 and 1920x1080, GM only (a player has no such window). Not Foundry: the
  module's sheets through the style harness. No presentation in the harness's world, so no "presented" or "hint" mark
  is on the shots. Seen: at 1366x768 under the glass the side list scrolls (its fourth row below the fold).
- c6d1e96 (C4, C5): tiers 0-1 1181 passed, 1 failed (R1317, fixed in c1bc17e); 14 scenarios (00, 30, 33, 41, 50, 61,
  62, 63, 65, 67, 72, 81, 86, 88) green.
- c1bc17e (C5 fix, C8, C9): quick gate green; tiers 0-1 1182 passed, 0 failed, 16 skipped, 1 red (R3339, E48's); tier 2
  by name ("E99 C5", "E97 C", R3674-R3677, R1317) 30 passed; 14 scenarios (00, 10, 11, 13, 30, 40, 41, 50, 63, 67, 72,
  76, 86, 88) green; 63 74/74, 72 with its summary phase green. Pushed.
- A slip, recorded: the dev worktree's `audit/harness/node_modules` (a symlink to the main tree's) was swept into a
  local commit by `git add -A audit`; fast-forwarding the main tree replaced its real node_modules with the symlink. Seen
  at the quick gate (eslint not found), before any push: the symlink taken out of the unpushed commit, `npm ci` run
  again, the path put in the local git exclude. The pushed history never held it (checked with git log and ls-tree).

## Next

C1 is the coordinator's (tools/stages.mjs). The board (C7's, the player handbook's trial section, 63's late p4)
waits for E61. Open from C8: a hint after a Present in 63. E98's 60-Remnant measurement.

## Blockers and a collision (12.11.2026)

- The coordinator's `claude/e97-fix` request (the owner's E97 review: nodes sized to their content, editing on the
  node, pan and zoom) was held here for the user's go-ahead, then withdrawn by the coordinator, who runs it in a
  session of its own. Nothing of it is on this branch.
- **R-number collision**: fa73b60's 3a288fa takes R3670 on the 1.2.107 line, where claude/e97-98 has R3670-R3677 for
  E99. The coordinator's decision: E99 renumbers at its merge onto the released 1.2.108 line; R3670-R3677 stay as they
  are until the coordinator names the base and the free range.

## C8's hint, end to end (after c1bc17e)

- Tier 2 "E99 C4: a Present card ...": a trace placed in this chapter, a real copy with its answer key, a card shaped
  as `presentBullet` posts it; the Case schema's state marks the Remnant presented and hints a deduction resting on it
  alone, the ticks unchanged. Written after the code, so not red first: its control is a mutant `casePresentations`
  that skips every card, under which it fails (and R3675 with it); restored. Seen on the way: the suite's shared
  `traceCopies` fixture places its trace with no chapter, so it is on no chapter's schema - this test places its own.

## The schema in the console's middle (Q-E99-1 answered)

- **The hook for E73**: the console's body holds `<div class="drpg-trial-schema" data-drpg-trial-schema></div>` after the
  read-out (`.drpg-trial-console`, the region that redraws every second) and before the footer; the console's render
  calls case-trial.mjs `mountTrialSchema(dialog)`, which fills the element (`TRIAL_SCHEMA_SLOT` =
  `[data-drpg-trial-schema]`) and keeps it live on its own watches. **E73's mockup B keeps one element with that
  attribute in its middle region, outside any region its own keepLive redraws, and the same `mountTrialSchema(dialog)`
  call at render.** The CSS for the console's variant (one column: the graph at a stated height, the ticks under it) is
  under `.drpg-window-trial` in components.css; E73 may restyle the slot's box.
- The Case schema window stays as the second way (the footer's button).
- A mode's start in the schema is greyed while no Class Trial runs as well (the console offers no start then).
- Tier 2 "E99 C5: the case schema stands in the middle ...": red at c73f5d7 (no slot), green here - the slot outside
  the read-out, the same tick box after the clock moved, starts greyed under an open floor, a click stored. R3676 grows
  a third case (no trial running), changed with the code (not red first).
- Round 3 (12.11.2026): https://claude.ai/artifact/XwXm4DyQ9xWQtUohqxUrvC - the trial console with the schema in its
  middle, both themes, EN and PL, 1366x768 and 1920x1080, no trial running. Not Foundry, and not yet E73's layout; at
  1366x768 the tick list starts at the fold and scrolls with the console.

## Round 3b (12.11, after the owner's 11:35 note: the schema in the console where modes, Overrule and Objection run)

- That console is the one window: `drpg-window-trial` (trialConsoleHtml draws the bar). No other window runs modes,
  Overrule or Objection: `drpg-objection-pick` is a player's bullet picker, `drpg-window-objections` the GMs' log.
- Tier 2 "E99 C5: the case schema stays in the trial console in every floor state the bar has": debate, Objection,
  rebuttal, Testimony, Panic Round, Closing Argument, after the vote, after the verdict - all eight reached, the slot
  in the console outside the read-out and filled in each. A guard written after the placement, not red first; the
  first run left the Panic Round unreached (the test's 60 s a turn is out of the round's 10-15), fixed in the test.
- **Open, a layout decision for E73 / the owner**: in a running trial the read-out (the trial, the debate with its bar,
  Missing Key Remnants, the vote) is taller than the window at 1366x768 and at 1920x1080 in today's 704 px console, so
  the schema under it is reached by scrolling. Tried and not committed: the read-out capped at 34vh with its own
  scroll - the schema then shows at once, but the bar scrolls out of sight in the read-out. Both are on the round-3b
  page. Showing read-out, bar and schema together takes a wider console or E73's mockup B.
- Shots: https://claude.ai/artifact/XwXm4DyQ9xWQtUohqxUrvC (round 3b on top).

## Round 3c (12.11, E73's mockup B slot as the coordinator relayed it: the graph's height reserved, nothing under it)

- In the console the mount is the graph alone, at clamp(12rem, 30vh, 24rem) - B's reserved height. Each deduction's,
  counter's and solution's tick box and its mode's start stand in the graph, in the column gap right of the node
  (case-map.mjs `caseGraphHtml` `controls`; siblings of the node's button, each named: "Ticked: <name>", "Start <mode>
  from <name>"). No list under the graph in the console; the Case schema window keeps it. The unknown cards' line
  stands inside the graph's box. The slot's own display and order are B's: this stage's rule on
  `.drpg-trial-schema` sets a margin only.
- Tier 2's two console tests look for the boxes and starts in the graph and for no list: red before (no controls in
  the graph), green after. The a11y sweep ("every control ... has a name to be read out") green.
- Measured in Chromium through the style harness (today's console, not B): the footer stays in the window at
  1366x768 and 1920x1080, both themes; the body scrolls to the schema (today's read-out above it is tall).
- Shots: https://claude.ai/artifact/XwXm4DyQ9xWQtUohqxUrvC (round 3c on top: from the window's top and scrolled to
  the schema).

## Renumbered (12.11, the coordinator's step 2 before the merge of claude/e97-fix)

E99's tests R3659-R3666 are R3670-R3677 (each +11, in order), because the 1.2.107 line took R3659 (3a288fa) and the
E97 fix R3660-R3662. The registry keeps the old rows marked "(renumbered to R367x in E99)" until the merge, where
R3659-R3662 take the 1.2.107 line's tests. Every mention in this file was moved too.

## Round 4 (12.11; the owner's 11:50 and 12:00 through the coordinator; E97 fix merged at 70b345b)

- **Merged the E97 fix** (claude/e97-fix at 1cb13422) as the coordinator asked, without waiting for its CI: 70b345b.
  Conflicts and the two rules of main that met E99 there (R3510's census row and chatCard; R3660's no fixed height)
  in the merge's message. On the merge: tiers 0-1 1238 passed, 0 failed, 16 skipped, 0 red; scenarios 41, 50, 62, 63,
  67, 72, 86, 88 green; 61-gmstore-case red once under that load (D5, "the same browser back in world A ...") and
  113/113 alone on the same commit - recorded, not explained (F9 before it was the same kind).
- **The trial's schema is the Map's** (case-map.mjs `caseGraphHtml`, `cameraHtml`, `wireCaseMap` with no editors and
  no callbacks: read only; case-view.mjs `relayoutCaseMap`, `wireCaseCamera`): whole nodes and the camera, in the
  console and in the separate window. The Map's graph rules in components.css also serve the trial's two contexts
  (`:is(...)` inside the selector, the same weight).
- **Before a trial** (the console the GM panel's Class Trial tile opens): the schema alone - no tick, no start.
- **While a trial runs**: each deduction's, counter's and solution's tick is a button on its tile (`aria-pressed`,
  "Ticked: <name>"), the mode's start under it, both in the tile's right-hand gutter (case-view.mjs `TILE_GUTTER`,
  `placeTileControls`, placed again after each measure); neither carries `data-drpg-node` (the relayout measures
  every child button that does).
- **The mount fills the slot's box and never grows it**: the live region stands absolutely in the slot; the slot gets
  `position: relative` and, for today's console, B's reserved min-height; display and order stay B's.
- **A bug found by the sweep and fixed**: keepLive replaces the region with what `build` returns, which returned the
  schema without `.drpg-case-trial-live`; after the first redraw the region was lost and nothing was wired (seen in a
  debate's capture: viewport 668x0, no camera). Present since afeeb68. The console test now holds the region and its
  wiring after the tick's own redraw (red before the fix: `rewired: false`).
- **Tests**: tier 2 - the console test (tick on the tile, inside its box; the camera; after the redraw), the eight
  floor states (the tick button in each), and a new pre-trial test (no tick, no start, the camera) - red at 70b345b,
  green here; "E99 C" 17 passed with R1317, R3676, R3677 and the a11y sweep (20). A slip of mine on the way: a
  replace in the test file hit the window test's line instead of the console test's and made it race; seen, put back,
  and 70b345b's own window test passes unchanged (2 of 2).
- **Measured in Chromium** (audit/case-map-sweep.mjs with `--ids "^class-trial--case"`, new `--scale` and a shot of
  the console scrolled to the slot; the tick and start checked inside their tile and over no word of it): 24 pages
  (before the trial, a debate, an Objection; both themes, 1366x768 and 1920x1080, EN and PL), 0 cut, 0 overlaps,
  7 controls a page during the trial and 0 before; controls read (the C5 box 30 cuts, the stale layout 3 overlaps).
- Shots: https://claude.ai/artifact/XwXm4DyQ9xWQtUohqxUrvC (round 4 on top).
- Open: in today's console the schema is below the read-out (B's layout places it); at 1366x768 the slot is 228 px
  tall and the camera's buttons stand over the graph's lower right (as on the Map); the fold of unrelated evidence
  does not unfold in the trial (no callback; a read-only view).

## CI, and 61 D5 (12.11, the coordinator's relays)

- The owner's decision: every commit carries "[skip ci]"; CI runs once per release on the train's PR head; the local
  checks above stand in for it. Cancelling this branch's queued runs was asked too; not done here (an action outside
  this session my brief does not cover; left to the coordinator or the owner).
- 61 D5 explained and fixed on the 1.2.107 line (d220d7a; the primary's clock beat landing between D's copy and the
  browser's hello): merged here with the 1.2.107 line at ce6a476. On it, under the same load (tiers 0-1 beside 41, 61,
  62, 63): tiers 0-1 1238 passed, 0 failed, 16 skipped, 0 red; 61 green, and 41, 62, 63 green; the quick gate green.

## Round 5 (12.11; the owner's 13:15 through the coordinator: the console as it is, no Case schema button, the schema in the window's empty right-hand part)

- **E73 merged** (claude/e73 at 6a914d0, a merge commit, fd3c07d). Following E73's merge note for E99: E99's rule on the
  slot keeps `position: relative` only; the min-height fallback and the margin-top went. R3912 (new) holds the slot's
  cascade - min-height 0, overflow auto and grid area `schema` from E73's rule alone, both themes, idle and running -
  and that no other rule sets the slot's display, grid, order, flex or a height. Red with the old rule back, green now.
- **The separate window is gone** (f02ec55): case-trial.mjs `openTrialSchema`, its class and tick-box list; the
  footer's Case schema and `TRIAL_ACTIONS.caseSchema`; `DRPG.CaseTrial.open`, `intro`, `noTrial` in both languages;
  its CSS; R3676 and R3677 (rows marked removed), the tier-2 window test and probe 08's capture; the GM handbook's lines
  (section 15, EN and PL). R3913 (new) holds the console's drawing and that no window or button is left (red at
  fd3c07d). R1317 reaches case-trial.mjs's region through the console. The registry's R3663-R3665 rows read "(removed
  in E99: renumbered to R367x)" instead of a doubled E48 stamp.
- **The camera's bar over a node** (the owner's round-4 shot: pl, glass, 1366x768, "- 100% + / Dopasuj do widoku"
  over "Wniosek / Nonstop Debate"). The sweep missed it: it read cuts, overlaps and the tile controls, not the bar.
  Now it reads the bar against every node's visible part at rest and after Fit to view, with a planted control (the
  bar fixed over the first node must read). Red at 54dc96b on round 4's captures: 24 of 24 pages. Fix: the bar stands
  in a strip of its own under the graph (Map and trial alike; `wireCaseMap` wires it there), outside the viewport,
  so Fit to view - which brings nodes to every edge - leaves nothing under it. E97's R3661 follows the bar's place.
- **The fold of unrelated evidence was cut and lay over a Remnant** (seen in the shots, not by any check): under glass
  "NIE ZWIĄZANE Z MORDERSTWEM: 1" (292 px of words in 238), and on the Map in Polish the folded button over the first
  unrelated Remnant. The sweep now reads the fold's words (a text range, not scrollWidth: the glass brush counts
  there) and its box against the nodes: red at 54dc96b. Fix: the fold keeps its words as written (no capitals, no wide
  spacing), wraps where it must, and case-view.mjs `mapPlace` gives the empty row the fold's measured height
  (`gapH`, first column only). R3914 (new, pure) red at fd3c07d.
- **The sweep frames the console as Foundry does**: 1280 px (`consoleWidth`), at most the screen less 16; the
  captures' 1008 px is the harness's screen. Every number below is at that width.
- **Size, measured** (audit/case-map-sweep.mjs; the slot, the viewport without the camera's strip, and after Fit to
  view the scale and the smallest node text = computed font size x scale):

  | State | Screen | Theme | Slot | Viewport | Fit | Smallest text |
  | --- | --- | --- | --- | --- | --- | --- |
  | before a trial | 1366x768 | glass | 1244x450 | 1242x412 | 0.705 | 14.8 px |
  | before a trial | 1366x768 | Legacy | 1244x536 | 1242x510 | 1 | 11 px |
  | before a trial | 1920x1080 | glass | 1244x762 | 1242x724 | 1 | 21 px |
  | before a trial | 1920x1080 | Legacy | 1244x848 | 1242x822 | 1 | 11 px |
  | debate / Objection | 1366x768 | glass | 669x352 | 667x314 | 0.49 | 10.3 px |
  | debate / Objection | 1366x768 | Legacy | 669x438-454 | 667x413-429 | 0.74-0.79 | 8.1-8.7 px |
  | debate / Objection | 1920x1080 | glass | 669x664 | 667x626 | 0.794 | 16.7 px |
  | debate / Objection | 1920x1080 | Legacy | 669x750-766 | 667x725-741 | 0.794 | 8.7 px |

  (Legacy's range is EN against PL; glass reads the same in both. The case: 840 px wide, 584-641 tall.)
- **Under 11 px at 1366x768 while a trial runs, so one change, chosen as the default: the mode picker on one compact
  row** (no wrap, the starts at the small text, a row that does not fit scrolls sideways). Why this one: at 1366x768
  the fit is bound by the slot's height (glass: width 667/840 = 0.79, height 314/641 = 0.49), so a narrower read-out or
  the window at the screen's width gains nothing there; only height does. Measured: it gave the slot 4 px (at the real
  1280 px the picker nearly fitted one row already; it took two at the harness's 1008). The camera's strip, kept low
  (glass 32 px, was 45), gave the viewport 14 px. Glass went 9.7 -> 10.3 px; about 22 px more viewport would reach 11.
  Legacy cannot reach 11 px at any scale under 1: its smallest node text is 11 px at 100%. At 1920x1080
  both themes are width-bound (0.794), where a narrower read-out column would help. Left to the owner: (1) a narrower
  read-out (helps 1920x1080, not 1366x768); (2) a lower header and footer at 1366x768 (154 px between them under
  glass); (3) leave it: at 100% the words are full size and the camera reaches any part.
- **Shots** (before a trial, Nonstop Debate, an Objection; 1366x768 and 1920x1080; both themes; EN and PL; the window
  at rest and after Fit to view; the table): https://claude.ai/artifact/WUy527XyW8X8QihFuEPKBd. Looked at before
  sending: nothing over a node, no cut text in a node or the fold, the footer in view. At rest (100%) the right-hand
  column runs past the viewport's edge: the camera's view, not a cut.
- **The zoom readout** reads at the small size (13 px; at 11 px of VT323 under glass it read as a smudge).
- **Local checks on 18bc6a1** (CI runs once per release; "[skip ci]" on every commit): the quick gate green (lint,
  check 17/17, gate 37/37); tiers 0-1 1250 passed, 0 failed, 16 skipped, 0 red; tier 2 by name ("E99", "E97", "E73")
  55 tests, 59 passed, 0 failed; scenarios 41 51/51, 50 44/44, 62 51/51, 63 74/74, 67 45/46 with 1 expected red
  (TR30 until E72), 68 20/20, 72 132/136 with 4 expected red (S17-31 until E43, three Foundry limits), 86 104/104,
  88 26/26 - 0 failed in each; the sweep 48 pages, 0 failing (the trial's console and the Map, EN and PL).

## Texts trimmed (12.11, the owner's standing text rule through the coordinator: shorter, natural, no overexplaining)

- `DRPG.CaseTrial` (empty, floorOpen, hint, unknown) and `DRPG.CaseSummary` (intro, sent, already, noVerdict,
  noSolution), EN and PL; Polish with no gendered past form ("zaznaczone wnioski", not "odhaczyłeś"). The GM handbook's
  two E99 paragraphs of section 15 rewritten shorter; they also said the camera's buttons stood in the schema's corner
  and that a start was greyed with no trial running, both untrue since round 5 and round 4. `DRPG.CaseMap` (E97/E98)
  read and left: its texts are already one short sentence each.
- Checked: parity, text, prose, dashes green; the quick gate green; R125, R1364, R3670-R3675, R3913 and tier 2's
  "E99" 22 passed, 0 failed; scenarios 50 44/44, 63 74/74, 72 132/136 with its 4 expected red, 0 failed.

## Round 6 (12.11; the owner: "Zgadzam sie na zmiany w oknach class trial ... akceptuje"; option (2) of round 5)

- **Red first**: the sweep holds glass, while a trial runs, at 800 px of height or less, to 11 px after Fit to view
  (`MIN_TEXT`). Before the change: 4 pages failing (glass 1366x768, debate and Objection, EN and PL: 10.3 px).
- **The change**: settings.mjs `BREAKPOINTS.low = 800` with `lowScreen` beside `shortScreen`; `applyTheme` stamps
  `drpg-low` on the body and the screen's watch re-applies it as the height crosses 800. components.css, under
  `body.drpg-low`, draws the trial console's title and its footer's buttons low (the small text, tight padding, no
  theme letter-spacing). The frame's own height, padding and margins stay the kit's: a first try set the header's
  min-height and the footer's margin and padding, and R1357 (no rule frames a moved window) read it red; taken out.
  No height in a media query (the breakpoints stay in settings.mjs, CLAUDE.md). R3915 (new) holds the threshold, the
  class, the watch and the sheets' rules; red at 1b8d19a.
- **The sweep now also reads** the window's footer: each button in view, named, its words inside its box (a text
  range; the glass brush counts in scrollWidth), with a planted control (a button put off the screen must read); and
  stamps `drpg-short`/`drpg-low` on its page from settings.mjs's numbers, as the module does.
- **Measured** (sweep, 24 trial pages, 0 failing; 1920x1080 identical to round 5):

  | 1366x768 | Theme | Slot | Viewport | Fit | Smallest text |
  | --- | --- | --- | --- | --- | --- |
  | before a trial | glass | 1244x478 | 1242x440 | 0.753 | 15.8 px |
  | before a trial | Legacy | 1244x560 | 1242x535 | 1 | 11 px |
  | debate / Objection | glass | 669x423 | 667x385 | 0.601 | 12.6 px (was 10.3) |
  | debate / Objection | Legacy | 669x478-494 | 667x453-469 | 0.794 | 8.7 px (as it was: Legacy's 11 px floor at 100%) |

  Where it came from (glass, debate): the footer 90 -> 44 px (one row of eight buttons, all in view, none cut); the
  header 64 -> 38 px, but that header is the harness's, not Foundry's - without its share the footer alone leaves
  about 359 px of viewport, a fit of 0.56, about 11.8 px. Foundry's own header at a real table is not measured.
- Monokuma Legacy stays as it is (the owner); a GM needs nothing new in the handbook for it.
- Shots, 1366x768 (round 6 at the top of the page): https://claude.ai/artifact/WUy527XyW8X8QihFuEPKBd.

## Round 6, the release ledger's fixes (12.11, the coordinator)

- GM handbook 15.2 "Starting a mode" (EN, PL): the three zone modes start from the console's mode picker and open the
  Hall zones window on that mode (since E73's 5fc377d4), not from a footer button. The comments over `MODE_STARTS`
  ("one footer button") and over `trialBodyHtml` ("from 1.2.109's merge", "in one column") say what the code does now.
- AUDIT 9.2 item 488 (LIVE-E99-01) rewritten for the schema inside the console (rounds 4-6), with the 11 px check at
  1366x768 and Foundry's own header height, which the sweep cannot read.
- **The summary card's world-secrets rule** (world-secrets.mjs `messages`, `when: "caseSummary"`): no `speaker.actor`
  or `speaker.token`, and module flags `caseSummary` and `sfx` alone. R190's three fixtures (each field, and a planted
  `nodes` flag) read red without the rule ("the rule did not find a secret planted for it"), green with it; R9 and
  R202 green.

## Plan defaults, as built (12.11.2026, round 6; what the plan proposed and what the code does)

| Q | The plan's default | Built |
| --- | --- | --- |
| Q-E99-1 | the schema in the console's middle, and its own larger window from a frame button | superseded by the owner (13:15): the schema in the console's right-hand part, no window, no button (round 5) |
| Q-E99-2 | discovered = ticked by a GM at the trial | as proposed (R3671) |
| Q-E99-3 | Remnants on the schema a student found | as proposed (R3671) |
| Q-E99-4 | the whole solution on a right vote | as proposed (R3671) |
| Q-E99-5 | greyed in a Final Trial | as proposed: Show summary greyed before the verdict and in a Final Trial |
| Q-E99-6 | a GM's public chat card, no notice | as proposed; the animated board is E61's and not in this tree |
| Q-E99-7 | its own Sound slot "Case summary", played with the board | built in round 6: `SFX_EVENTS.caseSummary` (incident; EN and PL), carried by the card (`sfx`), so every client plays it with the card (R3916) |
| Q-E99-8 | every GM ticks and sends | as proposed (R3672; 63 S: gm2 and gm3) |
| Q-E99-9 | once per trial; the button reads as done; a GM may replay the board on their own browser | once per trial built in round 6: the trial's record `summaryShown` (a time, nothing of the content; the entry blanks it, so a second trial has its own) replaces the ticks store's per-chapter row; a second press, by any GM, says "Already sent for this trial." and sends nothing (R3916, R1257; 63 S). E99 next (below) adds the rest but the board: the button reads "Summary sent", greyed, on every GM's console, and the ticks are the trial's too; there is no board to replay (E61) |
| Q-E99-10 | objection and rebuttal listed with no start; the Reveal where it is | as proposed (R3670) |
| Q-E99-11 | three-digit stage ids in E99 | not done: tools/stages.mjs is the coordinator's |
| Q-E99-12 | no count of what was not found | as proposed (R3671) |
| Q-E99-13 | a hint after presentations by E98's rule | as proposed (R3674, R3675) |
| C7 | a `showSummary` next step before the chapter's end, and a `summaryShown` record row | the record row built (above); the next step built in E99 next (below). Round 6's reason for leaving it, kept as the record: it changes the one table three readers share (trial-floor.mjs `TRIAL_NEXT_STEPS`: R2050's 31 views and its step count, R2051's panel line, R1364's footer primary, the console's leads, two texts) and needs a Final Trial flag `trialStepView` does not carry - not small. After the verdict the next step stays End of chapter; Show summary is a secondary button beside it. Left for the owner or a later stage |

## Round 6's local checks (aa4a8f6, 61d9d9c, a3e77af)

- Quick gate green (lint, check 17/17, gate 37/37) on a3e77af; the first run read the contract red on a `split(".")[1]`
  in R190's new fixture (rule 3), rewritten in a3e77af - R156 and R190 by name green after it.
- Tiers 0-1: 1251 passed, 1 failed (R156, that same line; green on a3e77af), 16 skipped, 0 red.
- Tier 2 by name ("E99", "E97", "E73", "E21"): 94 passed, 0 failed.
- Scenarios, 0 failed in each: 63 75/75 (the summary once a trial, the record's time), 72 132/136 with its 4 expected
  red, 41 51/51, 50 44/44, 62 51/51, 67 45/46 with 1 expected red (TR30 until E72), 68 20/20, 86 104/104, 88 26/26.
- The sweep: 48 pages, 0 failing (the 1366x768 numbers in round 6's table).

## E99 next (12.11.2026; the coordinator, the owner approved; local branch claude/e99-next from 9ca7fcc)

- **Show summary is the next step after the verdict**: trial-floor.mjs `TRIAL_NEXT_STEPS` answers `caseSummary` before
  End of chapter while the trial's record says the summary is not out (`summaryShown` null, as the record's blank and
  every entry write it) and no Final Trial runs; `trialStepView` carries `finalNow` from the clock. The step is named
  after the footer's own action, so the console's primary is Show summary at that step, the GM panel's line says
  `DRPG.Floor.next.caseSummary` and its Do it opens the console. A view with no record of the summary (R2050's 31 and
  R2051's views) reads as before: they are unchanged and green. Texts: `DRPG.Floor.next.caseSummary`,
  `DRPG.Floor.lead.caseSummary`, EN and PL.
- **The button once sent**: greyed and reading "Summary sent" / "Podsumowanie wysłane" (`DRPG.CaseSummary.shown`) on
  every GM's console - the record is a world setting, and the console's footer redraws on it.
- **The ticks are a trial's**: case-schema.mjs stamps each tick row with the trial's `trialStartedAt` (the record's,
  written afresh at every trial's entry) and reads only the current trial's rows. A second Class Trial in the chapter
  starts with none; nothing is deleted and nothing new is written on the primary or on a player (the store stays the
  GMs'). One row per node: a tick in a later trial is the row's from then on.
- **Red first**: R3917 (tier 1: the step for six views, the view's Final Trial flag, the texts, the footer before and
  after) and tier 2 "E99 next: the case's ticks are a trial's" (measured [true, true, true] at 9ca7fcc - the second
  trial read the first's tick) - both red at 9ca7fcc, green here. Scenario 63 S: after `resetTrialProgress`, gm2 reads
  none of the first trial's ticks and the summary is unsent.
- GM handbook section 15 (EN, PL): one sentence each on the next step and "Summary sent", and that ticks belong to the
  current trial.

## Round 7: the verdict and the chapter's end as steps of the flow (12.11.2026; the owner through the coordinator)

The owner: "czy werdykt nie powinien byc usunietym przyciskiem z konsoli trial? Zamiast tego byc kolejnym etapem
glosowania? Tak samo end the chapter. A start final trial w ogole tez nie powinno byc w trakcie trwania zwyklego class
triala opcja". **Defaults taken, owner to confirm:**

1. **The Verdict** leaves the console's footer as a standing button: it stands there only while it is the trial's next
   step (the vote counted, no floor open), as the primary; the console's first line, the GM panel's Next line and the
   vote window's lead already name it then. Not in the vote window as a button of its own (the vote's footer is
   unchanged).
2. **End the chapter** likewise: only while it is the next step - after the verdict and, in an ordinary trial, the case
   summary. Still the destructive role, never the Enter default (Close is). A chapter that ends without a verdict ends,
   as since E49 A2, from the part at the bottom of Edit campaign.
3. **Start the Final Trial** is not drawn while an ordinary Class Trial runs (hidden, not greyed); with no trial it is
   where it was (greyed with its reason when no Mastermind is set), and during a Final Trial End the Final Trial stays.

Every road that writes the verdict or ends the chapter is unchanged (`TRIAL_ACTIONS.verdict`, the verdict's window and
its runner on the primary; `TRIAL_ACTIONS.chapterEnd`, the chapter-end window): only where the GM reaches them moved.

- **Red first**: R3918 (tier 1), the footer's census over eleven states (the next step, a Verdict, an End of chapter, the
  Final Trial switch, the Enter default) - red at a5844ac (all three in every state). R1364's four footers, R2052's
  zone and set, and tier 2 E47-T1's zone follow the owner's change, each with the reason written beside it.
- GM handbook section 15 (EN, PL): one paragraph, "The footer follows the trial", naming the buttons as drawn.
- Probe 08: three new captures - the count, the verdict given, the summary sent - each a patch of the trial's record.
- The sweep over the console's five captures (40 pages, 0 failing): glass at 1366x768 during a trial 12.6 px after
  Fit, Legacy as it was; at 1920x1080 the slot grew 664 -> 707 px (the footer holds fewer buttons).

## The open node is its editor (12.11.2026; the owner at a real table, 1.2.108, through the coordinator)

The owner: clicking a Truth Bullet or Key Remnant slot in the planner showed the node's read-only view on top in a dashed
outline (its kind and state, title, description, State, Left by) and the editing part under it; the editing part is to
replace the node entirely.

- case-map.mjs: the open node's face is marked `is-editing` and hidden (components.css, at the node rule's weight), its
  fieldset stands at the face's own place (`relayoutCaseMap` places it there), and the fieldset drops the read-only rows
  (`nodeInfoHtml({ rows: false })`) when the node has fields of its own; its warnings stay. A node with no field of its
  own (another chapter's Remnant) still shows its facts. A **Close** button beside Move up / Move down, since the face
  that closed it on a second click is hidden; Escape and a click on empty space still close it.
- Red first: R3919 (tier 1) - the face editing and hidden by the sheets, the fields at its place, no read-only rows, a
  warning kept, a bare node's facts kept, Close calling `onClose` - red at f0b4f9b. R3661 (E97's) now reads the fields at
  the face's top, not under it.
- The sweep: the open node's box is its fields; its face must not be drawn and the fields must stand at its place; the
  camera's reveal reads the fields. Probe 08 adds `investigation--map-slot` (a planned Key Remnant slot open). Before
  (f0b4f9b) and after: 24 pages each, 0 failing.
- GM handbook (EN, PL): the fields open in the node's place, and Close.
- Shots, before and after, 1366x768, both themes, PL then EN: https://claude.ai/artifact/2hGySDAeJ8vJTxCW5USYbd.

## A node saves when its editing closes (12.11.2026; the owner through the coordinator, for 1.2.111)

The owner: "Moduly przy edycji nie powinny czekac na save, tylko zapisywac sie po zamknieciu edycji".

- investigation.mjs `saveOpenNode`: the open node's changed fields, read as Save reads the form but only inside that
  node's fieldset, are written by `applyDashboardSave` (quiet: no "saved" toast; a refused field is told as Save tells
  it) on the node's Close or Escape, a click on empty space, a pick of another node, the switch to the Table, and when
  the window closes by its X, Escape or a footer button other than Save. The writes run one after another. A written
  field takes its value as drawn (live.mjs `keepDrawn`), so a later Save does not hand it on again.
- Red first: tier 2 "planner autosave: ..." - a Remnant's name changed on the Map, Close without Save: stored; changed
  again, the window closed with the node open: stored. Red at cebe4c6 (both names stayed as drawn).
- GM handbook (EN, PL): the fields save on close, no Save needed.

Defaults, as built (the owner may revise):

| Question | Default |
| --- | --- |
| A Save button in the node's fields | none; the footer's Save stays for the Table |
| When it writes | the node's Close, Escape, a click on empty space, a pick of another node, the switch to the Table, the window closed (X, Escape, a footer button) |
| Per keystroke | no: one write per close |
| An empty or invalid field | written as `applyDashboardSave` takes it (the same rules as Save); nothing typed is lost |
| A write that fails | one line, "Not saved. Your text is still in the fields." / "Nie zapisano. Wpisany tekst został w polach."; the fields keep the text and stay the GM's change |
| Escape | saves, like Close (no earlier ruling gives Escape a "discard" meaning) |

## No OBJECTION or Rebuttal on a node (13.11.2026; the owner through the coordinator: "usuwamy objection i rebuttal")

- case-schema.mjs: `caseModes` (the node's select after "no trial mode", and the consistency check's list) leaves out
  `objection` and `rebuttal`: the list is Nonstop Debate, Testimony, Panic Round, Closing Argument, Straw Poll, Logic
  Dive, Scrum Debate. A node stored with either reads as no mode (`caseNodeOf`); nothing is rewritten, and the node's
  next Save writes what its select then holds (only if the GM changes it, as every field).
- R4451 (tier 1), red at 91ec405; R3373 (tier 0) reads the shorter list.
- GM handbook (EN, PL), the schema at the trial: the sentence about OBJECTION and Rebuttal having no start button is gone.

## The case map's columns farther apart (13.11.2026; the owner through the coordinator: "Wnioski ... sa za blisko bulletow i za blisko siebie. Chodzi o odstep miedzy kolumnami")

- case-view.mjs `MAP_GEOMETRY.colGap` 48 -> 80 px (1.67x): every gap between columns (evidence, each deduction column,
  the solution), on the Map and in the trial console's schema, which `mapPlace` lays out alike. Rows unchanged. A
  bracket between two nodes of one column stands `colGap / 4` left of them, 20 px now (12 before).
- R4452 (tier 1), red at 0f5591d; R3651 reads the bracket from the geometry.
- Measured, case-map sweep, Chromium, 1366x768 (PL; EN the same widths), 32 pages, 0 failing before and after:

| Where | Theme | Before | After |
| --- | --- | --- | --- |
| Map, nothing open (viewport 972 px) | both | canvas 840 px | 904 px, fits |
| Map, a node open | both | canvas 952 px | 1016 px: 44 px past the viewport, reached by dragging (as the open node's height already is) |
| Console schema, no mode (viewport 1242 px) | both | 840 px, fit 0.753 glass / 1 legacy | 904 px, the same fits |
| Console schema, a debate (viewport 667 px) | glass | fit 0.601, smallest text 12.6 px | fit 0.601, 12.6 px (the height decides) |
| Console schema, a debate | legacy | fit 0.794, 8.7 px | fit 0.738, 8.1 px |

- Monokuma Legacy's fitted text in a debate goes from 8.7 to 8.1 px; it is outside the 11 px rule (glass only), and
  100% zoom with dragging reads it, as the owner accepted for 8.7.

## Planned Remnants of other types (13.11.2026; the owner through the coordinator: "opcje w planerze dodawania zaplanowanych remnantow innego typu niz incident i keys")

- The planned node (case-schema.mjs kind "incident", E97 C12) carries a Remnant type, `PLANNED_TYPES`: Incident (the
  default, and every row written before), Prep, Neutral, Faint, Tamper (`resolution`). Its fields on the Map have a
  Type select beside the room; the face names the type; **Place on the map** opens New Remnant filled in from the plan
  with that type (tied to the murder for an Incident Remnant, as before; for the others the window's own default, "-").
  New Remnant asks the rest (author, difficulty, analysis, note, reinforced) as it does in play.
- Left out, and why: Key Remnant (the Key plan's slots plan it), Final Truth Remnant (the Final Truth form in the Map's
  overview places it), Autopsy Remnant (handed over from the GM panel and never found: Observe has no number for it,
  and New Remnant does not offer it).
- Texts: the add button "Add planned Remnant" / "Dodaj zaplanowany Remnant"; a new one "New Remnant" / "Nowy Remnant";
  the GM panel's waiting line counts planned Remnants. GM handbook (EN, PL): the Map's row and the GM panel's list.
- Red first: tier 2 "planned Remnants of every type: ..." (a planned Prep placed as a Prep Remnant with the plan's
  name, words and room; red at 6ea98d9: the window opened as an Incident Remnant) and R4453 (tier 1, red at 6ea98d9).
  R3373 reads the node's new `type` field.

## A planned location for a Remnant not yet placed (13.11.2026; the owner through the coordinator: "opcje zaplanowania lokacji niepostawionego bulleta")

- A Key plan slot takes a room (`room`, the GMs' Key plan store): a room picker beside its **Place**, in the Table's Key
  tab and on the slot's node on the Map, drawn while the slot is not on the map (a placed slot shows none: its Remnant
  has its real room). The realization's preview and the Table's Place start on it, and Place puts the Key Remnant in it.
  A planned room the scene no longer has is said in one line ("The planned room "X" is not on this scene. Pick a room." /
  "Zaplanowanego pokoju „X" nie ma na tej scenie. Wybierz pokój."), and the window starts as before (its first room; the
  preview's "leave it"). The map's slot node reads the room (`graphOf`).
- A planned Remnant (E97 C12's planned node) already had a room; its Place on the map says the same line for a room
  gone.
- Two fixes found on the way, both in this commit: the Map drew no fields for a planned Remnant (it is evidence, and
  only non-evidence nodes got the schema's editor), so its room, its Type (the commit before this one) and its Place on
  the map were reached only from the GM panel's list; and utils.mjs `placeRoomOptions` marked no room selected when
  given a room and no scene, so a planned Remnant's room read "- leave it -".
- Red first: tier 2 "planned location: ..." (stored, the preview's and Place's first room, placed there, a room gone
  starting on the first room with its line, a planned Remnant's room shown), red at 9267b1d.
- GM handbook (EN, PL): the realization's paragraph.

## A planned Autopsy, sent at the body with no GM click (13.11.2026; the owner through the coordinator: "Niech dziala tak samo jak key remnanty po prostu, tylko ze gracze dostaja od razu po odkryciu ciala. Bez kliku GMa")

- Like a Key Remnant slot: the Map's evidence column always has an Autopsy Truth Bullet node (case-schema.mjs kind
  "autopsy", one a chapter, `AUTOPSY_NODE`), drawn empty until the GM writes it. Its fields are the GM panel's Autopsy
  window's: name, words for the players, the GM's note. It saves on close like every node. A deduction may rest on it,
  and its holders are the students holding this chapter's Autopsy (`caseReach`).
- Sent: on the primary GM's browser, from the discovery's own hook (chapter.mjs `BODY_ANNOUNCED_HOOK`, `writer`), by
  case-realize.mjs `sendPlannedAutopsy`: to every student not dead (the hand window's own default), by the same road
  (truth-bullets.mjs `issueAutopsy`: the answer key and the note stay the GMs'), and the GM is told how many. The suite's
  rehearsal stamps send nothing.
- Defaults as built, and where they differ from the brief:
  - Once a chapter, not once a body: the case plans one Autopsy, and an Autopsy of the chapter already held (sent by
    hand, or at an earlier body; `autopsyIssued`, moved from gm-panel.mjs to investigation.mjs) sends nothing.
  - "No GM connected at the discovery": a discovery runs on the primary GM's browser (`runDiscovery`), so there is no
    discovery with no GM to send it; nothing waits for a later connection. A plan written after the body was found is
    not sent by itself; **Issue Autopsy Truth Bullet** opens filled in from it.
  - The node shows "Planned" until sent, "Sent" after; its fields stay as what was planned.
  - A planned Autopsy with neither a name nor words is not sent.
- Red first: tier 2 "planned Autopsy: ..." (a rehearsal sends nothing; the discovery sends to every living student with
  the name and the note; a second body sends nothing more), red at a8650af. R3373 reads the kind and the node's `note`;
  R376 reads `autopsyIssued` in its new file; R2067 reads the Key row's `keyroom` field (item 5's, missed in its
  commit: I ran only the named tests there).
- GM handbook (EN, PL): the paragraph after the realization.
- Scenario 62-investigation has no body discovery (checked: no `runDiscovery`, `announceBody` or the hook in it); 65-season,
  66-rooms and 72-canary have one, and none of them is extended here. The send at a real table's discovery, with players'
  browsers receiving the bullets, is for the live list.

## Planned minigames (13.11.2026; the owner through the coordinator: "Dodajmy mozliwosc zaplanowania logic dive i innych minigier class triala z poziomu planera sprawy")

- A schema node (deduction, counter, solution) whose trial mode is a zone mode plans its content in its own fields,
  shown for that mode only (a change of the mode's select shows the mode's rows): Straw Poll and Scrum Debate the
  question and the two answers (Scrum the thesis too), Logic Dive a saved set (the GMs' Logic Dive sets, their truths
  there) with the sets' editor a button away. case-schema.mjs `ZONE_FIELDS` on the node row, in the GMs' case store:
  never in a player's data. Saved on the node's close, as every node field (item 1).
- The trial console's start button on that node (case-trial.mjs `startFromNode`) opens the **Hall zones** window
  (trial-zones-ui.mjs `openZonePicker`) on the node's mode, filled in; the GM can still edit it and presses Start.
  Nothing starts without that press (default: "prefilled", as the brief preferred).
- A node's set deleted later reads "(a set since deleted)" in its select; the window then opens on its first set.
- Red first: tier 2 "planned minigames: ..." (a planned Dive and a planned Straw Poll fill the window, nothing started;
  the Map's Straw Poll node shows its question and hides the Dive's set), red at 6964661 (no `startFromNode`; the window
  opened empty). R3373 reads the node's new fields.
- GM handbook (EN, PL): the Map's paragraph.
- The **Hall zones** window's fields named (13.11, b77190a's whole tier 2): its question, answers, thesis and set had
  no name a screen reader could read (formGrid's label has no `for`), and "every control in the module's own chrome
  has a name to be read out" failed once "planned minigames" had opened the window with a set in the store. Each field
  now carries its row's label as `aria-label`. Red, then green: `--tier 2 --only "planned minigames" --only "every
  control in the module's own chrome"` (`input name="question"` and `select name="setId"` reported, then none).
- Seen beside it and not of this line: a run of tiers 0-2 in one process also reports R3551's character sheet input
  (`system.traits.instinct.value`, tier 1) to that test, at 91ec405 as well (`--only R3551 --only "every control ..."`).
  CI runs tier 2 in shards 2-8, apart from tier 1, so it does not see that input.
- Not done here: shots. The Map's node fields for a zone mode and the filled window are drawn in the harness, and are
  for the shots page with items 3-5.

## perf-open's review for 1.2.111, section 2 (13.11.2026; the coordinator's six points; docs/dev/PERF-OPEN/REVIEW-111.md on the perf-open-b line, 0fafef1)

- (1) The planned Autopsy is sent on the primary GM alone, not on the discovery's writer (case-realize.mjs
  `registerCaseAsk`): every discovery stamps on the primary today, and one stamped off it would have gone out from
  nobody. `sending` and `autopsyIssued` keep it once. Tier 2 "planned Autopsy" now hears the hook with `writer: false`:
  red at c598d3c (nothing went out on it, the later `writer: true` call sent 4), green after.
- (2) A node's close reads its editor through `readCaseFields(open)`, the traces', schema's and Key slots' part of the
  reader, which reads no Final Key Remnant field; `readDashboardForm` is the final fields plus `readCaseFields(form)`.
  The stand-in element that answered every selector with the node is gone. R4454 (tier 1, read in the source): red at
  c598d3c (no readCaseFields), green after.
- (3) **Cancel is a discard** (the coordinator's default; for the owner to confirm): its answer "close" writes neither the
  open node nor the Table's changed fields. Not `if (!action)` alone, as the review's patch read: the footer's other
  buttons (New trace, Autopsy, Log, Body found, Realize, Clear Faint, Sweep, Undo) also answer a string and reopen the
  window, and they keep writing the open node, as "every other close keeps autosaving" asks. GM handbook EN/PL: one
  sentence.
- (4) Tier 2 "planner autosave: a node's write that fails ...": the case store made to throw, the node closed: the
  "Not saved" error told, the store unchanged, the field still holding the text; the store given back, the next close
  writes it. This half passed at c598d3c too (the review's "likely" holds); its Cancel half was red there.
- (5) The Autopsy test asks `needs(env.primaryGm())`, a skip on a second GM.
- (6) `DRPG.CaseMap.autopsySent`: "Sent to the students." / "Wysłany uczniom." (DB24).


## The case editor's Close saves (13.11.2026; the owner through the coordinator: "Nie, ma zapisywac")

- The owner reversed the discarding Cancel of 4bab736/da352a8: the Investigation window's closing word keeps what was
  typed in an open node, as the X, Escape and the footer's other buttons do. A word that saves is not a Cancel
  (docs/glossary.json: `cancel-word` withdraws a question, `close-word` closes a window with nothing left to answer),
  so the footer's word is the kit's **Close** / **Zamknij** (`role: "close"`, DRPG.Kit.close; no new key). Its action is
  "close", ApplicationV2's own: at a table the press answers null, as the X does (LIVE-E21-06); headless it answers
  "close". Both write the open node.
- The Table's changed fields still wait for **Save**, as with the X (default: "like every other close"; the owner's
  answer was about the node's text).
- Red, then green: tier 2 "planner autosave: a node's write that fails ..." (at da352a8 the footer had a Cancel,
  action "discard", and the typed name stayed unwritten) and R1358's row for the window (the closing word `close`).
- GM handbook EN/PL: "**Close** saves them too." / "**Zamknij** też je zapisuje." in place of the Cancel sentence.

## Several planned Autopsies a chapter (13.11.2026; the owner through the coordinator: "zaplanowane autopsy moga byc wiecej niz 1. Ogolnie cel jest taki by gm mial preset pokazujacy ile powinno tego byc, ale by mogl zrobic ostatecznie ile chce")

- **Shape.** The n-th planned Autopsy of a chapter is the case row `autopsy-<n>` (the first stays `autopsy`), up to 9
  (case-schema.mjs `autopsyId`, `autopsyNumber`, AUTOPSY_MAX). The chapter's count is its meta row's `autopsies`, or
  the preset where none is written (investigation.mjs `autopsyCount`). The first Autopsy's fields hold the count as a
  select, with the preset named under it; the Map draws that many Autopsy nodes, numbered on their face when there is
  more than one. A written Autopsy past the count is kept and not drawn, unless it went out.
- **The preset** (`autopsyPreset`, `autopsyPresetOf`): one for each body the chapter has, read as this season's bodies
  found in the chapter (its discovery stamps, `bodiesFoundIn`) together with the open incident's victim where that
  incident is the chapter's (`murderState().victimId`), each body once; one where the chapter has none yet, because
  the case plans one murder a chapter. The case schema itself plans no bodies, so this is the reading of "the bodies
  the case plans". Q-P111-1 below.
- **The trigger.** Each planned Autopsy has **Sent at** / **Wysyłany przy**: "Body n found", its own number by default
  (`atBody`, null meaning its number). At each discovery, on the primary GM, every planned Autopsy that is due goes out
  in order (case-schema.mjs `autopsiesDue`): within the count, with a name or words, not marked sent, and its body
  found. "The k-th body" is read off the chapter's stamps in the order found (`bodiesInOrder`), so a discovery of two
  bodies sends the two due, and a GM who comes back after a missed hook sends the overdue ones at the next one. A sent
  Autopsy is marked on the meta row (`autopsySent`). It goes to every living student, as before.
- **By hand.** Nothing refuses the GM another Autopsy. An Autopsy held already no longer stops the planned ones (before,
  `autopsyIssued` blocked the one planned Autopsy). The GM panel's Autopsy window fills in the next planned one not
  sent and, sent from there, marks it sent, so its body sends it no second time. Q-P111-2 below.
- **Removed:** the probe `world.noAutopsyHeld` (da352a8). A held Autopsy no longer changes what the planned ones do,
  so the test skips no world for one.
- **Tests.** R4900 (tier 1; the ids, preset, order, due, atBody, the meta row's fields and the Map's nodes): red at
  bc3445c (none of the functions). Tier 2 "planned Autopsies: ..." (two planned; the first goes out at the first
  body's stamp, nothing more at the same bodies, the second at the second body; not to the dead; a rehearsal sends
  nothing): red at bc3445c (the second never went out). Tier 2 "planned Autopsies on the Map: ..." (the count drawn
  with its preset, a count of 2 written at the node's close draws a second node, its body written at its own close;
  the GM panel's window fills in the next one not sent and marks it sent): red at bc3445c.
- GM handbook EN/PL: the planned Autopsy's paragraph rewritten.

### Questions for the owner, each built on its default

- **Q-P111-1. Where the preset's bodies come from.** Default: the bodies found in the chapter plus the open incident's
  victim not yet found, at least one. The case planner has no "bodies" of its own; a body that dies off the incident
  (not the incident's victim) counts only once it is found. An alternative would be a planned "body" row in the case.
- **Q-P111-2. A hand-sent Autopsy and the plan.** Default: sent from the GM panel's window while it is filled in from
  a planned one, that planned one is marked sent. An Autopsy sent by hand with the window filled in from nothing
  planned (or every planned one already sent) marks nothing. The GM's text edits in the window do not matter: the
  planned one it was filled from is the one marked.
- **Q-P111-3. Lowering the count.** Default: the Autopsies past the new count are kept and neither drawn nor sent;
  raising the count again brings them back as they were. One already sent stays drawn, marked sent.
