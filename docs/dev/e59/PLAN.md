# E59 - Final consistency review, repository order and the 1.3.0 release gates: the plan

Preparation only (the e59-prep work line, 12.11.2026). Nothing here changes code. Read at `origin/main` =
`421f2395a43e62bbe5308ae83bd7d5376eacf280` (1.2.109, 12.11.2026). E59 is planned as 1.2.125 (`tools/stages.json`),
after E57 (1.2.124), so every number below has to be read again at the stage's base. Line numbers are 421f239's.

This builds on the planning line's plan, `docs/dev/plans/E59.md` on `origin/claude/plan-130` (0d6fac1), written at
ff11458 (1.2.104). That plan holds the goal and the decisions (D27, D47, the 03.10, 05.10, 11.10 and 29.10 amends); they
are summarised here, not repeated. What this file adds: the measurements on 1.2.109, the boundaries with E57 and E83,
the commits with their red-first tests, what waits for which line, and the owner's questions with defaults.

## 1. The goal, in one paragraph

No new features. (1) The ci layer of the gate on one release candidate, with no `expectedRed` left; (2) a second
rating of about 341 screenshots plus the surfaces added since, EN and PL, at 1366x768, 1024x768 and 820x1180, against
D27's thresholds, and a private review page; (3) a review of every window against the kit's contract; (4) README,
CONTRIBUTING, the agent rules, the handbooks and module.json say the same about versions, Dice So Nice, imposed
settings, fallbacks, the threat model and the screen; (5) the repository by D47: macros and pixel-sprite.svg out of the
package, stale docs, branches and tags, issue and PR templates, a CHANGELOG built from the notes, audit/README in
English; (6) one list of every gap between goal and state, for the notes or a fix window. The full local gate on
Foundry v14 is E83's (the 29.10 amend), not E59's.

## 2. Boundaries

| Stage | What it covers (its plan) | What E59 does not do because of it |
| --- | --- | --- |
| E57, 1.2.124 | Texts and handbooks: the text guards (stale-pl, `lang/pl.reviewed.json`, T9/T10/T26), rules-parity, D34 (document language), D35 (contextual "?" help), the handbooks rewritten EN then PL, a cold read. Plan: `docs/dev/plans/E57.md` on plan-130. `claude/e57-prep` was not on the remote when this was read (12.11.2026, `git ls-remote`) | E59 writes no handbook prose and adds no text guard. Its C4 reads E57's finished handbooks against README, CONTRIBUTING, module.json and the agent rules, and changes the other side when they disagree; a handbook sentence found wrong goes back to E57's owner as a carried item |
| E83, 1.2.132 | The auditor's review of every shipped stage (`audit/review-1.3.0/STATUS.md` on `claude/audit-130`), the full local gate on a v14 sandbox (the 29.10 amend), and the fixes it finds; then it repeats the gates its fixes touch | E59 does not run the local gate and closes no LIVE check. It writes each gate's result with the files it depends on (C0), so E83 knows which gates to repeat |
| E26, 1.3.0 | The release commit, the notes with "## Checked", the per-stage verdicts | E59's gap list (C6) is the notes' input; E59 does not write the 1.3.0 notes |
| E38, E39, E40, E43, E53, E58 (1.2.126-1.2.131) | Moved out of the plan on 25.10.2026; their rows stay unshipped | The gates they own (fuzzing, the hostile-client matrix, checkState, mutants, the performance budget, the first run) are recorded "not run: its stage is out of the plan", never as run (Q-E59-1) |

## 3. What reading the tree found (421f239)

Each row was measured on 421f239 in this session; "not measured" is said where it applies.

