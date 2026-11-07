# Guardia

**Cross-border supplier payments, with AI intelligence and on-chain control.**

Guardia is a stablecoin payment workflow for small and medium-sized businesses operating across Latin America. It connects invoice intake, supplier verification, payment risk analysis, stablecoin routing, smart-contract enforcement, and a real-time monitoring dashboard.

**Invoice in. Verified payment out.**

[Explore the deployed PolicyVault on Arbiscan](https://arbiscan.io/address/0x268549AdcC3c602045e01454D0399a0E34d39c39)

## Why Guardia

Cross-border supplier payments involve more than moving money. Businesses need to read invoices, confirm the destination wallet, obtain a quote, make a transfer, and preserve a reliable record. Manual copy-and-paste creates opportunities for supplier impersonation, lookalike wallet addresses, and payment errors.

Guardia brings those steps into a single programmable workflow. An AI-assisted service evaluates invoices and applies deterministic supplier and risk checks. Final payment authority sits in a smart contract governed by the business's own policies.

The initial corridor is **Argentina → Brazil**, using Twin's ARGt and BRAt stablecoins on **Arbitrum One**. The current cross-currency contract route is **ARGt → USDT0 → BRAt**: a coordinated payment operation rather than separate conversions that the business must manage manually.

## How it works

1. **Receive an invoice.** Guardia accepts PDFs, text documents, email-style content, or an API submission.
2. **Extract and verify.** The agent identifies the supplier, destination wallet, amount, and currency; checks the supplier registry; and looks for suspicious instructions or address changes.
3. **Evaluate payment risk.** Structured rules and AI-assisted extraction produce an explainable decision. The service can block an invoice before attempting any blockchain transaction.
4. **Quote and execute.** For eligible payments, the service obtains an on-chain quote and sends a payment request to PolicyVault. Argentine suppliers receive ARGt directly; Brazilian suppliers can receive BRAt through the configured Curve pools.
5. **Enforce and observe.** PolicyVault independently checks its allowlist and spending rules. The dashboard shows invoice decisions, risk signals, payment status, and transaction links.

The agent supports both simulated execution and a live Arbitrum client using the deployed contract's ABI and address.

## Product components

| Module | What it provides |
| --- | --- |
| [`contracts/`](contracts/) | Solidity PolicyVault, Foundry tests, deployment scripts, and the Arbitrum deployment manifest |
| [`agent/`](agent/) | TypeScript invoice intake, extraction, verification, risk scoring, quoting, execution, and REST/event API |
| [`web/`](web/) | Next.js dashboard for supplier payments, policy visibility, invoice details, live updates, and transaction history |
| [`demo/`](demo/) | Sample invoices, impersonation and prompt-injection cases, demonstration scripts, and proof utilities |
| [`shared/`](shared/) | Shared decision schema and fixtures for consistent agent/dashboard integration |
| [`SHARED_CONTRACTS.md`](SHARED_CONTRACTS.md) | Interfaces connecting the contract, agent, and dashboard |

### PolicyVault: programmable payment authority

PolicyVault holds ARGt and makes payments only when its on-chain rules permit them:

- **Authorized agent:** Only the designated agent wallet can call `pay()`.
- **Supplier allowlist:** Each recipient is registered with an allowed payout token.
- **Spending controls:** Per-payment and daily limits are set by the vault owner.
- **Replay protection:** Each invoice identifier is single-use.
- **Exchange protection:** BRAt payouts enforce a minimum output amount.
- **Owner controls:** Pause/unpause, supplier management, agent rotation, and token withdrawal.
- **Auditable outcomes:** Successful payments emit `PaymentExecuted`; policy denials emit `PaymentRejected`.

The contract separates AI-assisted decision-making from the final authority to move funds.

### Agent: invoice intelligence

The agent's pipeline includes file ingestion, supplier and wallet verification, prompt-injection checks, risk scoring, Curve quotes, an optional Belo reference rate, and explanations for payment decisions. It tracks transaction receipts and handles pending blockchain confirmations without blindly resending a payment.

### Dashboard: one view of every decision

The read-only dashboard includes an invoice decision feed, risk breakdowns, invoice-versus-registry comparisons, supplier rules, transaction details, and separate indicators for simulated and on-chain modes. It consumes the agent's REST endpoints and server-sent events, or uses sample fixtures for a standalone preview.

## Live on Arbitrum One

| Detail | Value |
| --- | --- |
| Network | Arbitrum One · Chain ID `42161` |
| PolicyVault | [`0x268549AdcC3c602045e01454D0399a0E34d39c39`](https://arbiscan.io/address/0x268549AdcC3c602045e01454D0399a0E34d39c39) |
| Authorized agent | `0x40912f9b8738C5714115B2A62ffA707c963577c2` |
| Per-payment limit | 40 ARGt |
| Daily limit | 100 ARGt |
| Registered suppliers | Three demo wallets: two BRAt recipients and one ARGt recipient |

**Confirmed on-chain deployment records**

- [PolicyVault contract creation](https://arbiscan.io/tx/0x30d268c2dc9a548bdbc2abbae1a8215e8dbf3b322efc6a21a9e8b85bfd2aa68b)
- [Authorized-agent configuration](https://arbiscan.io/tx/0x6c3608d5a1bdf2f41898731c04f956f4654cef91f982b983bf4c8a83c880e996)
- [Payment-limit configuration](https://arbiscan.io/tx/0x3856afff1a332d47d98bf215ff64c9389eaae31800abd49857c5c8900ba71880)

The contract, authorized-agent setup, limits, and three supplier registrations have been broadcast successfully. The public [deployment manifest](contracts/deployments/arbitrum.json) contains the vault address, chain ID, agent address, and ABI used by the service.

### Stablecoin infrastructure

| Asset or integration | Role |
| --- | --- |
| Twin ARGt | Source asset held by the vault |
| Twin BRAt | Brazilian supplier payout asset |
| Curve pools on Arbitrum | ARGt/USDT0 and BRAt/USDT0 routing |
| Belo public price API | Optional external price reference |
| Firecrawl | Optional supplier website checks |
| Arbiscan | Public transaction and contract records |

## Run Guardia locally

**Prerequisites:** A recent Node.js version compatible with the packages, npm, and an Arbitrum RPC for blockchain reads. Foundry is used for smart-contract development and tests.

From the repository root:

```bash
git clone https://github.com/altair-wq/guardia.git
cd guardia
cp .env.example .env
npm start
```

The startup script launches the agent at `http://localhost:8787` and the dashboard at `http://localhost:3000`. The default `MOCK_CHAIN=true` keeps payment execution simulated.

In a second terminal, run the scripted invoice experience:

```bash
npm run demo:invoices
npm run demo
```

The demo includes a registered supplier, a lookalike-wallet impersonation attempt, and an invoice with concealed prompt-injection text.

**Run individual modules:**

```bash
(cd agent && npm install && npm test && npm run dev)
(cd web && npm install && npm run dev)
(cd contracts && forge test --fork-url "$ARBITRUM_RPC_URL")
```

These commands are alternatives; run the module you need, with the applicable dependencies and environment configuration.

### Connect to the deployed contract

The live execution client reads [`contracts/deployments/arbitrum.json`](contracts/deployments/arbitrum.json). Configure the repository root `.env` or `agent/.env` with:

```dotenv
MOCK_CHAIN=false
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
AGENT_PRIVATE_KEY=YOUR_AUTHORIZED_AGENT_KEY
```

The authorized agent needs ETH for network fees, and PolicyVault needs ARGt to settle payments. Keep wallet credentials in local environment files, never in Git. Live execution makes real on-chain transactions.

### Agent API

| Endpoint | Purpose |
| --- | --- |
| `POST /invoices` | Submit an invoice |
| `GET /decisions` | Retrieve invoice decisions |
| `GET /decisions/:invoiceId` | Inspect an individual decision |
| `GET /rules` | Read supplier and vault rules |
| `GET /events` | Stream decisions using server-sent events |
| `GET /health` | Read agent and chain-mode status |
| `POST /demo/reset` | Reset local demonstration state |

The dashboard can use these endpoints directly. The frontend is built with Next.js and supports Vercel hosting, including an HTTPS agent-endpoint override for live presentations.

## Technology

**Smart contracts:** Solidity, OpenZeppelin, Foundry, Arbitrum One  
**Agent:** Node.js, TypeScript, Fastify, viem, Zod, and AI-assisted extraction  
**Dashboard:** Next.js, TypeScript, Tailwind CSS  
**Blockchain routing:** Twin stablecoins and Curve liquidity pools

Guardia combines AI-assisted operations with deterministic contract-level safeguards to make cross-border supplier payments easier to orchestrate, inspect, and control.
