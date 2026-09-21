# UI - findings

Domain: theme, chrome, sheet, settings, stylesheets, diagnostics. Module 1.2.42, Foundry v14 / Daggerheart 2.6.
Static read only; nothing in the repository was edited.

## Files read (with line counts)

| File | Lines | How |
|---|---|---|
| scripts/glass.mjs | 2328 | end to end |
| scripts/chrome.mjs | 192 | end to end |
| scripts/sheet.mjs | 3935 | end to end |
| scripts/settings.mjs | 1559 | end to end |
| scripts/diagnostics.mjs | 1235 | end to end |
| scripts/utils.mjs | 1119 | end to end |
| scripts/popup.mjs | 371 | end to end |
| styles/stained-glass.css | 4398 | end to end |
| styles/motion.css | 144 | end to end |
| styles/messenger.css | 325 | end to end |
| styles/pixel-icons.css | 703 | selectors and sizes read; the data-URI sprites skimmed (generated file) |
| styles/danganronpa.css | 14911 | section map (142 headers), tokens, @font-face, pixel-font block, SETTLING block, redacted-sheet block, every sub-12px rule, plus script analysis of all 385 `drpg-` classes |
| fonts/README.md, docs/design/typography.md | 68 / 59 | end to end |
| Neighbours followed: look.mjs (1-130), sfx.mjs launcher (1025-1110), anonymity.mjs (grep), motion.mjs (grep), module.mjs (registration order), lang/en.json (Settings.* and Look.* keys) | | |

## Strengths

- Player/GM separation on the sheet is done in JS, not CSS: `injectInitButton`, `injectAdvanceButton`, `injectItemButton` and the `gm-editable` action pips all return early on `!game.user.isGM` (sheet.mjs:1374, 1428, 1457, 1209); the Truth Bullet "really" badge is drawn only when `truthBulletData` handed a `realType` to a GM (sheet.mjs:2626). Nothing GM-only is merely `display:none`'d for a player. Another player's sheet is redacted by *emptying* panes (anonymity.mjs:146-166), not hiding them.
- Every client-visible setting (theme, pixelFont, glassPulse, reducedMotion, hudTicker, messengerSound, uiScale, debug) has a plain "This client only" hint and none names a GM mechanic; world-scoped hints are GM-facing and Foundry never shows them to players.
- Every `config: true` setting either has a live `onChange` or is read at use time (`getSetting` at the call site; no module-level cache of any of them). No setting needs a reload.
- The Stained Glass curtain is well-defended: geometry signature + DRIFT watch (glass.mjs:2246-2283) stops recuts on text ticks, `drpg-measuring` holds transitions still, the morph is keyed (`morphId`) so an interrupted one cleans itself, and a self-check (`CHECKS`) is published for tests and for `drpgGlassDebug()`.
- The two theme files do not duplicate rules: only 3 selectors appear in both, none with an identical declaration block. Latin-Ext font files are real and correctly ranged (see D2).
- utils.mjs is disciplined: one `esc`, one `plural` with `Intl.PluralRules`, `replaceFlag` for non-merge writes, in-memory `sessionFailures` capped at 60 with de-duplication; diagnostics.mjs reports measurements, never guesses.

## Findings

