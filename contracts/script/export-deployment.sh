#!/usr/bin/env bash
# Writes deployments/arbitrum.json = { chainId, policyVault, agent, abi } (SHARED_CONTRACTS.md section A).
# Usage: ./script/export-deployment.sh <policyVault> [agent]   (agent defaults to vault.agent() read on-chain)
set -euo pipefail
cd "$(dirname "$0")/.."
VAULT="${1:?usage: export-deployment.sh <policyVault> [agent]}"
RPC="${ARBITRUM_RPC_URL:-https://arb1.arbitrum.io/rpc}"
AGENT="${2:-$(cast call "$VAULT" 'agent()(address)' --rpc-url "$RPC")}"
forge build >/dev/null 2>&1
mkdir -p deployments
jq --arg v "$VAULT" --arg a "$AGENT" \
  '{ chainId: 42161, policyVault: $v, agent: $a, abi: .abi }' \
  out/PolicyVault.sol/PolicyVault.json > deployments/arbitrum.json
echo "wrote deployments/arbitrum.json (vault $VAULT, agent $AGENT)"
