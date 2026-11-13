# E40 item 4, slice D - status

Slice D of `docs/dev/e40/ITEM4.md` (windows, the fog, rooms, glass, settings, the sync and the rest): 26 tests, R99
already read by the pilot (text guard). Branch `claude/e40-item4-d`, from d7566926. Numbers taken: R5170, R5171 (of
R5170-R5189). Written 13.11.2026.

## Picks

(a) in place; (b) tier 2; (c) text guard. "Split" is rule 4's: the driven half is a test of its own, the original
keeps its name and number, trimmed to what stays text, and opens with its TEXT GUARD note. "Held by" names an older
test that already drives an assertion the trimmed test dropped.

| R | Pick | Where the rule is driven now | Reason |
| --- | --- | --- | --- |
| R62 | (b) + trimmed (c) | tier 2 "the Legacy sheet's factor is the slider alone, published on both roots, and 1 under the glass, beside the other two factors (E40 item 4: R62's rule, driven; was R62)" | `applyTheme` is called through two client settings (the theme, the slider) - a write; the sheets' census (no sheet drawn at one size reads the type factor) stays text: the harness lays out nothing |
| R65 | (c), trimmed | held by R167 (tier 1, spy windows) | handOff's behaviour is R167's already; its `.then`/`.catch` read dropped. Kept: handOff names no `await` (mutant m3 below: no outcome a call sees) and the Students window's order (row hands over, round trip returned before Apply) - only a tier-2 test opening the window and pressing a row would drive it, not built here |
| R73 | (a) split + trimmed (c) | R5171 (tier 0): `reopen` with spy windows in Foundry's register | the register is this browser's, put back in the test; nothing in the world. Kept as text: the item tables' census (three paths use `reopen`) |
| R78 | (a) split + trimmed (c) | R5170 (tier 0): `nowPlayingHere` on fixtures; the band through a stop and a renderHud held by R122 (tier 1) | kept as text: which hooks `registerHud` wakes the band on (anonymous listeners) and the two CSS rules |
| R83 | (b) + trimmed (c) | tier 2 "a deferred assembly is held on its own scene, not the one on screen, and an order whose room is gone is cleared and said (E40 item 4: R83's rule, driven; was R83)" | a scene, a region, a token and the order are fixtures. Kept as text: the clear after the room's check - with the order's scene read right it has no outcome a call can see (m6) |
| R90 | (a) | in place (tier 0): `keepLive` on a host of the test's own, LIVE_PROBE | DOM only, no world |
| R95 | (b), deleted from tier 0 | tier 2 "a window under the glass arrives by its contents' fade, never its own: the window grows with no opacity of its own and each child fades in (E40 item 4: R95's rule, driven; was R95)" | the theme switched and a window opened; `Element.prototype.animate` recorded for the render (jsdom has none). Every assertion held |
| R1330 | (c) | - | the window's composition (kit builders, its region, what it never calls, which sheets style it): a census of code and sheets; RAISED and the lazy card would need the window opened in tier 2, not built here |
| R31 | (c) | partly by tier 2 "Room Setup's fog edit keeps the rooms found while the window was open" and E46-T1 | kept: no `saveDiscoveryMatrix` call (a call nothing may make), the form's `defaultChecked`, the bedroom check before the fog's write (an order; a refused Apply through the window not built here), the bulk buttons' markup |
| R54 | (c) | - | the test's own reason: a race between a rebuild and a click; hud.mjs `control` is not exported (would need an export of `control`) |
| R61 | (c) | - | the stylesheet's declarations are the subject; a computed size needs layout, which the harness has not |
| R66 | (c), not converted | - | drivable in tier 2 (`applyAliveStates` with answer fixtures; the window's donors and watch with the window open); not built in this slice - left for a later pass, said so in its note |
| R71 | (c), not converted | - | behaviour (the cue pane rebuilt when a sound joins the cue playlist), drivable only with the Sound window open in tier 2; not built in this slice - said so in its note |
| R77 | (c) | - | drawn with PIXI on the canvas (no canvas headless, `env.canvas`); own-ring.mjs `frameOf`, `isMine`, `hourColour` not exported (would need an export of each) |
| R84 | (c) | its hint half already reads the live text | `promptAndCallGm`'s null needs no GM connected on the browser running the suite (a GM's); the proposal's line and the tile's constant are the code's shape |
| R118 | (c) | the harm by the tier-2 tests it names | a census over fourteen files: no road reads the camera |
| R119 | (c) | where the writes land by the tier-2 test it names | a census of Room Setup's calls that take a scene |
| R291 | (c) | - | pairs config.mjs's roll list with tier 2's `MODIFIER_FIXTURES` (source of a test file, not importable here) and roll-draw.mjs `situationReading`'s branches (not exported: would need an export of it) |
| R300 | (c) | - | a census of names over every file; its own reason: a name no longer exported is `undefined` until called |
| R383 | (c) | - | the harness's renderer has no background; fog.mjs `repaintFog`, `stand`, `armRendererFailsafe` not exported |
| R806 | (c) | - | two texts agreeing (the hint in both languages and the GM's handbook's line): words, not code |
| R846 | (c) | the helpers by tier 2 "a private card to a student's owners ..." | a census of the callers that name their own readers |
| R945 | (c) | the cut and the gate by R943, R944 and scenario 76 C | a census: no write, no emit, no copy read over six bodies |
| R1127 | (c) | `wholeNumber` itself by R1128 (tier 1) | a census of every stepper and the lines that read its value |
| R1483 | (c) | - | three texts of the harness and its README agreeing: documentation of an assumption |
| R99 | (c), the pilot's | - | unchanged here (see the note at the end) |

