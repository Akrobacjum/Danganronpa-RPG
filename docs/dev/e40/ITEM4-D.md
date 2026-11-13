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
