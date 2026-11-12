# E55 - CSS consolidation with a snapshot gate and the sheet split: the plan

Preparation only (the prep-54 work line, 12.11.2026). Read at `origin/main` =
`4dfac3a93ef22144db14121d1fbbde82e4ef0988` (1.2.108). E55 is planned as 1.2.119, after E54 and the stages
before it, which add CSS (section 6). The inventory is `INVENTORY.md` beside this file; it names every
target by selector and file, with 4dfac3a9's line as a help only, and `finders/` holds the CSS walker and
the readings that produced it, to be run again at the base.

## 1. The owner's words (translated)

"Freeze the look first, then one colour and size rule per surface per theme with today's winning value,
colour literals to tokens, about 300 lines of dead rules (css-lint) removed, defensive Daggerheart
selectors described; in stained-glass.css dead font-size, #drpg-events width, duplicate glyphs, dead
launcher removed, one checkbox and brush definition; Legacy consolidated the same way; the !important
budget shrinks and is gated. Done when each surface has one rule place per theme, the sheet split by
surface."

## 2. What the inventory measured (summary)

| Item | Measured at 4dfac3a9 | Inventory |
| --- | --- | --- |
| The sheets | 7 served (base, motion, danganronpa, stained-glass, pixel-icons, components, narrow, in that order, no `@layer`): 31,022 lines, 3,776 rules, 869 `!important` | 1.1 |
| Which is which theme | danganronpa.css is **not** Legacy only: 1,615 of its rules apply in both themes, 124 are Legacy-only, 109 glass-only. Legacy's look is mostly its unscoped rules, which stand under the glass until a glass rule overrides them | 1.1 |
| The lint | green; every row of tools/css-budget.json equals its count; the ratchet is already two-sided and in CI (`check css`) | 1.2, 1.3 |
| The `!important` budget | already gated and only falls; "shrinks and is gated" = each removal lowers its row in the same commit | 1.3 |
| The snapshot gate | audit/style-sweep.mjs + audit/style-baseline.json: 58 pages x 2 themes x 4 sizes, 33 properties, the first element per surface. **75 of 104 listed surfaces are frozen; the character sheet by one (`number-field`)**; chat cards, the Despair rail, the Event panel, the tray not at all; no `::before` and no mask read (so the brush, glyphs, Hope star and checkbox tick are invisible to it); **not run in CI**; not run for the inventory, so whether today's sheets still match the baseline is unmeasured | 1.4 |
| Proven dead | about 355 lines, 36 `!important`: the `.drpg-action-button[data-drpg-crisis=...]` block (danganronpa.css, 28 rules, ~242 lines: nothing writes the attribute, the `injectCrisisPanel` its comment names is gone); 120 declarations overridden by a later rule with the identical selector (16 whole rules, 49 lines, 8 `!important`); 3 overridden in both themes; 4 by containment (the glass Hope star) | 2.1-2.4 |
| Conditional | ~17 declarations dead if every character sheet root carries `.application.sheet.actor` (not provable here) | 2.5 |
| Unproven, defensive | 704 rules / 4,703 lines aimed at Foundry or Daggerheart markup; 12 Foundry ids no script writes (`#chat-log` 30 rules, `#context-menu`, ...), each settled only by a live DOM read | 2.6, 6 |
| stained-glass.css | 9 dead font-sizes; `#drpg-events` width: 691's `width` dead, 2423-2428 a duplicate rule of the same token, narrow.css 127 wins stacked; the "dead launcher" is the sound launcher's speaker glyph (danganronpa.css `#drpg-sound-launcher i`), beaten in both themes by an unscoped `!important` gear in stained-glass.css; one drawn glass checkbox (+1 accent rule), five Legacy accent places; the brush `::before` written five times, with two insets (-3 and -5 px) | 3 |
| Surfaces | the actor sheet: 314 colour places (170 `!important`), 133 font-size; its rules in every 500-line band of danganronpa.css (562 rules) and stained-glass.css (187); the window chrome 125 colour places over three sheets; the tiles, the Event panel and the launchers are close to one place already | 4 |
| Colour literals | the lint's 353 are mostly `rgba(var(--x-rgb), a)` (237 of danganronpa.css's 246); the 102 numeric literals are mostly stained-glass.css's 92; the ink `7,7,10` at various alphas is 36 of them, with no alpha token for `--drpg-sg-ink` | 5 |

