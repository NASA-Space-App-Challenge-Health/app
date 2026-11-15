#!/usr/bin/env bash
# Host-side API for machines that are not using Docker Compose.
# The Compose stack remains the shared backend entry point:
#   ./backend/docker/compose.sh up --detach --build --wait
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  printf 'python3 is required to run the API on the host.\n' >&2
  exit 1
fi

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi

.venv/bin/pip install -r backend/services/api/requirements.txt
export DATABASE_URL="${DATABASE_URL:-postgresql://app:app@127.0.0.1:5432/app}"
export API_PORT="${API_PORT:-8080}"

exec .venv/bin/uvicorn app.main:app \
  --app-dir backend/services/api \
  --host 127.0.0.1 \
  --port "$API_PORT"
