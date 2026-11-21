# STG-96, STG-98 and DOC-04 for the owner (1.2.122, line STG, 21.11.2026)

Three texts for files this line may not edit, each ready to paste, and what DOC-04 needs. Read against the tree at
aacab044 (the line's tip before this paper).

## 1. README.md, the Privacy paragraph (STG-96)

After "...and private messages reach only their readers.":

> Since 1.2.115 the GMs' browsers also keep a copy of the whole case, the Key Remnant plan in it, in a file in the
> world's folder on the Foundry server, so a GM who opens the world alone on another computer finds the case there. The
> file is not encrypted and is in no world data: only accounts that may browse or upload files can find it, which the
> module keeps off players' roles, its name cannot be guessed, and Foundry's server is taken to hand it to anyone who has
> its exact address (not yet read on a real server: LIVE-E111-02).

And in the same paragraph, "the Key Remnant plan and a murder declared in the dark stay on the GMs' browsers" becomes
"the Key Remnant plan and a murder declared in the dark stay with the GMs (the plan also in the case's file above)".

What each clause rests on: case-copy.mjs `copyFolder` (`worlds/<world>/drpg-case`), `newCopyName` (`case-<32 hex>.json`,
128 random bits), `FILE_PERMISSIONS` FILES_BROWSE and FILES_UPLOAD, `filesRefusal`; enforced.mjs's row `playerFiles`;
gm-stores.mjs `keyPlanStore` is `backup: true`, so it is in the copy; scenario 34 A2 and A3; the address served to anyone
is assumed (LIVE-E111-02, item of AUDIT 9.2).

## 2. .claude/rules/trust-model.md (STG-96)

docs/dev/e111/TRUST-DRAFT.md's paragraph, as written, to stand after "Layer two", before "What stays open", with its last
two sentences moved into "What stays open". Its facts were read at aacab044: the folder and file name as above,
`filesRefusal`, `copyRefusal`, `writeServerCopy`, `readServerCopies`, R7345 and R7346 (tests-tier1.mjs), scenario 34's
A2, A3, B1 and D1. The paragraph:

> **The case's copy on the server (E111, 1.2.115).** Since 1.2.115 the case - every GM store with `backup: true`, the
> file Back up saves - has a copy outside the GMs' browsers: a file in the world's folder on the Foundry server,
> `worlds/<world>/drpg-case/case-<32 hex>.json`, uploaded by a GM's browser through Foundry's FilePicker (case-copy.mjs).
> It is not in world data: no setting, flag, chat card or log line holds the file or its name, so nothing Foundry sends to
> a player's browser carries it (scenario 34 A3 scans a player's world settings, localStorage, chat messages, flags and
> every packet sent to it for the name and the planner's fields and values). It is not encrypted. What keeps it from a
> player is Foundry's: listing the folder asks FILES_BROWSE and uploading asks FILES_UPLOAD (the harness's stand-in judges
> both, scenario 34 A2; on v14, LIVE-E111-02), and enforced.mjs's row `playerFiles` keeps both off the Player and Trusted
> Player roles; and the name, 128 random bits, cannot be guessed. The module writes no copy while that row is off, or
> while the permissions in force give either permission to a Player, a Trusted Player or a player's own account
> (`filesRefusal`; R7345; scenario 34 B1-B2), and tells the GMs why. A write never comes from a browser whose stores have
> not heard the other GMs, and never before it has listed and merged every copy in the folder (`copyRefusal`,
> `writeServerCopy`; R7346; scenario 34 D1-D2). What stays open: Foundry's server hands a file of the data folder to
> anybody who asks its exact path, logged in or not (assumed, LIVE-E111-02), so a name that leaks - pasted into a chat,
> shown on a shared screen, read off a GM's console - gives the whole case to whoever holds it; and a GM who gives a
> player FILES_BROWSE while no GM is connected is caught only at the next GM's write or load.

## 3. .claude/rules/code.md, the export counts (STG-98)

Measured with espree (the lint's parser, audit/harness's node_modules) over every row of the "Where the code lives" table
that states a count: a file's names are its `export` declarations (each name of an `export const a = 1, b = 2` counted)
and its `export { ... }` lists without `from`; a re-export is a name in a facade's `export { ... } from "./<file>"`.
21 rows differ; every other row that states a count matches. Each change is one phrase of its own row:

