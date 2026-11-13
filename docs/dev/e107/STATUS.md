# E107 - a tile that waits for a GM wears the chip, not the red; branch e100

The owner, 13.11.2026, with a shot of the sheet's Hope Calls on 1.2.110 (Stained Glass): "Layout hope calla z GM rozni
sie od reszty. Kafelki wymagajace GMa niech nie beda czerwone - wystarczy czerwona ramka i napis jak w hope callu."
Passed on by the coordinator as stage E107 (R5430-R5459, target 1.2.112). Base: 8d7aa91f (origin/main 1.2.110, 44f9d690,
merged into the branch). Defaults taken, the owner to confirm: "czerwona ramka" is the chip's red frame, as on the Hope
Call, not a red frame on the whole tile; plain buttons that are not tiles stay as they are.

Review page (private, Polish captions; before 8d7aa91f, after b9dab19d; PL and EN, both themes, GM and player):
https://claude.ai/artifact/RJ2T7YTs1PSQQSRna4oqW1

## What changed (b9dab19d)

1. **The chip leaves the tile's flow.** `.drpg-action-gm` is absolute in the tile's top right corner (danganronpa.css,
   the rules after `.drpg-action-gm`; the tile `position: relative`). A tile centres its content, so the chip as a line
   under the cost lifted the icon, name and cost of every tile that carried it.
2. **A GM action tile is not red under the glass.** The red plate (34 % GM red, red edge, red brush; stained-glass.css,
   E22 C6b) is gone; the tile wears an action tile's look and the chip. Legacy drew no plate (see Found, 1).
3. **A pick row on the GM's road carries the chip** (ui-columns.mjs `choiceRowHtml`), at its top right, the text leaving
   room for it; no red left edge (Legacy), no GM-red indicator and no red brush when picked (glass).
4. **The chip stays red in every state under the glass.** Under the pointer the tile's ink rule listed it, and on its own
   dark ground it read rgb(7, 7, 10) on rgba(7, 7, 10, 0.72), barely readable - already so on 1.2.110 (Talent). On a
   picked row the row's ink rule took it the same way. Both now keep the chip's red.
5. The glass chip's line-height 1.1 (was 1.35), so at the grid's least tile it clears a two-line name.
6. notice-history.mjs `NOTICE_CLASSES` gains `drpg-action-gm` (R294's census: ui-columns.mjs builds card bodies).
   tools/css-budget.json lowered (stained-glass.css: `!important` 205 -> 203, colour literals 97 -> 96).
   tools/contrast-pairs.json `sg-gm-row-picked` says it names no rule since E107.

## Every element on the GM's road, and what happened to it

| Element | Where | Before (glass / Legacy) | After |
| --- | --- | --- | --- |
| Sheet action tile on the GM's road (Project, Analyze, Direct Murder, Dynamic; `callsGm`) | sheet.mjs:5756 `data-drpg-cost-kind="gm"`, chip in `actionButton` | glass: red plate, red edge and brush, chip in flow; Legacy: a plain tile (its stripe computes grey), chip in flow | **changed**: plain tile, corner chip |
| Sheet Call tile a GM rules (Talent, Experience, Ultimate; a Despair Call by `callAsksGm`) | sheet.mjs:5106 `callButton` | both: the drawer's plain tile, chip in flow | **changed** (layout only): corner chip |
| Pick rows with `gmRoute`: Observe's two, Analyze's hint, Search's specific, Tamper's Reshape, a new project, a crisis row a GM approves; a Call window's rows | ui-columns.mjs:50 `choiceRowHtml`, called by action-menus.mjs:191 `chooseVariant` and call-pickers.mjs:142 | glass: GM-red indicator, the picked row brushed in light GM red; Legacy: 3 px red left edge, kept when picked | **changed**: a plain row with the chip |
| Monocub's ability tiles | sheet.mjs:4868 `abilityButton` | no GM marker at all | left: nothing to change |
| A Tier 0 item's Use | sheet.mjs:3833 | an icon button on an item row, not a tile; measured on the sheet stand-in it computes exactly as a plain Use in both themes (see Found, 2) | left: not a tile |
| Footer and window buttons on the GM's road (the kit's `gmRoute` role, `role: "gmRoute"`), the GM panel's buttons, the Students window's mini button | ui-kit.mjs, gm-students.mjs:135, the glass's `.drpg-gmp-button.drpg-gm-route` | red | left: buttons, not tiles (the coordinator's default) |
| Rest options, a Frisk's ways | rest.mjs, palm.mjs | none is on the GM's road today (the glass's rules named them; they matched nothing) | no change |

## Measured in Chromium (not in jsdom, which lays nothing out)

The style harness's sheet (`?sheet=parts`, the module's sheets), tiles written in `sheet.mjs`'s shape; scratch
scripts, not committed. Each chip tile against the same tile with its chip removed, the icon's, name's and cost's
offset from the tile's top:

