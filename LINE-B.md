# LINE B - the brief for the second line of work (Claude Code CLI on the owner's computer)

Written 29.10.2026 by line A (the cloud session that has built and shipped every stage so far, up to 1.2.90). You are
line B: a second, parallel line of stages of the Danganronpa RPG module (Foundry v14, Daggerheart), run in Claude Code on
the owner's own computer, billed to the owner's API credits. The owner (Dawid, Polish; writes to you in Polish, answer in
Polish, gender-neutral forms, never the long dash, use "-") coordinates the two lines by hand. Line A keeps releasing.

Read this whole file first, then `BOARD.md`, then the repo's own `CLAUDE.md` and `docs/dev/METHOD.md` (they load or are
linked in the repo; METHOD.md is how every stage has been built), then `method/METHOD-A-lite.md` here.

## 1. What is where

| Thing | Where |
| --- | --- |
| The module | github.com/Akrobacjum/Danganronpa-RPG (public). `main` = the latest release (1.2.90 at 12ff1b62). |
| Line A's branch | `claude/fervent-sagan-gme4vt` (line A only; you never push there) |
| YOUR branch | `claude/fervent-sagan-gme4vt-b` (yours alone; push fast-forward only) |
| This kit and the board | branch `lines-board` (never merged into main): LINE-B.md, BOARD.md, plan.json, method/, tools/, examples/, stages/ |
| The plan | `plan.json` here: every unfinished stage (goal, why, risk, verify, doneWhen, issues, the owner's amendments). Polish. "after" is the planned order, NOT a proven dependency. |
| A model of a stage spec and its ledger | `examples/E70-p2/STAGE.md`, `examples/E70-p2/LEDGER.md` |
| Agent roles | `method/agents/drpg-impl.md`, `drpg-review.md`, `drpg-fix.md`, `drpg-scribe.md` (`<tools>` in them = this kit's `tools/`) |
| Helper scripts | `tools/quick.sh` (local gate), `tools/mut.sh` (mutants), `tools/ci-status.sh` (CI verdict, needs `gh` logged in), `tools/prepush-checks.sh` (pre-push hook) |

Suggested layout on the owner's computer (any parent folder; call it HOME below):
- `HOME/Danganronpa-RPG` - the clone, on branch `claude/fervent-sagan-gme4vt-b` (your worktree).
- `HOME/lines-board` - a second worktree of the same clone on branch `lines-board` (`git worktree add ../lines-board lines-board`).
- `HOME/scratch` - your scratch folder (logs, quick runs, mutants; never inside the repo). Set `LINE_B_HOME=HOME/lines-board`.

## 2. The rules (the same as line A's; they are the owner's, not optional)

1. One stage at a time on this line. A stage is: spec, commits C0..Cn, end review, one fix round, close, push, CI green.
2. Measure, then say. Every claim in a commit message, STATUS or ledger names what was run and what it printed. A test
   that cannot be measured headless says so (`needs()` / LIVE row) - never rounded up.
3. Red-first tests: each behaviour change gets a test that fails before the code and passes after; the commit says so.
4. Git: commit and push only `claude/fervent-sagan-gme4vt-b` (fast-forward) and `lines-board`. Never `main`, never line
   A's branch, never force, amend or rebase. Bring the newest release in with `git merge origin/main` (a merge commit).
5. Per-commit checks before every push (install `tools/prepush-checks.sh` as `.git/hooks/pre-push`): exactly one
   `Co-Authored-By` trailer; no U+2013/U+2014 added; no model identifier in the tree; no `sk-ant-` in the tree; never
   touch `audit/harness/lib/dh-dice/` or `audit/harness/lib/dh-relay.mjs`; README.md only its version line (and you
   never bump versions: line A releases).
6. Never print, echo, log or commit an API key or token. Never write a waiver file or fill a waiver input.
7. Every question to the owner carries your default; a stage runs on its defaults until the owner answers.
8. The repo is public: commit messages and notes stay neutral (no "exploit, attack, malicious, forger, bypass,
   vulnerab, cheat", no model or vendor names).
9. EN and PL texts in pairs (`lang/en.json`, `lang/pl.json`); `node tools/check.mjs parity` and `prose` green.
10. Kill processes by PID only. Never `rm -rf` a relative or variable path.

## 3. The method, per stage (A-lite; see method/METHOD-A-lite.md and docs/dev/METHOD.md)

1. Spec. Take the stage from `plan.json`. Read the code it names by symbol at HEAD (what HEAD already does - never
   build twice). Write `lines-board/stages/<Eid>/STAGE.md` in the shape of `examples/E70-p2/STAGE.md`: goal, the
   owner's words, what HEAD already does, acceptance rows `<Eid>-01..` (each with how it is checked and its commit),
   rules, a Write roads table if a player's browser can write, commits C0..Cn with MARKED ones (trust-model roads) and
   their mutants, what only a table can show (LIVE rows), out of scope, open owner questions with defaults. Push
   lines-board; tell the owner the stage is specified and list the questions with their defaults.
2. Commits. One subagent per commit (role `drpg-impl`): red test, code, `bash tools/quick.sh <worktree> --own "<tests>"
   --scen "<older scenarios that git grep finds reading what changed, cap 2>"`, commit with the real QUICK line, then
   mutants for MARKED commits (`tools/mut.sh`). Each ends with `git status --porcelain` empty.
   The A-lite amendments bind: `--own` also names the tier-2 tests whose source names a function, store, setting or
   bridge row the commit changes (cap ~15); a new GM store with `backup: true` needs a fixture in tier 2's "Back up the
   case, then Restore, brings every store back"; a new field on a record goes on every reader that builds that record.
3. End review: 2-3 read-only reviewer subagents (role `drpg-review`): lenses correctness and goal always, security when
   the stage touches sockets or has a Write roads table. Every finding needs a concrete failing case.
4. One fix round (role `drpg-fix`): every finding fixed red-first or answered with evidence; fewer, larger groups.
5. Close (role `drpg-scribe`): `lines-board/stages/<Eid>/LEDGER.md` in the shape of `examples/E70-p2/LEDGER.md` - one
   row per acceptance id, ANSWERED / OPEN / LIVE with the test and file:line. `STATUS.md` beside it: anchors, commits
   with their QUICK lines, open gaps.
6. Push your branch; CI (`.github/workflows/ci.yml`) runs on every push to `claude/**`. Read it with
   `bash tools/ci-status.sh <worktree> HEAD --wait` or on GitHub's Actions tab. Red: root-cause and fix forward (never
   skip, disable or quarantine a test; "flake" is not a cause). Green: mark the stage READY in BOARD.md, push
   lines-board, tell the owner "E## is ready for line A's train".
7. Line A merges your branch into its train, releases, and writes the version in BOARD.md. You then `git merge
   origin/main` before the next stage.

If the Workflow feature is available in this CLI, a stage may run as one workflow (implement, review, fix, close), with
the owner's request quoted at the top of every agent's prompt (a lesson: agents that saw a relayed question took it as
their task and built nothing). If not, run the same roles as subagents one after another.

## 4. Numbers both lines hand out (to avoid collisions)

| Kind | Line A | Line B |
| --- | --- | --- |
| R numbers (tier 0/1 tests, `docs/dev/R-REGISTRY.md`) | R1049-R1499 | R1500-R1999 (your next = the highest R1500+ in the tier files + 1; `registry.mjs --next` does not know about ranges) |
| Stage test ids | E##-T# of its own stages | E##-T# of its own stages |
| AUDIT 9.2 items (`audit/AUDIT-1.2.42.md`) | numbers them | append LIVE rows at the end WITHOUT a new item number ("item B-<Eid>-n"); line A numbers them at merge |
| Scenario files | next free in its decade | ask on BOARD.md before taking a number |
| Versions, release notes, tags, `tools/stages.json` ship | line A only | never; you may add your stage's planned row |
| Owner decisions D##, DA## | as given | as given; write the owner's words in STAGE.md |

## 5. Choosing your stages (your FIRST task, before any code)

Line A works, in this order: E89 (lag on token moves; flickering UI edges; a Bedroom's stash not created automatically),
then E65, E66, E50, E51, E37 (BOARD.md is the live list). E66 renames names across many files and E41/E54 split files:
anything you change at the same time as those will conflict.

Do this first, read-only, and report it to the owner in Polish (with your default):
1. For each candidate below, read its plan.json entry and the files it would touch (by symbol, git grep at main).
2. Measure the overlap with line A's next stages: the files both would change; whether either renames or moves code.
3. Propose the order for line B with the reason per stage, and the first stage. Candidates (line A's guess, verify):
   E20 (first run, Season setup, Pre-season checks; small - a good first stage to calibrate the cost),
   E52 (the Foundry/Daggerheart contract, patches.mjs), E64 (balance and rules), E67 then E72 (Monocub),
   E24 then E45 (character sheet), E60 (unfound traces in the GM store; check its link to E42's step runner).
4. Write the proposal into BOARD.md under "Line B - proposed", push lines-board, and stop for the owner's "yes".
   The owner relays it to line A, which may object to an overlap.

## 6. Cost, so the owner's credits last

- Report the cost of every stage: before and after it, read the Console's usage (the owner can tell you) or `/cost`
  in the CLI, and write "<Eid>: $x, n agents" in BOARD.md. The first stage calibrates every estimate after it.
- Do not run the whole `npm test` (38 min) or local scenarios beyond quick's cap: CI runs them on every push.
- In this repo tiers 0-1 take 200-400 s locally; if quick's t01 step hits 01-runtests' 370 s bound on a slow machine,
  run `--no-t01` and the changed tier-0/1 tests by name (`node run-tests.mjs --tier 1 --only "<name>"` in
  audit/harness), and say so: CI's shard 1 runs tiers 0-1 whole.

## 7. Talking to line A

Only through the owner and BOARD.md. Keep BOARD.md short: per line, the stage in work, its state (SPEC, BUILD,
REVIEW, FIX, CI, READY, SHIPPED <version>), the files it changes most, and questions for the other line. Fetch
lines-board before every edit and merge (never force); line A edits only its own section and the "Shipped" list.
