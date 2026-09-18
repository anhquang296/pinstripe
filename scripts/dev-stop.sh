#!/bin/sh
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
DEV_PORTS='3000,3001,3002,3003,3004,3005,3006,3100,4321,5173'
GRACE_SECONDS=3
IS_DRY_RUN=false

if [ "${1:-}" = '--dry-run' ]; then
  IS_DRY_RUN=true
fi

comm_of() {
  comm=$(ps -o comm= -p "$1" 2>/dev/null)
  echo "${comm##*/}"
}

args_of() {
  ps -o args= -p "$1" 2>/dev/null | cut -c1-140
}

is_dev_command() {
  case "$(comm_of "$1")" in
    node | pnpm | sh | esbuild | turbo | tsx | tsup | vite | astro | next-server* | concurrently) return 0 ;;
    *) return 1 ;;
  esac
}

list_ancestors() {
  pid=$1

  while :; do
    echo "$pid"
    parent=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')

    case "$parent" in
      '' | 0 | 1) return ;;
    esac

    pid=$parent
  done
}

list_descendants() {
  for child in $(pgrep -P "$1" 2>/dev/null); do
    echo "$child"
    list_descendants "$child"
  done
}

list_workspace_processes() {
  lsof -d cwd -Fpn 2>/dev/null | awk -v root="$ROOT" '
    /^p/ { pid = substr($0, 2) }
    /^n/ {
      path = substr($0, 2)

      if (index(path, root "/apps/") == 1 || index(path, root "/packages/") == 1) {
        print pid, "workspace"
      } else if (path == root) {
        print pid, "root"
      }
    }
  '
}

is_root_launcher() {
  case "$(args_of "$1")" in
    *turbo* | *'pnpm dev' | *'pnpm run dev') return 0 ;;
    *) return 1 ;;
  esac
}

SELF_PIDS=$(list_ancestors $$)

is_self() {
  echo "$SELF_PIDS" | grep -qx "$1"
}

candidates=''

for listener in $(lsof -ti "tcp:${DEV_PORTS}" -sTCP:LISTEN 2>/dev/null | sort -u); do
  if is_dev_command "$listener"; then
    candidates="${candidates}${listener}
"
  else
    echo "dev-stop() skipped ${listener} $(comm_of "$listener"), not a dev process"
  fi
done

list_workspace_processes > "${TMPDIR:-/tmp}/dev-stop.$$"

while read -r pid location; do
  if ! is_dev_command "$pid"; then
    continue
  fi

  if [ "$location" = 'workspace' ] || is_root_launcher "$pid"; then
    candidates="${candidates}${pid}
"
  fi
done < "${TMPDIR:-/tmp}/dev-stop.$$"

rm -f "${TMPDIR:-/tmp}/dev-stop.$$"

targets=''

for pid in $(echo "$candidates" | grep -E '^[0-9]+$' | sort -u); do
  targets="${targets}${pid}
$(list_descendants "$pid")
"
done

pids=''

for pid in $(echo "$targets" | grep -E '^[0-9]+$' | sort -un); do
  if ! is_self "$pid"; then
    pids="${pids} ${pid}"
  fi
done

if [ -z "$pids" ]; then
  echo 'dev-stop() nothing to stop'
  exit 0
fi

for pid in $pids; do
  echo "dev-stop() stopping ${pid} $(args_of "$pid")"
done

if [ "$IS_DRY_RUN" = true ]; then
  echo 'dev-stop() dry run, nothing killed'
  exit 0
fi

kill -TERM $pids 2>/dev/null

elapsed=0

while [ "$elapsed" -lt "$GRACE_SECONDS" ]; do
  survivors=''

  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then
      survivors="${survivors} ${pid}"
    fi
  done

  if [ -z "$survivors" ]; then
    break
  fi

  sleep 1
  elapsed=$((elapsed + 1))
done

for pid in $pids; do
  if kill -0 "$pid" 2>/dev/null; then
    echo "dev-stop() force killing ${pid}"
    kill -KILL "$pid" 2>/dev/null
  fi
done

busy=$(lsof -ti "tcp:${DEV_PORTS}" -sTCP:LISTEN 2>/dev/null)

if [ -n "$busy" ]; then
  echo "dev-stop() ports still in use by: $(echo "$busy" | tr '\n' ' ')"
  exit 1
fi

echo 'dev-stop() done'
exit 0