| # | Finding | Measured how | Effect on the plan |
| --- | --- | --- | --- |
| M1 | `expectedRed` is at 0: `node tools/stages.mjs check` prints "0 expectedRed marker(s) in the tier files and the grid, 0 `until` stage(s) in the kit" (the base plan read 1 at 1.2.104) | the tool | C1 holds it at 0 on the candidate; nothing to re-home today |
| M2 | The local gate has never run a part. `audit/gate/local-gate.json` has 9 committed versions (10.11-12.11.2026), every one verdict `incomplete`, every part `not-run`, reason `no-server`: live-stained-glass, live-monokuma-legacy, live-world-diff, sandbox-14-quiet, sandbox-60-ledger, sandbox-81-render-budget, sandbox-83-roll-integrity (9 of 9), sandbox-84-viewports (7 of 7). `verify-gate.mjs` refuses 1.3.0 in either mode unless the verdict is `passed` (`NO_WAIVER`, verify-gate.mjs:189) | `git log` over the file, each version parsed | 1.3.0 needs all eight parts passed on a v14 sandbox: E83's. E59's C6 names it as the first release blocker |
| M3 | Known leaks (`audit/harness/known-leaks.json`): 9 rows. **S17-31**, killer-identity, **high**, `closes: "E43"` - and E43 is out of the plan. TR30, metadata, low, `closes: "E72"` (E72 is on the line, 1.2.117). S17-64, answer-key, medium, a Foundry limit. Six `info` rows that are Foundry limits (hidden tokens, actor items, three passage rows, secret door types) | the file | S17-31 blocks 1.3.0 by D27 and has no stage on the line: Q-E59-12. TR30 waits for E72 |
| M4 | AUDIT 9.2 holds **510** live checks and marks none closed (the section's title: "Live checks nadal otwarte"). 29 have no LIVE id (items 15-43, before E30); the rest by stage: E79 25, E81 22, E77 18, E28 16, E29 15, E05 14, E78 14, E24 13, E04 12, E07 12, E23 12, E70 12, and 52 more stages with 1-11 each | parsed from `audit/AUDIT-1.2.42.md` from line 699 | C6 groups and triages them (Q-E59-11). The grouping by area below is a keyword reading, not a review |
| M5 | The same 510 by area, the first matching keyword of each item's text deciding (an approximation; an item about the map in a trial counts once, under the map): the map (fog, rooms, movement, Levels) 143; security and the GM bridge 111; rolls and Dice So Nice 98; two GMs, the GM stores, joining and reloads 53; windows, theme, sheet and screen 34; the Class Trial 22; incident, murder and the body 18; investigation 10; sound and voice 7; items, stashes, projects 5; performance 1; other 8 | a script over the items' text | C6 re-reads each item and gives it one area and a disposition |
| M6 | The package (`git archive HEAD`): 275 files, 30.1 MB of tar. It still holds `macros/` (5 files: 01-przeszukanie.js, 02-remnant-nowy.js, 03-remnant-do-gracza.js, 04-panel-dma.js, advancement.js), which no runtime script, language file or module.json reads, and `icons/pixel-sprite.svg`, read only by `tests-glyphs.mjs` and tier 0's R3333, which skips at a table (`needs(env.tools())`, tests-tier0.mjs:717) | the archive's list; `git grep` | C5: macros removed (D47), the sprite export-ignored (Q-E59-2, Q-E59-3). Export-ignoring the sprite breaks nothing at a table |
| M7 | Three tools are wired into no check: `tools/port-glass.py`, `tools/token-icons.mjs`, `tools/item-icons.mjs`. Run on a copy of 421f239: **port-glass.py rewrites `scripts/glass.mjs` (229 lines added, 1530 deleted)** - the module's curtain has moved on from `docs/design/glass-recipe.js` since the port; `token-icons.mjs` rewrites all 9 `icons/remnant-*.svg` (one line each: the same path written with relative `h-7` where the files hold absolute `H7`, whether every shape is the same pixels was not measured); `item-icons.mjs` writes what is committed. The glyphs have a check (`GLYPH_FILES`, R3333); the item and token icons have none | each tool run on a scratch worktree, `git diff --stat` | C5: port-glass.py removed or rewritten (Q-E59-7); the two icon generators held by a check part, red first (token-icons is red today) |
| M8 | `docs/dev` holds 8 folders of shipped stages (e61, e62, e73, e76, e92, e94, e97, e99) and `gaps/`, 13 files, plus E65's text working papers (text-batch-B01a.json, text-pilot.json, text-review-E65.md), METHOD.md and the generated R-REGISTRY.md. Every stage folder is cited by a release note; six are cited from code or tests as well (e73 by trial-zones-ui.mjs:5, zone-machine.mjs:13 and components.css; e94 by config.mjs:2057; e99 by tests-tier2.mjs:27327 and components.css; e92's CENSUS.md by tier 1; e97's STATUS-FIX.md by tier 0; e62's turn-baseline.json by notes). `text-batch-B01a.json` is read by tools/check.mjs and tools/text-render.mjs. One file is a draft of a shipped release's notes: `docs/dev/e61/RELEASE-1.2.108-draft.md` (cited by v1.2.109's notes). E64's folders join them with 1.2.110 | `git ls-files`, `git grep` for each path | Deleting any of them breaks a citation. C5 adds an index (`docs/dev/README.md`: each folder, its stage, its version, "a record, not a plan") and moves nothing by default (Q-E59-6) |
| M9 | Committed scratch: none found by name (`*.orig`, `*.bak`, `*.tmp`, `*.log`, `~`, `.DS_Store`, "scratch", "backup", "copy"); `audit/harness/results/` is ignored (.gitignore:18) and tracks 0 files. The one draft is M8's | `git ls-files` patterns | Nothing to remove beyond M6-M8 |
| M10 | Repository: 113 tags on the remote (v1.2.105-v1.2.109 the newest), 34 branches. Six are wholly in main (claude/e73, claude/e76-106, claude/e92, claude/gaps-65, claude/hotfix-1.2.102, claude/fervent-sagan-gme4vt); three are from before 10.10.2026 with histories more than 1000 commits apart from main (claude/gate-1.2.70, claude/e09-1.2.71, claude/e75-1.2.72); the rest are live lines. No `.github/ISSUE_TEMPLATE`, no PR template, no `CHANGELOG.md`; 94 files in `.github/release-notes` (v1.2.0 the oldest); `audit/README.md` opens in Polish ("# Audyty i testy") | `git ls-remote`, each head fetched and tested with `merge-base --is-ancestor` | C5 writes the branch and tag list for the owner; an agent deletes nothing on GitHub (Q-E59-9, Q-E59-10) |
| M11 | Documents against the tree, mechanically: every path in CLAUDE.md, CONTRIBUTING, README, METHOD.md, audit/README, the harness and gate READMEs and the four agent rules files exists (the rest are globs or `vX.Y.Z` placeholders); every `npm run` they name is a script of audit/harness/package.json; every `node X.mjs` exists. The harness README lists 9 scenario files that do not exist, each a `planned` row owned by a moved-out stage or E57 (16-first-run E58, 18-trial E40, 31-fuzz and 32-case-security E43, 51-lang-mixed E57, 64-migration-drill E38, 70-movement E39, 82-two-gms and 85-chaos E38). Dated numbers that no longer describe the tree: CLAUDE.md's suite line "937 passed, 0 failed, 17 skipped (07.10.2026, 1.2.69)" (tiers 0-1 alone read 1256 passed, 16 skipped on 1.2.108's tree, this line's runs of 12.11), its "503/503 on 02.11" (`check prose` reads 537/537 today), and `.claude/rules/code.md`'s sizes (hud.mjs "1639" now 1673, tables-editor.mjs "1668" now 1780, vault-store.mjs "1552" now 1573). Prose claims were not read here | scripts over the files; `wc -l`; `check prose` | C4 refreshes the dated numbers with a date, or marks them as E-stage history; reading the prose is C4's work |
| M12 | Versions: module.json, README:228-229 and the GM handbook:26-27 agree - Foundry 14.364 minimum, verified 14.365; Daggerheart 2.6.5 minimum and verified, no maximum (D1). The harness runs Daggerheart's relay and dice copied from 2.12.8 (`audit/harness/lib/dh-relay.mjs:4`), and 1.2.109's notes describe play on 2.12. The release rules say `verified` names only a version passed at a real table | the files | Not a contradiction under the rules; whether 1.3.0 says more is Q-E59-13 |

