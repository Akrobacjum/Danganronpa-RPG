# E103 - status (local branch e103)

Updated 13.11.2026. Base 58e0fd06 (the 1.2.111 line). Committed locally only; the coordinator merges. The owner's
decision (13.11.2026): "nie rozbijamy, a kafel move u monocuba usuwamy. Zmieniamy tylko kolejnosc akcji u gracza, a u
monocuba zawsze zaznaczamy ruch w karcie postaci, ze jest dostepny (chodzi o glif - kafel usuwamy)".

## Done

| Promise | What | Test |
| --- | --- | --- |
| 1 | A student's grid keeps its ten tiles (two rows of five) in the new order: Search, Observe, Analyze, Infiltrate (`listen`), Palm \| Projects, Facilities (`rest`), Dynamic, Tamper, Direct Murder. config.mjs `ACTION_GRID`, read by sheet.mjs `injectActionPanel` | R5300; "the action grid is two rows of five" (comment) |
| 2 | The Monocub's panel draws only its ability tiles (Confusion, Redeem, Ask for Hope, Tinker, Ghost Bet); no Move tile | R5301 |
| 3 | A Monocub's two feet always read as available, on the sheet and the HUD strip: by day the first solid, the second `off` as everyone's; in an Eclipse both solid (`anywhere` in free placement); whatever `freeMoveUsed`, Fog or the Eclipse's count says; no spend flash; tooltip `DRPG.Actions.cubMovesFree` + the legend | R5302 |
| 3 | A student's feet unchanged (spent after the free Move, `freeMoveSpent`, Fog's `fogged` on the sheet) | R5303 |
| 4 | Words: `DRPG.Chapter.deadPanelNote` EN/PL name no Move; new key `DRPG.Actions.cubMovesFree` EN/PL; player handbook EN/PL (the Monocub's panel, "You move freely", the Actions tab line, the strip); GM handbook EN/PL (the ten tiles' table in the new order, the Monocub paragraph) | R5304, R3330 |
| 4 | Glyph census: tests-glyphs.mjs FUTURE row 68 renamed (the row stays: FUTURE must be 1..N, and the glyph `move` is still drawn and worn by the feet); SAME's `ACTIONS.move` / F68 reason updated. tools/glyphs.json lists no tile: unchanged | `node tools/check.mjs` glyphs green |

## What reads ACTIONS' key order, and the choice

Read on 58e0fd06 (`git grep` of `Object.entries/keys/values(ACTIONS)` and of the ten keys as lists):

- sheet.mjs `injectActionPanel` - the grid (the only reader whose order is the layout).
- sheet.mjs `LONGEST_TILE_WORD` - a maximum over labels; order-free.
- trait-ruling.mjs `ruledDefinitions` - a Set of definitions; order-free.
- Suite loops: tier 0 R8 and the thresholds census, tier 1 "every action definition has a label and a cost", "the
  action grid is two rows of five" (counts ten), tier 2's one-statistic census; scenario 83's filter - order-free.
- Lists that freeze the old order: tier 1 R3330 reads the GM handbook's tile table "in the order they are drawn" by
  position (EN and PL). Changed to the new order, and the two tables reordered. Tier 0 and tier 1's other key lists
  (`["observe", "search", ...]`) are filters, not orders.
- No help page, GM panel, census row or i18n key lists the grid's order; the player handbook says "the ten tiles"
  without an order.

Chosen: an explicit list, config.mjs `ACTION_GRID` (frozen, every universal key once; R5300 holds it), and the ACTIONS
object untouched. Reordering ACTIONS would have moved three ~50-line blocks of a shared file (a merge risk for the
parallel line) and changed the walk order of every reader above for no reason of theirs.

## Defaults taken, owner to confirm

1. Tamper and Direct Murder, which the owner's order does not name, keep the last two places: row 2 is Projects,
   Facilities, Dynamic, Tamper, Direct Murder.
2. A Monocub's second foot outside an Eclipse stays `off` (dimmed, the stable layout of E49 B2); in an Eclipse both feet
   are solid ("available"), in a free placement both `anywhere` (also solid).
3. The Monocub's tooltip: "A Monocub moves freely: crossing into another room costs nothing, in an Eclipse too." /
   „Monocub chodzi swobodnie: przejście do innego pokoju nic go nie kosztuje, także w Eclipse.", then the legend.
4. Fog (the Overflow) does not dim a Monocub's feet: its crossing never paid a Free Move (movement.mjs `chargeRoute`).

## Checked

- The Monocub's header is not drawn still: `sheetMode` gives `header.acts` true for a cub (`(!dead || cub)`), so the
  owner and the GMs read the tooltip; a viewer gets none (the branch `!viewer && !still` is unchanged; a GM's browser
  cannot be a viewer, so no test draws that case - read in the code).
- The HUD strip has a Monocub road (`buildPlayerView`, `mode.monocub`): it now draws the same feet and sentence.

