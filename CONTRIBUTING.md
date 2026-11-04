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
  pass every test while the screen does not change.
- **No width that assumes a desk.** No component is fixed wider than 390 px, and nothing assumes a screen of
  1024 px or more: widths go through `min()`, `@container` or the `drpg-stacked` layout. A window a player opens is
  read at 390x844.
- **The breakpoints are `scripts/settings.mjs`'s** (`BREAKPOINTS`) and nowhere else; the stylesheet keys off the
  classes it sets. `styles/narrow.css` loads last.
- **No text under the floor.** Under Stained Glass the floor is 21 px scaled (`--drpg-sg-floor`); under Monokuma
  Legacy it is 10 px per rung (the `--font-size-*` rungs and `--drpg-text-xs`).
- **AA contrast in both themes.** Small text 4.5:1, large text 3:1, for every pair of `tools/contrast-pairs.json`;
  a pair below it is written there with its ratio as `known`, never raised to pass.

What the lint counts, per sheet (`scripts/tests-css.mjs`, read by the suite too):

| Detector | What it counts |
| --- | --- |
| `importantCount` | each `!important`, `! important` with a space as well, comments aside |
| `colourLiterals` | each declaration that is not a custom property and holds a hex, `rgb(a)()` or `hsl(a)()` colour |
| `strayCommentEnds` | a comment end with no start - 0, always, with no budget |
| `duplicateRules` | a rule written again with the same selector list and declarations, under the same at-rules |
| `deadClasses` | a `.drpg-*` the sheets style that no script writes (the suite's R2, the same function) |

The commands:

```bash
node tools/check.mjs css         # the lint against tools/css-budget.json (also in npm run quick and CI)
node tools/check.mjs contrast    # every pair of tools/contrast-pairs.json in both themes
node audit/style-sweep.mjs       # the computed style of the kit's surfaces in Chromium against audit/style-baseline.json
```

The sweep needs Chromium (Playwright from `audit/harness`), which CI does not install: whoever changes what a
surface looks like runs it, accepts only the surfaces that change (`--accept <id>`) and reads the screenshots.

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
