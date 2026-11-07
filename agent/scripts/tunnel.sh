#!/usr/bin/env bash
# Expose the local agent to the Vercel dashboard through a Cloudflare quick tunnel.
# Usage: agent/scripts/tunnel.sh   (start the agent first; PORT defaults to AGENT_PORT, then 8787)
set -euo pipefail
PORT="${PORT:-${AGENT_PORT:-8787}}"

if ! command -v cloudflared >/dev/null 2>&1; then
  cat >&2 <<'EOF'
cloudflared is not installed. Install it, then rerun this script:
  macOS:          brew install cloudflared
  Debian/Ubuntu:  curl -fsSL -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i /tmp/cloudflared.deb
  Windows:        winget install --id Cloudflare.cloudflared
  Other:          https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
EOF
  exit 1
fi

if ! curl -sf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
  echo "[tunnel] WARNING: agent not answering on http://localhost:${PORT}/health yet (start it with: cd agent && npm start)" >&2
fi

echo "[tunnel] Copy the https://*.trycloudflare.com URL below into Vercel as NEXT_PUBLIC_AGENT_URL"
echo "[tunnel] (with NEXT_PUBLIC_USE_FIXTURES=false) and redeploy. Ctrl+C stops the tunnel."
exec cloudflared tunnel --url "http://localhost:${PORT}"
