#!/bin/bash
# quick.sh - the implementer's local gate before a commit (METHOD-v2 section 3, step 4). Everything else - the whole
# suite and every ci scenario - runs on CI after the push.
#
#   bash quick.sh <worktree> [--own "R553,a test's name,..."] [--scen "76 66"] [--no-t01] [--glass]
#
# Steps (every step runs and is reported, a red one does not stop the next):
#   lint check gate   node run-all.mjs lint check gate          (all check parts: parity, prose, live, registry, ...)
#   prose             node tools/config-prose.mjs --check lang/pl.json   ("missing 0, extra 0")
#   t01               tiers 0 and 1 in full                     (run-tests.mjs --tier 1; INFRA-STAGE.md I1)
#   own               the commit's own tier-2 tests by name     (run-tests.mjs --tier 2 --only ... for each)
#   scen NN           each named scenario                       (run-all.mjs scenarios --only NN)
#   glass             node audit/glass-sweep.mjs, in Chromium    (only when the uncommitted change touches the curtain:
#                     audit/glass-harness.html, audit/glass-sweep.mjs, scripts/glass.mjs, styles/narrow.css; or --glass)
# The last line is the summary to paste into the commit message: "QUICK GREEN|RED: ...". Exit 0 green, 1 red,
# 2 usage. Harness steps hold $LOCK (one local harness at a time: tier-2 timing reads flake under load on 4 cores),
# and each reaps the clients its worktree left behind. Logs: $QUICK_OUT (default <worktree>/../quick-runs/<sha7>-<pid>).
#
# 18.10.2026 (owner, E80 from C4): the gate measured 17-19 min a run in E80 C1-C3, not the 4-6 min METHOD-v2 s4
# assumed (lint 66 s, t01 230-244 s, own 20-32 s, scenario 30 316-322 s, the other scenarios 22-167 s each; quick-runs
# 917280b-23726 and 879d6d5-8641), and C2 ran it whole four times (~72 min of its 188). CI runs every scenario in
# parallel in ~11 min on each push. So, unless QUICK_FULL=1:
#   - only the first QUICK_MAX_SCEN (default 2) of --scen run here; the rest are written "left to CI", not counted;
#   - a run at the same HEAD as an earlier run (the newest <sha7>-* with a status.txt) runs lint/check/gate, prose and
#     own again, and t01, scenarios and glass only where the earlier run had them RED or did not run them; a step it
#     had green is written "ok earlier (<run>)", and a scenario it left to CI stays left to CI. The edits since that
#     run are not re-checked by those steps: CI is.
# Each run writes status.txt (one "<label> ok|RED" line a step) for the next run to read.
# Portability (line B kit, 29.10.2026): macOS and Git Bash on Windows have no flock or timeout; run without them there.
. "$(dirname "${BASH_SOURCE[0]}")/portable.sh"   # flock, timeout, reap_clients (29.10.2026)
set -u
WT=$(readlink -f "${1:?usage: quick.sh <worktree> [--own list] [--scen list] [--no-t01] [--glass]}"); shift
OWN=""; SCEN=""; T01=1; GLASS=0
while [ $# -gt 0 ]; do
  case $1 in
    --own) OWN=${2:-}; shift 2 ;;
    --scen) SCEN=${2:-}; shift 2 ;;
    --no-t01) T01=0; shift ;;
    --glass) GLASS=1; shift ;;
    *) echo "quick.sh: unknown argument $1"; exit 2 ;;
  esac
done
H=$WT/audit/harness
[ -d "$H/node_modules" ] || { echo "quick.sh: $H/node_modules is missing (link an install; never npm ci in a line's tree)"; exit 2; }
LOCK=${LOCK:-$(dirname "$WT")/harness.lock}
OUT=${QUICK_OUT:-$(dirname "$WT")/quick-runs/$(git -C "$WT" rev-parse --short HEAD)-$$}
mkdir -p "$OUT"
SUM=(); RED=0
MAXS=${QUICK_MAX_SCEN:-2}; FULL=${QUICK_FULL:-0}; : > "$OUT/status.txt"
PREV=""
if [ "$FULL" != 1 ]; then
  for d in $(ls -td "$(dirname "$OUT")/$(git -C "$WT" rev-parse --short HEAD)"-* 2>/dev/null); do
    [ "$d" != "$OUT" ] && [ -s "$d/status.txt" ] && { PREV=$d; break; }
  done