## 4. The commits

E59 is documents, tools and tests; it changes no runtime behaviour. Each commit's tests are written red first; the
red is measured on the commit's parent and quoted in its message. R numbers are the coordinator's to assign (about
8-12 in all).

### C0 - the gate record (red first)

A results file per gate, `audit/gate/ci-record.json`: the command, the commit, the result, the counts, and the files
the gate depends on (a glob list per gate). `node tools/check.mjs` part `gaterecord` refuses a row without its file
list or with a result it did not see. So E83, after a fix, repeats only the gates whose files changed (11.10 amend).
- Red: the check on a planted row with no file list, and on one whose result says "passed" over an exit of 1.
- Tests: 1-2 R (the check's planted cases in tier 0 or the check's self-test).

### C1 - the ci layer on one candidate

`npm test` in audit/harness and every gate named in the goal that exists (lint, `tools/check.mjs` whole, the gate's
self-test, the suite in shards, every `ci` scenario, `check text` in its final modes, api-surface, the glass and
style sweeps quoted). Each named gate that does not exist is written "not run: its stage is out of the plan (E43)"
with the stage id. `expectedRed` read at 0 (M1). The results go into C0's file.
- Red: none new; C1 runs gates. The commit quotes each gate's line.
- Waits for: E57 shipped (its guards are part of the gate).

