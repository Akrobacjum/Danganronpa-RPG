# E55 on the 1.2.113 assembly - status

The work line `claude/e55-113`, from origin/claude/e55 (0f731e57) with the 1.2.113 assembly (1463f22b) merged in at
9b7daf8b. R numbers from R6100-R6199. Kept as the line goes, so a restart loses nothing.

## Done

| Item | What | Commit | Proof |
| --- | --- | --- | --- |
| C0 again | both freezes read on 9b7daf8b: every difference 78ee8e48's (the open kit tab Bone on an Ink brush); accepted | b0eb89d6 | C0-113.md |
| C1 | css-lint `overriddenDeclarations`, budget row `overridden` (123 at 9b7daf8b) | b78b0377 | R6100; self-check sees it stubbed blind |
| C2 | css-lint `deadAttributes`, budget row `deadAttributes` (2: `crisis`, `[data-drpg-gm]`) | b78b0377 | R6100 |
| style-baseline.json | rebuilt: see below | 94a47e0a | read back 0 differences |
| D1 | the crisis block (28 rules, 28 `!important`) and the `[data-drpg-gm]` arm | 8ba4decc | deadAttributes 0 |
| D2 | 121 overridden declarations (16 whole rules), base.css 4, danganronpa.css 85, stained-glass.css 29, components.css 3 | 8ba4decc | overridden 0 |
| D3 | the sheet's 275 px track rule (lost to its `body` twin in both themes) and the Hope marks' four `mask-image` lines (lost to the slot's `mask` by containment) | 8ba4decc, 2f164157 (R93 reads the rail left) | R4932, R5720, R93 green |
| D4 | the sound launcher's gear written once in danganronpa.css; stained-glass.css's unscoped `!important` gear rule gone; `#drpg-events` one width (D2) | 8ba4decc | look-freeze: no difference |
| Named | Font Awesome by `--fa-style-family` alone (R6104); 88vh for the token, scene and tile config only (R6101); the duality formula wraps (R6102); the effects hide by Daggerheart's names (R6103); `@property --drpg-glass-accent` described, the dead fallback on the Foundry tools frame gone | 8ba4decc | red on the old sheets, green here |
| X1 | CONTRIBUTING.md "What the sheets hold against Foundry and Daggerheart": eight groups by section name, the twelve ids (LIVE-E55-04) | 5518b2c7 | - |
| LIVE | LIVE-E55-01..04 in AUDIT 9.2 | 5518b2c7 | `check live` green |
| L1 | the glass ink at seven alphas, tokens on `:root`; stained-glass.css literals 95 -> 63 | 499d4c8f | three freezes 0 |
| B1 | one brush definition, `--brush-inset` per role; the two restatements gone | b3e30e59 | three freezes 0 |
| K1 | Legacy's checkbox places read one token, `--drpg-kit-check-accent` (selectors kept: see the commit) | b6618a1a | freezes 0 |
| Step 3 | 22 surfaces, a commit each (bdc83a28..e8f83c90): a selector stated more than once in a sheet made one rule, the moved declarations at the end when they came later and at the start when earlier, each comment moved with them by hand; the merger checks that no rule between declares a property of the same family at equal weight and importance on a selector that could match the same element (docs/dev/e55/tools/merge.mjs.txt) | see the commits | style-freeze per batch of 3-7 surfaces, 0 each (one batch read while the next was committed: provisional, re-read whole at the end); look-freeze, sweep at the end |
| Step 4 | measured and indexed, not moved: SHEET.md (121 of 487 and 69 of 169 sheet rules movable by text; Q-E55-9) | cbcadc5f | - |
| Legacy | no Legacy-scoped twin left worth merging: the two are the token root (the type floor and S12-25's red, separately reasoned) and the DH settings window's sizes list; D2's 121 and K1 were the Legacy consolidation that the text could prove | - | - |

## How style-baseline.json was rebuilt

`node audit/style-sweep.mjs --chromium /opt/pw-browsers/chromium --base <a server on a worktree of b78b0377> --write`:
the sheets as C1/C2 left them (no style change since 9b7daf8b), the captures in `audit/windows/` as committed, Chromium
153.0.8010.12. 628 readings, 744 distinct values, 4189 rows accepted (the 4221 differences at 1.2.112, read on this
tree), 5 min 10 s. Read back on the same tree: 628 readings, 0 differences, green. The sweep now writes the build into
the baseline (`chromium`) and refuses a comparison in another build. Not read row by row: the rebuild takes today's
look as the baseline, which is what C0's two freezes had already been accepted against.

## Measured differences, each named

- look-freeze after D1-D4 and the named fixes: 34, all `font-family` of masked glyphs (messenger launcher, tray gear,
  sheet action icon) under Legacy: the FA6/FA5/FontAwesome names gone. Accepted by surface.
- style-freeze and style-sweep after D1-D4, the named fixes, L1 and B1: 0 each.
- The inventory's 2.3 claim on `#drpg-player-status .drpg-status-label` did not hold: the base rule's
  `font-size ... !important` wins under the glass, whose rule has none. Left as it is.

## Not the line's

- R2001 failed at b78b0377 and on this line until the merge of 6dd02975 (d115df6f): 53 stale quotes of a stage's
  planned version, from the assembly's tools/stages.json; the coordinator's ledger fix came with that merge, and tier 1
  is 1607 passed, 0 failed there.

## The merge of E54 (6dd02975) and the radio sweep

- d115df6f: origin/claude/fervent-sagan-gme4vt at 6dd02975 merged (not rebased); conflicts in tests-tier1.mjs's kit import
  and R-REGISTRY.md (regenerated); styles/ merged clean (the assembly's 37 lines in, 25 out). On the merge: css-lint as
  before, look-freeze 0, style-sweep 628 readings 0, style-freeze 1304 readings 0, tier 1 1607 passed 0 failed 16
  skipped 0 red, quick green.
- 34c11c6d: audit/radio-sweep.mjs reads a radio hidden behind a label that is its face (E101's voice-mode buttons,
  R4062) through that label, with a planted fault each window reading; red 16 before on the merge, green after (the
  plant seen 8 of 8; the whole sweep, 21 windows, 736 radio readings, green). Also on the merge with it:
  glass-golden SAME byte for byte as 6dd02975 (276 cuts over 23 sizes, the boxes captured on 6dd02975), glass-sweep
  SWEEP GREEN (2 themes x 2 roles x 25 sizes, 46 with glass, 0 failing), sheet-column 144 cases 0 not right, scenario
  74-room-tile 46/46. The coordinator's bisect: red from 12090776 (gaps-111 into the 1.2.112 tree) on, a sweep older
  than E101's rule, not a fault of the module.

## Step 3 in numbers

Selector lists stated more than once in one sheet (extra statements), read by a finder over the served sheets: at
b6618a1a danganronpa.css 44, stained-glass.css 60, components.css 13, narrow.css 3 (120); at e8f83c90 31, 46, 11, 3
(91). The 29 merged are the ones that are one surface's property bundle. Of the 91 left, by reading each: lists kept as
lists (the right column's order, the Event panel's glyph per kind, the corner's `right` per button, the DH settings
window's sizes), pairs kept beside their reasons (the E100 tab fix, the picking rows' check token, the right column's
`pointer-events` opt-in, ONE EDGE MARGIN's offsets, the room tile's two places), token roots (`body`, the themes' body
classes, narrow.css's `body.drpg-stacked`), and the ones the merger's check refused (a possible tie in between).

## Open

- Step 3 beyond identical selectors: a surface's colour or size stated by different selectors in several places (the
  theme-scoped restatements) is not merged by text; each needs the cascade on the surface's markup.
- Step 4's split by moves: Q-E55-9's default accepted by the owner (14.11): the index stands; the moves wait for a
  stand-in of Daggerheart's whole sheet (estimate 4-6 h, not in 1.2.113).
- L1's near-miss darks: did not fall out of step 3; left (stained-glass.css's 63 literals are mostly inks at an alpha
  used once, and the grounds near the ink).
- The room and voice tiles' brush in components.css (Q-E55-8).

## Needs a local Foundry

LIVE-E55-01 (the look on v14), -02 (the config windows' class names and 88vh), -03 (the Font Awesome face), -04 (the
twelve ids).

## Questions (with the default taken)

- Q-E55-7 (K1): Legacy's checkbox places as one token on their own selectors, or one rule on one selector? Default
  taken: one token (`--drpg-kit-check-accent`), the selectors kept - one rule over all four would weigh more than each
  did, and two of them also apply under the glass beside its drawn checkbox.
- Q-E55-9 (step 4): the sheet's split by moves with a cascade proof each, or the index (SHEET.md)? Default taken: the
  index; the split waits for a stand-in of Daggerheart's whole sheet in the style harness.
- Q-E55-8 (B1): the room and voice tiles' brush (components.css, the plates' `::before`) folded into the one brush
  definition in stained-glass.css? Default taken: no - another sheet and another place in the order; they keep their
  own two rules (one body each, the same; merging those two is a step-3 item).
