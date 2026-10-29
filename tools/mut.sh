#!/bin/bash
# mut.sh - one mutant, killed or not (METHOD-v2 section 4: MARKED commits only; INFRA I7). Parameterised, never copied
# per stage: the e79run-style tool (S/e79run/mut.sh, fp.sh, verdict.py) stops with E79.
#
#   bash mut.sh <worktree> <defs.py> <label> <name[,name...]> <kind> <arg> [<regex>]
#
#   defs.py   a python file holding `M = { "name": ("path/in/tree", "old text", "new text"), ... }`; each old text must
#             occur exactly once in its file (a mutant that matches 0 or 2+ times is an error, not a survivor)
#   kind      own   <arg> = tier-2 test names, comma separated: run-tests.mjs --tier 2 --only <each>
#             t01   <arg> ignored: run-tests.mjs --tier 1
#             scen  <arg> = a scenario number: run-all.mjs scenarios --only <NN>
#             cmd   <arg> = a shell command run at the copy's root
#   regex     what a kill must print (default for own/t01: "run-tests: [0-9]+ passed, [1-9][0-9]* failed"; for scen:
#             "[1-9][0-9]* failed|FAIL"; cmd needs one). A non-zero exit without the regex is ERRORED: a crash is not
#             the check the mutant was written for.
#
# The worktree is copied as it is on disk to <worktree>/../mut/<label>/tree (never mutated in place), the mutants are
# applied there, the step runs under S/harness.lock, and the clients it left are reaped by PID. Output: the log at
# <worktree>/../mut/<label>.log and one last line "MUT <label> KILLED|SURVIVED|ERRORED (exit N)".
# Exit 0 killed, 1 survived, 2 errored or usage.
# Written 18.10.2026 for INFRA; first run owed on the first MARKED commit of E80 (not run yet).
# Portability (line B kit, 29.10.2026): macOS and Git Bash on Windows have no flock or timeout; run without them there.
. "$(dirname "${BASH_SOURCE[0]}")/portable.sh"   # flock, timeout, reap_clients (29.10.2026)
set -u
WT=$(readlink -f "${1:?usage: mut.sh <worktree> <defs.py> <label> <names> <kind> <arg> [regex]}")
DEFS=$(readlink -f "${2:?defs.py}"); LABEL=${3:?label}; NAMES=${4:?names}; KIND=${5:?kind}; ARG=${6:-}; RE=${7:-}
S=${LINE_B_HOME:-$(cd "$(dirname "$0")/.." && pwd)}
LOCK=${LOCK:-$S/harness.lock}
OUT=$(dirname "$WT")/mut; T=$OUT/$LABEL/tree; LOG=$OUT/$LABEL.log
case $KIND in
  own|t01) RE=${RE:-'run-tests: [0-9]+ passed, [1-9][0-9]* failed'} ;;
  scen) RE=${RE:-'[1-9][0-9]* failed|FAIL'} ;;
  cmd) [ -n "$RE" ] || { echo "mut.sh: cmd needs a regex"; exit 2; } ;;
  *) echo "mut.sh: no kind $KIND"; exit 2 ;;
esac
mkdir -p "$OUT"; rm -rf "$OUT/$LABEL"; mkdir -p "$T"
(cd "$WT" && tar cf - --exclude=./.git --exclude=./audit/harness/results --exclude=./audit/harness/node_modules .) | (cd "$T" && tar xf -)
ln -s "$(readlink -f "$WT/audit/harness/node_modules")" "$T/audit/harness/node_modules"
python3 -I - "$T" "$DEFS" "$NAMES" > "$LOG" 2>&1 <<'PY' || { echo "MUT $LABEL ERRORED (mutant did not apply)" | tee -a "$LOG"; exit 2; }
import sys
tree, defs, names = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
g = {}; exec(open(defs).read(), g); M = g["M"]
for n in [x.strip() for x in names if x.strip()]:
    if n not in M: sys.exit(f"mutant {n}: not in {defs}")
    f, old, new = M[n]; p = f"{tree}/{f}"; s = open(p).read(); c = s.count(old)
    if c != 1: sys.exit(f"mutant {n}: {c} matches in {f}")
    open(p, "w").write(s.replace(old, new)); print(f"applied {n}")
PY
H=$T/audit/harness; unset DRPG_REPO
case $KIND in
  own) A=(); IFS=',' read -r -a NS <<< "$ARG"; for n in "${NS[@]}"; do n=$(echo "$n" | sed 's/^ *//; s/ *$//'); [ -n "$n" ] && A+=(--only "$n"); done
       (cd "$H" && flock -w 3600 "$LOCK" timeout 1500 node run-tests.mjs --tier 2 "${A[@]}") >> "$LOG" 2>&1 ;;
  t01) (cd "$H" && flock -w 3600 "$LOCK" timeout 1500 node run-tests.mjs --tier 1) >> "$LOG" 2>&1 ;;
  scen) (cd "$H" && flock -w 3600 "$LOCK" timeout 1500 node run-all.mjs scenarios --only "$ARG") >> "$LOG" 2>&1 ;;
  cmd) (cd "$T" && flock -w 3600 "$LOCK" timeout 900 bash -c "$ARG") >> "$LOG" 2>&1 ;;
esac
RC=$?
reap_clients "$H"
if [ $RC -eq 0 ]; then V=SURVIVED; E=1
elif grep -E -q "$RE" "$LOG"; then V=KILLED; E=0
else V=ERRORED; E=2; fi
echo "MUT $LABEL $V (exit $RC)" | tee -a "$LOG"
exit $E
