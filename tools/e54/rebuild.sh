#!/bin/bash
# E54 rebuilt on a new base, from one command (the coordinator's ask of 13.11.2026: the base sha in, the landing
# line's shape out, each proof run and its result written down). Nothing here pushes.
#
#   tools/e54/rebuild.sh --base <sha> --work <new dir> --out <new dir> [--picks <a>..<b>] [--rows <sha>] [--no-sweep]
#
# Run from a checkout of the E54 prep line: its tools/e54 is the tool set and the manifests. --work becomes a git
# worktree on a local branch e54-rebuild-<base>, --out holds results.md (one row a step: seconds and what it read),
# logs/, the manifests and the comment sweep's tables built for this base, and the golden pair. The steps, in order:
#
#  1. the worktree at --base; audit/harness's npm ci when it has no node_modules
#  2. the behaviour commits cherry-picked (--picks, default the landing line on 1.2.112: its 12 behaviour commits and
#     the tooltip census's gate, a2b233d2..da276909), each message kept. A conflict in docs/dev/R-REGISTRY.md is
#     regenerated (tools/registry.mjs --write), one in a tier file's table where both sides appended tests is kept
#     both sides (union-tail.mjs, then node --check); any other conflict stops the run, named in results.md: it
#     needs a reader. On a2b233d2 the one such was config.mjs's import line (INFILTRATE beside SHEET_SIZE).
#  3. quick and tiers 0-1 on the picks; the golden's boxes and baseline (audit/glass-golden.mjs) on that tree
#  4. the comment sweep's tables built on it (sweep-build.mjs, from the manifests copied into --out)
#  5. the seven cuts in the plan's order, each: split (moved-only HEAD~1 must read 8 parts green), repoint, the
#     comment sweep, quick, tiers 0-1 - one commit for each of the first three; stops at a refusal or a red
#  6. code.md's rows (--rows, default c6e4e5ed) cherry-picked, then rows.mjs: every count a row states, held to
#     the files (a conflict, or a count a new base moved, stops: the prose needs a reader)
#  7. at the end: quick, tiers 0-1, the golden against step 3's (byte for byte), glass-sweep (unless --no-sweep),
#     messages.mjs over every commit from the base, and merge-tree against origin/main (read, not merged)
#
# What needs reading, whatever the script says: a stop in step 2 or 6; a repoint or sweep refusal in step 5 (a line
# of the new base the tables or the manifests do not know - each table row carries the line it expects); and a
# results.md that reads green is still read before a push, as every proof's own output is in logs/.
set -u
T=$(cd "$(dirname "$0")" && pwd)
PREP=$(cd "$T/../.." && pwd)
BASE= WORK= OUT= PICKS=a2b233d2..da276909 ROWS=c6e4e5ed SWEEP=1
while [ $# -gt 0 ]; do case "$1" in
  --base) BASE=$2; shift 2;; --work) WORK=$2; shift 2;; --out) OUT=$2; shift 2;;
  --picks) PICKS=$2; shift 2;; --rows) ROWS=$2; shift 2;; --no-sweep) SWEEP=0; shift;;
  *) echo "rebuild: unknown argument $1"; exit 2;; esac; done
[ -n "$BASE" ] && [ -n "$WORK" ] && [ -n "$OUT" ] || { echo "rebuild: --base, --work and --out, please"; exit 2; }
[ -e "$WORK" ] && { echo "rebuild: $WORK exists; a new directory, please"; exit 2; }
[ -e "$OUT" ] && { echo "rebuild: $OUT exists; a new directory, please"; exit 2; }
git -C "$PREP" fetch -q origin claude/e54-land-112 2> /dev/null # the default picks and rows live there
mkdir -p "$OUT/logs" "$OUT/tables"
OUT=$(cd "$OUT" && pwd)
CHROMIUM=${CHROMIUM:-/opt/pw-browsers/chromium}
CUTS="sheet windows windows-settings key-remnants cleanup-reshape chapter glass"
TRAILER="Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QsWhUcWE5y53y4rU2XXudy"
R=$OUT/results.md
printf '# E54 rebuild\n\nbase %s, picks %s, rows %s, tools %s (%s)\n\n| Step | Seconds | Read |\n| --- | ---: | --- |\n' \
  "$BASE" "$PICKS" "$ROWS" "$(git -C "$PREP" rev-parse --short HEAD)" "$(date -u +%FT%TZ)" > "$R"