### UI-01 [severity: minor] [category: hygiene] [CONFIRMED]
**Where:** styles/stained-glass.css:338, 928, 933, 1741, 2428, 2875, 814; scripts/glass.mjs:52
**What happens:** `#drpg-settings-launcher` is styled in seven rules and measured as a curtain block, but no script ever creates it. The element that opens the Look window is `#drpg-sound-launcher` (sfx.mjs:1035, `LAUNCHER_ID = "drpg-sound-launcher"`; look.mjs:4 "the sound launcher, wearing a gear"). The same is true of `#drpg-notice` (10 references in stained-glass.css), which the file's own B1 note admits "no script builds". So "the settings gear launcher" of the focus question is the sound launcher: it opens `openLookDialog()` (look.mjs:115) - volumes + theme + scale + the glass switches - under both themes. That works; the phantom id does not.
**Evidence:**
```
glass.mjs:52  { cls: "launch", sel: "#drpg-messenger-launcher, #drpg-sound-launcher, #drpg-settings-launcher", union: true, ... }
stained-glass.css:1750  It was cut for `#drpg-notice`, an element no script builds
```
`grep -rn "settings-launcher" scripts/` hits only glass.mjs:52.
**Fix:** delete `#drpg-settings-launcher` and `#drpg-notice` from every selector list and from `BLOCKS`; if a separate settings gear is ever wanted, build it in sfx.mjs/look.mjs and re-add the id then.
**Pitfalls:** the `launch` block's `union: true` measurement is unaffected (querySelectorAll simply finds two elements); the fallback box `66x134` in glass.mjs:52 was sized for three launchers stacked and may now be too tall - re-measure when the id goes.

### UI-02 [severity: minor] [category: hygiene] [CONFIRMED]
**Where:** styles/stained-glass.css:350-354, 800, 2396, 2440-2448, 2455-2488, 2790-2795, 3520 (23 rules)
**What happens:** 23 rules are gated on `body.drpg-no-glass-effects`, a class no script sets. glass.mjs:1711 records that "`effectsOn()` is gone with the setting it read", and settings.mjs registers no `glassEffects` setting any more (the only toggles are `drpg-no-pulse`, `drpg-no-ticker`, `drpg-reduced-motion`, settings.mjs:1424-1426). Every `:not(.drpg-no-glass-effects)` therefore always matches and every `body.drpg-no-glass-effects ...` rule is dead. The comment at stained-glass.css:2432 ("off with the glass effects") documents a switch that does not exist.
**Evidence:** `grep -rn "drpg-no-glass-effects" scripts/` returns nothing; `grep -c` in stained-glass.css returns 23.
**Fix:** either drop the class from every selector (simplest, and it removes a `:not()` from the already long brush selectors), or re-register the setting if "no SVG filters" is still wanted for weak tablets - the brush and the ink-blot filters (`#drpg-brush`, `#drpg-ink-blot`) are the costly part the class was written to switch off.
**Pitfalls:** if the setting is brought back it must be client-scoped and added to the Look window and to `renderSettingsConfig`'s hide list, or the two windows disagree again (settings.mjs:1457-1474).

### UI-03 [severity: minor] [category: bug] [CONFIRMED]
**Where:** scripts/glass.mjs:497-498 (write) vs 1771-1785 (`unmount`)
**What happens:** `moduleLayout` writes `overflow: visible` and a computed `max-height` inline onto `#scene-controls` every rebuild; `unmount()` (theme switched to Monokuma Legacy, or `refreshGlass` with the theme off) clears `marginTop`, `paddingTop`, `boxSizing`, `transform`, `transformOrigin` but never `maxHeight` or `overflow`. Legacy therefore keeps a scene-control rail capped to a height chosen for the glass layout until reload; on a short screen with a tool palette open the tail of the tools column is bounded by a stale number.
**Evidence:**
```
497  railTop.style.overflow = "visible";
498  railTop.style.maxHeight = Math.max(natural, room) + "px";
1776 document.querySelectorAll("#scene-controls, #sidebar").forEach(e => { e.style.marginTop = ""; e.style.paddingTop = ""; e.style.boxSizing = ""; });
```
**Fix:** add `e.style.maxHeight = ""; e.style.overflow = "";` to the line-1776 loop (and drop `#sidebar` there, whose `paddingTop` nothing sets any more - see UI-06).
**Pitfalls:** none; both are inline properties the module alone writes.