### C2 - every window to the kit's contract (red first)

Greps turned into tier-0 tests: no module window without `.drpg-ui`; `drpg-destructive` never the default and never
under autofocus; one tab system (`kitTabs`); the footer by `BUTTON_ROLES`; no text under 11 px; gold only for Hope.
The window list from probe 08's manifest (60 rows, 59 captured, on 421f239) and `drpgWindow` calls.
- Red: each test on a planted window that breaks its rule, and on the tree where it finds one (to be measured at
  the base).
- Scenarios that draw windows: 84-viewports (local gate only), 17-assistant, 62-investigation, 89-proposal-card,
  73-notice-history.
- Tests: 3-5 R.

### C3 - the screenshot rating

The set: about 341 surfaces of V01-V15 plus every window and tab of probe 08's manifest, the A8/A9 surfaces (room
tile, Foundry tools, Map tools, the GM cluster, the voice tile with "Who you hear"), EN and PL, both themes, at
1366x768, 1024x768 and 820x1180, captured headless through the style harness, plus `audit/style-sweep.mjs --fit` and
the style snapshot against `audit/style-baseline.json`. A private review page. Rated by D27's method (Q-E59-4).
- Not a test; the fit pass and the snapshot are the measured part, quoted.
- LIVE-E59-01: what only a v14 browser draws (canvas, the curtain, Foundry's own header) - after E83's local gate.

### C4 - the documents say one thing

README, CONTRIBUTING, CLAUDE.md, `.claude/rules/*`, module.json and E57's handbooks, read against each other and the
code on versions (M12), Dice So Nice, the imposed settings, the fallback modes, the threat model and the supported
screen. The dated numbers of M11 refreshed with their date, or marked as a stage's history. Text by docs/text-style.md
and docs/glossary.json.
- Red: `node tools/check.mjs` part `docs` - the version strings of module.json, README's table and each handbook's
  head and table read equal; red on a planted mismatch. 1 R.

### C5 - repository order (D47; red first where a check fits)

- `macros/` removed from main; the history keeps it (Q-E59-3).
- `icons/pixel-sprite.svg` export-ignored (Q-E59-2); the archive's file list checked: a check part `package` holds
  the archive's top level to `module.json`, `README.md`, `LICENSE`, `lang/`, `scripts/`, `styles/`, `icons/`,
  `fonts/` and `docs/handbooks/`. Red on 421f239: `macros/` is in it. 1 R.
- `tools/port-glass.py`: removed, its use recorded in docs/design (Q-E59-7).
- The icon generators held to their files: check part `icons` runs `item-icons.mjs` and `token-icons.mjs` into a
  scratch directory and compares. Red on 421f239: 9 token icons differ (M7). Then the icons regenerated (Q-E59-8). 1 R.
- `docs/dev/README.md`: the index of M8 (Q-E59-6).
- `audit/README.md` in English.
- `.github/ISSUE_TEMPLATE/` (a bug report and a table report, each asking for the module and Daggerheart versions and
  `game.drpg.diagnose()`'s text) and `.github/pull_request_template.md`.
- `CHANGELOG.md` built from `.github/release-notes` by `tools/changelog.mjs`, with a check part that every notes file
  is in it in version order. Red: the check on 421f239 (no CHANGELOG). 1 R.
- The branch and tag list for the owner (M10): merged, stale, live. Deleting is the owner's.

### C6 - the gap list

One file, `docs/dev/e59/GAPS.md`, and its summary for E26's notes:
- the release blockers: the local gate (M2) and S17-31 (M3);
- the 510 live checks, each with one area and a proposed disposition - "needed at E83's sandbox for 1.3.0", "into the
  notes as not checked", "superseded by a later stage's check" - for the owner to confirm (Q-E59-11);
- the leaks that are Foundry limits, for the notes;
- the gates of the moved-out stages, recorded not run;
- what C2-C5 found and did not fix.

### C7 - ledger, notes, AUDIT 9.2 rows

`node tools/stages.mjs ship E59 ...`, the release notes, LIVE-E59-01 in AUDIT 9.2 at the next free item number of that
time.

## 5. What waits for which line or release

| E59 part | Waits for | Why |
| --- | --- | --- |
| C1 | E57 (1.2.124) | Its guards join the gate |
| C3 | E71 (1.2.122), E57 | The UI texts and the handbooks are final only then; and E54-E56 (1.2.118-1.2.120) change windows' files |
| C4 | E57 | The handbooks are E57's rewrite |
| C5 `icons` | none | Can be built at any base; regenerating the icons is a visible change (one line per file, the pixels to be compared) |
| C5 port-glass.py | E54's glass-geometry.mjs (prep-54 F6) | The split moves the code the script writes into; removing the script first avoids a tool that writes over a split file |
| C6 TR30 | E72 (1.2.117) | `closes: "E72"` |
| C6 S17-31 | the owner (Q-E59-12) | E43 is out of the plan |
| C6 local gate | E83 (1.2.132) | A v14 sandbox |
| LIVE-E59-01 | E83's sandbox | |

## 6. Live checks (proposed)

- LIVE-E59-01: the surfaces of C3 that only a real browser on v14 draws (canvas, the curtain, Foundry's header), in
  both themes at 1366x768 and 820x1180 - after E83's local gate.

## 7. Open questions for the owner (each with the default the stage runs on)

| Id | Question | Default |
| --- | --- | --- |
| Q-E59-1 | The goal names gates owned by six moved-out stages. Run what exists and record the rest as not run? | Yes, each named gate either runs or is written "not run" with the stage id (the base plan's default) |
| Q-E59-2 | pixel-sprite.svg is E48's generated file. Remove it, or export-ignore it? | Export-ignore: the package loses it; R3333 already skips at a table (M6) |
| Q-E59-3 | macros/: remove from main (D47), or only export-ignore? | Remove, as D47 says; history keeps them |
| Q-E59-4 | Who rates the screenshots: this line or the auditor's pass? | The auditor's pass; E59 builds the set and the page |
| Q-E59-5 | Does "no expectedRed" count markers naming moved-out stages? | Yes; it reads 0 today (M1) |
| Q-E59-6 | docs/dev's folders of shipped stages (M8): keep, or move to an archive folder? | Keep in place with an index: code and notes cite them by path |
| Q-E59-7 | tools/port-glass.py would overwrite 1530 lines of glass.mjs today (M7). Remove it, or rewrite it against the module's curtain? | Remove; the recipe page stays a design record |
| Q-E59-8 | token-icons.mjs writes the 9 Remnant icons with a different path text (M7). Regenerate and hold them by a check, or leave them? | Regenerate after a pixel comparison, hold by the check |
| Q-E59-9 | Branches (M10): 6 merged, 3 stale with diverged history. Who deletes them? | E59 writes the list; the owner deletes on GitHub |
| Q-E59-10 | 113 tags: keep all? | Keep all |
| Q-E59-11 | 510 open live checks (M4): may E59 propose a disposition for each, the owner confirming the set "needed for 1.3.0"? | Yes; nothing is marked closed without a run |
| Q-E59-12 | S17-31 (high, killer-identity) closes E43, which is out of the plan. D27 forbids shipping with it | A fix window before E83, named by the owner; E59 lists it as a blocker and changes no code |
| Q-E59-13 | module.json says Daggerheart verified 2.6.5; the harness runs 2.12.8 (M12). Does 1.3.0 name a newer verified version? | Only after a table run on it (the release rules); C4 makes every document say the same sentence |
| Q-E59-14 | The dated numbers in CLAUDE.md and code.md (M11): refresh them, or mark them as history? | Refresh with today's measurement and date; a stage's own number stays under its stage name |

## 8. Risks

- C3's rating has a spread of about +-0.3 (the audit's risk), and D27 can stop the release on it.
- Removing macros/ or port-glass.py breaks a link in old notes or a comment: C5 greps the tree for each path first.
- Regenerated icons are a visible change at a table if the pixels differ; C5 compares them before committing.
- The live-check triage (C6) is judgement over 510 items; it proposes, the owner disposes.
- A gate written "not run" can read as a pass in a summary; C0's check refuses a row whose result it did not see.

## 9. Size

Estimate (mine): 22-30 agent-hours - C0 2, C1 4-6 (run time), C2 4-5, C4 3-4, C5 5-7, C6 4-6, C7 1; C3 not counted
(Q-E59-4). The base plan's estimate was 18-24; the extra is C5's checks and C6's triage of 510 items.

## Appendix - re-measuring at the base

All from the repository root of the base commit.

- M1: `node tools/stages.mjs check`.
- M2: `git log --format=%H -- audit/gate/local-gate.json`, then each version's `parts[].status`.
- M3: `audit/harness/known-leaks.json` `leaks[]`: `id`, `severity`, `closes`, `foundryLimit`.
- M4, M5: items of `audit/AUDIT-1.2.42.md` after the heading "### 9.2 Live checks nadal otwarte", matched by
  `^(B-[\w-]+|\d+)\.\s+\*\*(.+?)\*\*`; the LIVE id read from the bold title.
- M6: `git archive HEAD | tar -t`.
- M7: on a scratch worktree, `python3 tools/port-glass.py`, `node tools/token-icons.mjs`, `node tools/item-icons.mjs`,
  then `git diff --stat`; never on the working tree.
- M8: `git ls-files docs/dev`, and `git grep -l <path>` for each.
- M10: `git ls-remote --heads --tags origin`; each head fetched and tested with `git merge-base --is-ancestor`.
- M11: every repository path, `npm run` name and `node` script named in the listed documents, checked for existence.
