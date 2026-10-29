# portable.sh - sourced by quick.sh, mut.sh and ci-status.sh: flock, timeout and the harness clients' reaping where
# the system has no flock, no timeout or no `ps -eo` (macOS; Git Bash on Windows).
# 29.10.2026, line B on Windows 11 / Git Bash: the kit's first shim `flock() { shift 2; "$@"; }` dropped "-w" and the
# wait but left the lock path as the command, so every harness step of quick.sh exited 127; and `ps -eo pid=,args=`
# is refused by MSYS ps, so no client was reaped. This file replaces both.

# flock -w <seconds> <lockfile> <command...>: a mkdir lock (atomic on every filesystem the kit runs on), waited for
# up to <seconds>, released when the command ends. A lock left by a killed run is taken over after <seconds>.
if ! command -v flock >/dev/null 2>&1; then
  flock() {
    local wait=0
    if [ "$1" = "-w" ]; then wait=$2; shift 2; fi
    local dir="$1.d"; shift
    local t=0
    until mkdir "$dir" 2>/dev/null; do
      if [ "$t" -ge "$wait" ]; then echo "flock (portable.sh): $dir still held after ${wait}s - taking it over" >&2; break; fi
      sleep 2; t=$((t + 2))
    done
    "$@"; local rc=$?
    rmdir "$dir" 2>/dev/null
    return $rc
  }
fi

# timeout <seconds> <command...>: without coreutils' timeout the command runs unbounded (said once on stderr).
if ! command -v timeout >/dev/null 2>&1; then
  timeout() { shift; "$@"; }
fi

# reap_clients <harness dir>: kill, by PID, every node process whose command line runs <harness dir>/client-entry.mjs.
reap_clients() {
  local h=$1 p
  if ps -eo pid=,args= >/dev/null 2>&1; then
    for p in $(ps -eo pid=,args= | awk -v w="$h/client-entry.mjs" 'index($0, w) && $2 ~ /node$/ {print $1}'); do kill "$p" 2>/dev/null; done
  elif command -v cygpath >/dev/null 2>&1 && command -v powershell.exe >/dev/null 2>&1; then
    local win; win=$(cygpath -w "$h")
    for p in $(powershell.exe -NoProfile -Command "\$w='$win'; Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -and (\$_.CommandLine.Replace('/','\\').ToLower().Contains((\$w + '\\client-entry.mjs').ToLower())) } | ForEach-Object { \$_.ProcessId }" | tr -d '\r'); do
      taskkill //PID "$p" //F >/dev/null 2>&1
    done
  fi
}
