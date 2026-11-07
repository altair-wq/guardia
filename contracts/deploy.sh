#!/usr/bin/env bash
# One-command PolicyVault deploy to Arbitrum One.
# Usage (from repo root or contracts/):   bash contracts/deploy.sh
# Requires: Foundry (forge, cast), jq, and a filled contracts/.env (see deploy.env.example).
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "No contracts/.env. Run: cp deploy.env.example .env  and fill it."; exit 1; }
set -a; source .env; set +a

for v in ARBITRUM_RPC_URL ARBISCAN_API_KEY DEPLOYER_PRIVATE_KEY AGENT_ADDRESS AGENT_PRIVATE_KEY \
         PER_PAYMENT_CAP_ARGT DAILY_CAP_ARGT SUPPLIER_BR_WALLET SUPPLIER_BR2_WALLET SUPPLIER_AR_WALLET; do
  [ -n "${!v:-}" ] || { echo "Missing $v in contracts/.env"; exit 1; }
done
command -v forge >/dev/null || { echo "Foundry not installed: curl -L https://foundry.paradigm.xyz | bash && foundryup"; exit 1; }
command -v jq >/dev/null || { echo "jq not installed (brew install jq / apt install jq)"; exit 1; }

DEPLOYER=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
AGENT_FROM_KEY=$(cast wallet address --private-key "$AGENT_PRIVATE_KEY")
if [ "$(echo "$AGENT_FROM_KEY" | tr A-F a-f)" != "$(echo "$AGENT_ADDRESS" | tr A-F a-f)" ]; then
  echo "AGENT_PRIVATE_KEY does not belong to AGENT_ADDRESS ($AGENT_FROM_KEY vs $AGENT_ADDRESS)"; exit 1
fi
echo "Deployer: $DEPLOYER   ETH: $(cast balance "$DEPLOYER" --ether --rpc-url "$ARBITRUM_RPC_URL")"
echo "Agent:    $AGENT_ADDRESS   ETH: $(cast balance "$AGENT_ADDRESS" --ether --rpc-url "$ARBITRUM_RPC_URL")"
echo "Caps: per payment $PER_PAYMENT_CAP_ARGT ARGt, daily $DAILY_CAP_ARGT ARGt"
read -r -p "Deploy PolicyVault to Arbitrum One now? This spends a little ETH. [y/N] " ok
[ "$ok" = "y" ] || [ "$ok" = "Y" ] || { echo "Cancelled."; exit 0; }

git submodule update --init --recursive >/dev/null 2>&1 || true
LOG=$(mktemp)
forge script script/Deploy.s.sol --rpc-url "$ARBITRUM_RPC_URL" --broadcast --verify \
  --etherscan-api-key "$ARBISCAN_API_KEY" 2>&1 | tee "$LOG"

VAULT=$(grep -oE 'PolicyVault[^0-9a-fA-Fx]*0x[0-9a-fA-F]{40}' "$LOG" | grep -oE '0x[0-9a-fA-F]{40}' | head -1 || true)
if [ -z "$VAULT" ]; then
  VAULT=$(jq -r '.transactions[] | select(.transactionType=="CREATE" and .contractName=="PolicyVault") | .contractAddress' \
    broadcast/Deploy.s.sol/42161/run-latest.json 2>/dev/null | head -1 || true)
fi
[ -n "$VAULT" ] && [ "$VAULT" != "null" ] || { echo "Could not read the vault address; look for it in the output above."; exit 1; }

# remember it for ForceBadPayment and later steps
if grep -q '^POLICY_VAULT=' .env; then sed -i.bak "s/^POLICY_VAULT=.*/POLICY_VAULT=$VAULT/" .env && rm -f .env.bak; else echo "POLICY_VAULT=$VAULT" >> .env; fi
bash script/export-deployment.sh "$VAULT" "$AGENT_ADDRESS"

echo
echo "PolicyVault deployed: $VAULT"
echo "Arbiscan: https://arbiscan.io/address/$VAULT"
echo "Next: send your ARGt from the deployer wallet to $VAULT, then commit contracts/deployments/arbitrum.json."
