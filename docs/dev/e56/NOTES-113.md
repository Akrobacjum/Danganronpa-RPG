# E56 part 1 in 1.2.113 - the guards and the lint

Part 1 of E56 arrives in 1.2.113 ahead of the stage (the owner's plan of 14.11.2026); the comment sweep, file by file,
stays in 1.2.114. Nothing a player or a GM sees changes.

**Lint.** `npm run lint` now holds `no-unused-vars` as an error (options: `args: "none"`, a name starting with `_`
ignored, and `ignoreRestSiblings`, so `const { a, ...rest } = x` may leave `a` unread). Measured on the 1.2.113
assembly at 123f8242 with the harness's ESLint 10.11.0 over the 394 files `npm run lint` reads: 96 with the first two
options, 74 with all three; 0 after this part. `no-undef` was 0 before and is 0 after. The lint part now also plants a
name declared and never read in each of its six folders and is red unless all six report it, as it already did for
an undefined name. The 74 were removed, not
silenced: 20 in the module's own files (a function nothing called since E64, `cleanup.mjs bodyDestinations`; eight
fields `placeRemnant` destructured and `traceRowOf` reads itself; unread imports and locals), 37 in the test files
(imports and locals no assertion read; no assertion removed) and 17 in audit/ and tools/. Each was read in context
first; none was a value computed and then not used where it should have been.

**The keys guard.** `node tools/check.mjs keys` (tools/keys-lint.mjs, in `npm run quick` and `npm test` with every
part) is red on a key of lang/en.json that no string of the code holds and no prefix the code builds keys from covers.
It plants its own unread key on the real tree first and is red if it cannot see it. On 123f8242 it finds 0 dead keys of
5794; what it does not hold yet: 834 keys stand under 160 builder prefixes and pass without their builder being read,
and 186 are read only by tests - both counts printed on every run, both part 2's.

**The other two guards** (a backticked name in a comment exists; no docblock right after a docblock) were already in
the base: `node tools/check.mjs comments`.

**What E54's split left dead.** Measured with tools/e56's finders on 1463f22b (before E54) and 123f8242 (after): no new
dead key, no new dead export; three names became read only by their own file (`HUG`, `PAD_SIDE` in
glass-geometry.mjs, `VOICE_FOOT` in glass-blocks.mjs), each in an `export const` of several names whose others are read
elsewhere, so they stay exported (part 2).

Not measured: anything at a real table. Part 1 changes no behaviour a table could see.
