#!/bin/bash
# ci-status.sh - the CI verdict of one commit, in one line (METHOD-v2 section 4; INFRA I7).
#
#   bash ci-status.sh <worktree> <rev> [--wait]
#
# Prints "CI <sha7> green|red|pending|none ..." and exits 0 green, 1 red, 2 pending, 3 none (no run yet, or no
# commit). --wait polls every 30 s for up to WAIT_S seconds (default 540, under Bash's 10-minute call limit) while
# the run is not finished, then prints the line; call it again while it says pending. A red line names the jobs that
# failed, and the lines after it are those jobs' error annotations (ci.yml writes the first problems of a red job
# there, because job logs and artifacts are not readable from the line's session) - at most ANN_MAX (default 20).
# 18.10.2026: the kit's copy called `gh run list/watch/view`; in this session `gh` is Claude Code's client, which
# serves only `gh api`, so every call below is a REST read. Tried on b101885 (CI run 39080388921, green).
# CI_REPO (owner/name) and CI_WORKFLOW (the run's name, default "CI") override.
# Portability (line B kit, 29.10.2026): macOS and Git Bash on Windows have no flock or timeout; run without them there.
. "$(dirname "${BASH_SOURCE[0]}")/portable.sh"   # flock, timeout, reap_clients (29.10.2026)
set -u
WT=${1:?usage: ci-status.sh <worktree> <rev> [--wait]}
REV=${2:?usage: ci-status.sh <worktree> <rev> [--wait]}
WAIT=${3:-}
SHA=$(git -C "$WT" rev-parse --verify "$REV^{commit}" 2>/dev/null) || { echo "CI none: no commit $REV in $WT"; exit 3; }
S7=${SHA:0:7}
REPO=${CI_REPO:-$(git -C "$WT" remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##')}
WF=${CI_WORKFLOW:-CI}

latest() {  # newest run named $WF for this commit: "<id> <status> <conclusion> <url>", or nothing
  timeout 60 gh api "repos/$REPO/actions/runs?head_sha=$SHA&per_page=20" 2>/dev/null |
    WF="$WF" python3 -I -c 'import json,os,sys
try: r = json.load(sys.stdin)["workflow_runs"]
except Exception: r = []
r = [x for x in r if x.get("name") == os.environ["WF"]]
r.sort(key=lambda x: x.get("created_at", ""), reverse=True)
if r: x = r[0]; print(x["id"], x["status"], x["conclusion"] or "-", x["html_url"])'
}

read -r ID ST CO URL <<< "$(latest)"
if [ -z "${ID:-}" ]; then echo "CI $S7 none: no run of workflow '$WF' for this commit yet (pushed? CI triggers on this branch?)"; exit 3; fi
if [ "$ST" != completed ] && [ "$WAIT" = --wait ]; then
  END=$(( $(date +%s) + ${WAIT_S:-540} ))
  while [ "$ST" != completed ] && [ "$(date +%s)" -lt "$END" ]; do
    sleep 30
    read -r ID ST CO URL <<< "$(latest)"
  done
fi
if [ "$ST" != completed ]; then echo "CI $S7 pending ($ST) $URL"; exit 2; fi
if [ "$CO" = success ]; then echo "CI $S7 green $URL"; exit 0; fi
JOBS=$(timeout 60 gh api "repos/$REPO/actions/runs/$ID/jobs?per_page=100" \
  --jq '.jobs[] | select(.conclusion != "success" and .conclusion != "skipped") | "\(.id)\t\(.name)"' 2>/dev/null)
FAILED=$(printf '%s\n' "$JOBS" | cut -f2 | grep -v '^$' | paste -sd';' - | sed 's/;/; /g')
echo "CI $S7 red ($CO): ${FAILED:-see the run} $URL"
printf '%s\n' "$JOBS" | cut -f1 | grep -E '^[0-9]+$' | while read -r J; do
  timeout 60 gh api "repos/$REPO/check-runs/$J/annotations" --jq '.[] | select(.annotation_level == "failure") | "  \(.title // "-"): \(.message)"' 2>/dev/null
done | head -n "${ANN_MAX:-20}"
exit 1
