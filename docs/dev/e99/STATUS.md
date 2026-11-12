# E99 - status of the work line, branch claude/e97-98

The case schema at the trial and a summary for the players after the verdict. Started 12.11.2026 after E97/E98's
C1-C13 were pushed (1e1c61c). Plan: docs/dev/plans/E99.md on origin/claude/plan-130.

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
- **C5's place in the console's middle**: waits for E73's console layout (above).
- **C5's frame glyph** (`case-map`, `node-check`): drawn in tools/glyphs.json, not declared in pixel-icons.css (E48's;
  the same note as E97's in docs/dev/e97/STATUS.md); the button and the boxes carry no glyph.
- **C1 three-digit stage ids**: touches tools/stages.mjs, the coordinator's; not done here (Q-E99-11 stays open).
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
