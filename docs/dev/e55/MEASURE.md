# E55 - the measured report before consolidation (F0's companion)

Read on `origin/main` at 421f2395 (1.2.109), 13.11.2026. Nothing here changes a sheet: `styles/` is untouched (two
open lines edit it). Each count says how it was made. prep-54's inventory (`docs/dev/E55/INVENTORY.md` on its line,
read at 4dfac3a9, 1.2.108) made most of these readings first; its finders (`docs/dev/E55/finders/` there) were run
again here, on this tree, and the rows below are this tree's lines. Where a reading moved since 4dfac3a9 it says so.

## 1. The sheets

Seven served sheets (module.json `styles`, in order): 31,350 lines. By the finders' parser (rules outside at-rules
counted with the at-rules they sit in):

| Sheet | Rules | Declarations | !important |
| --- | ---: | ---: | ---: |
| base.css | 32 | 143 | 4 |
| motion.css | 3 | 29 | 0 |
| danganronpa.css | 1,946 | 5,847 | 647 |
| stained-glass.css | 628 | 1,904 | 206 |
| pixel-icons.css | 220 | 548 | 0 |
| components.css | 934 | 2,868 | 0 |
| narrow.css | 65 | 229 | 12 |

`!important` 869 in all, as `node tools/css-lint.mjs` counts it (and tools/css-budget.json holds it).

## 2. Dead rules

**By css-lint: none.** `node tools/css-lint.mjs` on this tree: dead classes 0 of 915 named, duplicate rules 0, stray
comment ends 0, 0 problems. Its dead-class detector reads class names no script writes; its duplicate detector reads a
rule written twice whole. Neither reads the two kinds of dead CSS below, which is why the owner's "about 300 lines
(css-lint)" does not match what css-lint reports (prep-54's finding, unchanged here).

**By the finders (not the lint):**

- **Overridden declarations: 124** (prep-54: 120 at 4dfac3a9). A declaration is counted when, for every selector of
  its rule, a later rule with the identical selector under the same at-rules sets the same property (finders
  `override.mjs`; a cross-sheet winner counted). By sheet: danganronpa.css 88 (6 `!important`), stained-glass.css 29
  (2), base.css 4, components.css 3. **16 rules** have every declaration overridden: danganronpa.css 35 declarations
  in them, stained-glass.css 10, components.css 4. Every row with its file:line and its winner: appendix A1, A2.
- **The crisis block** (`.drpg-action-button[data-drpg-crisis=...]`, danganronpa.css): 30 mentions of
  `data-drpg-crisis` in danganronpa.css, and no file of scripts/ writes `data-drpg-crisis`, `drpgCrisis` or names
  `injectCrisisPanel` (`grep -rl`, this tree). prep-54 measured it at 28 rules, about 242 lines; not re-counted by rule
  here.
- Not dead, and not counted as dead: the stained-glass.css brush rule at 885 (below), whose inset a later rule wins for
  three of its five selectors only.

## 3. Colour literals that could be tokens

`css-lint` counts **353** declarations with a colour literal (base 9, danganronpa 246, stained-glass 97, narrow 1); most
of danganronpa.css's are `rgba(var(--x-rgb), a)`, which already read a token's channels. Counted here instead: every
numeric literal (`#hex`, `rgb()`, `rgba()`, `hsl()` with numbers, no `var()`) outside a custom-property declaration,
one per occurrence - **132**: stained-glass.css 120, danganronpa.css 11, base.css 1. Of them **97** match a token
already declared in the sheets:

| How it matches | stained-glass.css | danganronpa.css | base.css |
| --- | ---: | ---: | ---: |
| the value of a `--drpg-*` token, exactly | 18 | 4 | 1 |
| the channels of a `--drpg-*-rgb` token (so `rgba(var(--x-rgb), a)` would say it) | 36 | 2 | 0 |
| the rgb of a hex token that has no `-rgb` channel token | 35 | 1 | 0 |

The glass ink `7, 7, 10` is **40** of the 132, at nine alphas; `--drpg-sg-ink` is a hex token with no `-rgb` twin,
which is the third row's largest part (prep-54 counted 36 at 4dfac3a9). Every matching literal with its file:line and
its token: appendix A3. The 35 literals that match no token are not listed one by one; they are mostly near-miss darks
(`rgba(7, 6, 11, a)`, `rgba(5, 4, 9, a)`, `rgba(8, 7, 12, a)`) and whites at low alpha.

