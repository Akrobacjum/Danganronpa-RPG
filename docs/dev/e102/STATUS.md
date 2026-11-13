# E102: tooltips across the module - status

Branch `claude/e102`, from `origin/main` 421f2395 (1.2.109) with the prep commit 813d506d on top. Started 13.11.2026 on
the coordinator's word: the owner (13.11, about 01:35 CET) accepted the plan's five defaults (PLAN.md section 8) and
asked for the stage now, not after 1.2.124. R numbers: R4750-R4799.

## What changed from the plan, and why

| Plan said | Built | Why |
| --- | --- | --- |
| starts after e101, E57 C4b, E71, E54-E56 | starts now, on 1.2.109 | the owner's word; to keep merges cheap the tooltip keys are new keys only (no value of an existing key is rewritten), all in one new block `DRPG.Tips` placed after `DRPG.Kit` (a stretch of the lang files no live line touches on 13.11), and each commit is one screen family |
| E57 C4b adds the tab tooltip | C1 adds it (a section's `tooltip` in `tabNav`, one line) | C4b is a plan, not code, on 13.11; E57 takes it over as built |
| C2-C9 by window group, C9 for "Change" | C2-C6, one per screen family; the Investigation family last | the review page had no verdicts when the stage started (the `decisions` store read empty, 13.11 00:35 UTC), so the proposals are built as written and a later verdict changes a key's words only. claude/e64 (held for 1.2.110) rewrites investigation.mjs's bar and tables, so the Case family waits for it on main |
| a census check by the drawn DOM as well | the static census only, held by `node tools/check.mjs tooltips`; each family commit adds one R test that reads each of its keys in the function that draws its control | a DOM read of 137 windows needs each window opened with its world. What the census reads, and what it does not, is its header's list (tools/tooltip-census.mjs), not "every control": REVIEW-102 C1 found whole kinds it missed, and the list is what was widened after it |

## Commits

| # | Family | Files | Tooltips (sites) | Test |
| --- | --- | --- | --- | --- |
| C0 | this file, KEYS.json | - | - | none (docs) |
| C1 | the kit and the gate | ui-kit.mjs, tools/tooltip-census.mjs + .json, check.mjs | - | R4750 |
| C2 | Actions and projects | action-*, frisk, call-pickers, calls, overflow, rest, use-items, roll-draw, observe, projects-ui | 31 (35) | R4751 |
| C3 | Chapter, murder and Class Trial | trial-zones-ui, trial-floor-ui, murder-rules, cleanup, chapter, trial, boundary, mastermind, trial-scene, murder-ui | 37 (38) | R4752 |
| C4 | GM panels | gm-items, gm-students, gm-stores, gm-team-dialog, gm-panel, gm-campaign, monocub, despair, sheet-audit, diagnostics, requirements | 44 (46) | R4753 |
| C5 | Setup, sheet and the rest | tables-editor, passages-tab, level-up, sound-panel, room-tile, season-setup, settings-window, room-setup, anonymity, messenger-app, sheet, popup | 28 (29) | R4754 |
| C6 | Investigation and the case | investigation, case-map, case-realize, case-summary, remnant-ring | 41 (60) | R4755 |
| C7 | the incident node's note (texts-e71's item, the coordinator 13.11) | investigation.mjs `schemaEditor`: a second key for a planned Incident Remnant node, "What a finder reads" / "Co przeczyta znalazca", where the node's text becomes the Remnant's words (`placeIncident` opens New Remnant with it); built last, after claude/e97-98 (which is editing `schemaEditor`) is pushed and merged into claude/e102 | - | 1 R |
| C8 | the sites the widened census reads (REVIEW-102 C1): notice history, the voice list, the room tile's buttons, summaries, each tab | 2 tooltips (the voice list's volume, push-to-talk's Change the key), 3 sites found tipped already (data-tooltip-text, now read), 22 with a reason | 2 (2) | R4761 |
| C10-C11 | screenshots, ledger, LIVE | - | - | - |

`KEYS.json` holds each family's keys: one key per distinct tooltip of a family (179 keys for 208 sites), with the
sites it serves.

## Merges

