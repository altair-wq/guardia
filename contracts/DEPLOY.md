# Deploying PolicyVault to Arbitrum One

Run this on the team laptop. Private keys stay in `contracts/.env`, which is gitignored. Never paste them into a chat or commit them.

## Before you start
- [ ] Foundry installed (`forge --version`). If not: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- [ ] `jq` installed (`brew install jq` on Mac)
- [ ] Deployer wallet `0xcD81…bEfb` has ETH on Arbitrum (a few dollars)
- [ ] Agent wallet `0x4091…77c2` has a little ETH on Arbitrum (about $1 to $2; it pays a fee per payment)
- [ ] You know how much ARGt the team received
- [ ] A free Etherscan API key (etherscan.io, API Keys)

## Steps
1. Get this branch: `git fetch origin && git checkout deploy/arbitrum` (or `main` once merged).
2. Create the config: `cd contracts && cp deploy.env.example .env`
3. Open `contracts/.env` and fill only: `ARBISCAN_API_KEY`, `DEPLOYER_PRIVATE_KEY`, `AGENT_PRIVATE_KEY`, `PER_PAYMENT_CAP_ARGT`, `DAILY_CAP_ARGT`. All public addresses are already filled in.
   - Limits: per payment ≈ 40% of the ARGt you'll put in the vault; daily ≈ 2.5 × per payment. Example with 10,000 ARGt: `4000` and `10000`.
4. Deploy: `bash deploy.sh` (from `contracts/`). It shows balances and caps, asks for confirmation, deploys and verifies on Arbiscan, saves the vault address into `.env` and writes `deployments/arbitrum.json`.
5. Fund the vault: send your ARGt from the deployer wallet to the printed vault address (in MetaMask/Rabby: send token ARGt on Arbitrum).
6. Commit the deployment file (public data only):
   ```bash
   git add deployments/arbitrum.json && git commit -m "contracts: PolicyVault deployed on Arbitrum" && git push
   ```
7. Send the vault address to the team lead chat. It will switch the agent to live mode and regenerate the demo invoices for the real limits.

## The "contract says no" proof
After the vault is funded, from `contracts/`:
```bash
set -a; source .env; set +a
forge script script/ForceBadPayment.s.sol --rpc-url "$ARBITRUM_RPC_URL" --broadcast
```
It tries to pay a non-allowlisted address; the vault emits `PaymentRejected` and the tx hash is your on-chain proof.
