#!/usr/bin/env bash
#
# Start the HushWay backend and frontend together.
#
#   ./scripts/dev.sh
#
# Ctrl-C stops both. Logs go to logs/backend.log and logs/frontend.log.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKEND_PORT="${HUSHWAY_BACKEND_PORT:-8000}"
FRONTEND_PORT="${HUSHWAY_FRONTEND_PORT:-5173}"
PYTHON="${HUSHWAY_PYTHON:-python3}"

mkdir -p logs

# ---------------------------------------------------------------- preflight --

# Load .env if present, so the password does not have to live in your shell
# profile or, worse, be edited into this tracked file.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -z "${HUSHWAY_DB_PASSWORD:-}" ]; then
  echo "ERROR: HUSHWAY_DB_PASSWORD is not set."
  echo ""
  echo "  Either export it:   export HUSHWAY_DB_PASSWORD='<your postgres password>'"
  echo "  or create .env:     echo \"HUSHWAY_DB_PASSWORD=<your postgres password>\" > .env"
  echo ""
  echo "  .env is gitignored. Do not edit the password into this script — it is"
  echo "  tracked by git and would be committed."
  exit 1
fi

# Child processes only inherit EXPORTED variables. Without this, setting the
# password as a plain shell variable leaves the API unable to reach Postgres,
# and it fails later with a confusing "no password supplied".
export HUSHWAY_DB_PASSWORD
export HUSHWAY_DB_HOST="${HUSHWAY_DB_HOST:-localhost}"
export HUSHWAY_DB_PORT="${HUSHWAY_DB_PORT:-5432}"
export HUSHWAY_DB_NAME="${HUSHWAY_DB_NAME:-postgres}"
export HUSHWAY_DB_USER="${HUSHWAY_DB_USER:-postgres}"

# Prove the credentials actually work before starting anything, so a bad
# password fails here with a clear message instead of as an empty dropdown.
if ! "$PYTHON" - <<'PYCHECK' 2>logs/dbcheck.log
import os, sys
import psycopg2
try:
    psycopg2.connect(
        host=os.environ["HUSHWAY_DB_HOST"], port=os.environ["HUSHWAY_DB_PORT"],
        dbname=os.environ["HUSHWAY_DB_NAME"], user=os.environ["HUSHWAY_DB_USER"],
        password=os.environ["HUSHWAY_DB_PASSWORD"],
    ).close()
except Exception as exc:
    print(exc, file=sys.stderr)
    sys.exit(1)
PYCHECK
then
  echo "ERROR: cannot connect to PostgreSQL as user '$HUSHWAY_DB_USER'."
  echo "       $(tr -d '\n' <logs/dbcheck.log | head -c 200)"
  echo ""
  echo "  Check HUSHWAY_DB_PASSWORD, and that PostgreSQL is running on"
  echo "  $HUSHWAY_DB_HOST:$HUSHWAY_DB_PORT."
  exit 1
fi

if ! "$PYTHON" -c "import fastapi, psycopg2, networkx" 2>/dev/null; then
  echo "ERROR: backend dependencies are missing for '$PYTHON'."
  echo "       pip install -r requirements.txt   (from the repository root)"
  echo "       (or set HUSHWAY_PYTHON to the interpreter that has them)"
  exit 1
fi

if [ ! -d frontend/node_modules ]; then
  echo "ERROR: frontend dependencies are missing."
  echo "       cd frontend && npm install"
  exit 1
fi

port_busy() { lsof -ti tcp:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# `./scripts/dev.sh --restart` stops whatever holds our ports first. Handy when
# a previous run was killed in a way that skipped its cleanup.
RESTART=0
for arg in "$@"; do
  case "$arg" in
    --restart) RESTART=1 ;;
    -h|--help)
      echo "Usage: ./scripts/dev.sh [--restart]"
      echo "  --restart   stop anything already holding the ports, then start"
      exit 0
      ;;
    *) echo "Unknown option: $arg (try --help)"; exit 1 ;;
  esac
done