row() { printf '| %s | %s | %s |\n' "$1" "$2" "$3" >> "$R"; echo "rebuild: $1 ($2 s): $3"; }
stop() { row "$1" "${2:-0}" "STOP: $3"; printf '\nStopped at %s.\n' "$1" >> "$R"; exit 1; }
# step <name> <log> <command...>: runs it, logs it, times it; the caller reads $? and the log
step() { local name=$1 log=$OUT/logs/$2; shift 2; local t0=$SECONDS; "$@" > "$log" 2>&1; local rc=$?; DT=$((SECONDS - t0)); return $rc; }
commit() { git add -A && git commit -q -F - ; }

# 1
step worktree worktree.txt git -C "$PREP" worktree add -b "e54-rebuild-${BASE:0:8}" "$WORK" "$BASE" || stop worktree $DT "$(tail -1 "$OUT/logs/worktree.txt")"
WORK=$(cd "$WORK" && pwd); cd "$WORK"
row worktree $DT "$WORK at $(git rev-parse --short HEAD)"
if [ ! -d audit/harness/node_modules ]; then
  step "npm ci" npm-ci.txt bash -c "cd audit/harness && npm ci" || stop "npm ci" $DT "see logs/npm-ci.txt"
  row "npm ci" $DT "audit/harness installed"
fi

# 2
t0=$SECONDS; n=0
for c in $(git -C "$PREP" rev-list --reverse "$PICKS"); do
  n=$((n + 1))
  if ! git cherry-pick "$c" > "$OUT/logs/pick-$n.txt" 2>&1; then
    regen=0
    for f in $(git diff --name-only --diff-filter=U); do
      case "$f" in
        docs/dev/R-REGISTRY.md) git checkout --theirs -- "$f"; regen=1;;
        scripts/tests-tier0.mjs|scripts/tests-tier1.mjs)
          node "$T/union-tail.mjs" "$f" >> "$OUT/logs/pick-$n.txt" 2>&1 && node --check "$f" 2>> "$OUT/logs/pick-$n.txt" \
            || stop "pick $n" $((SECONDS - t0)) "${c:0:8} $f: a conflict union-tail does not take (logs/pick-$n.txt)";;
        *) stop "pick $n" $((SECONDS - t0)) "${c:0:8} $(git log -1 --format=%s "$c" | cut -c1-60): $f needs a reader; the worktree stands mid-pick";;
      esac
    done
    [ $regen = 1 ] && node tools/registry.mjs --write >> "$OUT/logs/pick-$n.txt" 2>&1
    git add -A && GIT_EDITOR=true git cherry-pick --continue >> "$OUT/logs/pick-$n.txt" 2>&1 \
      || stop "pick $n" $((SECONDS - t0)) "${c:0:8}: the pick would not continue (logs/pick-$n.txt)"
    echo "resolved: $(git log -1 --format=%h)" >> "$OUT/logs/pick-$n.txt"
  fi
done
row picks $((SECONDS - t0)) "$n commit(s) from $PICKS; head $(git rev-parse --short HEAD)"

