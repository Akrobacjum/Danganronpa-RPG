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
