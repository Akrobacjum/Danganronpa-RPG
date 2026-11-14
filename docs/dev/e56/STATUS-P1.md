# E56 part 1 - status (line claude/e56-p1-113)

Base: claude/fervent-sagan-gme4vt at 123f8242. Updated as the line goes, so a restart loses nothing.

## Measured on 123f8242 (14.11.2026)

- `no-unused-vars` with `args: "none"`, `varsIgnorePattern: "^_"` (ESLint 10.11.0, the harness's, over the whole
  repository as `npm run lint` reads it, 395 files): **96**. With `ignoreRestSiblings: true` as well: **74** (22 are the
  omit-by-rest idiom, `const { a, ...rest } = x`). `caughtErrors: "none"` would take 2 more off; not used: the two
  `catch (err)` with no read become `catch {`.
- Other lint problems: 0 (no-undef 0).
- Finders (tools/e56, self-checks green), on 123f8242: keys 5794, 0 dead, 834 unsure (under 160 builder prefixes read
  off the code), 186 read only by tests, 95 foreign; exports 13 dead, 229 own-file only, 5 unsure. On 1463f22b (before
  E54's cuts): the same key counts; exports 13 dead (the same 13), 227 own. New after E54: own-only `HUG`, `PAD_SIDE`
  (glass-geometry.mjs:112) and `VOICE_FOOT` (glass-blocks.mjs:10), each in one `export const` of several names whose
  other names are read elsewhere: left (splitting a statement is not the smallest change), listed for part 2.

## Items

| Item | State |
| --- | --- |
| 1. no-unused-vars to 0, an error | in progress |
| 2. the keys guard | not started |
| 3. what E54 left dead | measured: nothing removable (above) |
| 4. NOTES-113.md | not started |

## Needs a local Foundry

Nothing in part 1 needs one.