### UI-04 [severity: minor] [category: perf] [CONFIRMED]
**Where:** scripts/glass.mjs:2222-2243 (`observe`), 2312-2317 (`registerGlass`), 2296-2302 (`refreshGlass`)
**What happens:** `observe()` calls `addEventListener("resize", schedule)` every time it runs, and it runs on every mount (`refreshGlass` -> `mount(); observe()` whenever `curtains` is empty). Each Legacy->Glass switch (`unmount` empties `curtains`) adds another permanent `resize` listener; the observers are disconnected, the listener is not. `registerGlass` adds a second, *unthrottled* resize listener (line 2317) that runs `pinRightColumn()` (reads `getBoundingClientRect`, writes 9 inline styles) and `freeTheBoard()` (four `elementFromPoint` probes and, when a lid is found, `getComputedStyle` on every `#interface` child) on every resize event during a window drag.
**Evidence:**
```
2224  addEventListener("resize", schedule);
2317  addEventListener("resize", () => { if (themeOn()) { pinRightColumn(); freeTheBoard(); } });
```
**Fix:** register the `schedule` listener once (guard with a module flag like `sidebarWatched`), and fold the line-2317 work into the debounced `schedule`/`rebuild` path (`rebuildAll` already calls `freeTheBoard()`, and `curtainGeometry` already calls `pinRightColumn()`), so a resize costs one debounced rebuild.
**Pitfalls:** `pinRightColumn` during a resize is what keeps the right column from visibly drifting mid-drag; if it moves behind the 150 ms debounce, check on a slow tablet that the column does not lag the sidebar.

### UI-05 [severity: minor] [category: perf] [CONFIRMED]
**Where:** scripts/glass.mjs:1705, 2285-2293 (`loop`), 2089-2105 (`scanUrgent`), 2077-2084 (`paneAt`)
**What happens:** `loop` runs on every animation frame for the life of the page (even with the theme off it returns after a check). Before the 66 ms gate it evaluates `REDUCED()`, which calls `matchMedia("(prefers-reduced-motion: reduce)")` - a new `MediaQueryList` allocated ~60 times a second. Past the gate (15 fps) `scanUrgent` runs every 500 ms a `querySelectorAll` over five selectors plus a `getBoundingClientRect` and a point-in-polygon scan over *all* panes (`j.panes.find(inside)`, typically 80-150 polygons) per match, and `pulseFrame` repaints every pane twice on the half-resolution canvas. All of this is by design for the pulse; the `matchMedia` allocation and the linear pane search are not.
**Evidence:**
```
1705 const REDUCED = () => document.body.classList.contains("drpg-reduced-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches;
2291   if (REDUCED() || !pulseOn()) return;
2292   if (t - last < 66) return;
```
**Fix:** cache the `MediaQueryList` once (`const MQ = matchMedia(...)`) and read `MQ.matches`; move the `REDUCED()` test below the 66 ms gate; in `paneAt` test the pane's bounding box (`p.bb`, already stored by `paintGlass`) before `inside()`.
**Pitfalls:** `REDUCED()` is also read by `morph`, `beatAt`, `flashSeams`; a cached MQL still reflects OS changes live (`.matches` is live), so nothing changes semantically.