## Removed as dead (and what was kept)

- sheet.mjs: `monocubTiles`'s Move; `refreshMonocubTiles`'s in-flight map (only the Move tile carried `data-drpg-action`
  there); the Move branches of `actionButton` (its Eclipse exemption), `costOf` and `costLabelFor` (the Eclipse's
  crossings on the tile), and the then-unused `ECLIPSE_MOVES` import.
- Kept: `ACTIONS.move`, `MONOCUB.dispatchable: ["move"]`, `performAction`'s "move" case and action-briefing.mjs's Move
  briefing - still reachable through `game.drpg.performAction` (and frozen by tier 0's ACT-13 test).
- Kept but now unread: lang keys `DRPG.Action.costCrossings` and `DRPG.Action.costAnyRoom` (EN and PL) - the binding
  rules allow adding keys only; for the coordinator to drop with `node tools/check.mjs parity` after.
- audit/style-harness.html's Monocub model drew a Move tile: removed.

## Notes for E71 (O16), not changed here

- GM handbook ch. 5's table still names the tiles Rest and Listen (the UI says Facilities and Infiltrate); Dynamic's
  Polish row reads "Dynamiczna".
- The player handbook's strip sentence still says "a foot for each crossing left" (two feet always since E49 B2).
- The GM's Students window's Free Move cell (gm-students.mjs) reads `hasFreeMove` for a Monocub too: it shows the
  foot solid in practice (a Monocub's crossing never sets the flag), outlined only under Fog. Not in this stage's ask.

## tools/stages.json

Left alone: no test needs an E103 row (the registry's Since was set to E103 by hand after `--write`).

## Tests and runs

Commit ea33c4fe (the stage's code, tests and words), then this file. The container restarted at about 10:50 UTC and
killed the first gate run; it was run again whole on ea33c4fe (the numbers below).

- Red first (58e0fd06 + the new tests): R5300, R5301, R5302, R5304 and R3330 (with its new key order) failed, each for
  the reason it names (the old order and no `ACTION_GRID`; a `move` tile first on the Monocub's panel; no
  `DRPG.Actions.cubMovesFree`; Move in both deadPanelNotes and both player handbooks; the GM handbook's table in the
  old order); R5303 and R3487 passed (the student's road, held).
- Lint, check (19 parts), gate self-test: green; `node tools/config-prose.mjs --check lang/pl.json`: 545 strings,
  missing 0, extra 0; `node tools/check.mjs text glyphs parity dashes`: green (parity: en 5544 keys, pl 6595, missing
  0; glyphs: FUTURE undrawn 0, shared not SAME 0).
- Tiers 0-1 whole on ea33c4fe: 1424 tests ran, 1409 passed, 0 failed, 16 skipped (the baseline's env probes), 0 red
  (487 s). The first whole run, before the fix commit's last two edits, had found R1233 (`DRPG` lacked `ACTION_GRID`)
  and R1470 (`isMonocub` read outside `sheetMode`): both fixed in ea33c4fe.
- Tier 2 by name (the tests whose bodies read the changed functions, and the sheet's lock and Monocub tests): E45-T1;
  "Students shows each acting student's actions and Free Move"; "in a fight the tile says Crisis actions ..."; "the
  Monocub's tiles say why they are shut ..."; "the trial shuts everything but Analyze and the Objection"; "topping up
  Hope lights the Calls it just paid for"; "a Monocub's sheet offers no Use, no Discard and no open stash": 10 passed,
  0 failed, 1 skipped ("topping up Hope ...", env.systemSheets).
- Scenarios found by `git grep` in audit/harness/scenarios for monocubTiles, drpg-move-slot, drpg-free-move,
  drpg-action-grid, deadPanelNote, data-drpg-action: 12-social 28/28 green, 88-flow-length 26/26 green; and 71-sheet
  (it reads `.drpg-monocub-panel .drpg-action-button`) 41/41 green.

## Shots

`/tmp/claude-0/-home-user-Danganronpa-RPG/5fca4a62-94a8-5d11-ad7b-5b580350fb4f/scratchpad/shots-e103/` (outside the
repository): before (58e0fd06) and after (ea33c4fe), both themes, deviceScaleFactor 2: a student (Free Move unused and
used), a Monocub by day with its free Move flag used, a Monocub in an Eclipse. What they are: the real markup of
sheet.mjs's header Actions and action panel, rendered by the jsdom harness (a probe of scratch, not in the repository)
and placed into audit/style-harness.html's ground under the module's stylesheets in Chromium. What they are NOT:
Foundry's or Daggerheart's sheet, its CSS or its layout; the harness world (three actions, room-bound tiles struck
through for want of a subject); under Monokuma Legacy the feet are Font Awesome icons, which the page does not load, so
the Legacy shots show the grid and the panel but no feet. No review page published (the coordinator does).

## Open for the owner

The defaults above (1-4).
