#!/usr/bin/env bash
# Serves the static crew dashboard. It reads the API at frontend/config.js.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${FRONTEND_PORT:-5173}"

printf 'Crew dashboard: http://127.0.0.1:%s\n' "$PORT"
printf 'Simulated readings come from the API at the origin in frontend/config.js.\n'
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT_DIR/frontend"