fi
green_before() { [ -n "$PREV" ] && grep -qxF "$1 ok" "$PREV/status.txt"; }
kept() { SUM+=("$1 ok earlier ($(basename "$PREV"))"); echo "$1 ok" >> "$OUT/status.txt"; echo "$1: kept green from $PREV"; }

reap() { reap_clients "$H"; }
step() {  # step <label> <log> <command...>: run under the lock, record ok/RED and the log's last line
  local label=$1 log=$OUT/$2; shift 2
  flock -w 3600 "$LOCK" "$@" > "$log" 2>&1; local rc=$?
  reap
  local last; last=$(grep -v '^\s*$' "$log" | tail -1 | cut -c1-120)
  if [ $rc -eq 0 ]; then SUM+=("$label ok"); echo "$label ok" >> "$OUT/status.txt"; else SUM+=("$label RED"); RED=1; echo "$label RED" >> "$OUT/status.txt"; echo "--- $label RED (exit $rc), $log:"; tail -15 "$log"; fi
  echo "$label: exit $rc - $last"
}

cd "$H" || exit 2
unset DRPG_REPO
step "lint/check/gate" lint.log node run-all.mjs lint check gate
( cd "$WT" && node tools/config-prose.mjs --check lang/pl.json ) > "$OUT/prose.log" 2>&1
if grep -q 'missing 0, extra 0' "$OUT/prose.log"; then SUM+=("prose ok"); else SUM+=("prose RED"); RED=1; tail -5 "$OUT/prose.log"; fi

if [ ! -f "$H/run-tests.mjs" ]; then
  [ $T01 -eq 1 ] || [ -n "$OWN" ] && { echo "quick.sh: $H/run-tests.mjs is missing - INFRA-STAGE.md I1 has not landed"; SUM+=("t01/own NOT RUN"); RED=1; }
else
  if [ $T01 -eq 1 ]; then if green_before t01; then kept t01; else step "t01" t01.log node run-tests.mjs --tier 1; fi; fi
  if [ -n "$OWN" ]; then
    ARGS=(); IFS=',' read -r -a NAMES <<< "$OWN"
    for n in "${NAMES[@]}"; do n=$(echo "$n" | sed 's/^ *//; s/ *$//'); [ -n "$n" ] && ARGS+=(--only "$n"); done
    step "own(${#NAMES[@]})" own.log node run-tests.mjs --tier 2 "${ARGS[@]}"
  fi
fi
NS=0
for s in $SCEN; do
  if green_before "scen $s"; then kept "scen $s"
  elif [ "$FULL" != 1 ] && [ -n "$PREV" ] && grep -qxF "scen $s left" "$PREV/status.txt"; then
    SUM+=("scen $s left to CI"); echo "scen $s left" >> "$OUT/status.txt"; echo "scen $s: left to CI (as in $PREV)"
  elif [ "$FULL" = 1 ] || [ $NS -lt "$MAXS" ]; then NS=$((NS+1)); step "scen $s" "s$s.log" node run-all.mjs scenarios --only "$s"
  else SUM+=("scen $s left to CI"); echo "scen $s left" >> "$OUT/status.txt"; echo "scen $s: left to CI (QUICK_MAX_SCEN=$MAXS)"; fi
done
CURTAIN=$(git -C "$WT" diff --name-only HEAD -- audit/glass-harness.html audit/glass-sweep.mjs scripts/glass.mjs styles/narrow.css)
if [ $GLASS -eq 1 ] || [ -n "$CURTAIN" ]; then
  if green_before glass; then kept glass; else step "glass" glass.log bash -c 'cd "$1" && node audit/glass-sweep.mjs' _ "$WT"; fi
fi
git -C "$WT" checkout -- audit/harness/results 2>/dev/null

TREE=$(git -C "$WT" rev-parse --short HEAD)$([ -n "$(git -C "$WT" status --porcelain --untracked-files=no)" ] && echo "+edits")
LINE="QUICK $([ $RED -eq 0 ] && echo GREEN || echo RED) at $TREE: $(IFS=';'; echo "${SUM[*]}" | sed 's/;/; /g') (logs $OUT)"
echo "$LINE"
exit $RED
