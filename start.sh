#!/bin/sh
#
# start.sh — container entrypoint for the SwahiliSME backend.
#
# Why this file exists:
#   Railway does NOT always run the start command through a shell, so a
#   command like `uvicorn api.app:app --port $PORT` is executed literally and
#   uvicorn dies with:
#       Error: Invalid value for '--port': '$PORT' is not a valid integer.
#   Running the port resolution *inside* an executable script removes any
#   dependency on shell variable expansion by the platform.
#
# It also guarantees the import root: the backend modules use flat imports
# (db.database, models.user, services.*, api.routes.*), so /app/backend must
# be both the working directory and on PYTHONPATH.
set -eu

# ── Import root ───────────────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-/app/backend}"
if [ ! -d "$APP_DIR" ]; then
    # Fallback for a non-/app layout (e.g. running from the repo checkout).
    APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/backend"
fi
cd "$APP_DIR"

case ":${PYTHONPATH:-}:" in
    *":$APP_DIR:"*) ;;
    *) PYTHONPATH="$APP_DIR${PYTHONPATH:+:$PYTHONPATH}" ;;
esac
export PYTHONPATH

# ── PORT: Railway injects it; fall back to 8000, ignore non-numeric values ────
PORT="${PORT:-8000}"
case "$PORT" in
    '' | *[!0-9]*)
        echo "[start] WARNING: PORT='$PORT' is not a valid integer — using 8000" >&2
        PORT=8000
        ;;
esac

echo "[start] cwd=$(pwd) PYTHONPATH=$PYTHONPATH port=$PORT"

exec python -m uvicorn api.app:app --host 0.0.0.0 --port "$PORT"