## Mutant tables

Each on a detached worktree copy (`DRPG_REPO`), the old test from d7566926's tier files and the new one from this
branch's. "ok - missed" is the old test passing a mutant that breaks the rule.

| Test | Mutant | Old | New |
| --- | --- | --- | --- |
| R90 | m1 live.mjs: `Hooks.callAll("drpgWindowUpdated", next)` removed | FAIL | FAIL |
| R90 | m2 the hook fired before `after(next)` | FAIL | FAIL |
| R90 | m3 chrome.mjs's listener `dressChrome(null)` (text kept) | ok - missed | FAIL |
| R90 | clean | ok | ok |
| R78 / R5170 | m1 music.mjs `nowPlayingHere`: `if (!sound.playing)` | FAIL | FAIL |
| R78 / R5170 | m2 `if (!(sound.sound?.playing \|\| sound.playing))` (text kept) | ok - missed | FAIL |
| R78 / R122 | m3 hud.mjs `renderHud` removes every child, the band too (text kept) | ok - missed | FAIL |
| R78 / R122 | m4 `paintTrackLine` removes the band on a stop | FAIL | FAIL |
| R78 / R5170, R122 | clean | ok | ok |
| R65 / R167 | m1 live.mjs `handOff` closes with `animate: true` (text kept) | ok - missed | FAIL |
| R65 / R167 | m2 the work replaced by `null` (text kept) | ok - missed | FAIL |
| R65 / R167 | m3 `async` with `await null` at its head | FAIL | ok (no outcome a call sees; the read kept in R65) |
| R73 / R5171 | m1 live.mjs `reopen`: the close not awaited | FAIL | FAIL |
| R73 / R5171 | m2 the opener called before the loop (and again after) | FAIL | FAIL (a first draft keeping only the last call's reading passed it; it records every call now) |
| R73 / R5171 | m3 the class test inverted (text kept) | ok - missed | FAIL |
| R73 / R5171 | clean | ok | ok |
| R83 / tier 2 | m1 call-world.mjs `runPendingGather` on `canvas.scene` | FAIL | FAIL |
| R83 / tier 2 | m2 `gatherEveryone` takes `canvas?.scene` before `onScene` (text kept) | ok - missed | FAIL |
| R83 / tier 2 | m3 the order stores `scene.id && canvas.scene?.id` (text kept) | ok - missed | FAIL |
| R83 / tier 2 | m4 `fallbackGather` writes on `canvas.scene` | ok - missed | FAIL |
| R83 / tier 2 | m5 a gone room cleared in silence | FAIL | FAIL |
| R83 / tier 2 | m6 a clear added before the room's check | ok | ok (no outcome a call sees; kept as text) |
| R83 / tier 2 | clean | ok | ok |
| R62 / tier 2 | m1 settings.mjs: the `<html>` root's write of `--drpg-legacy-scale` removed | FAIL | FAIL |
| R62 / tier 2 | m2 the screen term multiplied in (`effectiveScale() / sliderScale()`, text kept) | ok - missed | FAIL |
| R62 / tier 2 | m3 the `<html>` root given the slider in both themes (text kept) | ok - missed | FAIL |
| R62 / tier 2 | clean | ok | ok |
| R95 / tier 2 | m1 motion.mjs: the window's first frame with `opacity: 0` | FAIL | FAIL |
| R95 / tier 2 | m2 the children's loop over nothing | FAIL | FAIL |
| R95 / tier 2 | m3 a second `play(el, ...)` fading the window after the loop (text kept) | ok - missed | FAIL |
| R95 / tier 2 | clean | ok | ok |

A reading for the owner, not a change: the harness's regions have no `teleportTokens`, so R83's tier-2 test runs
call-world.mjs `fallbackGather` on a scene not on screen - the road the pilot's R99 note says needs a second scene
with a gather fixture. R99 is left as the pilot marked it; m4 above is a mutant of that road the new test fails.

## Gates

| Batch | Tests | node --check, check.mjs, lint | Tests by name | Tiers 0-1 whole |
| --- | --- | --- | --- | --- |
| 1 | R62, R65, R73, R78, R83, R90, R95 (+ R5170, R5171, three tier-2 tests) | ok; check 19 parts green; lint 346 files, 0 problems | tier 0-1: 8 ran, 9 passed; tier 2: 3 ran, 7 passed | 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red (446 s); the pilot's 1419/1404 plus R5170 and R5171, less R95 |
| 2 | R1330, R31, R54, R61, R66, R71, R77, R84, R118 (notes only) | ok; check 19 parts green; lint 0 problems | tier 0-1: 9 ran, 10 passed | 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red (425 s) |
| 3 | R119, R291, R300, R383, R806, R846, R945, R1127, R1483 (notes only) | ok; check 19 parts green; lint 0 problems | tier 0-1: 9 ran, 10 passed | 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red (408 s) |

## Counts

26 tests in the slice (R99 the pilot's). (a): 3 - R90 in place, R5170 off R78, R5171 off R73. (b): 3 - R62, R83, R95
(three new tier-2 tests). (c): 20 text guards, of which R62, R65, R73, R78 and R83 are trimmed to what stays text,
R66 and R71 are marked not converted (drivable, not built here), and R99 is the pilot's. Deleted from tier 0: R95.
New R numbers: R5170, R5171. Every new test failed each mutant it was written for (m2 of R5171 only after a fix,
recorded above).

## For the owner

- Would need an export (rule 2): hud.mjs `control` (R54); own-ring.mjs `frameOf`, `isMine`, `hourColour` (R77);
  roll-draw.mjs `situationReading` (R291); fog.mjs `repaintFog`, `stand`, `armRendererFailsafe` (R383).
- Drivable, not built in this slice: R66 (the Students window's apply and its live watch), R71 (the cue pane), R65's
  and R31's window halves (a row's round trip; a refused Apply), R1330's RAISED and lazy card.
- Default taken (ITEM4.md rule 1 and 4): a test with a driven half is split - the driven half its own test (a new R
  number in tier 0, a named test in tier 2), the original keeping its name and number, trimmed to the rest and marked
  TEXT GUARD. A trimmed assertion an older test already drives (R167 for R65, R122 for R78) is dropped with that test
  named in the note.