Spot-checked by hand after the inventory (12.11.2026): `data-drpg-crisis`, `drpgCrisis` and
`injectCrisisPanel` have no hit in scripts/, audit/, tools/ or macros/, and danganronpa.css holds 30
mentions of the attribute; stained-glass.css's unscoped `#drpg-sound-launcher i` sets the gear with
`!important` over danganronpa.css's speaker; the two glass `#drpg-events` rules both set
`width: var(--drpg-events-w)`. The rest is the inventory's reading.

The owner's "about 300 lines (css-lint)" does not match what css-lint reports: its dead-class count is 0
of 877, and its duplicate detector finds 0. The ~355 proven lines come from two readings the lint does not
make (an attribute nobody writes, and a declaration a later identical selector overrides). C2 below makes
the second a lint part.

## 3. The commits

Order: freeze, then gates, then deletions that cannot change a pixel, then consolidations surface by
surface, each measured against the frozen look, then the sheet split. Every commit that removes an
`!important` or a literal lowers tools/css-budget.json in the same commit (`node tools/css-lint.mjs
--write`). "QUICK" is METHOD.md section 3. "SWEEP" is `node audit/style-sweep.mjs` against the baseline,
in Chromium, both themes, with its controls read first; its summary line goes in the message.

### Step 0 - freeze the look (no CSS changes)

| Id | What | Proof |
| --- | --- | --- |
| F0 | Run SWEEP at the base. If it is not clean, the differences are read and either accepted with the stage that caused them named, or reported as a regression before E55 goes on. | The sweep's own summary line; nothing else may start on an unmeasured baseline. |
| F1 | Surface rows for what the sweep does not freeze: the sheet's parts on `style-harness.html?sheet=parts` (the action panel, a tile in each cost state, the Calls, the header's Hope, traits and resources, the sidebar's bars, the tab bar, an inventory row, the item sheet), the chat cards (a roll card, an action card, a GM card), the Despair rail, the Event panel, `#countdowns`. Each a row in `STYLE_SURFACES` and the baseline written for those rows only (`--accept`). | Red first: the sweep's control that must read a restyled surface as a fault, planted on one new row. |
| F2 | The pseudo-elements and masks: the snapshot reads `::before`/`::after` (`content`, `inset`, `background`, `filter`, `opacity`) and `mask-image` for the surfaces that draw with them (the brush, the glyphs, the Hope star, the checkbox tick). | As F1. |
| F3 | Screenshots of both themes at 1920x1080 and 1366x768 of the sheet, the GM page and the player page, kept outside the repository, as the picture the numbers cannot see (code.md: "the numbers can be clean and the picture wrong"). | Kept for the end review. |

Whether CI runs the sweep is Q-E55-1; the default keeps it a commit-time step (CI installs no browser).

### Step 1 - gates