for port_pair in "$BACKEND_PORT backend" "$FRONTEND_PORT frontend"; do
  set -- $port_pair
  port="$1"
  role="$2"
  port_busy "$port" || continue

  holder_pid="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null | head -1)"
  holder_cmd="$(ps -p "$holder_pid" -o command= 2>/dev/null || echo unknown)"

  if [ "$RESTART" -eq 1 ]; then
    echo "Port $port was held by pid $holder_pid; stopping it (--restart)."
    kill -TERM $(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null) 2>/dev/null || true
    sleep 2
    kill -9 $(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null) 2>/dev/null || true
    sleep 1
    port_busy "$port" && { echo "ERROR: could not free port $port."; exit 1; }
    continue
  fi

  echo "ERROR: port $port is already in use, so the $role cannot start."
  echo "       Held by pid $holder_pid: $(echo "$holder_cmd" | cut -c1-70)"
  echo ""
  case "$holder_cmd" in
    *uvicorn*|*vite*)
      echo "  That looks like an earlier HushWay run. Restart cleanly with:"
      echo "      ./scripts/dev.sh --restart"
      ;;
    *)
      echo "  That is not a HushWay process, so stop it yourself, or use a"
      echo "  different port:  HUSHWAY_BACKEND_PORT=8001 ./scripts/dev.sh"
      ;;
  esac
  exit 1
done

# ------------------------------------------------------------------ cleanup --

BACKEND_PID=""
FRONTEND_PID=""

# uvicorn --reload and npx each supervise a child process, so killing the
# parent alone leaves the real server running and the port held.
stop_tree() {
  local pid="$1"
  [ -z "$pid" ] && return 0
  pkill -TERM -P "$pid" 2>/dev/null || true
  kill -TERM "$pid" 2>/dev/null || true
}

cleanup() {
  trap - EXIT INT TERM
  echo ""
  echo "Stopping..."
  stop_tree "$FRONTEND_PID"
  stop_tree "$BACKEND_PID"
  sleep 1
  # Safety net: anything still holding our ports is ours to clear.
  for port in "$FRONTEND_PORT" "$BACKEND_PORT"; do
    local stragglers
    stragglers="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    [ -n "$stragglers" ] && kill -9 $stragglers 2>/dev/null || true
  done
  echo "Stopped."
}
trap cleanup EXIT INT TERM

# Poll a URL until it answers, failing if the process dies or time runs out.
wait_for() {
  local url="$1" pid="$2" name="$3" log="$4"
  for _ in $(seq 1 60); do
    if curl -sf -o /dev/null "$url" 2>/dev/null; then
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "ERROR: the $name exited during startup. Last lines of $log:"
      tail -20 "$log"
      return 1
    fi
    sleep 0.5
  done
  echo "ERROR: the $name did not become ready within 30s. Last lines of $log:"
  tail -20 "$log"
  return 1
}

# ------------------------------------------------------------------ backend --

echo "Starting backend on :$BACKEND_PORT ..."
(
  cd backend
  exec "$PYTHON" -m uvicorn app.main:app --reload --port "$BACKEND_PORT"
) >logs/backend.log 2>&1 &
BACKEND_PID=$!

wait_for "http://localhost:$BACKEND_PORT/api/health" "$BACKEND_PID" "backend" logs/backend.log

HEALTH="$(curl -sf "http://localhost:$BACKEND_PORT/api/health" 2>/dev/null || true)"
echo "  $HEALTH"

case "$HEALTH" in
  *'"status":"degraded'*)
    echo ""
    echo "ERROR: the API started but cannot query the database."
    echo "       Last lines of logs/backend.log:"
    tail -5 logs/backend.log
    exit 1
    ;;
  *'"graph_nodes":0'*)
    echo ""
    echo "WARNING: the routing graph is empty, so route planning will fail."
    echo "         Run:  $PYTHON scripts/build_graph.py"
    echo ""
    ;;
esac

# ----------------------------------------------------------------- frontend --

echo "Starting frontend on :$FRONTEND_PORT ..."
(
  cd frontend
  exec npx vite --port "$FRONTEND_PORT" --strictPort
) >logs/frontend.log 2>&1 &
FRONTEND_PID=$!

wait_for "http://localhost:$FRONTEND_PORT/" "$FRONTEND_PID" "frontend" logs/frontend.log

cat <<EOF

  HushWay is running.

    App             http://localhost:$FRONTEND_PORT
    Route planner   http://localhost:$FRONTEND_PORT/explore
    API docs        http://localhost:$BACKEND_PORT/docs

  Logs: logs/backend.log, logs/frontend.log
  Press Ctrl-C to stop both.

EOF

# Block until one side dies. `wait -n` would be neater but needs bash 4.3, and
# macOS still ships bash 3.2, where it fails silently and returns immediately.
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done

echo ""
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "The backend exited. Last lines of logs/backend.log:"
  tail -20 logs/backend.log
else
  echo "The frontend exited. Last lines of logs/frontend.log:"
  tail -20 logs/frontend.log
fi