## 4. stained-glass.css: the named duplicates

| Item | What this tree holds | Note |
| --- | --- | --- |
| **Checkbox** | 9 rules in stained-glass.css name a checkbox: the drawn glass checkbox is 4100-4162 (8 rules on one selector family, `:is(.drpg-panel, .drpg-popup, .drpg-messenger, .application.sheet.actor) input`: its box, mark, states, focus); 1609 is an `accent-color` rule on range inputs and checkboxes of Foundry's own windows. `accent-color` is set in 13 places: danganronpa.css 8691, 8705, 14597, 15273, 18485, 18488, 18834; stained-glass.css 1009, 1609, 4100; components.css 994, 2856, 3794 | One drawn definition under the glass (4100-4162); the accent is spread over three sheets. Which of equal rules wins in the settings and item-tables windows under Legacy was not measured |
| **Brush** (`::before` behind a button) | The panel buttons' brush is stated three times on overlapping selector lists: stained-glass.css 885 (`inset: 1px -5px`, five selectors), 2866 (`1px -3px`, four), 3256 (`-4px -5px`, three). The three selectors all three share are won by 3256 (the last, same specificity); 885's two others (`.drpg-mini-button`, the sheet's buttons) keep `1px -5px`. Other roles' brushes, once each: action and Call buttons 1325, the sheet's tabs 1504, choices 1881 (each `1px -5px`); the messenger launcher 1267 (`-2px`) | So the "five times, two insets" of the plan is, on this tree, three statements for one role with three insets, two of them losing for three selectors; the override finder counts none of them, because no rule's every selector is overridden |
| **Glyphs** | One selector given a glyph by two rules: `#drpg-sound-launcher i` - the speaker at danganronpa.css 13596 (`mask-image: var(--drpg-pix-speaker)`) and the gear at stained-glass.css 561 (`var(--drpg-pix-gear) !important`, unscoped, so in both themes) | The speaker never shows (prep-54 read it in Chromium as no difference when planted) |
| **Launcher** | That same rule is the "dead launcher": the Legacy sound launcher's speaker glyph, beaten by the gear | prep-54 section 3.3 |
| **`#drpg-events` width** (also named in E55) | danganronpa.css 10036 (`--drpg-events-w: 412px`, `width: var(--drpg-events-w)`); stained-glass.css 691 (`--drpg-events-w: calc(355px * var(--drpg-sg-scale))`, `width: var(--drpg-events-w)`); stained-glass.css 2426 (`width: var(--drpg-events-w)` again); narrow.css 127 (`width: auto`) | 691's `width` and 2426's read the same token; one of the two is a duplicate |
| **Dead font-sizes** (also named) | 9, each overridden by a later identical selector: 483 (by 3267), 1397 and 1647 (by 3905), 1401 and 1654 (by 3910), 1825 (by 3839 `!important`), 2709 (by 3271), 2712 (by 3274), 3168 (by 3942) | The same nine lines as prep-54's at 4dfac3a9 |

## 5. What this did not measure

- Which rules a real Foundry v14 page matches: the defensive selectors aimed at Foundry's and Daggerheart's markup
  (prep-54: 704 rules) are settled only by a live DOM read.
- Pixels. The freeze (audit/style-freeze.mjs) reads computed style on the harness's pages; a picture can still be
  wrong where the numbers agree (code.md's curtain rule).
- The pseudo-elements and masks in the freeze: audit/look-freeze.mjs on the prep-54 line reads them.

## Appendix
### A1. Declarations a later rule with the identical selector overrides (124)

| At | Selector | Property | !important | Overridden by |
| --- | --- | --- | --- | --- |
| styles/base.css:37 | `#drpg-messenger-launcher` | border-radius |  | danganronpa.css:13397 |
| styles/base.css:37 | `#drpg-messenger-launcher` | font-size |  | danganronpa.css:8467! |
| styles/base.css:92 | `#drpg-messenger-roster` | border-radius |  | danganronpa.css:13392 |
| styles/base.css:92 | `#drpg-messenger-roster` | background |  | danganronpa.css:13344 |
| styles/danganronpa.css:24 | `:root` | --drpg-panel-ground |  | danganronpa.css:24 |
| styles/danganronpa.css:747 | `.character-sidebar-sheet .resources-section .status-label, .character-sidebar-sheet .re...` | overflow | yes | danganronpa.css:766! |
| styles/danganronpa.css:817 | `.character-header-sheet .drpg-ultimate-value:empty::before` | color |  | danganronpa.css:11050 |
| styles/danganronpa.css:817 | `.character-header-sheet .drpg-ultimate-value:empty::before` | opacity |  | danganronpa.css:11050 |
| styles/danganronpa.css:923 | `#drpg-hud` | border-radius |  | danganronpa.css:12202 |
| styles/danganronpa.css:923 | `#drpg-hud` | background |  | danganronpa.css:12202 |
| styles/danganronpa.css:923 | `#drpg-hud` | backdrop-filter |  | danganronpa.css:12202 |
| styles/danganronpa.css:923 | `#drpg-hud` | box-shadow |  | danganronpa.css:12202 |
| styles/danganronpa.css:923 | `#drpg-hud` | font-family |  | danganronpa.css:7870 |
| styles/danganronpa.css:1163 | `#drpg-despair` | border-radius |  | danganronpa.css:12202 |
| styles/danganronpa.css:1163 | `#drpg-despair` | background |  | danganronpa.css:12202 |
| styles/danganronpa.css:1163 | `#drpg-despair` | backdrop-filter |  | danganronpa.css:12202 |
| styles/danganronpa.css:1163 | `#drpg-despair` | box-shadow |  | danganronpa.css:12202 |
| styles/danganronpa.css:1209 | `#drpg-despair .drpg-despair-name` | color |  | danganronpa.css:7734 |
| styles/danganronpa.css:1353 | `.character-header-sheet .drpg-actions-section` | flex-direction |  | danganronpa.css:12148 |
| styles/danganronpa.css:1353 | `.character-header-sheet .drpg-actions-section` | align-items |  | danganronpa.css:12148 |
| styles/danganronpa.css:1353 | `.character-header-sheet .drpg-actions-section` | gap |  | danganronpa.css:12148 |
| styles/danganronpa.css:1573 | `.drpg-action-panel` | background |  | danganronpa.css:7814 |
| styles/danganronpa.css:1667 | `.drpg-action-button:hover:not(:disabled)` | border-color |  | danganronpa.css:7727! |
| styles/danganronpa.css:1680 | `.drpg-action-button .drpg-action-name` | overflow-wrap |  | danganronpa.css:6474 |
| styles/danganronpa.css:1690 | `.drpg-action-button .drpg-action-cost` | opacity |  | danganronpa.css:7767 |
| styles/danganronpa.css:1888 | `.drpg-inventory-group .drpg-group-count.full` | color |  | danganronpa.css:7741 |
| styles/danganronpa.css:2474 | `body.drpg-theme-monokuma-legacy .drpg-call-button .drpg-action-name` | font-size | yes | danganronpa.css:8350! |
| styles/danganronpa.css:2474 | `body.drpg-theme-monokuma-legacy .drpg-call-button .drpg-action-name` | line-height |  | danganronpa.css:8350 |
| styles/danganronpa.css:2941 | `body.drpg-pixel-font .drpg-action-button .drpg-action-cost` | font-size |  | danganronpa.css:6490 |
| styles/danganronpa.css:2999 | `.character-header-sheet .name-row .drpg-advance-button` | min-height |  | danganronpa.css:6452 |
| styles/danganronpa.css:2999 | `.character-header-sheet .name-row .drpg-advance-button` | padding |  | danganronpa.css:6452 |
| styles/danganronpa.css:3604 | `.drpg-row-button` | width |  | danganronpa.css:6458 |
| styles/danganronpa.css:3604 | `.drpg-row-button` | height |  | danganronpa.css:6458 |
| styles/danganronpa.css:3604 | `.drpg-row-button` | margin-left |  | danganronpa.css:6458 |
| styles/danganronpa.css:3652 | `.drpg-row-present i` | color |  | danganronpa.css:3701 |
| styles/danganronpa.css:6058 | `.drpg-popup` | border-radius |  | danganronpa.css:13271 |
| styles/danganronpa.css:6058 | `.drpg-popup` | background |  | danganronpa.css:13271 |
| styles/danganronpa.css:6139 | `.drpg-popup-title` | padding |  | danganronpa.css:13276 |
| styles/danganronpa.css:6139 | `.drpg-popup-title` | font-size |  | danganronpa.css:13276 |
| styles/danganronpa.css:6139 | `.drpg-popup-title` | letter-spacing |  | danganronpa.css:13276 |
| styles/danganronpa.css:6213 | `.drpg-popup-body` | padding |  | danganronpa.css:13296 |
| styles/danganronpa.css:6213 | `.drpg-popup-body` | font-size |  | danganronpa.css:13296 |
| styles/danganronpa.css:6808 | `.drpg-hud-elapsed` | font-size |  | danganronpa.css:13144 |
| styles/danganronpa.css:6808 | `.drpg-hud-elapsed` | letter-spacing |  | danganronpa.css:13144 |
| styles/danganronpa.css:6808 | `.drpg-hud-elapsed` | text-transform |  | danganronpa.css:13144 |
| styles/danganronpa.css:6808 | `.drpg-hud-elapsed` | opacity |  | danganronpa.css:13144 |
| styles/danganronpa.css:6844 | `#drpg-player-status` | border-radius |  | danganronpa.css:12202 |
| styles/danganronpa.css:6844 | `#drpg-player-status` | background |  | danganronpa.css:12202 |
| styles/danganronpa.css:6891 | `#drpg-player-status .drpg-status-value` | color |  | danganronpa.css:9445! |
| styles/danganronpa.css:6904 | `#drpg-player-status .is-hope .drpg-status-value` | color |  | danganronpa.css:9480! |
| styles/danganronpa.css:6958 | `#drpg-player-status .drpg-status-pip` | color |  | danganronpa.css:9451! |
| styles/danganronpa.css:6981 | `#drpg-player-status .drpg-status-pip.filled` | color |  | danganronpa.css:9471! |
| styles/danganronpa.css:7016 | `#drpg-player-status .drpg-free-move` | color |  | danganronpa.css:9471! |
| styles/danganronpa.css:7271 | `.drpg-safeword-button` | left |  | danganronpa.css:7536 |
| styles/danganronpa.css:7271 | `.drpg-safeword-button` | bottom |  | danganronpa.css:7536 |
| styles/danganronpa.css:7271 | `.drpg-safeword-button` | padding |  | danganronpa.css:7536 |
| styles/danganronpa.css:7271 | `.drpg-safeword-button` | min-height |  | danganronpa.css:7536 |
| styles/danganronpa.css:7271 | `.drpg-safeword-button` | border |  | danganronpa.css:9427! |
| styles/danganronpa.css:7271 | `.drpg-safeword-button` | background |  | danganronpa.css:9427! |
| styles/danganronpa.css:7271 | `.drpg-safeword-button` | color |  | danganronpa.css:9427! |
| styles/danganronpa.css:7314 | `body.drpg-pixel-font .drpg-safeword-button` | font-size |  | danganronpa.css:7543 |
| styles/danganronpa.css:7472 | `.drpg-gm-panel .drpg-gmp-section > summary` | padding |  | danganronpa.css:8407! |
| styles/danganronpa.css:7472 | `.drpg-gm-panel .drpg-gmp-section > summary` | font-size |  | danganronpa.css:8407! |
| styles/danganronpa.css:7472 | `.drpg-gm-panel .drpg-gmp-section > summary` | letter-spacing |  | danganronpa.css:8407 |
| styles/danganronpa.css:7472 | `.drpg-gm-panel .drpg-gmp-section > summary` | text-transform |  | danganronpa.css:8407 |
| styles/danganronpa.css:7472 | `.drpg-gm-panel .drpg-gmp-section > summary` | color |  | danganronpa.css:8407! |
| styles/danganronpa.css:7776 | `.character-header-sheet .hope-section h4, .character-header-sheet .resource-section h4` | color | yes | danganronpa.css:8455! |
| styles/danganronpa.css:7844 | `.drpg-safeword-button:hover` | background | yes | danganronpa.css:9433! |
| styles/danganronpa.css:8679 | `.application.sheet.actor .character-sidebar-sheet progress.progress-bar` | background-color | yes | danganronpa.css:9361! |
| styles/danganronpa.css:8679 | `.application.sheet.actor .character-sidebar-sheet progress.progress-bar` | border | yes | danganronpa.css:9361! |
| styles/danganronpa.css:8679 | `.application.sheet.actor .character-sidebar-sheet progress.progress-bar` | border-radius |  | danganronpa.css:14089! |
| styles/danganronpa.css:9361 | `.application.sheet.actor .character-sidebar-sheet progress.progress-bar` | border-radius |  | danganronpa.css:14089! |
| styles/danganronpa.css:12262 | `#countdowns .drpg-projects-gear, #countdowns .drpg-projects-fold` | border |  | danganronpa.css:14506! |
| styles/danganronpa.css:12262 | `#countdowns .drpg-projects-gear, #countdowns .drpg-projects-fold` | background |  | danganronpa.css:14506! |
| styles/danganronpa.css:12262 | `#countdowns .drpg-projects-gear, #countdowns .drpg-projects-fold` | color |  | danganronpa.css:14495! |
| styles/danganronpa.css:12277 | `#countdowns .drpg-projects-gear i, #countdowns .drpg-projects-fold i` | color |  | danganronpa.css:14513! |
| styles/danganronpa.css:12283 | `#countdowns .drpg-projects-gear:hover, #countdowns .drpg-projects-fold:hover` | color |  | danganronpa.css:14518! |
| styles/danganronpa.css:12468 | `.drpg-item-sheet .window-content` | background |  | danganronpa.css:14044 |
| styles/danganronpa.css:12474 | `.drpg-item-sheet .item-sheet-header` | padding-bottom |  | danganronpa.css:14062 |
| styles/danganronpa.css:12474 | `.drpg-item-sheet .item-sheet-header` | border-bottom |  | danganronpa.css:14062 |
| styles/danganronpa.css:12481 | `.drpg-item-sheet .item-sheet-header img.profile` | border-radius |  | danganronpa.css:14068 |
| styles/danganronpa.css:12481 | `.drpg-item-sheet .item-sheet-header img.profile` | border |  | danganronpa.css:14068 |
| styles/danganronpa.css:12723 | `:is(.drpg-window-tables, .drpg-rename-table) input[aria-invalid="true"]` | border-color |  | danganronpa.css:15375! |
| styles/danganronpa.css:12723 | `:is(.drpg-window-tables, .drpg-rename-table) input[aria-invalid="true"]` | box-shadow |  | danganronpa.css:15375! |
| styles/danganronpa.css:13596 | `#drpg-sound-launcher i` | -webkit-mask-image |  | stained-glass.css:561! |
| styles/danganronpa.css:13596 | `#drpg-sound-launcher i` | mask-image |  | stained-glass.css:561! |
| styles/danganronpa.css:14332 | `#pause.paused figcaption::before` | top |  | danganronpa.css:15051 |
| styles/danganronpa.css:14333 | `#pause.paused figcaption::after` | bottom |  | danganronpa.css:15056 |
| styles/danganronpa.css:14418 | `.application.sheet.actor .drpg-row-button, .application.sheet.actor .drpg-inventory-gro...` | width |  | danganronpa.css:14806 |
| styles/danganronpa.css:14418 | `.application.sheet.actor .drpg-row-button, .application.sheet.actor .drpg-inventory-gro...` | height |  | danganronpa.css:14806 |
| styles/danganronpa.css:14441 | `.application.sheet.actor .drpg-row-button i, .application.sheet.actor .drpg-inventory-g...` | font-size |  | danganronpa.css:14814 |
| styles/danganronpa.css:17516 | `.drpg-hud-track` | height |  | danganronpa.css:17516 |
| styles/stained-glass.css:483 | `body.drpg-theme-stained-glass #drpg-hud .drpg-hud-campaign` | font-size |  | stained-glass.css:3267 |
| styles/stained-glass.css:520 | `body.drpg-theme-stained-glass #sidebar-tabs` | background |  | stained-glass.css:3025! |
| styles/stained-glass.css:691 | `body.drpg-theme-stained-glass #drpg-events` | width |  | stained-glass.css:2426 |
| styles/stained-glass.css:885 | `body.drpg-theme-stained-glass .drpg-panel button:not(.drpg-action-button):not(.drpg-cal...` | content |  | stained-glass.css:885 |
| styles/stained-glass.css:885 | `body.drpg-theme-stained-glass .drpg-panel button:not(.drpg-action-button):not(.drpg-cal...` | position |  | stained-glass.css:885 |
| styles/stained-glass.css:1363 | `body.drpg-theme-stained-glass :is(.drpg-action-button, .drpg-call-button):is(.active, ....` | border-color | yes | stained-glass.css:4852! |
| styles/stained-glass.css:1397 | `body.drpg-theme-stained-glass :is(.drpg-action-button, .drpg-call-button) .drpg-action-...` | font-size |  | stained-glass.css:3905 |
| styles/stained-glass.css:1397 | `body.drpg-theme-stained-glass :is(.drpg-action-button, .drpg-call-button) .drpg-action-...` | line-height |  | stained-glass.css:3905 |
| styles/stained-glass.css:1401 | `body.drpg-theme-stained-glass :is(.drpg-action-button, .drpg-call-button) .drpg-action-...` | font-size |  | stained-glass.css:3910 |
| styles/stained-glass.css:1401 | `body.drpg-theme-stained-glass :is(.drpg-action-button, .drpg-call-button) .drpg-action-...` | letter-spacing |  | stained-glass.css:1654 |
| styles/stained-glass.css:1476 | `body.drpg-theme-stained-glass .character-header-sheet .tab-navigation nav.sheet-tabs` | display |  | stained-glass.css:4297 |
| styles/stained-glass.css:1623 | `body.drpg-theme-stained-glass .application.sheet.actor .character-sidebar-sheet` | background-color | yes | stained-glass.css:4875! |
| styles/stained-glass.css:1647 | `body.drpg-theme-stained-glass :is(.drpg-action-button, .drpg-call-button) .drpg-action-...` | font-size |  | stained-glass.css:3905 |
| styles/stained-glass.css:1647 | `body.drpg-theme-stained-glass :is(.drpg-action-button, .drpg-call-button) .drpg-action-...` | overflow-wrap |  | stained-glass.css:1670 |
| styles/stained-glass.css:1654 | `body.drpg-theme-stained-glass :is(.drpg-action-button, .drpg-call-button) .drpg-action-...` | font-size |  | stained-glass.css:3910 |
| styles/stained-glass.css:1670 | `body.drpg-theme-stained-glass :is(.drpg-action-button, .drpg-call-button) .drpg-action-...` | line-height |  | stained-glass.css:3905 |
| styles/stained-glass.css:1732 | `body.drpg-theme-stained-glass .drpg-popup-title` | background |  | stained-glass.css:2442 |
| styles/stained-glass.css:1732 | `body.drpg-theme-stained-glass .drpg-popup-title` | color |  | stained-glass.css:2442 |
| styles/stained-glass.css:1825 | `body.drpg-theme-stained-glass .character-header-sheet .character-traits .trait .trait-n...` | font-size |  | stained-glass.css:3839! |
| styles/stained-glass.css:2166 | `body.drpg-theme-stained-glass #drpg-popups` | top |  | stained-glass.css:3399! |
| styles/stained-glass.css:2166 | `body.drpg-theme-stained-glass #drpg-popups` | bottom |  | stained-glass.css:3399! |
| styles/stained-glass.css:2166 | `body.drpg-theme-stained-glass #drpg-popups` | left |  | stained-glass.css:3399! |
| styles/stained-glass.css:2310 | `body.drpg-theme-stained-glass #drpg-hud .drpg-hud-time-slot` | padding |  | stained-glass.css:3283 |
| styles/stained-glass.css:2709 | `body.drpg-theme-stained-glass #drpg-hud .drpg-hud-campaign.is-long` | font-size |  | stained-glass.css:3271 |
| styles/stained-glass.css:2712 | `body.drpg-theme-stained-glass #drpg-hud .drpg-hud-campaign.is-very-long` | font-size |  | stained-glass.css:3274 |
| styles/stained-glass.css:2786 | `body.drpg-theme-stained-glass .drpg-event` | overflow |  | stained-glass.css:3919 |
| styles/stained-glass.css:3168 | `body.drpg-theme-stained-glass #countdowns .countdown-tools .progress-tag` | font-size |  | stained-glass.css:3942 |
| styles/stained-glass.css:3399 | `body.drpg-theme-stained-glass #drpg-popups` | justify-content |  | stained-glass.css:3431 |
| styles/stained-glass.css:3399 | `body.drpg-theme-stained-glass #drpg-popups` | max-height |  | stained-glass.css:3431 |
| styles/components.css:3152 | `.application.drpg-window-case .drpg-data-table-box > table.drpg-data-table` | min-width |  | components.css:3818 |
| styles/components.css:3183 | `.application.drpg-window-case table.drpg-data-table col[data-drpg-col="vis"]` | width |  | components.css:3835 |
| styles/components.css:4552 | `.application.drpg-ui.drpg-window-trial .drpg-trial-frame .drpg-trial-top > .drpg-trial-...` | margin-top |  | components.css:4657 |

### A2. Rules every declaration of which is overridden (16)

| At | Selector | Declarations |
| --- | --- | --- |
| styles/danganronpa.css:817-820 | `.character-header-sheet .drpg-ultimate-value:empty::before` | 2 |
| styles/danganronpa.css:2941-2943 | `body.drpg-pixel-font .drpg-action-button .drpg-action-cost` | 1 |
| styles/danganronpa.css:3652-3654 | `.drpg-row-present i` | 1 |
| styles/danganronpa.css:6213-6216 | `.drpg-popup-body` | 2 |
| styles/danganronpa.css:6904-6906 | `#drpg-player-status .is-hope .drpg-status-value` | 1 |
| styles/danganronpa.css:7776-7779 | `.character-header-sheet .hope-section h4, .character-header-sheet .resource-section h4` | 1 |
| styles/danganronpa.css:7844-7846 | `.drpg-safeword-button:hover` | 1 |
| styles/danganronpa.css:8679-8683 | `.application.sheet.actor .character-sidebar-sheet progress.progress-bar` | 3 |
| styles/danganronpa.css:12723-12726 | `:is(.drpg-window-tables, .drpg-rename-table) input[aria-invalid="true"]` | 2 |
| styles/danganronpa.css:14332-14332 | `#pause.paused figcaption::before` | 1 |
| styles/danganronpa.css:14333-14333 | `#pause.paused figcaption::after` | 1 |
| styles/stained-glass.css:1397-1400 | `body.drpg-theme-stained-glass :is(.drpg-action-button, .drpg-call-button) .drpg-action-name` | 2 |
| styles/stained-glass.css:2709-2711 | `body.drpg-theme-stained-glass #drpg-hud .drpg-hud-campaign.is-long` | 1 |
| styles/stained-glass.css:2712-2714 | `body.drpg-theme-stained-glass #drpg-hud .drpg-hud-campaign.is-very-long` | 1 |
| styles/components.css:3183-3183 | `.application.drpg-window-case table.drpg-data-table col[data-drpg-col="vis"]` | 1 |
| styles/components.css:4552-4554 | `.application.drpg-ui.drpg-window-trial .drpg-trial-frame .drpg-trial-top > .drpg-trial-picker` | 1 |

### A3. Numeric colour literals that match a token (97 of 132)

| At | Property | Literal | Token |
| --- | --- | --- | --- |
| styles/base.css:204 | mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/danganronpa.css:3443 | background | `rgba(0, 0, 0, 0.22)` | channels of --drpg-shadow-rgb |
| styles/danganronpa.css:12876 | text-shadow | `rgba(255, 210, 63, 0.35)` | channels of --drpg-gold-rgb |
| styles/danganronpa.css:14842 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/danganronpa.css:17516 | -webkit-mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/danganronpa.css:17516 | -webkit-mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/danganronpa.css:17516 | mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/danganronpa.css:17516 | mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:448 | background | `#ffd38f` | = --drpg-sg-badge-tool |
| styles/stained-glass.css:448 | background | `rgba(7, 7, 10, 0)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:448 | background | `rgba(7, 7, 10, 0.5)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:448 | background | `rgba(7, 7, 10, 0.82)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:464 | text-shadow | `rgba(0, 0, 0, 0.85)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:464 | text-shadow | `rgba(0, 0, 0, 0.6)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:545 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:617 | text-shadow | `rgba(0, 0, 0, 0.8)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:617 | text-shadow | `rgba(0, 0, 0, 0.5)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:664 | background-image | `rgba(242, 238, 230, 0.055)` | channels of --drpg-bone-rgb |
| styles/stained-glass.css:664 | border-right | `rgba(242, 238, 230, 0.14)` | channels of --drpg-bone-rgb |
| styles/stained-glass.css:802 | text-shadow | `rgba(0, 0, 0, 0.85)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:802 | text-shadow | `rgba(0, 0, 0, 0.6)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:840 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:976 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1018 | background | `rgba(7, 7, 10, 0.5)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1030 | border-bottom | `rgba(242, 238, 230, 0.06)` | channels of --drpg-bone-rgb |
| styles/stained-glass.css:1035 | background | `rgba(242, 238, 230, 0.035)` | channels of --drpg-bone-rgb |
| styles/stained-glass.css:1047 | -webkit-mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:1047 | -webkit-mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:1047 | mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:1047 | mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:1293 | background | `rgba(7, 7, 10, 0.5)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1406 | color | `rgba(7, 7, 10, 0.7)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1410 | text-shadow | `rgba(0, 0, 0, 0.85)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:1410 | text-shadow | `rgba(0, 0, 0, 0.55)` | = --drpg-a8-frame-shadow |
| styles/stained-glass.css:1468 | background | `rgba(7, 7, 10, 0.4)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1533 | background-color | `rgba(7, 7, 10, 0.7)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1533 | box-shadow | `rgba(0, 0, 0, 0.6)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:1582 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1615 | text-shadow | `rgba(0, 0, 0, 0.9)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:1615 | text-shadow | `rgba(0, 0, 0, 0.7)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:1623 | background-image | `rgba(242, 238, 230, 0.055)` | channels of --drpg-bone-rgb |
| styles/stained-glass.css:1688 | text-shadow | `rgba(0, 0, 0, 0.9)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:1688 | text-shadow | `rgba(0, 0, 0, 0.7)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:1709 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1720 | box-shadow | `rgba(0, 0, 0, 0.5)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:1816 | background | `rgba(7, 7, 10, 0.45)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1816 | border | `rgba(242, 238, 230, 0.08)` | channels of --drpg-bone-rgb |
| styles/stained-glass.css:1825 | background | `rgba(7, 7, 10, 0.6)` | = --drpg-a8-tile-button-ground |
| styles/stained-glass.css:1848 | border | `rgba(242, 238, 230, 0.16)` | channels of --drpg-bone-rgb |
| styles/stained-glass.css:1848 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1892 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1897 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1947 | border-top | `rgba(242, 238, 230, 0.12)` | channels of --drpg-bone-rgb |
| styles/stained-glass.css:1956 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1956 | border-color | `rgba(242, 238, 230, 0.35)` | channels of --drpg-bone-rgb |
| styles/stained-glass.css:1967 | background-color | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1971 | background | `rgba(7, 7, 10, 0.4)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:1976 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:2008 | background-color | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:2077 | border | `rgba(242, 238, 230, 0.25)` | channels of --drpg-bone-rgb |
| styles/stained-glass.css:2077 | background | `rgba(7, 7, 10, 0.6)` | = --drpg-a8-tile-button-ground |
| styles/stained-glass.css:2115 | border-color | `rgba(242, 238, 230, 0.35)` | channels of --drpg-bone-rgb |
| styles/stained-glass.css:2116 | border-color | `rgba(242, 238, 230, 0.35)` | channels of --drpg-bone-rgb |
| styles/stained-glass.css:2371 | background | `rgba(7, 7, 10, 0.92)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:2447 | color | `rgba(7, 7, 10, 0.65)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:2560 | background | `rgba(7, 7, 10, 0.5)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:2560 | border | `rgba(255, 85, 102, 0.75)` | channels of --drpg-phase-trial-rgb |
| styles/stained-glass.css:2591 | background | `rgba(7, 7, 10, 0.5)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:2731 | background | `rgba(7, 7, 10, 0.35)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:2794 | -webkit-mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:2794 | -webkit-mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:2794 | -webkit-mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:2794 | -webkit-mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:2794 | mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:2794 | mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:2794 | mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:2794 | mask-image | `#000` | = --drpg-a8-mask-ink |
| styles/stained-glass.css:3035 | text-shadow | `rgba(0, 0, 0, 0.85)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:3035 | text-shadow | `rgba(0, 0, 0, 0.6)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:3356 | background | `rgba(7, 7, 10, 0.5)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:3369 | background | `rgba(7, 7, 10, 0.5)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:4069 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:4312 | background | `rgba(7, 7, 10, 0.5)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:4410 | text-shadow | `rgba(0, 0, 0, 0.8)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:4410 | text-shadow | `rgba(0, 0, 0, 0.5)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:4434 | box-shadow | `rgba(0, 0, 0, 0.5)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:4434 | box-shadow | `rgba(0, 0, 0, 0.5)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:4480 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:4487 | background-image | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:4571 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
| styles/stained-glass.css:4977 | text-shadow | `rgba(0, 0, 0, 0.9)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:4977 | text-shadow | `rgba(0, 0, 0, 0.75)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:4980 | background-color | `rgba(7, 7, 10, 0.72)` | = --drpg-a8-tile-ground |
| styles/stained-glass.css:4989 | background | `rgba(7, 7, 10, 0.72)` | = --drpg-a8-tile-ground |
| styles/stained-glass.css:5079 | box-shadow | `rgba(0, 0, 0, 0.5)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:5079 | box-shadow | `rgba(0, 0, 0, 0.5)` | channels of --drpg-shadow-rgb |
| styles/stained-glass.css:5160 | background | `rgba(7, 7, 10, 0.55)` | rgb of --drpg-sg-ink, no channel token |
