#!/usr/bin/env bash
# Starts agent + dashboard on this laptop for the live pitch (no network risk) and clears demo/inbox.
#   ./demo/start.sh            (or: npm start from the repo root)
# Ctrl+C stops both.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then set -a; . ./.env; set +a; fi
AGENT_PORT="${AGENT_PORT:-8787}"
WEB_PORT="${WEB_PORT:-3000}"
export NEXT_PUBLIC_AGENT_URL="http://localhost:${AGENT_PORT}"
export NEXT_PUBLIC_USE_FIXTURES=false

echo "[start] clearing demo/inbox"
find demo/inbox -mindepth 1 ! -name .gitkeep -delete

if [ "${MOCK_CHAIN:-true}" = "false" ] && [ ! -f contracts/deployments/arbitrum.json ]; then
  echo "[start] WARNING: MOCK_CHAIN=false but contracts/deployments/arbitrum.json is missing"
fi

pids=()
cleanup() { echo; echo "[start] stopping"; kill "${pids[@]}" 2>/dev/null || true; wait 2>/dev/null || true; }
trap cleanup EXIT INT TERM

if [ -f agent/package.json ]; then
  [ -d agent/node_modules ] || (cd agent && npm install)
  echo "[start] agent on :${AGENT_PORT} (MOCK_CHAIN=${MOCK_CHAIN:-true})"
  (cd agent && AGENT_PORT="$AGENT_PORT" npm run dev 2>&1 | sed -u 's/^/[agent] /') &
  pids+=($!)
else
  echo "[start] agent/package.json not found, skipping agent"
fi

if [ -f web/package.json ]; then
  [ -d web/node_modules ] || (cd web && npm install)
  echo "[start] dashboard on http://localhost:${WEB_PORT} -> ${NEXT_PUBLIC_AGENT_URL}"
  (cd web && PORT="$WEB_PORT" npm run dev 2>&1 | sed -u 's/^/[web]   /') &
  pids+=($!)
else
  echo "[start] web/package.json not found, skipping dashboard"
fi

[ ${#pids[@]} -gt 0 ] || { echo "[start] nothing to start"; exit 1; }
echo "[start] ready. In another terminal: ./demo/run.sh"
wait
