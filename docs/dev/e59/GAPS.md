# The gaps between each stage's goal and the code (E59 C6, for 1.2.113)

Read on 14.11.2026 at the 1.2.113 assembly base 123f8242 (plus this line's E59 commits). The stages are those the
owner's plan of 14.11 puts in 1.2.113 (every stage that needs no local Foundry v14) and the two that need one, E53 and
E58, for what can be read of them headless. E83 (the auditor's review) and E26 (the release) are not read here.

HOW IT WAS READ. `tools/stages.json` has no `goal` field (`grep -c '"goal"' tools/stages.json` is 0 here and on
`claude/plan-130`): each stage's goal, "done when" and outline are its plan, `git show
origin/claude/plan-130:docs/dev/plans/EXX.md` (E102: docs/dev/e102/PLAN.md). Four reading agents read the plans against
this tree, without running anything but read-only `node tools/check.mjs` parts. I re-read seven of their claims by hand
(settings.mjs:4570, lang/en.json:2515-2551, lang/pl.json:681, projects.mjs:1567, R6100-R6104 absent, README rows 31-32,
tools/stale-pl.mjs and tools/rules-parity.mjs absent), and all seven held; the rest is theirs, with the place each was
read. One of their readings corrected this line's own GATES.md (the fuzz and the matrix exist, in scenarios 30 and 33).

A gap "built on <line>" is work in flight on another line, not merged into this base: it closes at the coordinator's
merge, and should be read again on the merged tip. "Release notes" means: say it in the notes as not done. "Fix window":
small enough to do before E26, or a decision the owner has to make first.

The ledger disagrees with the plans on the planned version of E54 (1.2.113 vs 1.2.117), E55 (1.2.119 vs 1.2.118), E56
(1.2.114 vs 1.2.119) and E25 (1.2.114 vs 1.2.120), and lists E53 and E58 in the 1.2.114 train while their plans say they
are out of the plan. Every stage's row has `version`, `shipped` and `touches` null and `drills` empty. Release notes, all
of it (the versions are the owner's).

## E59 - this stage

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| C3, the second screenshot rating, is not done | the plan's point (2); Q-E59-4 | needs a local Foundry: LIVE-E59-01 (AUDIT 9.2 item 529) | release notes |
| The room's picture is the one window without `.drpg-ui` (Foundry's ImagePopout) | room-tile.mjs:551; R6750 ROOT_OUTSIDE | open, kept (Q-E59-11) | release notes |
| The kit's header still says a closing word is "the role's own key, never a caller's label", though since E102 C6 (7386194a) the kit draws a caller's word ("Not now", "Not yet") | ui-kit.mjs:35-36, :131 | open (E102's file; the three windows themselves are right since the merge d1f37e51) | fix window |
| 21 sizes under 11 px off the windows: the sheet's pixel-font rows (9-10 px), the clock and the Overflow caption, the status bar, the Event panel, the Despair meter, the voice tile (6.4 and 7.2 px at the slider's 80 %) | R6754 FLOOR_OUTSIDE; WINDOWS.md | open (Q-E59-12) | release notes |
| Under Monokuma Legacy a pressed mode, a chosen case node and the GM panel's tiles are drawn in the eye's red | components.css `--drpg-kit-btn-on-bg` and `-on-edge` (Legacy `body`), the GM panel rules; R6756 RED_KEPT | open (Q-E59-13) | release notes, or a fix window if the owner says red is the road's alone there too |
| A Foundry-limit known leak prints as "expected red" in a scenario's summary | run-all.mjs:281-283 | open (Q-E59-15) | fix window |
| The gate's "runContract on 2.10.5": module.json now verifies Daggerheart 2.12.8 | module.json:21-22 | open (Q-E59-16) | release notes |
| T9, T26 and `--stamp` (the 05.10 decision's final text modes) do not exist | tests-text.mjs MODES (:2458); grep of tools/ | open, E25 and E57's | fix window |
| README rows 31-fuzz and 32-case-security still say `planned`, though the fuzz is scenario 30's last part and the matrix 33's part H | audit/harness/README.md:185-186; docs/dev/e43/STATUS.md:17-18 | open | fix window |
| No mutation run is in any gate (E40's 12-rule run is recorded, 12 of 12 killed) | docs/dev/e40/STATUS.md:48, :249; `git ls-files tools audit` | open | fix window |

## E54 - the file split, wave 3

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| The verify line "a theme change and crossing 1224 px do not reset the size of open windows" does not hold in the code: `applyTheme` deletes `drpgScaled` on every open window and scales it again from its default position; the resize handler calls `applyTheme` when `shapeKey()` changes (S01-36 as it was) | settings.mjs:4568-4571, :4429, :4441; window-scale.mjs:145-150 | open; whether a moved window snaps back needs a local Foundry (LIVE-E54-01/02) | fix window |
| The C2 memo keyed on 'scale\|theme' and C0's red tests for it were not built; W4 wrote "the memo needs no theme", and R4802 holds the re-size on a theme switch as intended - the line's decision, not the owner's | window-scale.mjs:103-105; commit 0a107604; R-REGISTRY.md:1431 | open | fix window |
| LIVE-E54-01, -02, -03 are not in AUDIT 9.2 | `grep -n E54 audit/AUDIT-1.2.42.md` | open | release notes |
| C6 (the remnants' migrations into migrate.mjs), C9 (glass.mjs's dead code, S12-77: `const W = fullW` stands) and C10 (passages-gm.mjs, 3288 lines) were not done | remnants.mjs:2673, :2775, :2933; glass.mjs:1928-1929; `wc -l` | open | release notes |
| Q-E54-1 read the other way (the Key plan moved into key-remnants.mjs; the Key-on-token code stays in remnants.mjs); `sheetMode` left the facade; windows.mjs is two files | key-remnants.mjs:614; remnants.mjs:1150, :1676; sheet-mode.mjs:41; code.md:97, :106 | open, deviations from the plan | release notes |
| R4803 keeps ui-kit.mjs `settleKitWidth` as a second place a window's size is decided, listed for the owner | tests-tier0.mjs:25190, :25202 | open | release notes |
| Size: sheet-actions.mjs 1545 lines; the facades glass 3728, remnants 3368, cleanup 3004, investigation 2449 | `wc -l scripts/*.mjs` | open (Q-E54-2) | release notes |
| The split's proofs (tools/e54/, docs/dev/E54/) are not in the base, though its commit messages cite tools/e54/*.json | `git ls-tree HEAD tools/`; origin/claude/e54-prep | built on claude/e54-prep, not in base | release notes |
| The plan's 71-sheet, 84-viewports and styleSnapshot "no difference" and C2's screenshots are recorded nowhere read | e54-prep SPLIT-STATUS.md | not measured | release notes |
| R4800-R4805's registry stage column reads E93 | R-REGISTRY.md:1429-1434 | open (the tool's rule, not checked) | release notes |

## E38 - the multi-client harness

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| 85-chaos's list is not built: parallel Eclipses, the pool and Search under a reload, a player with two characters | audit/harness/README.md:228; e38/STATUS.md:59 | open | release notes |
| 82's 11.10 scope is not built headless (Testimony, Closing, Objection in Closing, Logic Dive, `mutedDead` under a reload and a change of primary) | e38/STATUS.md:60-61 | open; its live half LIVE-E38-04 | release notes |
| A11 Frisk across two GMs is partial: `action.friskAnswer` across GMs and `frisk.cancel` are not driven | 97-two-gms.mjs:189-192 | open | release notes |
| 64-migration-drill is not built | README.md:201 | needs a local Foundry: a v14 sandbox and copies of the v1.1.0, 1.2.13 and 1.2.56 worlds under DRPG_FIXTURES (LIVE-E38-03) | release notes |
| audit/live has no third account, no gm2, `reload` or `makePrimary`, so 97 and 98 cannot run at the local gate | audit/live/sandbox-cluster.mjs:20, :60 | needs a local Foundry: GM, second GM and two players (LIVE-E38-04) | release notes |
| Item transfers are not chained across two GMs on two browsers | inventory.mjs:1010 | open | release notes |
| FLOWS "truth-bullets" stays `partial`, stage E38, though `bullet.give` landed; README row 98 describes the card to an absent p2 as before C5; STATUS's item numbers contradict themselves (508-511 vs 519-522) | tests-flows.mjs:430-431; README.md:228 vs 98-chaos.mjs:94; e38/STATUS.md:81, :84-90 | open, stale words | release notes |
| Q-E37-4's carried items and SIER-R1's D041, D086, D094, D120, D146, D175, D177 | the source file is not in this checkout | not checked | release notes |

## E39 - behaviour tests: movement, items, actions, projects

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| A move between the trial hall's zones is not checked for every step it must not run (68 has no phase M) | e39/STATUS.md "Gaps left" | built on claude/e39-43-113 (30a10b5b), not in base | release notes |
| Palm's Frisk in both modes is not driven from 99; Find Stash and Find Passage at their flat 16 are priced, not banded | 99-actions.mjs (no "frisk") | built on claude/e39-43-113 (c5840f11), not in base | release notes |
| The shim is not calibrated against v14 (`movement.pending.waypoints`, `Region.levels`) | AUDIT item 512; lib/shim.mjs | needs a local Foundry: a real drag across two rooms with waypoints and one up a Change Level stair, its options logged (LIVE-E39-01) | release notes |
| The Eclipse limit's four guards each SURVIVED alone in 70's mutants | e39/STATUS.md, Mutants | open | release notes |
| drawItem in two languages is tested in one browser, not two clients; the 14 project cases came from changeStep's header, not the S09 list (not in this checkout); 15 FLOWS rows still `partial`, stage E39 | tests-tier2.mjs:77798, :78866; tests-flows.mjs | open | release notes |

## E40 - behaviour tests: trial, reset, state invariants

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| 18-trial covers the trial's five steps only: two Blackened, duplicates on the card, a GM reload in the vote, a late player, preselection and "Nobody", D4's offer once, a death before and after discovery, the Final Trial and a second trial (D17) are not in it | 18-trial.mjs (106 lines); README.md:181 | open (some in 61, 63) | release notes |
| 18-trial scans only the world and the chat on p1 and p2 after each step, not the whole `playerLeakScan` | 18-trial.mjs:34-35; lib/canary.mjs:653 | open | release notes |
| checkState holds three invariants; the plan's fuller list was never recovered | state-check.mjs:6-18 | open | release notes |
| No shared "allowed now" predicate; the matrix is a test with no floor-mode dimension and no `passage.*` / `action.frisk*` columns | tests-tier2.mjs:49178; `git grep -i allowedNow scripts` | open | release notes |
| The mutation run is recorded, not in the release gate (the "done when" wants it there) | e40/STATUS.md | open | fix window |
| settle() to until(): no before/after time recorded; 176 of 178 sites left | e40/STATUS.md item 5 | open | release notes |
| FLOWS rows and two tier 0 notes still say "partial until E40" / "left to E40"; R25, R55, R69, R87, R95 read "removed in E54" though E40 item 4 removed them | tests-flows.mjs:131, :159, :253; tests-tier0.mjs:9118, :9188; R-REGISTRY.md:35-105 | open, stale words | release notes |
| `revertPlayerBulletEdit` puts back a field the bullet never had as the key holding null | truth-bullets.mjs:1336-1345, :1407-1416 | open, read not run (an owner question in STATUS) | release notes |
| LIVE-E40-01 is not in AUDIT 9.2; the handbooks do not name checkState | grep of AUDIT and docs/handbooks | needs a local Foundry: checkState at a real primary GM's start on a played world | release notes |
| The behaviour tests of Level Up and the chapter end the "done when" asks for | - | not checked | release notes |

## E43 - the second security round

S17-31 (the killer's identity, high) is closed in this base: no known-leaks entry, the name in the GM store
(projects.mjs:1567-1580, projects-secrecy.mjs:128, migrate.mjs:1091-1110, 72-canary.mjs:258-275).

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| A secret project's `indirectMurder` mark stays in projectMeta, world data: measured on p1 and p2 in 72-canary (LEAK-PROJECT-MARK.md); not a Foundry limit; its room is also told by the project token's position (`foundry-hidden-tokens`); the countdown's `img` is the GM's pick | projects-secrecy.mjs:171; projects.mjs:67, :990, :2212; traps.mjs:202; gm-stores.mjs:2550 | open, red, the fix not small (a proposed patch in LEAK-PROJECT-MARK.md) | fix window (D27's "plans": blocks unless the owner rules) |
| The whole-season canary is not built: 72 walks one chapter, and plants no closingClaims, diveSets, claimTicket or passage keys | 72-canary.mjs | open (STATUS: carried to E58) | release notes |
| The fuzz and the matrix run in the ci layer only | 30-security.mjs:7139-7145; 33-bridge-paths.mjs:2158 | needs a local Foundry: the fuzz on the 30099 sandbox (LIVE-E43-01) | release notes |
| LIVE-E43-01 and -02 are not in AUDIT 9.2 | grep | needs a local Foundry: (02) a bystander's Countdowns on v14 show no secret project's name | release notes |
| `projectLabel(id, user)` is not built | projects.mjs:2622 | open | release notes |
| The README chapter "What a player with a console always sees" is a draft only | docs/dev/e43/README-CHAPTER.md; README.md | open (the owner's file) | fix window (in the plan's "done when") |
| A secret project's description still goes on a chat card (`descriptionTold`) when its words change (Open 103) | projects.mjs:220-283 | open | release notes |
| The session log drops new rows past 60 (E43-F7); a Truth Bullet edited while no GM is online is only listed; no length bound on bridge text fields | utils.mjs:261, :281; truth-bullets.mjs:1429-1437; bridge-guards.mjs:1494-1500 | open | release notes |
| Stale pointers: projects-map.mjs:29 "the name moves in E43"; 76-passages.mjs:11; the fuzz's prototype check was never seen to fail (no mutant run for it) | the files named; e43/FINDINGS.md | open | release notes |

## E102 - tooltips across the module

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| C6, the Investigation and case family, is not in base: 52 census rows say "E102 C6", R4755 is absent | tools/tooltip-census.json; `git grep '"R4755 '` | built on claude/e102-c6 (9c1a4104, 62558842, 767c8e34), not in base | fix window |
| 66 census rows say "E102 C12" (controls merged after the census); each turns red the day E102 ships | tooltip-census.mjs:492-498 | built on claude/e102-c6, not in base | fix window (blocks shipping E102) |
| C7, the incident node's second key ("What a finder reads"), is missing in base and on e102-c6 | lang/en.json, lang/pl.json | open | release notes |
| C10 (screenshots) and C11 (ledger, notes) are not done; the drawn census covers 53 keys in scenario 95, most windows are not read drawn | e102/STATUS.md:29; 95-tooltips-drawn.mjs | open | release notes |
| Foundry's tooltip delay and position, and a tooltip over a disabled button | AUDIT-1.2.42.md:1354 | needs a local Foundry (LIVE-E102-01, Q-E102-2) | release notes |

## E55 - CSS consolidation and the stylesheet split

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| The look freeze (audit/style-freeze.mjs, MEASURE.md) and R6100-R6104 are not in base | `ls`; `grep -c "R610[0-4]"` is 0 | built on claude/e55-113, not in base | fix window |
| The FA6/FA5 fallbacks (S12-72), `max-height: 88vh` on every non-module sheet (S12-87), the global `[class*="effects-display"]` hide (S12-92), no `flex-wrap` on the duality formula (S12-89), the dead rules and overridden declarations | danganronpa.css:8433-8434, 9217-9218, 15366-15368, 15339-15344, 10960-10968 | built on claude/e55-113, not in base; the 88vh rule also needs a local Foundry (LIVE-E55-02) | fix window |
| `!important` 866 in base (the plan's start 869; 827 on the line); colour literals 352 | `node tools/check.mjs css` | open, partly on the line | fix window |
| Step 3 (one colour and one size rule per surface and theme, D29's Legacy consolidation) and the split (S17-55: danganronpa.css 19229 lines whole) are done on no line | claude/e55-113 STATUS "Open"; module.json | open | release notes |
| No defensive Daggerheart selector is marked "not emitted" (Q-E55-4); `#ui-top:empty` undecided (S12-84); STYLE_SURFACES lacks `#drpg-tile-row` and `drpg-dock-hidden` | grep; narrow.css:413; style-snapshot.mjs | open | release notes / fix window |
| The look after the work, both themes, against C0's screenshots | - | needs a local Foundry (LIVE-E55-01, -03, -04) | release notes |

## E56 - module hygiene

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| `no-unused-vars` is not on, so the goal's "0 no-unused-vars" is not measured | eslint.config.mjs:40 | open (Q-E56-1) | fix window |
| The comment guard is a ratchet (141 cited names no code holds, 3 doubled JSDoc blocks, held at budget), not zero | `node tools/check.mjs comments`; tools/comment-budget.json | open | release notes |
| No guard that every en.json key has a reader; tools/e56/keys.mjs exists and nothing calls it | grep of check.mjs, the suite, the harness | open | fix window |
| Four dead keys of S13-57 remain in both files: `DRPG.Murder.addThird`, `whoWalkedIn`, `nobodyElse`, `noStressLeft` | lang/en.json:2515-2517, :2551; pl.json:2665-2667, :2703 | open | fix window (the text lines) |
| U+2013/U+2014 and U+2212 remain in code and CSS (config.mjs, fog-geometry.mjs, mastermind.mjs, utils.mjs:1200, danganronpa.css:12132, :15228; U+2212 in pl.json, action-report.mjs, cleanup.mjs, config.mjs, search-tokens.mjs) | `git grep` | open (C13) | fix window |
| S10-75: `trialSlotFace` builds `speaker` and `versus`, which only a test reads; `CASE_PROBLEMS` exported, now read by a tier 0 row (the merge settles it); the duplicate colour helpers kept by decision | hud.mjs:1144-1170; case-schema.mjs:500; docs/dev/e56/C10-LIST.md | open | release notes |
| No comment policy for new code in the root rules; SIER-R1's four items and the S01-S13 citation sweep | grep | not checked / open | release notes |
| A world whose macros call `game.drpg.*` runs with no missing function | - | needs a local Foundry (LIVE-E56-01) | release notes |

## E25 - texts, Polish and the handbooks

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| tools/stale-pl.mjs, the reviewed file and T9 do not exist | `ls`; MODES | open (built on claude/e57-tools 78e4576e as tools/pl-reviewed.json, not in base) | fix window |
| T8 (28 found) and T7 (40 found) are still report mode; T6's baseline holds 9 rows marked `empties: "E25"` | tests-text.mjs:2402-2412, :2465, :2469; `check text` | open | fix window |
| D33c is not applied: whole-word "GMa" on 56 lines of gm-handbook.pl.md, 18 of player-handbook.pl.md, 1 of the brochure | `grep -cw` | open | fix window |
| "Stage 4/5/6" jargon on 12 lines of lang/en.json; "analysed" (D33e) in en.json and the handbooks; `stillToAct` "Zostały akcje" (S13-23); `noMovesLeft` "Your token has been put back." (S07-39); "the first four questions are boundaries" (S01-25); the brochure's "The names stay English" | lang/en.json:2321, :4006, :5666; lang/pl.json:681; player-brochure.en.md:3 | open | fix window / release notes |
| Glossary `db3-english` and `mechanic-capitals` still open, staged E65 while text-style.md says E25 settles them | docs/glossary.json:78, :434; text-style.md:795-796 | open | release notes |
| C0's census of the 38 issues does not exist; S12-17, S01-37, S01-49 | - | not checked; LIVE-E25-01..03 need a local Foundry | release notes |

## E71 - the UI copy-edit, EN and PL

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| Batches B01b-B05 (e71-a) and B06-B18 (e71-b, -c, -d, merged on handbooks-113) are not in base; e71-a is merged into no other line | `git merge-base --is-ancestor`; STATUS-A..D | built on the lines, not in base | fix window |
| C20 (the fog and voice literals, 102 T13 finds) and investigation.mjs's 5 are not in base; settings.mjs:1198 "Safe Word" a literal on every line | `check text --all` T13 | built on e71-d, not in base; the last open | fix window |
| "No literal left in UI-rendering code": T13 finds 846 in 147 files on base, 743 on e71-d, unclassified (patches.mjs 264, module.mjs 124 ...) | `check text --all` | open | fix window (or narrow the claim in the notes) |
| C21 is done nowhere: the ten lints marked `fail: "E71"` are still report mode; Q-E71-3 unsettled | tests-text.mjs:2467-2484 | open | fix window |
| DB19 (third person on cards many read): T16 still 11; US spelling not whole (28 in base, a few left on handbooks-113); DB15 Remnant (25 "trace(s)" in en, 12 "ślad*" in pl); DB17 "Search Token" (3 lowercase) | `check text`; grep of lang | open, partly on the lines | fix window |
| Q-E71-4 (`gm-bar-buttons`) open; the 15 E57 UI items cannot be read (their S texts are not in the repo); no owner sign-off on any batch text | docs/glossary.json:1329; batch files' `owner` null | open | release notes |
| Screenshots per window batch; LIVE-E71-01..03 not in AUDIT | - | needs a local Foundry: every window batch in both languages and themes at 1366x768, 1024x768, 820x1180 | release notes |

## E57 - text guards, rules-parity, contextual help, handbooks

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| C1 stale-pl, C2 rules-parity (53 rules, without Tamper's ladders, E51's thresholds, Monocub's numbers, A10's passages, the Logic Dive and Scrum timings), C3 D34 (`documentLanguage` still `config: false`; inventory.mjs:852 writes English "Tier ${tier}." into a world document), C4 D35's "?" (`openHandbooks(book)` takes no section), C5 51-lang-mixed: none in base | `ls`; settings.mjs:1720-1731; handbooks.mjs:357 | built on claude/e57-tools, not in base | fix window |
| The Polish baseline is stamped "baseline, not a read" on every key; C12's `--sheet --since v1.2.56`, the 60 rendered texts and `--stamp` are not done | e57-tools STATUS C12 | open | release notes, or a fix window if the owner wants the read |
| T7 reads lang only; T8 and the forbidden forms are not FAIL for the handbooks; T10 and T26 exist nowhere; handbook pairs at paragraph level are printed, never red | tests-text.mjs on base, e57-tools, handbooks-113 | open | fix window |
| C6-C11 (the handbooks) are on handbooks-113, which holds neither e71-a nor e57-tools; the handbooks grew (GM EN 67 816 to 78 260 words) where the plan said shrink | handbooks-113 STATUS-HANDBOOKS.md | built on handbooks-113, not in base | fix window (the merge order) / release notes |
| No "supported screen" sentence and no note on numbers after session 0 found by grep; about 40 UI or code texts the handbook line found wrong (e.g. config.mjs:2530 HOPE_CALLS.freeCrit against roll-dialog.mjs:984-991) | grep on handbooks-113; STATUS-HANDBOOKS | open | fix window |
| LIVE-E57-01..03 only on e57-tools | grep | needs a local Foundry: each "?" opening its section (EN, PL, both themes, 1366x768 and 820x1180), the handbook window at 820x1180, a document in another world language | release notes |

## E53 - the performance budget (needs a local Foundry)

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| perf() has no line for six of the goal's costs (the rings' blur, the E29 audit on the primary, canvas.draw at the trial room, the card render, the dashboard rebuild, the fog); no counters for the notice history, room tile, Foundry tools windows or `auditMove` | diagnostics.mjs:1680-1832; the `count("...")` list | open | fix window (code) |
| No budget in the root rules, no tier 2 test with D27 thresholds | grep; tests-tier2.mjs:23751 | open | fix window |
| The balance log (`balanceReport()`, docs/balance.md, its switch and world-secrets entry) does not exist | `git grep balanceReport` 0 | open (Q-E53-3) | fix window or release notes |
| No table number recorded: perf-baseline.json `not-measured`, `runs` 0, world copy lost | audit/perf-baseline.json | needs a local Foundry: v14 at 127.0.0.1:30099 with Daggerheart and the module at the release commit, a world copy whose name holds gate, copy or qa, the largest isometric scene, a 1366x768 laptop on its GPU, GM and the weakest player, `perf()` and `fps()` in both themes (LIVE-E53-01, LIVE-E33-05) | release notes |

## E58 - final verification in a sandbox (needs a local Foundry)

| Gap | Where read | Status | Verdict |
| --- | --- | --- | --- |
| The headless halves - a fresh review of the incident and investigation files by an agent that did not fix them, and reading the module from README and the handbooks alone - are done on no branch read | - | open | fix window |
| No checklist equal to verifyLater; its source (AUDIT-DEFERRED-31.10.md, D194) is not in the repository; AUDIT holds 504 LIVE-E ids, how many closed not measured | `git grep -il verifyLater` 0 | open | fix window / release notes |
| 16-first-run is planned only; FLOWS' voice row `planned`, stage E58 | README.md:179; tests-flows.mjs:433 | open; the run needs a local Foundry | fix window |
| The local gate has never run: local-gate.json bound to 325b5500 (1.2.112), all 8 parts `not-run`, `no-server`, `fixtures.dir` null | audit/gate/local-gate.json | needs a local Foundry: Foundry v14 (14.364-14.365) at localhost:30099, Daggerheart at the chosen version, Dice So Nice and isometric-perspective, the module byte for byte from the release commit, the four accounts, one client in Polish, a 1366x768 view and 390 px views, a world whose name holds gate, copy or qa, seeded by audit/live/seed-world.mjs, DRPG_FIXTURES for the drills | release notes |
| The 1.3.0 notes' known-risk section split by session 0 does not exist | docs/ | open | release notes |
