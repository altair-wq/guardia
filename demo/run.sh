#!/usr/bin/env bash
# The hands-off live demo. Start agent + dashboard first (./demo/start.sh), then run this
# and do not touch anything:
#   a) legit invoice          -> paid in BRAt
#   b) impersonation invoice  -> blocked (wallet_changed, lookalike_address, urgent_language)
#   c) injection invoice      -> blocked (prompt_injection)
#   d) direct bad payment     -> PaymentRejected onchain, with tx hash
# Options: DEMO_FORMAT=txt (default pdf), DEMO_GAP=10 (seconds), DEMO_RESET=0 to skip the reset.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then set -a; . ./.env; set +a; fi
AGENT_URL="${AGENT_URL:-http://localhost:${AGENT_PORT:-8787}}"
FORMAT="${DEMO_FORMAT:-pdf}"
GAP="${DEMO_GAP:-10}"
INBOX="demo/inbox"
STAGING="demo/.staging"

[ -d demo/node_modules ] || (cd demo && npm install --silent)
[ -f "demo/invoices/legit.${FORMAT}" ] || node demo/make-invoices.mjs

# Wait for the agent (up to 30 s), but never block the demo on it.
for _ in $(seq 1 30); do
  curl -sf "${AGENT_URL}/rules" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf "${AGENT_URL}/rules" >/dev/null 2>&1 || echo "[run] WARNING: agent not answering at ${AGENT_URL}; continuing anyway"

if [ "${DEMO_RESET:-1}" != "0" ]; then
  curl -sf -X POST "${AGENT_URL}/demo/reset" >/dev/null 2>&1 || true
  find "$INBOX" -mindepth 1 ! -name .gitkeep -delete
  sleep 2
fi

drop() {
  local name="$1" label="$2"
  mkdir -p "$STAGING"
  cp "demo/invoices/${name}.${FORMAT}" "${STAGING}/${name}.${FORMAT}"
  # Atomic rename so the watcher never sees a half-written file.
  mv "${STAGING}/${name}.${FORMAT}" "${INBOX}/${name}.${FORMAT}"
  echo "[run] $(date +%H:%M:%S) ${label}"
}

drop legit         "a) factura legítima de Autopeças Sul      -> se espera: pagada en BRAt"
sleep "$GAP"
drop impersonation "b) suplantación: 'cambiamos de cuenta'   -> se espera: bloqueada"
sleep "$GAP"
drop injection     "c) instrucciones ocultas para la IA      -> se espera: bloqueada"
sleep "$GAP"
node demo/force-bad-payment.mjs

# Summary from the agent, for the presenter's terminal.
node --input-type=module -e "
const r = await fetch('${AGENT_URL}/decisions').catch(() => null);
if (!r || !r.ok) process.exit(0);
const ds = await r.json();
console.log('=== Resumen del agente ===');
for (const d of [...ds].reverse()) console.log(
  (d.invoiceId + '').padEnd(10), (d.status + '').padEnd(16), (d.supplier?.name ?? '?').padEnd(26),
  (d.risk?.signals ?? []).join(','), d.explorerUrl ?? '');
" || true