proofs() { # quick and tiers 0-1 at this commit; $1 the step's name
  step "$1 quick" "quick-$1.txt" bash -c "cd audit/harness && npm run quick"; local q=$? dq=$DT
  row "$1 quick" $dq "$([ $q = 0 ] && echo green || echo "RED (logs/quick-$1.txt)")"
  step "$1 tiers" "tiers-$1.txt" bash -c "cd audit/harness && node run-tests.mjs --tier 1"; local t=$? dt=$DT
  row "$1 tiers 0-1" $dt "$(grep 'run-tests: [0-9]* passed' "$OUT/logs/tiers-$1.txt" | tail -1)"
  [ $q = 0 ] && [ $t = 0 ] || stop "$1" 0 "quick or tiers red; logs/quick-$1.txt, logs/tiers-$1.txt"
}

# 3
proofs picks
step "golden boxes" golden-boxes.txt node audit/glass-golden.mjs --capture --boxes "$OUT/golden-boxes.json" --chromium "$CHROMIUM" \
  || stop "golden boxes" $DT "logs/golden-boxes.txt"
step "golden base" golden-base.txt node audit/glass-golden.mjs --boxes "$OUT/golden-boxes.json" --out "$OUT/golden-0.json" --chromium "$CHROMIUM" \
  || stop "golden base" $DT "logs/golden-base.txt"
row "golden base" $DT "$(tail -1 "$OUT/logs/golden-base.txt" | cut -c1-120)"

# 4
cp "$T"/{sheet,windows,windows-settings,key-remnants,cleanup-reshape,chapter,glass}.json "$OUT/tables/"
step "sweep tables" sweep-build.txt node "$T/sweep-build.mjs" --base "$WORK" --out "$OUT/tables" --work "$OUT/sweep-work" \
  || stop "sweep tables" $DT "logs/sweep-build.txt"
row "sweep tables" $DT "$(grep -o 'base [0-9a-f]*:.*' "$OUT/logs/sweep-build.txt" | tail -1 | cut -c1-200)"

# 5
D=$OUT/tables
for cut in $CUTS; do
  src=$(node -e "console.log(require('$D/$cut.json').source)")
  step "$cut split" "split-$cut.txt" node "$T/split.mjs" --manifest "$D/$cut.json" --repo "$WORK"
  grep -q "e54-split: done" "$OUT/logs/split-$cut.txt" || stop "$cut split" $DT "refused (logs/split-$cut.txt)"
  files=$(grep -o "wrote scripts/[a-z-]*\.mjs ([0-9]* lines)" "$OUT/logs/split-$cut.txt" | sed 's/wrote //' | paste -sd, - | sed 's/,/, /g')
  commit <<EOF
E54 $cut: the split (tools/e54/$cut.json, tools/e54/split.mjs) [skip ci]

What it reads: $src at $(git log --format=%h -1), as the manifest
tools/e54/$cut.json (the E54 prep line) places each of its top-level
declarations. A pure move: every line moved, promoted, an import or a
header; the facade keeps its name and every name it exported.

Wrote: $files.

$TRAILER
EOF
  step "$cut moved-only" "moved-only-$cut.txt" node tools/moved-only.mjs HEAD~1
  grep -q "^moved-only: 8 part(s), all green" "$OUT/logs/moved-only-$cut.txt" || stop "$cut moved-only" $DT "not green (logs/moved-only-$cut.txt)"
  sum=$(grep "^lines: [0-9]" "$OUT/logs/moved-only-$cut.txt" | cut -c1-200)
  git log -1 --format=%B | sed "s|^Wrote: |Measured: moved-only HEAD~1, 8 parts all green ($sum).\nWrote: |" > "$OUT/msg.txt" && git commit -q --amend -F "$OUT/msg.txt"
  row "$cut split" $DT "$files; moved-only 8 parts green"
  step "$cut repoint" "repoint-$cut.txt" node "$T/repoint.mjs" --manifest "$D/$cut.json" --repo "$WORK"
  grep -q "e54-repoint: done" "$OUT/logs/repoint-$cut.txt" || stop "$cut repoint" $DT "refused: $(grep -m1 REFUSED "$OUT/logs/repoint-$cut.txt" | cut -c1-160) (logs/repoint-$cut.txt)"
  rw=$(grep -o "[0-9]* rewrites" "$OUT/logs/repoint-$cut.txt" | head -1)
  commit <<EOF
