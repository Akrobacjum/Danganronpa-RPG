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
| a census check by the drawn DOM as well | the static census only, held by `node tools/check.mjs tooltips`; each family commit adds one R test that reads each of its keys in the function that draws its control | a DOM read of 137 windows needs each window opened with its world; the per-family tests and the census together hold every site E102 fills |

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

How it was read: each branch's conflicts with origin/main alone, against its conflicts with claude/e102; only the
difference is E102's. R-REGISTRY.md is generated and conflicts wherever two lines add R numbers.

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
