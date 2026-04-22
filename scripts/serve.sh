#!/usr/bin/env bash
# Start the local satellite-visibility API.
# Binds to 127.0.0.1 only — never exposes to the network.

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -d .venv ]]; then
  echo "error: .venv not found. Run 'uv venv && uv pip install -e \".[dev]\"' first." >&2
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

HOST="${SATVIS_HOST:-127.0.0.1}"
PORT="${SATVIS_PORT:-8765}"

echo "Starting Satellite Visibility API on http://${HOST}:${PORT}"
echo "OpenAPI docs: http://${HOST}:${PORT}/docs"
echo

exec uvicorn "api.app:create_app" --factory --host "${HOST}" --port "${PORT}" --reload