E54 $cut: the suite's readers pointed at the family (tools/e54/repoint.mjs) [skip ci]

What it reads: the split before it, and tools/e54/$cut.json's repoint
part (its sites and patches, each with its why). The suite, the contract
register and the census documents only; no module code. $rw.

$TRAILER
EOF
  row "$cut repoint" $DT "$rw"
  step "$cut sweep" "sweep-$cut.txt" node "$T/sweep.mjs" --manifest "$D/$cut.json" --repo "$WORK"
  grep -q "e54-sweep: done" "$OUT/logs/sweep-$cut.txt" || stop "$cut sweep" $DT "refused (logs/sweep-$cut.txt)"
  if [ -n "$(git status --porcelain)" ]; then
    rows=$(grep -o "[0-9]* row(s) apply[^;]*" "$OUT/logs/sweep-$cut.txt" | head -1)
    commit <<EOF
E54 $cut: the comment sweep - comments and test names say where the code stands (tools/e54/sweep.mjs) [skip ci]

What it reads: the repoint before it, and the sweep's table for this cut,
built by tools/e54/sweep-build.mjs on this branch's commit before the
cuts. Comments, test names and the registry they key; no code. $rows.

$TRAILER
EOF
    row "$cut sweep" $DT "${rows:-written}"
  else row "$cut sweep" $DT "nothing to write"; fi
  proofs "$cut"
done

# 6
step rows rows-pick.txt git cherry-pick "$ROWS" || stop rows $DT "code.md's rows do not apply on this base (logs/rows-pick.txt); the worktree stands mid-pick"
step "rows check" rows.txt node "$T/rows.mjs" --repo "$WORK" || stop "rows check" $DT "$(head -3 "$OUT/logs/rows.txt" | paste -sd ';' -)"
row rows $DT "$(tail -1 "$OUT/logs/rows.txt")"

# 7
proofs end
step "golden end" golden-end.txt node audit/glass-golden.mjs --boxes "$OUT/golden-boxes.json" --out "$OUT/golden-1.json" --chromium "$CHROMIUM" \
  || stop "golden end" $DT "logs/golden-end.txt"
cmp -s "$OUT/golden-0.json" "$OUT/golden-1.json" && row golden $DT "SAME, $(wc -c < "$OUT/golden-1.json") bytes" || stop golden $DT "DIFFERS from step 3's"
if [ $SWEEP = 1 ]; then
  step "glass-sweep" glass-sweep.txt node audit/glass-sweep.mjs --chromium "$CHROMIUM"; s=$?
  row glass-sweep $DT "$(grep '^SWEEP' "$OUT/logs/glass-sweep.txt" | tail -1)"
  [ $s = 0 ] || stop glass-sweep $DT "red (logs/glass-sweep.txt)"
else row glass-sweep 0 "not run (--no-sweep)"; fi
step messages messages.txt node "$T/messages.mjs" "$BASE" HEAD --repo "$WORK"; m=$?
row messages $DT "$(tail -1 "$OUT/logs/messages.txt")"
[ $m = 0 ] || stop messages 0 "logs/messages.txt"
git fetch -q origin main 2> /dev/null
step merge-tree merge-tree.txt git merge-tree --write-tree origin/main HEAD; mt=$?
row merge-tree $DT "against origin/main $(git rev-parse --short origin/main): $([ $mt = 0 ] && echo clean || echo "CONFLICTS (logs/merge-tree.txt)")"
printf '\nDone: %s, %s commits from the base, tree %s. Not pushed.\n' "$(git rev-parse --short HEAD)" \
  "$(git rev-list --count "$BASE"..HEAD)" "$(git rev-parse --short HEAD^{tree})" >> "$R"
echo "rebuild: done, $(git rev-parse --short HEAD); $R"
