#!/bin/sh
set -u

DEV_PORTS='3000,3001,3002,3003,3004,3005,3006,3100,5173'

comm_of() {
  ps -o comm= -p "$1" 2>/dev/null
}

is_dev_process() {
  case "$1" in
    *ocker*) return 1 ;;
    *node | *pnpm | *turbo | *tsx | *vite | next-server*) return 0 ;;
    *) return 1 ;;
  esac
}

collect_with_ancestors() {
  pid=$1
  echo "$pid"

  while :; do
    parent=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')

    case "$parent" in
      '' | 0 | 1) return ;;
    esac

    if is_dev_process "$(comm_of "$parent")"; then
      echo "$parent"
      pid=$parent
    else
      return
    fi
  done
}

listeners=$(lsof -ti "tcp:${DEV_PORTS}" -sTCP:LISTEN 2>/dev/null | sort -u)
pids=''

for listener in $listeners; do
  if is_dev_process "$(comm_of "$listener")"; then
    pids="${pids}$(collect_with_ancestors "$listener")
"
  else
    echo "dev-stop() skipped ${listener} $(comm_of "$listener") — not a dev process"
  fi
done

pids=$(echo "$pids" | grep -E '^[0-9]+$' | sort -u)

if [ -z "$pids" ]; then
  echo 'dev-stop() nothing to kill on 3000-3006, 3100, 5173'
  exit 0
fi

for pid in $pids; do
  echo "dev-stop() killing ${pid} $(comm_of "$pid")"
done

kill -9 $pids 2>/dev/null

echo 'dev-stop() done'
exit 0
