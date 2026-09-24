#!/bin/bash
# usage: vsum.sh <outdir> - one line per run
OUT=$1
for f in $OUT/01*.log; do
  echo "$(basename $f): $(grep -oE '[0-9]+ passed, [0-9]+ failed, [0-9]+ skipped' $f | tail -1)  wall $(grep -E '^real' $f | awk '{print $2}')  $(tail -1 $f)"
done
for f in $OUT/[0-9][0-9].log; do
  n=$(basename $f .log); [ "$n" = "01" ] && continue
  echo "$n: $(grep -E '^\[cluster\].*checks passed' $f | tail -1)  $(tail -1 $f)"
done
echo "prose: $(tail -1 $OUT/prose.log 2>/dev/null)"
