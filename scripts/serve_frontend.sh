#!/usr/bin/env bash
# Starts the Vite dev server for the crew dashboard. API calls are same-origin
# relative paths; the Vite server proxies /api, /eda, /predict and
# /recommendations to the Compose API (VITE_DEV_API, default 127.0.0.1:8081).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${FRONTEND_PORT:-5173}"
API_ORIGIN="${VITE_DEV_API:-http://127.0.0.1:8080}"

printf 'Crew dashboard: http://127.0.0.1:%s\n' "$PORT"
printf 'API proxy target: %s\n' "$API_ORIGIN"

cd "$ROOT_DIR/frontend"
exec npm run dev -- --port "$PORT" --host 127.0.0.1
