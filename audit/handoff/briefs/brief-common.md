# Common rules for every E30 implementation agent

You are implementing part of stage E30 ("test foundation") of the Danganronpa RPG
Foundry VTT module, release 1.2.61. Read this file first, then your phase brief.

## Where you work
- Worktree: <scratch>/e30wt
  (branch `e30-wip`). Edit and commit ONLY there. Never edit /home/user/Danganronpa-RPG
  (that checkout is the released 1.2.60 and stays untouched). Never push. Never create PRs.
- The harness needs `audit/harness/node_modules` - it is already a symlink in the worktree;
  do not run `npm install`/`npm ci` unless your brief says so, and never commit the symlink.
- Reference copy of the released parent (1.2.60, 6ea3bba): scratchpad/e30base (read-only).
- Design documents (read the sections your brief names, completely):
  scratchpad/e30design/05-plan.md (the commit plan - authoritative where the others disagree),
  00-split.md, 01-harness.md, 02-contract.md, 03-gate.md, 04-registries.md.
  They were written against 411d4da (an earlier commit); line numbers have shifted - find
  code by content, not by the numbers in the design. Re-measure every number you write down.

## How to verify
- `bash scratchpad/v.sh <worktree> <outdir> <suite-runs> <scenario numbers...>` runs the suite
  (01-runtests) N times as 01a.log, 01b.log ... and the listed scenarios as NN.log, then puts
  tracked results files back and reaps that worktree's leftover clients. `bash scratchpad/vsum.sh <outdir>`
  prints one line per run. Use a fresh outdir under scratchpad/e30run/ for each run.
- Baseline at 1.2.60 is in scratchpad/e30run/base (suite 292/0/16 twice, identical test by test;
  00 18/19 (LIVEKITAVCLIENT keys); 10 19/19; 11 5/6 (known leak S04-02, closes in E06);
  12 10/10; 13 20/20; 14 7/7; 15 9/9; 20 3/3; 30 66/66; 40 37/38 (known leak S02-11, closes in E05);
  50 43/43; 60 14/14; prose 497/497). Every scenario exited 0 even when red - that is the bug C3a fixes.
- Compare suites test by test: `node <worktree>/audit/harness/suite-diff.mjs before.log after.log`
  (exit 0 identical, 1 differs, 2 not comparable).
- One harness run at a time on this machine (4 cores): do not start two cluster runs at once,
  timing-bound tier-2 tests flake under load.
- The suite takes about 3 minutes; the scenarios together about 2 minutes. Wait for a
  background run with Bash `run_in_background` and an `until [ -f <outdir>/DONE ]` loop,
  not with chained sleeps.

## Process hygiene (this has bitten twice)
- NEVER use `pkill -f` or `pgrep -f` with a pattern that also appears in your own command line:
  it matches your own shell and kills it (exit 144). To reap harness clients use
  `ps -eo pid=,args= | awk -v w="<worktree>/audit/harness/client-entry.mjs" 'index($0, w) && $2 ~ /node$/ {print $1}'`
  (the `$2 ~ /node$/` keeps awk from matching its own command line) and kill those PIDs.

## House rules (CLAUDE.md applies in full; these are the ones most often missed)
- Never write the character U+2014 (em dash) anywhere - code, comments, docs, commit messages.
  Use "-". Do not introduce U+2013 in prose either.
- Comments follow the house style: say what was tried, what it measured (with a date, 24.09.2026)
  and why the code is the shape it is. No comment that restates the line under it.
  "Measure, then say": never write a number you did not measure; if something cannot be measured
  here (no real Foundry v14, no browser layout), say so instead of rounding it up.
- Every English lang key needs a Polish twin (lang/en.json and lang/pl.json); plural families need
  .one/.other and in Polish also .few/.many. Run `node tools/config-prose.mjs --check lang/pl.json`
  (must read 497/497 unless your brief adds prose).
- A socket handler that touches an actor checks senderOf(senderId) and ownsActor(sender, actor).
- Release notes and comments about Daggerheart's GM relay stay neutral and minimal: say what the
  guard does in one plain sentence; never describe how a request could be forged or abused, and never
  write anything that reads like a vulnerability advisory.
- No model names or model identifiers anywhere in the repository or in commit messages, apart from
  the Co-Authored-By trailer below, which is required verbatim.
- Test numbering: R151 is taken (C2). Your brief says which R numbers you may use.

## Commits
- One commit per plan item (C3a, C3b, ...), in plan order, each verified before the next starts.
- Commit message: a short imperative title; a body in the house style that says what changed, why,
  and the measured before/after numbers (suite totals and suite-diff verdict, each scenario's
  "[cluster] X/Y" line, anything that moved and why). A difference you cannot explain is reverted,
  not committed.
- End every commit message with exactly these two lines:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01LMLAB2EDDrJM3pGjimWZAd
- Before each commit: `git -C <worktree> status --short` must show only your intended files
  (never audit/harness/node_modules, never results files).

## Token economy (the owner asked for it on 24.09: the session has a usage limit)
- Read each design section and each large source file once; keep notes in scratchpad/ if you need to come back.
- Grep or read line ranges instead of whole large files where that is enough.
- Run the full ci scenario set once per commit; a second suite run only where timing could matter.
- Keep your final report short: hashes, numbers, what moved and why, what you did not do, what looks wrong.

## What to report back
A short report: each commit's hash and title, the measured numbers before and after, every result
that moved and why, anything from the design you did NOT do and why, and anything you found that
looks wrong in the module or the design. Do not claim anything you did not run.
