#!/bin/bash
# usage: v.sh <worktree> <outdir> [suite-runs=1] [scenario numbers...]
# Runs the suite N times (01a.log, 01b.log, ...) and the named scenarios, then puts the
# tracked results files back and reaps any client left behind by this worktree's runs.
WT=$1; OUT=$2; RUNS=${3:-1}; shift 3 2>/dev/null
SCEN=${@:-00 10 11 12 13 14 15 20 30 40 50 60}
mkdir -p $OUT; rm -f $OUT/DONE
cd $WT/audit/harness
unset DRPG_REPO
for i in $(seq 1 $RUNS); do
  L=$(printf "\\x$(printf %x $((96+i)))")
  rm -f results/01-runtests.json
  { time node cluster.mjs scenarios/01-runtests.mjs ; } > $OUT/01$L.log 2>&1
  echo "exit $?" >> $OUT/01$L.log
  cp results/01-runtests.json $OUT/01$L.json 2>/dev/null
done
for n in $SCEN; do
  f=$(ls scenarios/$n-*.mjs 2>/dev/null | head -1)
  [ -z "$f" ] && { echo "no scenario $n" > $OUT/$n.log; continue; }
  node cluster.mjs $f --verbose > $OUT/$n.log 2>&1; echo "exit $?" >> $OUT/$n.log
done
cd $WT && node tools/config-prose.mjs --check lang/pl.json > $OUT/prose.log 2>&1
git -C $WT checkout -- audit/harness/results 2>/dev/null   # a no-op once results/ is untracked (E30 C3b)
# Reap clients forked from this worktree's harness (their argv[1] is the full path).
for p in $(ps -eo pid=,args= | awk -v w="$WT/audit/harness/client-entry.mjs" 'index($0, w) && $2 ~ /node$/ {print $1}'); do kill $p 2>/dev/null; done
echo DONE > $OUT/DONE