| Id | What | Proof |
| --- | --- | --- |
| C1 | A css-lint part for declarations overridden by a later rule with the identical selector under the same at-rules (finders/override.mjs's reading), with a budget row per sheet (`overridden`). | Red first on a planted pair; the budget written at the base's count (120). |
| C2 | A css-lint part for attribute selectors `[data-drpg-*]` no script writes (the crisis block's kind), with the same family rule as `deadClasses` for built names. | Red first on a planted rule; the base count (the crisis block, `[data-drpg-gm]`'s dead arm). |

### Step 2 - deletions that cannot change a pixel

| Id | What | Proof |
| --- | --- | --- |
| D1 | The crisis block (`.drpg-action-button[data-drpg-crisis=...]`, 28 rules, its header comment). The five `--drpg-pix-*` tokens only it reads are not removed (tokens are also read by name at run time: ui-kit.mjs, projects-tray.mjs). | C2's count to 0; budget -28 `!important`; SWEEP unchanged; tiers 0-1 (tests read the sheets by text: inventory risk 3) |
| D2 | The 120 overridden declarations and 16 whole rules (inventory 2.2), file by file, except the fallback pair in danganronpa.css (`height: 1.25em; height: 1lh`). | C1's count down; budget; SWEEP unchanged |
| D3 | 2.3 and 2.4 (overridden in both themes, the Hope star by containment). | SWEEP unchanged; F2's mask rows for the star |
| D4 | stained-glass.css's named items with no visible effect: the 9 dead font-sizes (in D2 already, listed in the message), `#drpg-events`'s duplicate width rule (keep one, the token-reading one), the speaker glyph: the gear written once in danganronpa.css's `#drpg-sound-launcher i` and the unscoped stained-glass.css rule with its two `!important` removed. | SWEEP unchanged, F2's mask row for the launcher in both themes |

### Step 3 - one rule place per surface per theme

One commit per surface, smallest first, so the method is tried where it is cheap: the launchers, the
Event panel, the tiles, the pause screen, the strip, the HUD, the GM panel, the tray, the messenger,
popups and notices, the chat cards, the window chrome. For each:

1. Read every rule that sets colour, font-size or width on the surface (finders/surf.mjs), per theme.
2. Write the winning value today (the sweep's reading, not the source's) into one rule per theme: the
   unscoped base rule in danganronpa.css for what both themes share or Legacy's value, one
   `body.drpg-theme-stained-glass` rule in stained-glass.css for the glass; widths through their tokens
   (`--drpg-events-w` and the like), never a literal per theme (narrow.css wins by order: code.md).
3. Delete the restatements; lower `!important` only where its rival was one of the deleted rules.
4. Proof: SWEEP unchanged on the surface's rows in both themes at all four sizes; R1323's cascade; QUICK;
   `node tools/check.mjs contrast` where a colour moved.

Then the named definitions:

| Id | What | Proof |
| --- | --- | --- |
| B1 | One brush: one `::before` rule over an `:is()` of the six roles (panel buttons, the GM panel's, mini buttons, the sheet's, the messenger's, the tiles' plates), the colours staying per role (`--brush`). The two insets (-3 px for the panel buttons since stained-glass.css's second statement, -5 px for the sheet) become a token per role. | F2's `::before` rows unchanged; screenshots |
| K1 | One checkbox per theme: the glass's drawn definition stays where it is; Legacy's five `accent-color` places become one token on one selector (components.css, the kit's). | F2's rows; the settings window and the item tables window under Legacy compared by screenshot (which of the two equal rules wins there today was not measured) |
| L1 | Colour literals to tokens: a glass ink channel (`--drpg-sg-ink-rgb`) and a small set of named grounds for the near-miss darks (36 of the 102 numeric literals); the five near-misses merged only where contrast allows. | budget `colourLiterals` down; `check contrast`; SWEEP |

### Step 4 - the sheet's CSS split by surface

The sheet's rules (danganronpa.css 562, stained-glass.css 187, components.css 22) gathered into sections
by part, as the inventory proposes: frame, header, sidebar, actions, inventory, tabs, item sheet (this
matches E54's sheet-*.mjs files). **As sections inside the existing sheets by default, not as new served
files** (Q-E55-2): a new file changes every moved rule's place in the cascade relative to every equal
rule between, and the order decides wherever the same selector appears twice (inventory risk 2). Within a
sheet, a block moves only past rules it does not tie with; the reading of ties is C1's walker extended to
"same specificity, overlapping element" by R1323's `styleCascade` on the sheet's stand-in.

| Id | What | Proof |
| --- | --- | --- |
| S1..S7 | One part a commit, both themes. | SWEEP on F1's sheet rows unchanged; R1323; tests that cut the sheets by text (inventory risk 3) read in the same commit |

### Step 5 - describe the defensive selectors

| Id | What |
| --- | --- |
| X1 | A short index (in CONTRIBUTING.md's "The CSS contract" or a doc beside it: Q-E55-3) of the six groups of rules aimed at Foundry or Daggerheart markup (inventory 6), each with what it defends against, the version its comment names, and the 12 Foundry ids that one live DOM read would settle: a LIVE id for that read. Nothing deleted. |

### Step 6 - close

The budget's final counts in the end report; `!important` and literals per sheet before and after.

About 30 commits: 4 + 2 + 4 + about 12 surfaces + 3 + 7 + 1.

## 4. Risks

| Id | Risk | What holds it |
| --- | --- | --- |
| R1 | The freeze has gaps (the sheet, cards, rail, panel, tray, pseudo-elements, masks); a "pure" consolidation there is measured by nothing. | Step 0 before anything. |
| R2 | Order is meaning: no `@layer`; moving a rule changes which equal rule it beats. | Sections inside the sheets by default; SWEEP per commit. |
| R3 | Tests read the sheets by name and by text (danganronpa.css named in 44 test-file places, ...); a moved selector can make a test fail or pass on nothing. | grep the tests for a selector before moving or deleting it; tiers 0-1 per commit. |
| R4 | Generated regions: pixel-icons.css (tools/glyph-map.mjs) and danganronpa.css's chrome icon block (tools/chrome-icons.mjs) are rewritten by their generators. | Change them only through the generators. |
| R5 | Taking `!important` off a winner revives what it was beating, sometimes a Daggerheart rule this repository cannot see (E44 C6's protected lines). | Only a rival that this stage deleted lets an `!important` go; R1323. |
| R6 | Theme scoping is asymmetric: a rule moved from unscoped to `body:not(...)` gains specificity and can beat kit rules (components.css's budget is 0, it wins by order). | Keep Legacy's values unscoped where they are today. |
| R7 | Merging near-miss colours changes contrast ratios. | `check contrast` and tools/contrast-pairs.json per merge. |
| R8 | The sweep needs Chromium and Playwright from audit/harness (`npm ci`), a few minutes a run, and its baseline is 1.1 MB: an accepted row is a reviewed decision, not a refresh. | Accept by surface (`--accept <id>`), never `--write`, once F1 is in. |
| R9 | The conditional set (2.5) and the defensive rules stay: removing them is a table's decision. | Listed, not removed. |

## 5. Effort

About 30 commits. Each CSS commit costs a SWEEP (minutes; both themes, four sizes, 58+ pages) plus QUICK
(tiers 0-1: 200-244 s). Step 0 is the expensive one to write (new surface rows and pseudo-element reads,
with their controls); step 3 is reading work per surface. My estimate, not a measurement: three to four
working sessions, the sheet's part (step 4) alone one of them.

## 6. Open lines touching the same files (12.11.2026)

`git diff --numstat` against each line's merge base. All ship before E55; they add CSS the inventory has not
read, so C1's and C2's counts and the surface tables are re-read at the base.

| Sheet | Lines (+added -removed) |
| --- | --- |
| danganronpa.css | fervent-sagan-gme4vt +270 -1, e61-62 +269, e92 +245, e72 +55 -4, e100 +19 -19, gaps-a +10 -1, e93 +9 |
| stained-glass.css | e61-62 +29, e92 +29, fervent-sagan-gme4vt +29, e100 +5 -5, e72 +2 |
| components.css | e64 +52 -13, e92 +33 -3, fervent-sagan-gme4vt +33 -3, e64-inv +31 -7, e93 +11, gaps-a +11, gaps-61 +7 -1, e101 +6 -7, e100 +2 |
| narrow.css, base.css | none |

## 7. Open questions for the owner (each with the default the stage runs on)

| Id | Question | Default |
| --- | --- | --- |
| Q-E55-1 | Run the style sweep in CI (needs a browser in the job)? | No: a commit-time step, its summary line in each commit message, as today. |
| Q-E55-2 | The sheet split by surface: sections in the existing sheets, or new served files (each changes the cascade order of what it takes)? | Sections. |
| Q-E55-3 | Where the index of defensive selectors lives. | CONTRIBUTING.md's "The CSS contract", one subsection. |
| Q-E55-4 | The "300 lines of dead rules" are ~355 proven lines of other kinds (section 2); the css-lint finds none. Is that the set meant? | Yes, and C1/C2 make the lint find them from now on. |
| Q-E55-5 | The brush's two insets (-3 px panel buttons, -5 px the sheet): keep both as role tokens, or one value chosen on screenshots? | Keep both (today's winning values). |
| Q-E55-6 | A target for the `!important` budget per sheet at the stage's end? | None stated: the ratchet records what the deletions free (36 proven at the base, more from step 3). |
