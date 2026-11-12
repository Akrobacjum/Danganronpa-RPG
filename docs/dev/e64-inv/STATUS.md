# E64-inv: the Investigation review's picks (12.11.2026)

Branch `claude/e64-inv`, from `origin/main` 235c321 (1.2.107). The owner's verdict on the Investigation review page,
verbatim: "Final truth remnants akurat musi zostac, bo te remnanty mialy sie pojawiac min. 1 na rozdzial jako hinty dla
graczy. Na reszte sie zgadzam". So every proposal of the page is built except hiding the Final Truth Remnants tab, which
stays as it is.

| # | The pick | What was built | Held by |
| --- | --- | --- | --- |
| 1 | Clear Faint Remnants and Collect Truth Bullets off the Investigation bar | both buttons and their runs gone from the bar; End the chapter's two boxes do the same work | R3967 |
| 2 | The Class Trial evidence log off the bar | gone; the trial console's own button (`trial-floor-ui.mjs` `logButton`) stays | R3967 |
| 3 | Undo realization tucked away | a destructive button of the realization preview, shown only while a run's marks stand, asking first as before (`case-realize.mjs` `realizationFooter`) | R3967 |
| 4 | Faint set in two places | kept both: see below | - |
| 5 | Who has what as one view | one table; the Breakdown column lists each Truth Bullet by name with its real kind, a new Items column the other items by name; the list under the table is gone from the tab (the Map's side panel keeps its list) | R3968 |
| 6 | One name for Difficulty / Visibility | "Visibility" / "Widoczność", the rules' word (`REMNANT_VISIBILITY_LABELS`, the handbook); New Remnant was the one window saying "Difficulty" | R3969 |
| 7 | Standing hints shorter | the Remnants tab's hint, New Remnant's intro and End the chapter's reveal note each one sentence of at most 20 words; End the chapter's closing note removed (each box already says "cannot be undone") | R3970 |
| 8 | End the chapter fits at 1366x768 | two columns (the evidence left, the clock and the backup right) in a 900 px window | the fit pass (`audit/style-sweep.mjs --fit`, STILL `chapter-end`) |

## 4. Faint: two different things, both kept

Read in the code, not assumed:

- **The kind "Faint Remnant"** (`REMNANT_TYPES.faint`) has its own Observe and Analyze difficulty column
  (`config.mjs` `OBSERVE_DC` and `ANALYZE_DC`, their `faint` entries). It is how hard the trace is to find and read.
- **The Faint mark** (the column's checkbox, `remnantData().faint`) is what End the chapter's clean-up reads
  (`remnants.mjs` `clearable`: Faint, not reinforced, not tied to the crime) and what keeps a Truth Bullet through the
  sweep. A Prep trace carries it too - the Faint Prep a Search for a tool, a Sabotage or a misleading trail leaves
  (D14; `config.mjs` `leavesRemnant: { type: "prep", faint: true }`), with Prep's difficulty, not Faint's.
- The two are tied one way only: a trace of the kind Faint always has the mark (`remnants.mjs` `writeKind`, which ticks
  the box back and tells the GM). A Prep with the mark is a trace of its own.

So one control could not say both. The GM handbook's table of Remnant types already says both (its "Faint" row). Nothing changed for this item.

## Questions

None open.

## Round 2 (12.11.2026): two windows held to the screen

The coordinator's ask after the review page: New Remnant and the realization preview fit at 1366x768 with nothing cut,
both themes, English and Polish. Read by the fit pass (`audit/style-sweep.mjs --fit`; probe 08's `new-trace`,
`case-realize`, `case-realize--made`; the first two held unscrolled in STILL), the Polish from a capture outside the
repo with the same script.

| Window | Red on 76d4373's parent | Built | After |
| --- | --- | --- | --- |
| New Remnant | its body scrolled at 1366x768 under Stained Glass, EN and PL | two columns, 900 px; its selects keep their widest option (the tie's read "- nie rozs" under Glass) | fits, EN and PL, every size |
| Realization preview, after a run | its body scrolled 12 px in PL under Glass (the footer on two rows); its table 521 px in a 510 px body under Legacy | a stated width, 720 px | fits, one footer row |
| Realization preview, before a run | the same table, 521 px in 510 under Legacy (1.2.107's window) | the same width | fits |

Not changed: a long placeholder in a text field is cut at the field's edge (New Remnant's "What analysis reveals"), as
in one column before.

## Round 3 (12.11.2026): placeholders that fit their fields

The coordinator: shorten the cut placeholder rather than widen the field, and read every placeholder of New Remnant and
the realization preview the same way. Read in Chromium at 1366x768, both themes, English and Polish, on the style
harness's captures: each placeholder's text width (the field's placeholder font, a canvas measure) against its field's
content box. A scratch script outside the repo, not a test: the fit pass reads scrolling and overflow, not a
placeholder's text.

- Before: 6 of 16 cut, all in New Remnant (the realization preview has no text field). "What analysis reveals" in both
  themes (EN 453 px of text in 235, Legacy 1146 in 207) and "Player description" under Legacy (EN 333 in 223, PL 253
  in 241).
- Built: `DRPG.TruthBullet.analyzedTextPlaceholder` "Whose blood?" / "Czyja krew?" and
  `DRPG.Investigation.notePlaceholder` "What they see" / "Co widzi uczeń". Both keys are shared: the Remnants tab, the Final Truth tab, the
  Key plan, Create a Key Remnant here, Observe's describe window, the give window and the ring read them too, so they
  are shorter there as well.
- After: 0 of 32 cut (New Remnant, Create a Key Remnant here and both states of the preview).