### UI-06 [severity: nit] [category: hygiene] [CONFIRMED]
**Where:** scripts/glass.mjs:2024-2055 (`placeTiles`, `MAX_SHIFT`), 128 (`STRIP_SLACK`), 44-52 (BLOCKS comments), 116-128 (STRIP_LEAN comment)
**What happens:** (a) `placeTiles` returns at line 2043 and carries 12 lines of unreachable code after it (the old padding pusher), which is the only user of `MAX_SHIFT`; (b) `STRIP_SLACK` is computed and never read; (c) the `note-block` entry is preceded by two stacked comments that contradict each other and the code - "it has NO fallback on purpose" (line 46) directly above `fixed: true, fallback: (W, H) => ...` (line 52); (d) the comment at 116 says the strip is "the lean of its outer edge (22) plus the clearance (14)" while `STRIP_LEAN = 26`. Comments in this file are a dated diary (07.09, 08.09, 10.09...) - valuable, but several now describe superseded states as if current (e.g. 2028-2035 "the rail is a block" while line 54 says the rails are NOT blocks).
**Evidence:**
```
2043   return moved;
2044   for (const [target, probe, side] of [ ... ]) {   // unreachable
   46   to the real container, and it has NO fallback on purpose - ...
   52   { cls: "note-block", sel: "#drpg-popups", fixed: true, fallback: (W, H) => { ... } },
```
**Fix:** delete lines 2044-2055 and `MAX_SHIFT`, delete `STRIP_SLACK`, delete the line-44-47 comment (the 48-51 one is the true one), and fix "(22)" to 26 or derive it. Consider moving the dated narrative into `docs/design/glass-recipe.js` or a CHANGELOG so the source keeps only what is true today.
**Pitfalls:** tests.mjs may assert on comment text or on `CHECKS`; run `game.drpg.runTests()` after the edit.

### UI-07 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:307 (`DRPG.Settings.uiScale.hint`); docs/design/typography.md:19-22, 57; styles/stained-glass.css:88; fonts/README.md (VT323 paragraph)
**What happens:** three documents give three floors. The setting hint promises "the 11px floor [is] never scaled"; typography.md says the floor is 11 px; the stylesheet sets `--drpg-sg-floor: calc(21px * var(--drpg-sg-scale, 1))` - 21 px *and it scales with the slider* (that scaling is the whole point of the 07.09 fix at stained-glass.css:85-87). fonts/README.md is the only doc with the right number (21). A player reading the hint is told the opposite of what the slider does.
**Evidence:**
```
en.json:307      "The map, Foundry's own windows and the 11px floor are never scaled."
typography.md:19 `--drpg-sg-floor` is **11px** and nothing in the theme is set smaller
stained-glass.css:88  --drpg-sg-floor: calc(21px * var(--drpg-sg-scale, 1));
```
**Fix:** hint -> "The map and Foundry's own windows are never scaled."; typography.md -> 21 px, scaled by the slider and by the screen term clamped at 0.85 (settings.mjs `typeScale`).
**Pitfalls:** the Polish previous audit and release notes quote 11 px too; update the doc, not the number.

### UI-08 [severity: minor] [category: ux] [CONFIRMED]
**Where:** scripts/settings.mjs:1540-1559 (`renderSettingsConfig`), scripts/look.mjs:36-41; styles/motion.css:133-143; scripts/motion.mjs:88-93
**What happens:** the "Reduced motion" switch is hidden under Monokuma Legacy in both windows, on the stated argument that "under that theme it was a third switch that changed nothing" (look.mjs:40). It does change something: `body.drpg-reduced-motion` in motion.css zeroes every motion token of the whole module (popups, hope/action flares, the clock turn-over, window entrances), and `reducedMotion()` in motion.mjs reads the class regardless of theme. A Legacy player who wants stillness has to change an OS setting, which is exactly what the switch was added to avoid (motion.css:129-132).
**Evidence:**
```
settings.mjs:1553  for (const key of [SETTINGS.glassPulse, SETTINGS.hudTicker, SETTINGS.reducedMotion]) show(key, glass);
motion.css:133     body.drpg-reduced-motion { --drpg-t-snap: 0ms; ... }
motion.mjs:92      if (document.body.classList.contains("drpg-reduced-motion")) return true;
```
**Fix:** keep `glassPulse` and `hudTicker` glass-only; show `reducedMotion` under both themes in `renderSettingsConfig` and in `lookFieldset` (move it out of `glassOnly`).
**Pitfalls:** the Look fieldset is rebuilt on theme change (look.mjs `wireLook`); keep the checkbox in the same list so it is rewired.