| | Before (8d7aa91f) | After |
| --- | --- | --- |
| Glass, Talent / Support | icon 4.7 / 21.4 px, cost 53.2 / 69.9 | the same tile with and without the chip: 0 px apart, icon, name and cost |
| Legacy, Talent / Support | icon 13.7 / 22.2 px, cost 55.5 / 63.9 | 0 px apart |
| All 12 cases (2 themes, PL and EN, 1024/1366/1920 wide; 3 chip tiles each) | moved | 0 / 0 / 0 |

The chip touches no line of text at the widths the stand-in draws (tiles 103-157 px). At the grid's least tile, 92 px,
forced by hand: it touches the icon's box by 0.3 px (glass) and 1-2 px (Legacy) - the font's box, wider than the drawn
mark; no text. Its first cut at the tile's foot covered the cost by 13 px under the glass (the chip is 30 px tall at the
sheet's floor size, about 19 px stand free under the cost): hence the corner. Window rows (probe 08's Analyze, Observe,
Search and Tamper on p1, both themes and languages): the chip inside its row, over no line of text, the row's edge not
red. Under the pointer (glass): the chip rgb(7, 7, 10) before, rgb(255, 85, 102) after; Legacy red before and after.

## Tests

| R | What | Red at |
| --- | --- | --- |
| R5430 | the chip absolute, the tile positioned (action and Call tiles, both themes) | 8d7aa91f: chip in flow, Call tile static |
| R5431 | a GM action tile's background, edge and brush an action tile's; the chip's edge and ink red; no glass rule gives the chip the ink | 8d7aa91f: the glass tile red; the hover rule lists the chip |
| R5432 | `choiceRowHtml` draws the chip on a GM row and none on a plain one; the GM row's edge and kind a plain row's, picked or not; the chip red, absolute, and red on a picked row | 8d7aa91f: no chip, the row red; the first cut: the picked chip's ink |
| R1373 changed | the GM's road's red on a footer and a window button; the choice row left it (`gmRow` false) | 8d7aa91f: the row red |
| R1580 changed | the Legacy GM row's left edge no longer red under the pointer or picked | found by the whole tier at the first cut |

Registry Since E107 set by hand (`tools/stages.json` has no E107 row; `--write` stamps E93), as E100's were.
The registry's "Next free" reads R5433.

## Runs (b9dab19d)

`npm run quick` green; tiers 0-1 1382 passed, 0 failed, 16 skipped (the last whole run before the commit's comment and
test-name wording edits; after them the seven touched tests and `npm run quick` again green); tier 2 by name: "a crisis
action rolls what the GM approved", "E22-T3", "in a fight the tile says Crisis actions" green; scenarios 71-sheet 41/41,
73-notice-history 32/32. No run in a real Foundry.

## Found, not changed

1. **Legacy's cost stripes are all grey.** `body.drpg-theme-monokuma-legacy .drpg-action-button[data-drpg-cost-kind]::before`
   (0,3,2) outranks each kind's colour `.drpg-action-button[data-drpg-cost-kind="gm"]::before` (0,2,1): free, action, gm
   and stress all computed rgba(228, 222, 216, 0.34) in Chromium. The coloured stripes danganronpa.css describes do not
   show. Not this stage's; for the owner.
2. **A Tier 0 item's Use is not red.** sheet.mjs and R121 call it red; R121 reads the class, and the class paints nothing
   on that button in the sheet (measured on the stand-in, both themes). Only its tooltip names the GM. Not checked in
   Foundry.

## Open, for the owner

1. The chip in the tile's corner rather than under the cost (why: above).
2. The window rows changed too (the picked GM row was all red); keeping red there is a separate small change.
