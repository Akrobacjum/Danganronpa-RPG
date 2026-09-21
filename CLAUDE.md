# Working in this repository

This file is for whoever is next in here, human or otherwise. It is not a tour
of the code - the code explains itself at length, and that is deliberate. It is
the short list of things that are easy to get wrong here and expensive to get
wrong twice.

## The one rule the rest follow from

**Measure, then say.** Nearly every long comment in this module ends in a
number, a date and often somebody's name, because nearly every one of them
replaced a plausible guess that turned out to be wrong. A claim in a commit
message, a code comment or a report is a claim somebody will rely on a year
later without re-checking it.

Two ways this has actually failed, both recently, both worth not repeating:

- A test can pass by measuring nothing. `stackShapes` was written, the
  self-check reported zero failures, and the reason was that the block list it
  checked was empty - a property was read under the wrong name. The screenshot
  found it; the numbers said everything was fine.
- A reason written on a bucket of known failures is not the same as a reason
  that was checked. Twelve tests failed on every headless run under the label
  "these need a real canvas". Four of them did not need one, and one of those
  had been telling the truth about a real geometry question for a year.

If a claim cannot be measured, say that instead of rounding it up.

## Running things

| What | How |
| --- | --- |
| The suite, in Foundry | `game.drpg.runTests({ tier: 2 })` in the console, as GM |
| The suite, headless | `cd audit/harness && node cluster.mjs scenarios/01-runtests.mjs` |
| One scenario | `node cluster.mjs scenarios/40-flow.mjs` (add `--verbose` for per-test lines) |
| Every scenario | the ten numbered ones: 10, 11, 12, 13, 14, 20, 30, 40, 50, 60 |
| The Polish file | `node tools/config-prose.mjs --check lang/pl.json` - must read 493/493 |
| The curtain, without Foundry | `python3 -m http.server 8765` then `/audit/glass-harness.html` |
| The evidence pack, without Foundry | the same server, then `/audit/pack-harness.html` |
| What the theme costs | `game.drpg.perf()` at the table - the only place that number is real |
| What a screen reader cannot read | `game.drpg.a11y()` |

The headless harness (`audit/harness`) runs four jsdom clients - one GM and
three players - against a shim of Foundry. It is good enough to drive the rules,
the sockets and the DOM, and it is **not** a browser: no layout, no canvas
width, no fonts, no audio. A test that needs one of those says so with
`needs(condition, why)` and is counted as skipped, not failed.

## What the suite's three numbers mean

`126 passed, 0 failed, 9 skipped`

- **failed** must be zero. It was not zero for a year, and a thirteenth failure
  arrived unnoticed because twelve was a number people had learnt.
- **skipped** may only be a fact about the environment that the test checked
  itself. Never a result that came out wrong. The harness asserts this number
  does not grow: something that used to be answerable and stopped being so is a
  regression wearing the one colour nobody looks at.

## Things that will bite

**Every English key needs a Polish twin.** `lang/en.json` and `lang/pl.json` are
checked against each other by the suite (R1) and the prose in `config.mjs` by
`tools/config-prose.mjs`. A key used with `plural()` needs `.one`/`.other` and,
in Polish, `.few`/`.many`.

**The breakpoints live in `settings.mjs` and nowhere else.** `BREAKPOINTS` is
read by the stylesheet (through two body classes stamped in `applyTheme`), by
the curtain, and by the glass harness. A media query with 1200 in it would be a
fourth copy of the number and the curtain could not read it.

**`styles/narrow.css` loads last on purpose.** Both themes state widths for the
module's blocks as specifically as anything that could be written against them,
so the narrow layout wins its ties by being later rather than by an arms race in
selectors.

**The curtain has two partitions.** `curtainShapes` for a desk, `stackShapes`
for a stacked screen. The desk one assembles panes and checks afterwards that
they tile the screen; the stacked one starts from the screen and cuts it, so it
holds together by construction. Neither is a small change: run
`audit/glass-harness.html` at several sizes and compare the self-check
(`overlaps`, `blockFails`, `edgeGaps`) before and after, and look at a
screenshot, because the numbers can be clean and the picture wrong.

**A socket handler that touches an actor must check who sent the message.** R1b
in the suite reads the source for it. `senderOf(senderId)` and
`ownsActor(sender, actor)`, both, every time.

**Two functions are deliberately long.** `registerSettings` (a flat registration
table) and `steps()` (a data table). Everything else the audit measured over 300
lines has been split. Splitting either of those two would produce a dozen
functions that are each one line of data.

## The house style

Comments here are long, and they are long in one particular way: they say what
was tried, what it measured, and why the code is the shape it is. A comment that
restates the line under it is noise; a comment that records the reading that
chose a number is the only place that reading exists. When a comment stops
matching the code, it is worse than nothing - the two comment sweeps in the
audit found several of those and they had each survived a release.

Dashes are `-`, not `—`, throughout, including in prose files.

## Releasing

1. `module.json` version and the `--drpg-css-version` stamp in
   `styles/danganronpa.css` must agree, and the workflow checks that they do.
2. Write `.github/release-notes/vX.Y.Z.md`. The workflow refuses to run without
   it.
3. `main` is the release branch; the tag is created there.
4. Actions ▸ Release, dispatched on `main` with the tag.
5. `1.3.0` is reserved for a text rework. Releases before it are `1.2.X`.

## What is not done

`audit/AUDIT-1.2.42.md` section 9 carries the live checks - the things no
harness can settle and that have to be tried at a real table. That list is the
honest statement of what this module has not yet proved about itself.