| Row | Now | Measured |
| --- | --- | --- |
| `scripts/fog.mjs` | 53 names of its own | 55 names of its own |
| `scripts/projects.mjs` | 49 names of its own, 16 re-exported | 63 names of its own, 17 re-exported |
| `scripts/projects-ui.mjs` | 8 names of its own | 19 names of its own |
| `scripts/call-effects.mjs` | 33 names of its own | 35 names of its own |
| `scripts/action-rolls.mjs` | 62 re-exported (24 from action-pipeline.mjs, 13 from action-search.mjs, | 56 re-exported (24 from action-pipeline.mjs, 7 from action-search.mjs, |
| `scripts/action-pipeline.mjs` | 31 names exported | 32 names exported |
| `scripts/action-search.mjs` | 9 names exported | 8 names exported |
| `scripts/action-project.mjs` | 11 names exported | 12 names exported |
| `scripts/gm-bridge.mjs` | 86 re-exported (72 from bridge-asks.mjs, | 94 re-exported (80 from bridge-asks.mjs, |
| `scripts/call-gm.mjs` | 28 names exported | 22 names exported |
| `scripts/vault-store.mjs` | 51 of them re-exported | 50 of them re-exported |
| `scripts/gm-panel.mjs` | 8 names of its own | 13 names of its own |
| `scripts/hud.mjs` | 11 names of its own | 13 names of its own |
| `scripts/music-states.mjs` | 11 names exported | 15 names exported |
| `scripts/sfx.mjs` | 7 names of its own | 15 names of its own |
| `scripts/sfx-play.mjs` | 22 names exported | 27 names exported |
| `scripts/vote.mjs` | 20 names of its own | 21 names of its own |
| `scripts/trial-progress.mjs` | 15 names exported | 21 names exported |
| `scripts/verdict.mjs` | 12 names exported | 18 names exported |
| `scripts/sheet-header.mjs` | 18 names exported | 24 names exported |
| `scripts/key-remnants.mjs` | 28 names exported | 30 names exported |

Not counted by this reading: the line counts some rows state (hud.mjs "1639 lines since E23", sheet-actions.mjs 1545,
tables-editor.mjs, vault-store.mjs), and the facade rows' prose. docs/dev/e56/C14-COUNTS.md read 18 of 22 rows as
stale on 13.11.2026; this reading is of the whole table on 21.11.2026.

## 4. DOC-04: claude/e58-local's batch 1 (7875554f, the owner's commit)

What it is: test-side only - tests-kit.mjs `standIn` and `env.replaceable` (a stand-in for what v14 holds read-only, and a
probe where none can stand), tests-grid.mjs and tests-tier2.mjs `putBackRolls` (a message's `rolls` put back, not
deleted), `rerollableRealRoll`'s subclass named as the real class with its dice scripted, `setActive` (a v14 User's sealed
`_source`), the tests that stood in `game.i18n.format`, a Module's `active`, `foundry.utils` and `foundry.canvas` moved
onto them, and R7745 (tier 0) holding the kit's two; plus 38 lines of docs/dev/e58/LOCAL-REPORT.md.

What can be done without it: nothing of its own substance - each fix is the commit's, and writing them again here would
be the same lines under another author. What this line measured instead: whether the commit applies onto this line's tip and what tiers 0-1 read with it
(section 5).

What needs it: the 13 tier-2 Reroll tests' "reading 'length'" at a table (`delete message.rolls`), the Reroll stand-in's
"Unable to recreate TableReroll", the read-only `format` in R2077, R3980 and two tier-2 tests, and the `_source.active`
writes - all read only on the owner's sandbox (LOCAL-REPORT on claude/e58-local), none headless, where the shim's objects
are writable.

## 5. DOC-04 measured: 7875554f on this line's tip

On a throwaway worktree at aacab044 (21.11.2026), `git cherry-pick -n 7875554f`: the five script files applied with no
conflict (tests-grid, tests-kit, tests-tier0, tests-tier1, tests-tier2: 143 insertions, 30 deletions); docs/dev/R-REGISTRY.md
and docs/dev/e58/LOCAL-REPORT.md conflicted, both files this line also edits - the registry is generated
(`node tools/registry.mjs --write` gives R7745 its row), and the report's 38 lines are the owner's to place. Tiers 0-1
headless with it: **1838 passed, 0 failed, 16 skipped, 0 red** (611 s), where this line's tip reads 1837 / 0 / 16 / 0:
one test more (R7745), no skip more (the shim's objects are writable, so `env.replaceable` holds everywhere headless). Tier
2 with it was not run. What it changes at a table is read only on the owner's sandbox.

## 6. STG-88: the three look baselines read again (21.11.2026, Chromium 153.0.8010.12, the build all three were written in)

| Tool | Reading against its 14.11 baseline | What was done |
| --- | --- | --- |
| `audit/look-freeze.mjs` | 0 differences not accepted; 384 of 416 surface readings found | not written; its `about` says so |
| `audit/style-sweep.mjs` | 8 differences, all one page: `mastermind`, at 4 sizes x 2 themes, which the baseline has no row for (a page added after it) | `--accept mastermind`: that page's rows added, nothing else changed; then 0 not accepted, green |
| `audit/style-freeze.mjs` | 120 differences, all one surface: the select (`.application.dialog select`) on the Investigation window's three Map tabs (map, map-node, map-trace), font size 11 px -> 13 px under Legacy and 11 px -> 21 px (the glass's floor) under Stained Glass, its width and line height following | `--write`. The change is 5ae1b8a0 (1.2.120 line P, "the order's select at the theme's size"), on purpose: before it the select stood under both themes' text floors |

So the look of 1.2.114-1.2.121 differs from 1.2.113's on two things only, both intended, and the three baselines now match
this tree. They are still not a standing gate: no CI job runs them (CI installs no browser for them; style-sweep.mjs's
header), and making them one is a workflow change this line does not make.
