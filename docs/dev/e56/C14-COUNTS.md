# E56 C14 - code.md's counts against the tree (read-only: the agent rules directory is not this line's to edit)

Measured 13.11.2026 with a small espree counter (not kept in the tree): a file's own exported names (`export` declarations and
`export { }` lists without a source), the names it re-exports (`export { } from`), and its lines, read with espree
at a revision. Columns: origin/main ceb9e9c8 (1.2.112 with its release fix) and the e56-c0 line at dca750db (after C6-C9,
C11, C12: C7 and C8 lower some counts).

| code.md line | row | code.md says | main ceb9e9c8 | e56 tip dca750db |
| --- | --- | --- | --- | --- |
| 33 | murder.mjs | 67 names "at 1.2.69" (33 store, 31 rules, 3 window) | 69 (34, 32, 3) | 69 (34, 32, 3) |
| 37 | fog.mjs | 53 own, 5 re-exported | 57, 5 | 55, 5 |
| 42 | projects.mjs | 49 own, 16 re-exported | 62, 16 | 52, 16 |
| 44 | projects-ui.mjs | 8 own, 2 re-exported | 19, 2 | 19, 2 |
| 46 | call-effects.mjs | 33 own, 12 re-exported | 38, 12 | 34, 12 |
| 49 | action-rolls.mjs | 2 own, 62 re-exported (24 pipeline, 13 search, 9 project, 4 dynamic, 3 palm, 2+2+2, 1 each) | 2, 56 (search 7: the stash rework) | 2, 56 |
| 50 | action-pipeline.mjs | 31 exported, 24 re-exported | 32, 24 | 32, 24 |
| 54 | action-search.mjs | 9 exported, 7 re-exported | 9, 7 (holds) | 8, 7 (C8: SEARCH_DEFAULT) |
| 55 | action-project.mjs | 11 exported, 9 re-exported | 12, 9 | 12, 9 |
| 64 | gm-bridge.mjs | 3 own, 86 re-exported (72 asks, 10 call-gm, 1+1+1+1) | 3, 93 (79 asks) | 3, 93 |
| 71 | vault.mjs | 73 "at E41's base" (51, 13, 5, 4) | 73 (holds) | 71 (50, 12, 5, 4: C7 took atOwnVault and vaultRoomOwnedBy) |
| 72 | vault-store.mjs | 53 exported, 51 re-exported | 55, 51 | 53, 50 |
| 75 | gm-panel.mjs | 8 own, 4 re-exported | 13, 4 | 13, 4 |
| 78 | hud.mjs | 11 own, 9 re-exported; 1639 lines | 12, 9; 1686 lines | 11, 9; 1686 lines |
| 80 | tables.mjs | 32 "once E41 C1c had added DRAW_STEPS" (28 pools, 4 editor) | 34 (29, 5) | 33 (28, 5: C7 took MAX_EXTRA_ROLES) |
| 81 | tables-pools.mjs | 36 exported, 28 re-exported | 37, 29 | 36, 28 |
| 82, 119 | tables-editor.mjs | "about 1670 lines", "(1668)" | 1772 lines | 1773 lines |
| 83 | music.mjs | 2 own, 24 re-exported (8, 7, 7, 2) | holds | holds |
| 88 | sfx.mjs | 7 own, 14 re-exported | 9, 14 | 9, 14 |
| 90 | vote.mjs | 20 own, 20 re-exported (14, 6) | 21, 20 | 21, 20 |
| 91 | trial-progress.mjs | 15 exported, 14 re-exported | 20, 14 | 20, 14 |
| 92 | verdict.mjs | 6 re-exported by vote | holds | holds |

On main, 18 of the 22 rows read differ from what they say; 4 hold (action-search.mjs, vault.mjs, music.mjs,
verdict.mjs). murder.mjs and tables.mjs are dated, so each is true of its date and false of today; on this line,
vault.mjs joins them after C7. The counts move with every stage that adds an export, and nothing
checks them, so each one drifts after the next stage that adds an export. Q-E56-4: the counts are edited after E56 lands, by
whoever may edit the agent rules directory (the coordinator's answer of 13.11.2026). A `tools/check.mjs` part could compute them
instead; that would be a tool change.

Also for that edit (Q-E56-1's default): a line in code.md that a dead name may leave a facade - vault.mjs and
tables.mjs each lost one in C7.