### UI-09 [severity: minor] [category: bug] [SUSPECTED]
**Where:** scripts/settings.mjs:1487-1538 (`scaleWindow`)
**What happens:** under Stained Glass every `renderApplicationV2`/`renderApplication` passes through `scaleWindow`, which treats an app as "the character sheet" when `/actor/i.test(app.constructor.name)` OR `app.document?.documentName === "Actor"`. The class-name regex also matches Foundry's `ActorDirectory` (the Actors sidebar tab, an ApplicationV2 in v13/v14) and any module window with "actor" in its class name; for those it sets `want = {width: 1120, height: 1160}`, removes the resize handle and calls `setPosition`. The `documentName` test also catches NPC/Monokuma sheets, which are then forced to 1120x1160 and made non-resizable. Whether a docked sidebar tab honours `setPosition` cannot be settled statically.
**Evidence:**
```
1503  if (/actor/i.test(app?.constructor?.name ?? "") || app?.element?.classList?.contains("actor")
1504      || app?.document?.documentName === "Actor") {
1505      want.width = 1120;
1509      want.height = 1160;
1510      fixed = true;
```
**Fix:** test the sheet precisely: `app.document?.type === "character" && app instanceof foundry.applications.sheets.ActorSheetV2` (or `app.element.matches(".application.sheet.actor")`), and drop the class-name regex.
**Pitfalls:** the `renderApplication` (V1) hook still fires for legacy apps; keep the element guard so a V1 `element` (jQuery) is unwrapped as it is now.

### UI-10 [severity: minor] [category: bug] [CONFIRMED]
**Where:** scripts/popup.mjs:107-118 (`trimStack`); styles/stained-glass.css:2942-2949, 3239-3245
**What happens:** under Stained Glass the notice stack is clipped to a fixed 160 px tile (`#drpg-popups { height: calc(160px*scale) !important; overflow: hidden }`) and `trimStack` keeps at most 2 cards - but it only ever retires *non-sticky* cards. During a Class Trial two sticky evidence cards fill the tile; every later card (a refusal, a DM reply, the time of day) is appended below them, inside a box with `overflow: hidden` and `justify-content: flex-end`, so the *newest* card is the one that never becomes visible until a sticky one is closed by hand. Under Legacy the stack scrolls off screen upward and stays reachable; under the glass it is simply gone.
**Evidence:**
```
popup.mjs:112   const max = document.body.classList.contains("drpg-theme-stained-glass") ? 2 : MAX_VISIBLE;
popup.mjs:115   for (let i = 0; i < excess && i < droppable.length; i++) droppable[i].dispatchEvent(...)
stained-glass.css:2945  overflow: hidden;
```
**Fix:** when `cards.length > max` and `droppable` is exhausted, either let the stack grow (`height: auto; max-height: calc(100vh - 220px)` is already at line 2915 and is overridden at 2943) or move sticky cards to their own lane; at minimum, give `#drpg-popups` `overflow-y: auto` so the newest card can be scrolled to.
**Pitfalls:** the tile is a *fixed* pane of the curtain (glass.mjs `note-block`, `fixed: true`) precisely so cards never recut the glass; growing the stack past 160 px puts cards off their pane, which is cosmetic, whereas an unreadable notice is not.

