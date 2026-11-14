# A comment policy for new code - a draft for the owner (E56 part 1, 14.11.2026; part 2, 14.11.2026)

A draft only. CLAUDE.md and `.claude/` are the owner's; if this is wanted, it would extend "The house style" there
(a paragraph of CLAUDE.md, or a rule file under `.claude/rules/` for `scripts/**/*.mjs` and `styles/**/*.css`). What
the gate already holds is marked **(held)**, with the check that holds it; the rest is a convention only a reader
holds.

## The draft text

A comment in new code says one of three things, and nothing else:

1. **Why the code is this shape** - what was tried, what it measured, and the reading that chose a number (with the
   date, and where it was measured).
2. **What a reader would get wrong** - a trap, an order that matters, a road the code does not take on purpose.
3. **What it does not do yet** - with the stage or LIVE id that will.

It does not restate the line under it, and it does not keep a history the commit log holds.

**A name in backticks is a claim.** A bare backticked name - `name` or `name()` - says this repository holds it
**(held)**. So:

- A name of this module is written bare, and it exists. When the code it names is renamed, moved or removed, the
  comment changes in the same commit.
- A name that is somebody else's is written with its owner, inside the backticks: `Token#_drawEffects`,
  `ClientSettings#set`, `HTMLMediaElement#setSinkId`, `DhCharacter#prepareBaseData`, `foundry.canvas.groups.CanvasVisibility`.
  A reader sees whose it is, and the lint, which reads only a bare span, leaves it to the reader. Write the owner only
  when it was read (in the code that calls it, in a copy under `audit/harness/lib/`, in the upstream source at a named
  version); when it was not, write the name bare and give it a `known` row that says so.
- A name that is gone, kept in a comment because the comment is a record (a red-first reading, a measurement, the
  reason a road is not taken), says plainly that it is gone and since when ("removed in E64, 03.11.2026"), and gets a
  `known` row in `tools/comment-budget.json` whose reason says "history - ...". A comment that only described the
  name's behaviour is rewritten to describe what the code does now.
- A word that is not an identifier (an attribute value, a dataset key, a design page's class) is written as what it is:
  `aria-live="assertive"`, `dataset.sceneid`.

**One docblock per declaration (held).** A `/** */` block stands directly over the declaration it documents. Two
blocks with nothing between them are an error whatever the budget says (tools/comments-lint.mjs since E56 part 2;
R7150 holds the budget at no doubled block). A `@typedef` or `@callback` block documents a type, not the declaration
under it, and may stand over another block. A note about a section is a plain `/* */` comment, not a docblock.

**A key has a reader (held).** `node tools/check.mjs keys` (tools/keys-lint.mjs): a key of lang/en.json that no code
reads and no builder's prefix covers is red.

**A class a CSS comment names exists, or is said to be gone.** Not held by a check (part 2 scanned the sheets once,
with a script kept outside the tree; tools/css-lint.mjs counts dead classes in rules, not in comments).

**A count, a line or a file:line in a comment is dated.** "voice.mjs:783 there" (at the parent of the commit it
describes) stays true; "voice.mjs:783" alone does not. Not held by a check: tools/e56/lines.mjs reads them on demand.

When code changes, its comment changes in the same commit. A comment that no longer matches the code is worse than
none: the audit's two comment sweeps found several that had survived a release, and E56 part 2 found 141 names in 77
module files and 3 stacked blocks on 9e7e3d78 (1.2.114), and 49 names and 8 stacked blocks in the suite's files.

## What holds it, as of E56 part 2

| Rule | Check | Since |
| --- | --- | --- |
| a bare backticked name exists, or is `known` with a reason | `node tools/check.mjs comments` (in `npm run quick`); R7151 holds every budget row at 0 | E56 C1 (the ratchet), part 2 (at 0) |
| no docblock over a docblock | the same lint, as an error; R7150 | part 2 |
| every key has a reader | `node tools/check.mjs keys` | part 1 |

## Open, for the owner

- Q-E56-4 (the plan's default: a `known` list of at most 20 rows). It holds 119 after part 2, every one with its
  reason: 28 from before, the rest the sweep's history records and other owners' names (93 after the module files,
  119 once the suite's files were read too). Shortening it means taking the
  history names out of the comments that record them, which loses the record; part 2's default kept them.
- Whether the lint should read the suite's own files as well: part 2 widened it to them (tools/comments-lint.mjs;
  49 citations and 8 doubled blocks there before their sweep). Default taken: yes.
