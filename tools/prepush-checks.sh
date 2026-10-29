#!/usr/bin/env bash
# Pre-push checks for the v2 line (owner decision A, 15.10.2026): the same per-commit checks the
# orchestrator ran by hand before every push, so a drpg-impl / drpg-fix agent can push only what passes.
# Install (INFRA, I6/I7): as .git/hooks/pre-push of the line's worktree (git rev-parse --git-path hooks),
# never committed to the repo. Git calls it with "<remote> <url>" and lines
# "<local ref> <local sha> <remote ref> <remote sha>" on stdin.
# Tried 18.10.2026 01:5xZ on throwaway commits against a local bare remote: a good commit passed; a U+2014 line, no trailer, another branch, a forced non-ff and a delete were each refused.
set -u
# Line B kit (29.10.2026): line B pushes only to its own branch (and to the lines-board branch for paperwork).
BRANCH=refs/heads/claude/fervent-sagan-gme4vt-b
# Line B (the owner, 18.10.2026 ~20:15Z: "Tak" to a second branch and O8 lifted): the worktree S/wt/line-b pushes only
# to the -b branch, every other worktree only to the line's branch. The hook is shared (the common git dir).
fail() { echo "pre-push: $*" >&2; exit 1; }
while read -r lref lsha rref rsha; do
  [ "$rref" = "refs/heads/lines-board" ] && continue
  [ "$rref" = "$BRANCH" ] || fail "push only to $BRANCH (got $rref)"
  case "$lsha" in 0000000*) fail "no deletes";; esac
  if [ "${rsha#0000000}" != "$rsha" ]; then range="$lsha --not --remotes"; else
    git merge-base --is-ancestor "$rsha" "$lsha" || fail "not a fast-forward of $rsha"
    range="$rsha..$lsha"
  fi
  for c in $(git rev-list $range); do
    n=$(git grep -n -E 'Opus 5\.5|Sonnet 5\.5|claude-(opus|fable|sonnet)' "$c" | wc -l)
    [ "$n" -eq 0 ] || fail "$c: model identifier in the tree ($n)"
    k=$(git grep -c 'sk-ant-' "$c" | wc -l)
    [ "$k" -eq 0 ] || fail "$c: key prefix in the tree"
    a=$(git log -1 --format=%B "$c" | grep -c '^Co-Authored-By:')
    [ "$a" -eq 1 ] || fail "$c: $a Co-Authored-By lines, want 1"
    d=$(git diff "$c^" "$c" | grep '^+' | perl -CS -ne '$n++ if /[\x{2013}\x{2014}]/; END { print $n+0 }')
    [ "$d" -eq 0 ] || fail "$c: $d added lines with U+2013/U+2014"
    p=$(git diff --name-only "$c^" "$c" -- audit/harness/lib/dh-dice audit/harness/lib/dh-relay.mjs | wc -l)
    [ "$p" -eq 0 ] || fail "$c: touches dh-dice or dh-relay"
    r=$(git diff "$c^" "$c" -- README.md | grep -E '^[+-][^+-]' | grep -v -E 'They describe version' | wc -l)
    # The owner's exception (option B; A10 Q3, A11 Q2): one sentence and marker per new known-leaks entry, checked
    # narrowly by readme-leaks-ok.py (tried 18.10.2026 on six throwaway commits: one passed, five refused as meant).
    [ "$r" -eq 0 ] || python3 -I "${LINE_B_HOME:?set LINE_B_HOME to the kit folder}/tools/readme-leaks-ok.py" "$c" || fail "$c: README changed beyond the version line and the known-leaks exception"
  done
done
exit 0
