# E57 rest: T13 (uiLiterals), group 2

Branch `claude/e57-t13b-113`, from `claude/e57-tools` at 6cd30a92, 14.11.2026. The slice: T13's findings in 21 files
(module, gm-store, movement-audit, roll-dialog, trial-progress, glass, gm-panel, utils, passages, trial-floor, vote,
sheet-item, enforced, body-tile, sheet-sidebar, season-wipe, search-tokens, projects-map, gm-team-dialog,
cleanup-reshape, action-project), 237 at the base. Read by `node tools/check.mjs text --all`.

## The counts

| | T13 in the whole tree | This slice |
| --- | --- | --- |
| Base (6cd30a92) | 737 | 237 |
| After the console-only parameter (56de363d) | 596 | 100 |
| After the detector's second round | 560 | 73 |
| After UI_LITERAL_ALLOW (6d7f6ca6) | 487 | 0 |

Fixed in the text: none. Moved into lang/: none. No literal of the slice is text a screen shows in English: each was
console text, a selector, markup, CSS, a note in a table or a reason handed back to the console or a test.

## What the detector misread (164 of the 237)

- 124 in module.mjs, 13 in roll-dialog.mjs: `safely(label, fn)` and `failed(step, err)`, whose argument reaches only
  `error()` / `warn()`. A parameter of a file's own function read only inside a log call makes its call sites'
  arguments console text (`consoleArg`).
- 3 in roll-dialog.mjs: `const wrong = ...`, read only by `if (wrong)` and `warn(...)`.
- 5 in movement-audit.mjs (4) and body-tile.mjs (1): a logger chosen or imported at the call.
- 6 selectors (querySelector arguments, a selector list with its commas glued, a pseudo-class), 4 attribute fragments
  (` disabled title="`), 4 CSS rules in utils.mjs's `<style>`, 4 `env.text?.(...) ?? "..."` fallbacks in
  gm-store.mjs, 1 bridge `claims:` note in search-tokens.mjs.

Each case is a plant in `FIXTURES.uiLiterals` (red before its fix), with three controls that stay flagged. The same
rules took 4 findings of other lines' files at the first commit and 9 at the second, each read (the coordinator was
sent the list).

## What is allowed (73, in 18 rows)

`UI_LITERAL_ALLOW` in scripts/tests-text.mjs: each row names a file and a top-level declaration, the number of
literals it lets stand there and the reason. A row whose number stops matching is a finding, and `check text` is red
on it while T13 reports. The rows are reasons the detector cannot read, because the text reaches the console, a test
or data through a return value or another file: gm-store's packet and section reasons and one fallback piece
(C12-FINDINGS.md's decision), movement-audit's ledger notes and send-back reasons, passages' packet reason, the trial
record's writer notes and the two tables' fault lists (tier 0 and tier 1 only), glass's console helpers, the panel's
product name and the copied error log's header, a ballot reason of the bridge's closed list, enforced.mjs's console
fallbacks, a font stack, runSteps' label and the Project actor's name.

That is 31% of the slice, over the brief's fifth. Read as: the misreads the detector can be taught were taught
(164); what is left needs data flow across functions and files.

## Questions, with the default taken

- Q-T13b-1: keep the 73 as allow rows for 1.2.113, rather than teaching T13 to follow a returned reason across
  functions and files? Default: yes, allow rows.
- Q-T13b-2: glass.mjs `glassReport`'s comment says "for the Look dialog", and nothing in scripts/ but the
  watchdog's `log()` calls it. Allowed as console text; the comment may be stale. Default: left for the glass
  file's owner.

## Tests

`npm run quick` green before each push. Full tier 1 at the final tip: see the coordinator's report.
