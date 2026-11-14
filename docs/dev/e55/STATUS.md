# E55 on the 1.2.113 assembly - status

The work line `claude/e55-113`, from origin/claude/e55 (0f731e57) with the 1.2.113 assembly (1463f22b) merged in at
9b7daf8b. R numbers from R6100-R6199. Kept as the line goes, so a restart loses nothing.

## Done

| Item | What | Commit | Proof |
| --- | --- | --- | --- |
| C0 again | both freezes read on 9b7daf8b: every difference 78ee8e48's (the open kit tab Bone on an Ink brush); accepted | b0eb89d6 | C0-113.md |
| C1 | css-lint `overriddenDeclarations`, budget row `overridden` (123 at 9b7daf8b) | b78b0377 | R6100; self-check sees it stubbed blind |
| C2 | css-lint `deadAttributes`, budget row `deadAttributes` (2: `crisis`, `[data-drpg-gm]`) | b78b0377 | R6100 |
| style-baseline.json | rebuilt: see below | (this round) | read back 0 differences |
| D1 | the crisis block (28 rules, 28 `!important`) and the `[data-drpg-gm]` arm | (this round) | deadAttributes 0 |
| D2 | 121 overridden declarations (16 whole rules), base.css 4, danganronpa.css 85, stained-glass.css 29, components.css 3 | (this round) | overridden 0 |
| D3 | the sheet's 275 px track rule (lost to its `body` twin in both themes) and the Hope marks' four `mask-image` lines (lost to the slot's `mask` by containment) | (this round) | R4932, R5720 green |
| D4 | the sound launcher's gear written once in danganronpa.css; stained-glass.css's unscoped `!important` gear rule gone; `#drpg-events` one width (D2) | (this round) | look-freeze: no difference |
| Named | Font Awesome by `--fa-style-family` alone (R6104); 88vh for the token, scene and tile config only (R6101); the duality formula wraps (R6102); the effects hide by Daggerheart's names (R6103); `@property --drpg-glass-accent` described, the dead fallback on the Foundry tools frame gone | (this round) | red on the old sheets, green here |
| X1 | CONTRIBUTING.md "What the sheets hold against Foundry and Daggerheart": eight groups by section name, the twelve ids (LIVE-E55-04) | (this round) | - |
| LIVE | LIVE-E55-01..04 in AUDIT 9.2 | (this round) | `check live` green |

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

## Not the line's

- R2001 fails at b78b0377 and here: 53 stale quotes of a stage's planned version (scripts/utils.mjs E57, handover.mjs
  E38, ...), from the assembly's tools/stages.json (1463f22b, "the rest planned 1.2.114"). No file of this line is in
  its list.

## Open

- B1 one brush, K1 one checkbox token, L1 literals to tokens, step 3 (one rule place per surface), step 4 (the sheet's
  sections), Legacy consolidation: see the report.

## Needs a local Foundry

LIVE-E55-01 (the look on v14), -02 (the config windows' class names and 88vh), -03 (the Font Awesome face), -04 (the
twelve ids).

## Questions (with the default taken)

- none yet.
