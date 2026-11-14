# E56 part 2 - status (line claude/e56-115)

Base: main at 9e7e3d78 (the 1.2.114 release tree). R block: R7150-R7159 (R7150, R7151 used). Updated as the line
goes, so a restart loses nothing.

## Measured on the base, 9e7e3d78 (14.11.2026, this machine, 4 cores)

- `node tools/comments-lint.mjs` (the check part `comments`): 253 module files of scripts/ read; cited names no code
  holds **141** (in 77 files), doubled JSDoc **3** (death.mjs, enforced.mjs, gm-items.mjs), `known` 28.
- The same lint's reading over the suite's files, which it did not read then: 49 citations, 8 doubled blocks (on
  this line after the module sweep, by a script calling the lint's `fileFindings`).
- `node --max-old-space-size=8192 tools/e56/run.mjs --md <file>` (77 s): (b) 4 line citations that do not hold - all
  four read by hand and none wrong (tests-tier0.mjs's `voice.mjs:783` says "there", at the parent it describes;
  tests-tier1.mjs's `daggerheart.mjs:1` is inside a stack-trace fixture string; tools/moved-only.mjs's two
  `tests-kit.mjs:1` are an error message's placeholder line) - and 0 counts; (c) dead exports 12, unsure 4, own-file
  only 232; (d) 47 groups of identical bodies; (e) dead keys 0.
- CSS comments (a script kept outside the tree, run once): 37 names or classes no code holds.

## Items

| Item | State |
| --- | --- |
| 1. comments that contradict the code | done for every finding the checks above make: module files 141 -> 0, the suite's files 49 -> 0, CSS 37 read (8 rewritten, 29 already said gone), two text-batch facts that cited removed names (B08 effectsLine, B10a roundOrder). Each name read in context; renamed ones pointed at what exists, removed ones kept as the record and said gone, foreign ones qualified with their owner or `known` with a reason. A comment that contradicts its code in prose without naming a missing identifier is not found by any of these checks: not measured |
| 2. stacked JSDoc and the guards, red first | done. 3 + 8 stacked blocks fixed; the lint holds a doubled block as an error and no longer counts a block after a `@typedef` (planted in its self-check, red first); it reads the suite's files too (red first: 32). R7150 (no doubled block allowed) and R7151 (no citation allowed, every `known` reason written), both red first on the older budget |
| 3. dead exports and duplicates | 12 dead exports removed, one restored: effectsLine, INFILTRATE_REROLLS, TIMED_KINDS, lastMessage, fillObjection, curtainHeld, bulletsWithoutAnswer, ownSpectator, markedChecks (with the CSS rule only it fed), exportLedger, deadRoomFor, scrumCampOfRoom; importLedger removed and put back (7387437f: tier 2 imports it through a namespace, which tools/e56's finder missed and check part `names` caught). Duplicates: not merged (below) |
| 4. the comment policy draft | done: COMMENT-POLICY-DRAFT.md, rewritten for part 2 |

## Numbers on the tip

- `node run-all.mjs lint check gate` (audit/harness): green (lint 405 files 0 problems; check 24 parts green; gate
  37/37), on a0f13a1a; `node tools/config-prose.mjs --check lang/pl.json` missing 0, extra 0. Again on the tip: see the
  last section.
- Tier 1 (`node run-tests.mjs --tier 1`) on a0f13a1a: 1673 passed, 1 failed (R3858, the census this line's removal
  of ownSpectator moved; fixed in the next commit, `--only R3858` 2 passed), 16 skipped, 0 red, 544 s wall. The tip's
  full run: see the last section.
- Tier 2: `--only "a younger partial Truth Bullet entry" --only R2033`: 6 passed, 0 failed (the two and the world
  checks). The tier-2 helpers whose docblocks moved (drawnCaseWindow, playerInRoom, useItemRerolled, withBodyTile)
  changed in comments only (tokens checked equal); not run one by one.
- Scenarios: 75-voice-tile 42/42, 87-messenger-sound 36/36, 41-trial-scene 52/52, each exit 0.

## Not done, and why

- **Duplicate imports** (`no-duplicate-imports` over scripts/: 43 files import ui-kit.mjs twice, and one each of
  utils.mjs and settings.mjs): not merged. The tooltip sweep, running at the same time, adds `tipAttr`/`tipText`
  imports from ui-kit.mjs to these same files; a merge now is a conflict in each. Q-E56-115-1 below.
- **Duplicate helpers**: glassOn is one declaration already. cssColour, colourOf, overlayColour, accentColour,
  themeOn: not merged, each a behaviour change (C10-LIST.md, still true at 9e7e3d78 by the finder's table). The 11
  `esc` copies with utils `esc`'s body: behaviour-neutral, not merged for the same reason as the imports (UI files
  the other lines edit). isPlain (4 copies), ownersOf (4) and the rest of (d)'s 47 groups: the plan names none.
- **HUG, PAD_SIDE, VOICE_FOOT**: exported and read only in their own files; each in one `export const` with names read
  elsewhere, and code.md's rows count those files' exports. Left as part 1 left them.
- **code.md's counts** (C14-COUNTS.md) and its rows that name a function this line removed: `.claude/` is not this
  line's. For whoever edits it: action-facilities.mjs, glass.mjs, gm-stores.mjs, monokuma.mjs, season-setup.mjs,
  truth-bullets.mjs, voice-client.mjs, messenger.mjs, timed-effects.mjs, infiltrate-reroll.mjs and trial-floor.mjs each
  export one or two names fewer; no facade row changes (none of the names was re-exported).
- **tools/e56's exports finder misses a namespace from `await import()` read as `ns.name()`** (importLedger). Not
  fixed in the finder; `names` is the check that holds that road.

## Questions, each with the default taken

- Q-E56-4 (the plan's: a `known` list of at most 20). It holds 119, each with its reason. Default: keep them - the
  history names are records the comments keep, and the rest are other owners' names not read in a source here.
- Q-E56-115-1: merge the duplicate imports and the 11 `esc` copies after the tooltip sweep and E109 land, and turn
  on `no-duplicate-imports` then? Default: yes, in 1.2.116, as one commit after the merges.
- Q-E56-115-2: the lint reads the suite's files too since this line. Default: yes (the plan's guard is over the
  source, and the suite's comments named removed functions as often).

## Needs a local Foundry

- LIVE-E56-01 (the plan's): a world with macros that call `game.drpg.*` loads and runs them with no missing-function
  error. This line removed no console name (tools/api-surface.json unchanged), so it does not move that check.
- The qualified foreign names (`TokenDocument#_onUpdateMovement`, `foundry.canvas.groups.CanvasVisibility`,
  `viewedDocuments`' owner and the like) were written from the code that calls them, the harness's copies of
  Daggerheart's dice and general knowledge of Foundry v13-v14, not from v14's source: a reader with v14's source can
  confirm them; nothing at a table depends on them.

## The tip

On 05ababdc (14.11.2026, this machine, 4 cores): `node run-all.mjs lint check gate` green (lint 405 files 0 problems,
check 24 parts green, gate 37/37); `node run-tests.mjs --tier 1`: **1674 passed, 0 failed, 16 skipped, 0 red**, 1689
tests, 558 s wall. This commit adds only this section.

## The coordinator's answers (14.11.2026)

- Q-E56-4: keep the 119 `known` rows with their reasons.
- Q-E56-115-2: yes, the comments lint reads the suite's files.
- Q-E56-115-1: not 1.2.116 - everything that needs no Foundry closes in 1.2.115. The duplicate ui-kit.mjs imports and
  the 11 local `esc` copies go in once the tooltip line is merged; the coordinator says when.

## Q-E56-115-1 done, on the merged base (14.11.2026)

Merged claude/fervent-sagan-gme4vt at 93f2ccae (the tooltip sweep) in f63a2485 (a merge commit: 7748fe4d was past
the base's ca36e77a).

- **Duplicate imports**: `no-duplicate-imports` on, as an error (eslint.config.mjs). Red first on f63a2485: "405
  files, 48 problem(s)" - 48 statements in 42 files (ui-kit.mjs in 40, utils.mjs in 2, settings.mjs in 1). Merged
  into the first statement of each module by an AST script, in four commits of 10-11 files; per file the set of
  bindings and every statement after the imports checked equal to the parent. run-all's lint part plants a doubled
  import in each of its six folders: "0/6" with the rule off, "6/6" on.
- **Local esc copies**: 13 with utils `esc`'s exact body (C10-LIST's 11 plus cleanup-reshape.mjs's and
  trial-progress.mjs's), in 9 files, replaced by the import, in two commits; eslint-scope over the parent and the tree:
  every reference to a copy resolves to the import, the bare `foundry.utils.escapeHTML` copies (another behaviour) and
  `esc` parameters as they were. The suite's own 12 copies in tests-tier2.mjs (fixtures') left. openProjectManager,
  the room table rename road and roomCells not touched (projects-ui.mjs's two were ownedFieldset's and
  passageFieldset's).
- Tip 8f42103a: quick green (lint 405 files 0 problems, check 24 parts, gate 37/37), prose missing 0 extra 0; tier 1
  **1675 passed, 0 failed, 16 skipped, 0 red** (1690 tests, 575 s). Scenarios: 65-season 58/60 with 2 expected red
  (Foundry limits), 76-passages 118/119 with 1 expected red (a Foundry limit), 40-flow 89/89, 95-tooltips-drawn 4/4;
  each exit 0.
