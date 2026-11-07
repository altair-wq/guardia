# Guardia

**An autonomous AI agent that pays a small company's suppliers across Latin America in local stablecoins, and blocks fraudulent payments on its own, with the company's payment rules enforced by a smart contract.**

Built at HackaTwin (Digital House, Buenos Aires, November 7, 2026) for the Stablecoins (Twin), Fintech (Belo) and AI tracks, plus Blockchain (Avalanche) if deployed there.

## The problem

Argentine PyMEs that buy from or sell to neighbouring countries already pay suppliers in stablecoins, but usually by copying a wallet address from an email or WhatsApp message into a consumer app. There is no approval policy, no supplier check and no audit trail, and stablecoin payments cannot be reversed. Most business stablecoin losses come from off-chain failures such as supplier impersonation and lookalike addresses, not from hacks. Paying a LATAM supplier also means a double conversion: pesos to dollars to reais.

## How it works

1. **Setup (once):** the owner registers suppliers and sets a per-payment cap and a daily cap in the PolicyVault contract, funded with ARGt.
2. **Trigger:** an invoice arrives.
3. **The agent runs alone:** extracts the invoice, verifies the supplier (registry + website check with Firecrawl), scores risk (changed wallet, lookalike address, prompt injection, urgent language).
4. **Pay or block:** low risk is quoted with Belo's price API and paid through the vault (ARGt to USDT0 to BRAt via Twin's Curve pools). Anything suspicious is blocked and explained in plain Spanish.
5. **Defense in depth:** even if the AI is fooled, the contract rejects any payment to a non-allowlisted address or over the caps.

## Repository layout

| Folder | What | Owner |
| --- | --- | --- |
| `contracts/` | PolicyVault smart contract (Foundry) | TBD |
| `agent/` | Autonomous agent service (Node + TypeScript) | TBD |
| `web/` | Dashboard (Next.js on Vercel) | TBD |
| `demo/` | Demo invoices and the live-demo script | Altair |
| `shared/` | Decision JSON schema and fixtures used by agent and web | everyone (read-only) |
| `prompts/` | The build prompt for each module's coding agent | - |

The modules only talk through [`SHARED_CONTRACTS.md`](SHARED_CONTRACTS.md), so each can be built in parallel against mocks.

## Team workflow

0. The designer starts in Figma Make with `prompts/00-figma-design.md` and hands the live-feed frame to the dashboard agent around 14:30.
1. Each teammate opens one coding-agent session on their own folder and pastes the matching prompt from `prompts/` (01 contract, 02 agent, 03 dashboard).
2. Every module must run on its own with mocks by **13:00** (`MOCK_CHAIN=true` for the agent, fixtures for the web).
3. Swap mocks for real parts between **15:00 and 16:00**.
4. Integration and demo with `prompts/04-integration.md` from 16:00. Submit by **17:30**.

## Tokens, chain and contracts used

| What | Chain | Address |
| --- | --- | --- |
| ARGt (Twin) | Arbitrum One | `0x59863989d080B22476DB95656d0C3CC18be92214` |
| BRAt (Twin) | Arbitrum One | `0xC4ed6Aba5373D78E160F4df39e011F078Be54df8` |
| ARGt/USDT0 Curve pool | Arbitrum One | `0x356d349da9add7efb56a35fab939a2c6d852f853` |
| BRAt/USDT0 Curve pool | Arbitrum One | `0xeef48df5f1c509cd9730774b4e8a4464626ef8d5` |
| PolicyVault | Arbitrum One | _to be filled after deploy (verified link)_ |

**Onchain proof:** _to be filled: one tx hash for a paid invoice, one for an onchain rejection._

## Sponsor integrations

- **Twin:** ARGt held in the vault, BRAt paid to suppliers, Curve pools for the route.
- **Belo:** public price API for quotes; distribution and on/off-ramp partner.
- **Firecrawl:** supplier website verification.
- **Vercel:** dashboard hosting.
- **Avalanche + KUMPLY (conditional):** vault on C-Chain with an `isBusiness()` gate on suppliers.

## Business model

Subscription for the agent plus a small routing fee on cross-currency payments, distributed through wallets such as Belo that offer it to their business accounts.

## Running locally

_Each module's README will say how. Quick start once modules exist:_

```bash
cp .env.example .env   # fill in keys
# agent:  cd agent && npm install && npm run dev        (MOCK_CHAIN=true works without the contract)
# web:    cd web && npm install && npm run dev          (NEXT_PUBLIC_USE_FIXTURES=true works without the agent)
# contracts: cd contracts && forge test --fork-url $ARBITRUM_RPC_URL
```

## Built during the event

Everything in this repository was built on November 7, 2026, during the hackathon. Open-source libraries used are listed in each module's README.
