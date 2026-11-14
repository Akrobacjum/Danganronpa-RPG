# E56 part 2 - status (line claude/e56-115)

Base: main at 9e7e3d78 (the 1.2.114 release tree). R block: R7150-R7159. Updated as the line goes, so a restart loses
nothing.

## Measured on the base, 9e7e3d78 (14.11.2026, this machine, 4 cores)

- `node tools/comments-lint.mjs` (the check part `comments`): 253 module files of scripts/ read; cited names no code
  holds **141** (in 77 files), doubled JSDoc **3** (death.mjs, enforced.mjs, gm-items.mjs), `known` 28; 0 problems
  (the budget equals the counts).
- `node --max-old-space-size=8192 tools/e56/run.mjs --md <file>` (77 s): (a) 427 citations over scripts/ with the
  test files (the lint above reads the module files alone), (b) 4 line citations that do not hold (two in the tier-0
  and tier-1 files, two in tools/moved-only.mjs) and 0 counts, (c) dead exports 12, unsure 4, own-file only 232,
  (d) 47 groups of identical bodies, (e) dead keys 0, unsure 981, test-only 197.

## Items

| Item | State |
| --- | --- |
| 1. comments that contradict the code, scripts/ styles/ tools/ | in progress |
| 2. stacked JSDoc and the guards as tests, red first | in progress |
| 3. dead exports, constants, duplicate helpers | not started |
| 4. the comment policy draft | not started |

## Needs a local Foundry

Nothing so far.
