# Contributing

Thanks for looking. This is a Foundry VTT module - plain ES modules and CSS, no
build step, no bundler, no `npm install`. What you check out is what ships:
the package is `git archive` of the tree. The one exception is the headless
test harness in `audit/harness`, which needs jsdom: `npm ci` there, once.

## Getting it running

1. Clone into your Foundry `Data/modules/` folder as `danganronpa-rpg`.
2. Enable it in a world running [Daggerheart](https://foundryvtt.com/packages/daggerheart)
   2.6 or later on Foundry v14.
3. Edit a file, reload the browser. There is nothing to compile.

## Before you open a pull request

Run all three. They take about five minutes together (the suite alone is about three, measured 24.09).

```bash
# the regression suite and the eleven scenarios, headless
cd audit/harness
npm ci        # once: installs jsdom for the harness (the module itself needs nothing)
node cluster.mjs scenarios/01-runtests.mjs
for s in 10-murder 11-killer-secrecy 12-social 13-murder-signals 14-quiet 15-held \
         20-crit-hope 30-security 40-flow 50-lang 60-ledger; do
  node cluster.mjs scenarios/$s.mjs
done

# the Polish file covers the prose in config.mjs
cd ../..
node tools/config-prose.mjs --check lang/pl.json
```

The harness boots the checkout it sits in; set `DRPG_REPO` to point it at
another one.

The suite must report **0 failed**. It also reports a number of skipped tests -
those are the ones that need a real browser (layout, a canvas with a width,
loaded fonts, audio) and say so individually. That number should not grow: if
something that used to be answerable has stopped being so, that is a regression.

If you touched the theme or the layout, also open `audit/glass-harness.html`
over a local server and look at it at a few sizes - the curtain's self-check can
read clean while the picture is wrong, which is how one bug got through.

```bash
python3 -m http.server 8765      # then open /audit/glass-harness.html
```

## What a change should carry

**A test, where one is possible.** The suite is in `scripts/tests.mjs` and runs
inside a real world; the scenarios in `audit/harness/scenarios/` drive four
clients at once and are the place for anything involving sockets, permissions or
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
