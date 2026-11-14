# Contributing

Thanks for looking. This is a Foundry VTT module - plain ES modules and CSS, no
build step, no bundler. The module installs nothing: what you check out is what
ships, and the package is `git archive` of the tree. Its tests do install
something: `npm ci` in `audit/harness`, once, brings jsdom, ESLint, espree and
Playwright (no browser download), and none of it ships.

## Getting it running

1. Clone into your Foundry `Data/modules/` folder as `danganronpa-rpg`.
2. Enable it in a world running [Daggerheart](https://foundryvtt.com/packages/daggerheart)
   2.6 or later on Foundry v14.
3. Edit a file, reload the browser. There is nothing to compile.

## Before you open a pull request

Run the one command CI runs. It takes about eight minutes (the suite five, the
scenarios three, lint and the checks ten seconds; measured 24.09 on four cores).

```bash
cd audit/harness
npm ci        # once: the harness's dependencies (the module itself needs nothing)
npm test      # lint, tools/check.mjs, the gate's self-test, the suite, every ci scenario
```

`npm run quick` is the ten-second part: lint, the checks (the Polish file's
coverage of `config.mjs` among them) and the gate's self-test. `npm test`
exits 1 when anything is red, prints a table, and keeps each run's log and
results in `audit/harness/results/`. The harness boots the checkout it sits
in; set `DRPG_REPO` to point it at another one. One scenario on its own:
`node cluster.mjs scenarios/40-flow.mjs --verbose`.

The suite must report **0 failed**. It also reports a number of skipped tests -
each one stands on an `env.*` probe (a real browser's layout, a canvas with a
width, loaded fonts, a CSS cascade) and says which. The headless run's list is
`audit/harness/skip-baseline.json`, test by test: 01-runtests fails on a skip
that is not in it and on one in it that now answers, and on any `world.*` skip,
since the harness builds its own world. If something that used to be answerable
has stopped being so, that is a regression.

If you touched the theme or the layout, also open `audit/glass-harness.html`
over a local server and look at it at a few sizes - the curtain's self-check can
read clean while the picture is wrong, which is how one bug got through.

```bash
python3 -m http.server 8765      # then open /audit/glass-harness.html
```

## What a change should carry

**A test, where one is possible.** The suite is in `scripts/tests*.mjs` (the
runner in `tests.mjs`, the tests in `tests-tier0.mjs`, `tests-tier1.mjs` and
`tests-tier2.mjs`, the shared tools in `tests-kit.mjs`, in `tests-lint.mjs` the
contract's detectors, which `node tools/check.mjs contract` also runs, and in
`tests-flows.mjs` the flows, every way a player reaches the GM) and runs inside a real world; the
scenarios in `audit/harness/scenarios/` drive four clients at once (five in
`17-assistant`) and are the place for anything involving sockets, permissions or
two people doing things in the wrong order.

**Both languages.** Every string is a key in `lang/en.json` with a twin in
`lang/pl.json`. Prose that lives in `scripts/config.mjs` is covered by
`tools/config-prose.mjs`.

**The reason, in a comment.** This codebase explains itself at length on
purpose: where a number came from, what was tried before, what a reading
measured. If you change a number, the comment that chose it has to change with
it - a comment that no longer matches its code is worse than none.

**Plain hyphens.** `-`, not `—`, in code, comments and prose alike.

## The CSS contract

The stylesheets are held by tools, so a rule that looks right is measured before it is trusted (E44, 04.11.2026).
What every change to `styles/` keeps:

- **Tokens, not literals.** A colour, a size on the floor's scale, a radius and a shadow are custom properties
  (`--drpg-*`), defined on `:root` or on a theme's body class. In `styles/components.css` (the window kit, from
  E44 C3) a literal is not allowed at all; in the older sheets the lint counts them and the count only falls.
- **One rule per role, per theme.** Stained Glass and Monokuma Legacy are both supported (D29): a component's
  Legacy variant is the same rule reading the same tokens with Legacy's values, not a second tree of rules.
- **No `!important` in `components.css`, and the budget falls.** `tools/css-budget.json` holds each sheet's
  counts; a count above its budget is red (a rule added one), and a count below it is red until the budget is
  lowered in the same commit (`node tools/css-lint.mjs --write`, which never raises one).
- **A migrated surface takes its old rules with it.** A surface moved onto the kit loses every rule that styled it
  in the old sheets in the same commit, and is measured - the cascade test (`tests-kit.mjs` `styleCascade`) and
  the style sweep - and looked at on a screenshot in both themes. A kit rule that loses to an old `!important` can
  pass every test while the screen does not change. One exception, since E44 C6: seven `!important` declarations of
  the A8 surfaces stay in the old sheets, each under a "Stays here (E44 C6)" line, because what they are held against
  is Foundry's own sheet, which no harness reads; E49 reads them at a table and homes them.
