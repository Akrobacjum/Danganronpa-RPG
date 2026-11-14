# A comment policy for new code - a draft for the owner (E56 part 1, 14.11.2026)

A draft only. CLAUDE.md is the owner's; if this is wanted, it would extend "The house style" there. Nothing here is
enforced beyond what the guards below already hold.

## The draft text

A comment in new code says one of three things, and nothing else:

1. **Why the code is this shape** - what was tried, what it measured, and the reading that chose a number (with the
   date, and where it was measured).
2. **What a reader would get wrong** - a trap, an order that matters, a road the code does not take on purpose.
3. **What it does not do yet** - with the stage or LIVE id that will.

It does not restate the line under it, and it does not keep a history the commit log holds.

Three rules the gate holds:

- **A name in backticks exists.** `node tools/check.mjs comments` (tools/comments-lint.mjs): a backticked name in a
  comment of scripts/ that no code, key or stylesheet holds is counted against tools/comment-budget.json, which only
  falls.
- **One docblock per declaration.** The same lint counts a JSDoc block directly after another.
- **A key has a reader.** `node tools/check.mjs keys` (tools/keys-lint.mjs): a key of lang/en.json that no code reads
  and no builder's prefix covers is red.

When code changes, its comment changes in the same commit. A comment that no longer matches the code is worse than
none: the audit's two comment sweeps found several that had survived a release.

## Why a draft and not a rule

The brief for E56 part 1 keeps CLAUDE.md the owner's. Q-E56-4 (the comment guard's exception list, at most 20 rows)
is still open and belongs to part 2's comment sweep.
