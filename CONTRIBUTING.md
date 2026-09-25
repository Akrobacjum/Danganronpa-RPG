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

## What to expect from a review

It will ask where a number came from. Most of the long comments in here exist
because a plausible-sounding answer turned out to be wrong, so "it looked right"
is not enough for anything that can be measured - and most things here can be.

`CLAUDE.md` has the longer working notes: the traps, the invariants the suite
enforces, and the release procedure.

## Reporting something instead

Issues are welcome, and a screenshot is worth a paragraph. If it is about the
interface, the two commands worth pasting into the console first are:

```js
game.drpg.perf()    // what the theme costs your machine
game.drpg.a11y()    // controls with no name a screen reader can read
```
