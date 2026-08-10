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

if [ -z "${HUSHWAY_DB_PASSWORD:-}" ]; then
  echo "ERROR: HUSHWAY_DB_PASSWORD is not set."
  echo "       export HUSHWAY_DB_PASSWORD='<your postgres password>' and try again."
  exit 1
fi

if ! "$PYTHON" -c "import fastapi, psycopg2, networkx" 2>/dev/null; then
  echo "ERROR: backend dependencies are missing for '$PYTHON'."
  echo "       cd backend && pip install -r requirements.txt"
  echo "       (or set HUSHWAY_PYTHON to the interpreter that has them)"
  exit 1
fi

if [ ! -d frontend/node_modules ]; then
  echo "ERROR: frontend dependencies are missing."
  echo "       cd frontend && npm install"
  exit 1
fi

port_busy() { lsof -ti tcp:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

for port_pair in "$BACKEND_PORT backend" "$FRONTEND_PORT frontend"; do
  set -- $port_pair
  if port_busy "$1"; then
    echo "ERROR: port $1 is already in use, so the $2 cannot start."
    echo "       Find it with:  lsof -ti tcp:$1"
    echo "       Stop it with:  kill \$(lsof -ti tcp:$1)"
    exit 1
  fi
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