- **No width that assumes a desk.** No component is fixed wider than 390 px, and nothing assumes a screen of
  1024 px or more: widths go through `min()`, `@container` or the `drpg-stacked` layout. A window a player opens is
  read at 390x844.
- **The breakpoints are `scripts/settings.mjs`'s** (`BREAKPOINTS`) and nowhere else; the stylesheet keys off the
  classes it sets. `styles/narrow.css` loads last.
- **No text under the floor.** Under Stained Glass the floor is 21 px scaled (`--drpg-sg-floor`); under Monokuma
  Legacy it is 10 px per rung (the `--font-size-*` rungs and `--drpg-text-xs`).
- **AA contrast in both themes.** Small text 4.5:1, large text 3:1, for every pair of `tools/contrast-pairs.json`;
  a pair below it is written there with its ratio as `known`, never raised to pass.
- **A button's colour is its role's** (E22, D11; `scripts/ui-kit.mjs` `BUTTON_ROLES`, components.css's role rules,
  which set the `--drpg-kit-face-*` tokens the old sheets' footer rules read). Red means one of two things and
  nothing else: for a player the road through the GM, with a sentence about the GM beside it (R121); for a GM an
  action that cannot be undone, which is never the default under Enter. A warning stays red; information is the
  kit's `box("info")`, neutral. R1373 reads the rule in both themes.

  | Role | Class | Face | Default under Enter |
  | --- | --- | --- | --- |
  | primary | `drpg-role-primary` | Bone with the stronger Bone edge (Legacy); the glass's Bone brush | yes |
  | gmRoute | `drpg-role-gm-route` + `drpg-gm-route` | the GM's red, one token (`--drpg-kit-role-gm-route`) | may be |
  | close, cancel | `drpg-role-close`, `drpg-role-cancel` | the Bone wash; the role's own word | may be |
  | secondary | `drpg-role-secondary` | the Bone wash | never |
  | destructive | `drpg-role-destructive` + `drpg-destructive` | crimson under the raster (Legacy); the GM red under the raster (glass) | never |

What the lint counts, per sheet (`scripts/tests-css.mjs`, read by the suite too):

| Detector | What it counts |
| --- | --- |
| `importantCount` | each `!important`, `! important` with a space as well, comments aside |
| `colourLiterals` | each declaration that is not a custom property and holds a hex, `rgb(a)()` or `hsl(a)()` colour |
| `strayCommentEnds` | a comment end with no start - 0, always, with no budget |
| `duplicateRules` | a rule written again with the same selector list and declarations, under the same at-rules |
| `deadClasses` | a `.drpg-*` the sheets style that no script writes (the suite's R2, the same function) |
| `overriddenDeclarations` | a declaration that, on every complex selector of its rule, a twin on the identical selector under the identical at-rules always beats - `!important` first, then later in module.json's order; the sheets read as one cascade, a fallback pair inside one rule kept (E55 C1, budget row `overridden`, R6100) |
| `deadAttributes` | a `[data-drpg-*]` the sheets select on that no script writes, in markup, through `dataset`, as a family or from a named prefix and a template's tail (E55 C2, budget row `deadAttributes`, R6100) |

The commands:

```bash
node tools/check.mjs css         # the lint against tools/css-budget.json (also in npm run quick and CI)
node tools/check.mjs contrast    # every pair of tools/contrast-pairs.json in both themes
node audit/style-sweep.mjs       # the computed style of the kit's surfaces in Chromium against audit/style-baseline.json
```

The sweep needs Chromium (Playwright from `audit/harness`), which CI does not install: whoever changes what a
surface looks like runs it, accepts only the surfaces that change (`--accept <id>`) and reads the screenshots.
Since E55 (14.11.2026) its baseline names the Chromium build that wrote it (`chromium`), and a run in another build
is red before it reads a page: the baseline written at e258b135 read 1176 differences on its own tree in another
build, drift no row could tell from a change. Beside it, E55's two freezes, each bound to its build the same way:
`node audit/look-freeze.mjs` (the sheet's parts and the glass pages, the `::before`/`::after` and the masks: the
brush, the glyphs, the Hope marks; about 15 s) and `node audit/style-freeze.mjs` (every captured window in both
languages, both themes, four sizes; about 13 minutes).

### What the sheets hold against Foundry and Daggerheart (E55 X1)

About 700 rules style markup the module does not write: Foundry's chrome and windows, Daggerheart's sheet, chat cards,
countdowns and Fear (read at 4dfac3a9, `docs/dev/e55/INVENTORY.md` section 6: 704 rules, pixel-icons.css out). No
grep in this repository can prove one of them live or dead, so none is removed by a reading of this repository; each
is named here by the section that holds it, with what it defends against and the markup it was written for. A rule
added against foreign markup goes into one of these groups and says which version of the markup it read.

| Group | What it defends against | Where (section headings; danganronpa.css unless named) | Written against |
| --- | --- | --- | --- |
| The system's colour | Daggerheart's own palette showing through - its gold furniture, purple glows and footers, red where the module means Hope or the GM | "THE LAST OF DAGGERHEART'S COLOUR", "Hope is gold, not red", "NOTHING IN THIS MODULE IS PURPLE", "THE PURPLE WAS IN THE FOOTER ALL ALONG", "THE RED WINS THE ARGUMENT", the chat cards' "no purple glow, no Daggerheart gold" | Daggerheart 2.10.x as the comments name it; mostly `!important` because the system's rules are as specific |
| Surfaces this game does not use | the system's effects readout, damage and healing buttons, the combat tracker, the guide's spare parts | "surfaces this game does not use" (`#combat-popout`, `#effects-panel`, `#effects-display`), "NO DAMAGE, NO HEALING, NO RELOAD", "DAGGERHEART'S STATUS ICONS ARE NOT PART OF THIS INTERFACE" (since E55 by Daggerheart's own names only, R6103), "TRIMMING WHAT THE GUIDE DOES NOT USE" | Daggerheart 2.10.11's ui list (countdowns, effects-display, resources, the darkness slider), as the chrome rule's comment reads it |
| Fonts and icon fonts | Signika, Montserrat, Cinzel and Modesto Condensed inside the module's interface; Font Awesome glyphs turned into wrong letters by the pixel face | "THE FONT REALLY MEANS EVERYWHERE", "THE FIVE THAT WERE STILL WEARING FONT AWESOME", the GENERATED chrome icon block (tools/chrome-icons.mjs; edited only through it); stained-glass.css's VT323 weights and the Hope track's `fa-diamond` | Font Awesome 7 by `--fa-style-family` only since E55 (R6104, LIVE-E55-03) |
| The system's sheet layout | Daggerheart's grid, banners and tabs on the character sheet: the 275 px rail, `1fr` tracks that refuse to shrink, the pointed status labels | "THE SHEET IS THIS GAME'S SHEET", "THE SPLIT", "HEADERS AND TABS, AGAINST THE REAL MARKUP", "TWO COLLISIONS FROM THE INVERSION, BOTH MEASURED", "THE SHEET SURVIVES A NARROW WINDOW"; the "Stays here (E44 C6)" `!important` lines | Daggerheart's sheet; its left column as Daggerheart 2.12.8 draws it is `audit/sheet-column/`'s (13.11.2026) |
| Foundry's chrome | the rails, the player list, the pause screen, the context menu, performance stats, scene navigation, the loading bar, the settings window and the file picker in the module's dress | "TAKING OVER THE BASE INTERFACE", "the icon rails", "THE PLAYER LIST, BOTTOM LEFT", "THE PAUSE SCREEN", "THE DROPDOWN, AND THE HALF OF IT THE PAGE DOES NOT OWN", "E105 FT, BATCH 3 - FOUNDRY'S AND DAGGERHEART'S CHROME IN THE MODULE'S DRESS" | Foundry v13's markup and v14's notes (LIVE-E30 ids) |
| Foundry's windows | another sheet's or a config window's controls cut off by the module's type and widths | "FOUNDRY'S OWN CONFIG WINDOWS STAY USABLE" (since E55 the 88vh ceiling for the token, scene and tile config only, R6101, LIVE-E55-02) | v13's class names `token-config`, `scene-config`, `tile-config` |
| Chat and roll cards | Daggerheart's duality colours and roll cards in the chat log | the duality colours under `#chat-log .chat-message.duality`, the chat cards' section | Daggerheart's roll cards as 2.10.x drew them |
| Another module | Carolingian UI | one `.crlngn-ui` rule | that module as it was when it was dropped |

**Twelve Foundry ids no script writes**, which one `document.querySelector` each at a v14 table would settle:
`#chat-log`, `#context-menu`, `#performance-stats`, `#players-active`, `#players-inactive`, `#resource-fear`,
`#combat-popout`, `#effects-display`, `#effects-panel`, `#scene-navigation`, `#chat-popout`, `#loading-bar`
(LIVE-E55-04). Until it is read, a rule naming one is kept.

## What to expect from a review

It will ask where a number came from. Most of the long comments in here exist
because a plausible-sounding answer turned out to be wrong, so "it looked right"
is not enough for anything that can be measured - and most things here can be.

`CLAUDE.md` and the path-scoped rules beside it in `.claude/rules/` have the
longer working notes: the traps, the invariants the suite enforces, and the
release procedure.

## Reporting something instead

Issues are welcome, and a screenshot is worth a paragraph. If it is about the
interface, the two commands worth pasting into the console first are:

```js
game.drpg.perf()    // what the theme costs your machine
game.drpg.a11y()    // controls with no name a screen reader can read
```
