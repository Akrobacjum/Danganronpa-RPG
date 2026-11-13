## What this changes

The stage and commit ids (for example "E57 C4a"), and in a sentence or two what a GM or a player will see differently.

## Red first

The tests or check parts written before the change, how they failed on the base, and how they pass now.

## Measured

- `npm run quick` in audit/harness (lint, `tools/check.mjs`, the gate's self-test):
- Tiers 0-1 (`node run-tests.mjs --tier 1`): passed / failed / skipped / red
- The tier-2 tests and scenarios this touches, by name:
- Merge-tree against main and the open lines: any conflict this branch adds

## Not checked in a real Foundry

What only a table or a Foundry v14 sandbox can show, and the live check id it was given in AUDIT section 9.2.
