# E97 (then E98, E99) - status of the work line, branch claude/e97-98

Kept current by the line's agent. Last written 12.11.2026.

## Done (committed on claude/e97-98)

| Commit | What | Tests |
| --- | --- | --- |
| a881094, 12334f7, d2889c6 | **C1, C3, C4** from the earlier patch (e97-c1c3c4, made on b97028e1), applied with `git am --3way` onto f22a7e8. Two conflicts, resolved: `docs/dev/R-REGISTRY.md` (generated) regenerated with `node tools/registry.mjs --write` for each commit; `scripts/tests-tier0.mjs`, where this base's last test (R3345 and after, E49) and the patch's R3373 were both appended at the end of REGRESSIONS - both kept. | R3370-R3376 as the patch's STATUS says |
| 9b572a1 | The registry tool stamps a new row with the stage it finds current (E48 here); R3370-R3376 set to E97 by hand. Every later commit does the same for its rows. | `check registry` green |
| e320102 | **C2** - the panel's fixed frame: `width: WIDE.width` (1120) in place of `fit`; a toolbar row (switch slot, controls slot; the said line moved there); the live region itself is the view's box, stated height from the screen's, the one box that scrolls. Legacy's one-word heads (AUDIT 449): the Traces table at 130 % of its box, scrolled sideways there; Difficulty 13 %, Name 15 %. | R3650 red at 9b572a1, green |
| fde1c64 | **C5** - the Map view, reading: new `scripts/case-map.mjs` (HTML nodes at `MAP_GEOMETRY` pixels over one SVG edge layer; a counter's edge a bracket on the left; the unrelated evidence below a fold; arrows walk the nodes; a side panel); the Map / Table switch in the toolbar, a flag on the GM's own User (`investigationView`), "table" until C9; the live region watches `caseSchemaStore`. Probe 08 captures `investigation--map` and `investigation--map-node`. | R3651 (tier 0), R3652 (tier 1) red at e320102, green; R3653 the parity test `expectedRed("E97")` |
| 5b124a4 | **C2/C5 fix** - tiers 0-1 at fde1c64: R1357 and R1358 failed (a moved window's own rule may not frame its footer or form; R1358 asked for `fit`). The two-row footer is now a kit option, opt-in: ui-kit.mjs `footer.rows: 2` (`FOOTER_ROWS_CLASS`), styled in the kit's footer section; R1358 accepts a stated width. | R1357, R1358, R1322, R1323, R1376, R2067, R2068, R3650, R3652 green |

Measured in Chromium on probe 08's captures through `audit/style-harness.html` (the module's stylesheets, **not**
Foundry's own CSS, no real fonts beyond what the harness loads), 1366x768 and 1920x1080, both themes, English and Polish:
the frame and the footer are identical on the Map, a picked node and the three Table tabs - 1120 x 714 (glass) and
1120 x 688 (Legacy) at 1366x768, 1120 x 1002 and 976 at 1920x1080; the footer two rows; no Traces or Key head word
wider than its head under Legacy. Before C2: 1241 px wide at 1366x768, the size following the tab.

| fd66831 | **C6-C12, E98 C4** - C6: the Map's side panel carries the Table's own cells per Remnant and Key slot (hidden unless picked), so the Table's Save writes Map edits unchanged; every Key plan slot a node; the Final Truth form and the Key limit override in the summary; schema editors (name, GM note, trial mode, inputs / refutes checklist) on the same Save, refused and told where another GM moved them; add / remove / column order / up-down written at once. Fixed C3's `setCaseNode`, which wrote nothing for a one-field write. C7: holders by actor id, `reachability` with the chapter's culprits and the living, "x/y" on schema nodes, who has what by name. C8: `checkCase`, ten codes, marks and list, "Check consistency". C10: new `case-realize.mjs` - preview with a room per slot, Run through the planner's road, marks in the meta row, Undo only what nobody found. C11: the question at a body (primary GM, once a chapter). C12: planned Incident Remnants (schema kind "incident") and the GM panel's line. E98 C4: Who has what as a Table tab, by name. AUDIT 9.2 gets LIVE-E97-01..06. | R3653 passes (its `expectedRed` off); R3654, R3655, R3657 (tier 0), R3656, R3658 (tier 1), five tier-2 tests |
| d2839d8 | **Fix** - tiers 0-1 at fd66831 failed R1322 (an undeclared custom property: the footer's columns now inline), R304 (a census row for `studentsListHtml`), R1157 (five texts reworded so the count census reads them), R1318 (the GM panel reopens from one place; the case line runs through the tiles' handler). | the four green; "E97 C" tier-2 tests 24 passed |

## In progress

- (none: fd66831 and d2839d8 pushed after the batch below)

## Next

E99 goes on in docs/dev/e99/STATUS.md (C4 hints and C5 the trial's Case schema window next). E98's remainder (the
60-Remnant measurement) is still open.

## Not done, and why

- **C0 (ledger)**: tools/stages.json is the coordinator's (the brief). E97 and E98 read `planned` there; the version and
  `touches` (the plan proposes `["scenes", "sockets"]`, Q-E97-12) are the coordinator's at registration.
- **Glyphs**: the drawings of E97/E98's rows (map-view, table-view, held, on-map, planned, reachable, case-warn ...) are
  in tools/glyphs.json but not declared as `--drpg-pix-*` in styles/pixel-icons.css (generated by tools/glyph-map.mjs,
  E48's). Drawn as masks they painted plain squares (Chromium). The Map names each glyph's slot
  (`<span class="drpg-case-glyph" data-drpg-glyph="...">`) and draws nothing there. **For the coordinator / E48**:
  declaring those rows for both themes (or saying which family they belong to) lets the slots be filled.
- **`.claude/rules/code.md`'s file table** ("Where the code lives") should get rows for scripts/case-schema.mjs,
  case-layout.mjs and case-map.mjs; `.claude/` is not mine to edit (the brief).

## Defaults taken, owner to confirm

- The realization asks each Key slot's room in its preview (the plan holds no room; Place asks the same way). The
  preview lists Key slots only; a planned Incident Remnant is placed by hand from the GM panel or the Map (C12).
- Two GMs pressing Run: the run's id is written first and a run whose id was overwritten stops (Q-E97-5 asked for the
  primary to run it; this is simpler and unmeasured on a real network: LIVE-E97-04).
- Who has what leaves the top of the Table for a tab of its own (Q-E98-5).

- The Map draws the chapter the Remnants tab's chapter filter names; with "every chapter" it draws every Remnant of the
  world beside this chapter's schema and Key slots (C3's open question 1).
- Every slot of the Key plan as the planner reads it is a node (a slot no GM wrote included), so each planner row has
  its fields on the Map (C3's open question 2).
- Add / remove a node, the column order and the arrows are written at once (not on Save): the arrangement of the map,
  as New Remnant writes at once; a node's fields ride Save (Q-E97-6's default).
- The side panel's tools (add, order, arrows) stand at the top of the side panel, not in the toolbar's controls slot:
  the slot is outside the live region and would have to be redrawn by hand with the view.
- R3653 (parity) loses its `expectedRed` in C6, when it passes, not in C9: an `expectedRed` that passes fails the suite.
  C9 still waits for the owner's look at both views (Q-E).

## Blockers

None.

## Test results

- Tiers 0-1 with the patch applied (f22a7e8 + C1/C3/C4): 1165 passed, 0 failed, 16 skipped, 1 red.
- Tiers 0-1 at fde1c64 (C5): 1166 passed, **2 failed (R1357, R1358)**, 16 skipped, 2 red - fixed in 5b124a4.
- Pre-push batch on 5b124a4: tiers 0-1 1167 passed, 1 failed (R1336, fixed in a7146dd), 2 red; 29 scenarios green.
  On a7146dd: tiers 0-1 1168 passed, 0 failed, 16 skipped, 2 red (R3339 E48's, R3653 as promised); tier 2 by name
  ("dashboard", "Investigation", ...) 39 tests green. Pushed.
- Tiers 0-1 on fd66831: 1170 passed, 4 failed (R1322, R304, R1157, R1318 - fixed in d2839d8).
- Pre-push batch on d2839d8: tiers 0-1 1174 passed, 0 failed, 16 skipped, 1 red (R3339, E48's); the "E97 C" tier-2
  tests 24 passed; 30 scenarios (00, 10, 12-15, 17, 19, 30, 33, 40, 41, 50, 60-63, 65-67, 71, 72, 74-76, 81, 83,
  86-88): 29 green, 61-gmstore-case 112/113 (F9, the murder opening's pick kept on the primary and re-asked by a second
  GM) while three scenarios ran on four cores - alone on the same commit 113/113 green. Not touched by this stage's
  files as far as read; recorded as seen once under load, not explained.

- Pre-push batch on 9290ce0 (E99 C2/C3/C6/C7): tiers 0-1 1176 passed, **2 failed (R1322, R173)**, fixed in the next
  commit; tier 2 by name ("E97 C", "dashboard", "trial console", "verdict") 125 passed; 14 scenarios (00, 30, 33, 41,
  50, 61, 62, 63, 65, 67, 72, 81, 86, 88) green. The fix (lang and CSS only) was written while the last six of those
  ran from the same tree. On the fix: tiers 0-1 1178 passed, 0 failed, 16 skipped, 1 red (R3339, E48's); 50-lang green.

## Screenshot pages

- Round 1 (12.11.2026, fd66831's state): https://claude.ai/artifact/7fsQToa7sBj1wL5HHTpW7G - the Map (nothing
  picked, a deduction picked, a Remnant picked), the Table (Remnants, Key Remnants, Who has what), the realization's
  preview, the question at a body, the GM panel's Incident Remnant line; both themes, EN and PL, 1366x768, GM only.
  Not Foundry: the module's sheets in Chromium through the style harness, the harness's own window header, the harness's
  world with probe data in English. Seen since and open: a node's trial-mode pill hides its kind label; slot nodes cut
  their kind ("Miejsce na..."); under the glass the frame reads 747 px at 768 because the harness's header is 88 px
  (Foundry's about 40).

## Tokens so far

Not measured by this session's tools.
