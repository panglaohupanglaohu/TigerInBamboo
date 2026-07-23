#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${VENV_DIR:-$ROOT_DIR/.venv}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8931}"
RELOAD="${RELOAD:-1}"

cd "$ROOT_DIR"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "[start] Creating Python virtual environment: $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

echo "[start] Installing backend dependencies"
python -m pip install -r "$ROOT_DIR/backend/requirements.txt"

UVICORN_ARGS=(
  "backend.main:app"
  "--host" "$HOST"
  "--port" "$PORT"
)

if [[ "$RELOAD" != "0" ]]; then
  UVICORN_ARGS+=("--reload")
fi

echo "[start] Backend API: http://$HOST:$PORT/api/health"
echo "[start] Frontend:    http://$HOST:$PORT/"
echo "[start] Press Ctrl+C to stop"

exec uvicorn "${UVICORN_ARGS[@]}"