### UI-11 [severity: minor] [category: readability] [CONFIRMED]
**Where:** styles/stained-glass.css:104-118 (tokens), 2274-2280, 3403-3410; styles/danganronpa.css tokens 43-102
**What happens:** computed WCAG ratios (sRGB, module palette, a pane of `rgba(7,7,10,.55)` over a mid-grey map): Bone on pane 12.1:1, Bone-dim (62 %) 5.6:1, Bone 84 % 9.0:1 - all fine. The *accent* colours used as text fall short when the hour is dark: night `#7f8cff` 4.7:1 on a pane and 3.7:1 on a window over a light map; trial/despair `#ff3d8b` 4.2 / 3.2; eclipse `#a678ff` 4.5 / 3.5; GM red `#e0182f` 2.9 / 2.2 (used as icon colour on `.drpg-destructive`/`.drpg-gm-route`, 3876-3882, and as the Monokuma panel's `--brush`); GM-light `#ff5566` 4.5 / 3.5. Everything that puts *ink on an accent plate* (phase stamp, popup title, chosen tile) is >= 6:1 except ink on GM red (4.2). So at Night, Eclipse and Class Trial the state-coloured labels (`.drpg-hud-phase` text is fine - it is ink on a plate - but `.drpg-hud-elapsed`, `.drpg-event-title`, the tile icons, table headers `th`, the GM-panel icons) sit at or below 4.5:1, and below it on a bright map.
**Evidence:** stained-glass.css:4202-4226 already measured "sixteen of 154 strings under 4.5:1"; the rule at 4224 adds a ground under two of them.
**Fix:** for text (not borders) derived from `--drpg-glass-accent`, use `color-mix(in srgb, var(--drpg-glass-accent) 70%, var(--drpg-sg-bone))` as the *text* token (the file already does this for `.drpg-hud-elapsed` at line 913), or add the `rgba(7,7,10,.72)` chip ground used at 4224 wherever an accent word stands alone; never draw GM red `#e0182f` as text - use `--drpg-sg-gm-light` for text and keep `#e0182f` for fills.
**Pitfalls:** the accent transitions through `@property --drpg-glass-accent` (2972); a `color-mix` of it still animates. Do not change the *plate* colours - ink on them is fine.

### UI-12 [severity: nit] [category: readability] [CONFIRMED]
**Where:** styles/danganronpa.css:11807, 11849, 11120, 11970, 2935, 5666, 5789, 11027, 11105; styles/messenger.css:56, 240
**What happens:** under Monokuma Legacy (the theme's own floor does not apply) eleven rules set text under 12 px at 1080p: `.drpg-overflow-badge` 10 px, `.drpg-overflow-caption` 11 px, `.drpg-table-item-also` 0.66 rem (10.6 px), `.drpg-sfx-badge` 0.68 em, `.drpg-tb-badge` 0.7 rem (11.2 px), `.drpg-messenger-badge` 0.68 rem (10.9 px), `.drpg-messenger-time` `--font-size-10` (10 px), `#drpg-player-status .drpg-status-value` 0.72 rem (11.5 px) under the pixel face - the pixel face is exactly where fonts/README says 11 px is the readable floor. Under Stained Glass these are lifted by the floor ladder (stained-glass.css:167-189, 3177-3189) so the theme is clean; Legacy is not.
**Fix:** raise the Legacy badges to `var(--drpg-text-xs)` (11 px) and the pixel-face status value to 12 px; a 10 px count badge in Press Start 2P is a 7 px capital.
**Pitfalls:** `.drpg-tb-badge` rows are width-sensitive on the inventory tab; check the Truth Bullet row at 850 px sheet width.

### UI-13 [severity: nit] [category: hygiene] [CONFIRMED]
**Where:** scripts/sheet.mjs:3919-3935 (`growForCalls`, `SHEET_MIN_HEIGHT = 980`, comment "850x830") vs scripts/settings.mjs:1496-1511 (`want.width = 1120; want.height = 1160`, comment "850 x 800")
**What happens:** two files state the character sheet's size, with two different Daggerheart defaults in their comments and two different targets (980 min height under Legacy; 1120x1160 scaled under the glass). They do not fight at runtime - `renderApplicationV2` (settings) fires before `renderCharacterSheet` (sheet), and `growForCalls` is a one-shot "only upwards" - but the sheet's size is a design fact that now lives in two places with two rationales.
**Fix:** one exported `SHEET_SIZE` per theme in config.mjs, read by both; fix one of the two comments (Daggerheart 2.6.5's default is whichever the live sheet reports - measure once).
**Pitfalls:** `growForCalls` uses a `WeakSet` to run once per app; `scaleWindow` re-runs on every `applyTheme` with the `drpgScaled` key deleted - keep that difference if merging.

### UI-14 [severity: nit] [category: perf] [CONFIRMED]
**Where:** scripts/sheet.mjs:1012-1033 (`watchTileFit`)
**What happens:** one `ResizeObserver` per sheet root is created and never disconnected. The `dataset.drpgTileFit` guard stops duplicates on the same element, but ApplicationV2 builds a new root on every open, so every open/close cycle of a character sheet leaves an observer bound to a detached element. `closeCharacterSheet` is never hooked.
**Fix:** keep the observer on the app (`app._drpgTileFit`) and disconnect it in a `closeCharacterSheet` hook, or observe once and re-target.
**Pitfalls:** none; the observer's callback already guards re-entrancy.

### UI-15 [severity: nit] [category: hygiene] [CONFIRMED]
**Where:** scripts/sheet.mjs:837; styles/danganronpa.css:3956-4247 (`.drpg-compact`)
**What happens:** (a) `const SHY = "­"` is written as the literal invisible U+00AD character in the source (`od -c` shows `" 302 255 "`), which any editor, diff or linter will show as an empty string; (b) `.drpg-compact` is used in nine `:not(.drpg-compact)` selectors and documented as "the manual override", but no script or window class list ever sets it (tests.mjs:545 notes the same). Also `#drpg-messenger-launcher` is styled in messenger.css:13-37 and again at 319-325 with a comment about a Casebook launcher that "stopped existing" - the second block could fold into the first now that the ordering reason is gone.
**Fix:** write `"­"`; either remove `.drpg-compact` or use it on the one window the comment at 4206 says wanted it ("the Projects manager").
**Pitfalls:** none.

### UI-16 [severity: nit] [category: perf] [CONFIRMED]
**Where:** scripts/glass.mjs:401-520 (`moduleLayout`), 280-325 (`applyRotations`), 327-355 (`tightenGmGap`), 176-271 (`railRule`)
**What happens:** one rebuild forces roughly 8-12 synchronous layouts: `moduleLayout` writes transforms/margins then reads rects (x3 with `void offsetWidth/offsetHeight`), `applyRotations` writes the sheet then reads (`void offsetWidth`, `measuring(false)` reads again), `railRule` walks `offsetLeft/offsetTop` chains per tile after the sheet write, `tightenGmGap` does up to three write-read passes. It is debounced (150 ms) and only runs on real drift, so at the table it is a few times a session - acceptable - but the same `applyRotations` is also the `ResizeObserver` callback on both rails (line 2237), where a tool palette opening triggers it synchronously with three forced reflows.
**Fix:** none needed for the rebuild; for the rail observer, run `applyRotations` in `requestAnimationFrame` and skip when the sheet text would be unchanged.
**Pitfalls:** the comments at 280-291 explain why the sheet is written once; keep that.

## Live checks recommended (things statics cannot settle)

1. UI-09: open the Actors sidebar as a popout and a Monokuma (NPC) sheet under Stained Glass; confirm whether `setPosition({width:1120,height:1160})` reaches them and whether the resize handle disappears.
2. UI-10: in a trial with two sticky evidence cards on screen, trigger a refusal popup on a player client under Stained Glass and confirm it is not visible.
3. UI-03: switch Stained Glass -> Monokuma Legacy with a scene-control tool palette open on a 900 px-tall screen; inspect `#scene-controls` for a stale inline `max-height`.
4. UI-11: at Night / Eclipse / Class Trial, run a contrast picker on `.drpg-event-title`, `.drpg-gm-panel table th` and the GM-panel icons over a bright scene.
5. Polish diacritics: the four Latin-Ext woff2 files exist and their `unicode-range` (stained-glass.css:35, 47) covers U+0100-017F (ą ę ł ś ż ń ó ć ź are all there); confirm in DevTools' Network tab that `VT323-LatinExt.woff2` is fetched when a campaign name with "ł" is on the clock, and that "Ó" (U+00D3, in the *Regular* file's range) is present in `VT323-Regular.woff2` (Google's latin subset includes it; the shipped subset was not verified byte-level here).
6. UI-05: profile one minute of idle with the pulse on and 120+ panes; the linear `paneAt` scan every 500 ms is the number to watch on a tablet.

## Hygiene metrics

**Functions over 150 lines** (own count, brace-balanced):
- glass.mjs `curtainShapes` 608 (703-1310) - the whole partition solver in one closure; `curtainGeometry` 142; `morph` 121; `moduleLayout` 120.
- sheet.mjs `actionButton` 169 (3624-3792), `groupInventory` 161 (2102-2262), `injectActionBar` 155 (1160-1314), `injectActionPanel` 125.
- settings.mjs `registerSettings` 678 (484-1161) - flat registrations, harmless.
- diagnostics.mjs `diagnoseStyles` 156.
- popup.mjs `showPopup` 120.

**Dead / phantom selectors and code:** `#drpg-settings-launcher` (7 rules), `#drpg-notice` (10), `body.drpg-no-glass-effects` (23), `.drpg-compact` (9), `placeTiles` tail + `MAX_SHIFT`, `STRIP_SLACK`. Of the 385 `drpg-` classes in danganronpa.css only `.drpg-compact` is never produced by code (comments stripped before matching); of the 165 in stained-glass.css none.

**`!important` counts:** danganronpa.css 689, stained-glass.css 260, messenger.css 5, motion.css 0, pixel-icons.css 0. Most in the theme file are documented as fights with Daggerheart's cascade layer; the density in danganronpa.css (one per 22 lines) is the reason the theme file needs its own.

**Duplicated rules between the theme files:** 3 shared selectors, 0 identical blocks. Inside danganronpa.css `:root` is declared 15 times and `.drpg-safeword-button` 4 times (token blocks appended per stage rather than merged).

**Magic numbers not in config.mjs (notable):** glass.mjs - `GM_DROP 26`, `RAIL_MARGIN 16`, `STRIP_ANGLE atan(22/370)`, notice tile `330x160`, `100 + 160` bottom offset, `0.22` pane-lean factor, `34/14` skirt/collar, `HUG 120`, `REACH 360`, `DRIFT 4`, watchdog `1500/4000/9000 ms` - each is explained in a comment but none is shared with stained-glass.css, which repeats `330px`, `160px`, `100px` (2942-2949, 1757-1766) by hand. settings.mjs - sheet `1120x1160`, screen factor `0.7/0.85`, `2560x1440`. sheet.mjs - `SHEET_MIN_HEIGHT 980`, `TILE_TEXT_FLOOR 0.68`, `LONG_WORD 9`, `BREAK_EVERY 6`. popup.mjs - `AUTO_DISMISS_MS 12000`, `MAX_VISIBLE 4`, glass cap `2`.

**Comments contradicting code:** glass.mjs:44-52 (fallback), 116/124 (22 vs 26), 2028-2035 (rails "are blocks"); look.mjs:36-41 (reduced motion "changes nothing" under Legacy); en.json:307 and typography.md:19 (11 px floor); sheet.mjs:3905 vs settings.mjs:1497 (850x830 vs 850x800); stained-glass.css:2432 (a "glass effects" switch that no longer exists).

**Duplicated helpers across files:** `themeOn()` exists in glass.mjs:1707 (reads the setting) and chrome.mjs:32 (reads the body class) and look.mjs:22 `isStainedGlass()` - three predicates for one fact; `const root = element instanceof HTMLElement ? element : element?.[0]` appears 9 times across sheet.mjs/utils.mjs/settings.mjs.