Before each push: `git merge-tree --write-tree` against origin/main, origin/claude/e101, origin/claude/e100,
origin/claude/e97-98 and origin/claude/float-text (and claude/e64, this line's own), each read; a conflict is listed
here, not resolved on another line's files.

| Commit | main | e101 | e100 | e97-98 | float-text | e64 |
| --- | --- | --- | --- | --- | --- | --- |
| C0-C3 (pushed 13.11) | clean | R-REGISTRY.md, settings-window.mjs, tests-tier0.mjs - all three also conflict between e101 and main alone (e101 stands on 1.2.108), none of E102's | R-REGISTRY.md (generated: `node tools/registry.mjs --write` after the merge); rest.mjs was E102's (C2's tooltip beside e100's relabelled Rest button) and is moved apart in "C2 follow-up" | R-REGISTRY.md | R-REGISTRY.md | chapter.mjs (End the chapter: claude/e64 redraws the window in two columns; this line's own, resolved when 1.2.110 is on main), plus four that e64 has with main alone |

| C4-C5 and the import commits (pushed 13.11) | clean | five files where e101 reshapes a control E102 tipped (below) | none | R-REGISTRY.md | R-REGISTRY.md | none (chapter.mjs and level-up.mjs met only through the kit import, now on a line of its own) |

| review fixes (pushed 13.11, about 03:00 UTC) | clean | the same four as before (gm-panel, gm-team-dialog, season-setup, tables-editor), e101's reshapes | none | R-REGISTRY.md; trial-zones-ui.mjs: e97-98's new push writes `named(...)` on the Scrum thesis input and the set select, the two tags E102 tipped - same line, resolved by keeping both attributes | R-REGISTRY.md | none |

How it was read: each branch's conflicts with origin/main alone, against its conflicts with claude/e102; only the
difference is E102's. R-REGISTRY.md is generated and conflicts wherever two lines add R numbers.

## The review of c5cf2aff (REVIEW-102, claude/e93 dbbd91e5)

| Finding | What was done | Commit |
| --- | --- | --- |
| C1 (high) the census never read wrappers, aliased or unlisted builders, `<summary>`, `<a data-action>`, `role="button"` | read now, one level of local wrapper; the tab, mode and chip builders one site per object | 937082c0 |
| C2 the baseline could grow | a `why` on every row; no count above origin/main's copy (not on main yet: the gate prints that); a stage's rows red once it shipped. Left: one identity is a count per function, kind and key | 937082c0 |
| C3 help from the neighbour | the control's own attribute, call or variable; `tooltip: ""` is none; a key with no words is red. A hint line is still by proximity, and the header says so | 937082c0 |
| C4 three plants of eight kinds | 25 plants, every kind; old census 13/25, new 25/25 | 937082c0 |
| C5 / L2 the registry said E64, no stage row | E102 in stages.json (planned 1.2.133; ids may have three digits now), R4750-R4754 say E102 | d3c7c3b2 |
| T1-T15 | the words, two code changes (Rest's cost, the project window's key), five tooltips dropped, `title` on the controls drawn disabled; R4760 | af5939de |
| T16 Grant all is in the posting GM's language | left: the card is GMs-only, nothing leaks; a GM in another language reads the poster's words | - |

## The review of C4 and C5 (REVIEW-102-C4C5, claude/gaps-radio e7152e5b), and a second read of Gm, Setup and More

| Finding | What was done | Commit |
| --- | --- | --- |
| G1, G2, S1, S2 (medium), S3, S4, G3-G7, S5, S6, S8-S11, the style notes | as the review proposed, with three changes said in the commit: G1 says Health and Sanity full (text-style M7; R1448 failed the review's Polish "znacznikami"), G2 and S2 shortened under the 23-word limit, G5 says what Apply does to a held death (chapter.mjs publishDeath) | f8bb7826, R4762 |
| S7 (closeX on cards kept nowhere) | the gaps line's: a code fix | - |
| the second read's 5-15, 22, 23 | five label or window repeats dropped (each a baseline row), the passages menu's two keys, Play's title, wordings | b30682c8 |
| the second read's Case findings (1, 2, 16-21) | taken into C6 | - |

R numbers: R4750-R4754 (C1-C5), R4760 on (review fixes, C6-C8).

## Tier 2

Whole, on C2 (70613472), 13.11 01:17-02:32 UTC: tiers 0-2, 2676 tests, 2652 passed, 1 failed, 27 skipped. The one: "every
control in the module's own chrome has a name to be read out" - a Daggerheart trait `<input>` on the sheet of a
character a tier-2 test made (r3551), not an E102 control. Measured on main alone (421f2395, 13.11 about 03:20 UTC):
`node run-tests.mjs --tier 2 --only R3551 --only "every control in the module's own chrome"` fails the same way, so it
is main's: an order dependence (it fails after R3551 has run; why was not traced), which CI's shards
may not meet if they run it in another order (not checked). Not E102's to fix; told to the coordinator.

## Open

**E101 (GM screens) reshapes five controls E102 tipped.** Read with `git merge-tree` against origin/claude/e101 on
13.11 (e101 at its push of that day); not resolved here, by the coordinator's rule. When e101 is on main, E102 merges
main and re-applies:

| File | e101 | E102's tooltip then |
| --- | --- | --- |
| gm-panel.mjs, the Debug log's footer | adds a Foundry report button and rewrites the footer | Copy and Clear keep their keys, written into e101's footer |
| gm-panel.mjs, Students left | removes the line's Students button (the Now section's tile is the door, R4054) | `DRPG.Tips.Gm.studentsTooltip` dropped with it, or moved to the tile if the tile has none |
| gm-team-dialog.mjs, Monokumas tab | redraws the pool column without the Monokuma checkbox column | `monokumaTooltip` dropped or moved; `despairPoolTooltip` kept on e101's select |
| season-setup.mjs, Reset the season | removes the footer's Reset (a role button elsewhere) | `resetTheSeasonTooltip` moved to e101's button |
| tables-editor.mjs, a table's actions | hides Rename for the tier tables on the same line | Delete's tooltip written into e101's line |

Each family test (R4753, R4754) names the function that draws each key, so a key whose control is gone fails there
until it is moved or dropped (and KEYS.json says so).
