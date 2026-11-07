# Guardia agent

Autonomous service that reads supplier invoices, decides on its own and pays (or blocks) through PolicyVault on Arbitrum. No step waits for a human.

## Pipeline in 7 lines
0. **Intake**: a file dropped in `demo/inbox/` or `POST /invoices` (PDF with hidden text included, `.txt`, `.eml`). The same file twice (sha256) is the same run.
1. **Extract**: the LLM returns structured JSON (zod-validated); a regex pre-check flags prompt injection even if the LLM misses it. Without a key, a heuristic extractor is used.
2. **Verify**: deterministic checks against `config/suppliers.json`: unknown supplier, wallet changed, lookalike address, amount > 3x average, plus a Firecrawl website check (8 s budget, never blocks the demo).
3. **Score**: fixed weights, `min(100, sum)`. Any of wallet_changed, lookalike_address, unknown_supplier or prompt_injection blocks, and so does a high score. Medium with no hard signal still pays, and the reason says so.
4. **Quote**: Curve `get_dy` ARGt -> USDT0 -> BRAt on-chain, `minAmountOut = expected * 0.98`; Belo price as a reference when reachable. ARGt suppliers: direct.
5. **Execute**: `PolicyVault.pay(keccak256(invoiceId), wallet, amount, minAmountOut)`, then the logs are decoded: `PaymentExecuted` => `paid`, `PaymentRejected` => `rejected_onchain`.
6. **Explain**: 1 or 2 sentences of rioplatense Spanish from the LLM (5 s limit), with a template fallback from `src/reasons.ts`. The LLM never changes the decision.

## Run

```bash
cd agent && npm install
npm test            # vitest: wallet_changed, lookalike, injection regex, hard rule, score levels
npm run demo:once   # processes demo/invoices/* (or test/fixtures/invoices if empty) and prints each Decision
npm run dev         # API on :8787 with watch mode
```

### Mock mode (default): `MOCK_CHAIN=true`
No contract needed. The fake vault waits 2 s, returns a random tx hash, and applies the allowlist (wallets in `config/suppliers.json`) and the caps in `config/mock-vault.json` in memory, so over-cap and not-allowlisted rejections look real. Curve quotes are still read from Arbitrum (a fixed rate is used if the RPC is down).

### Live mode: `MOCK_CHAIN=false`
Needs `contracts/deployments/arbitrum.json` (`policyVault`, `agent`, `abi`), `ARBITRUM_RPC_URL` and `AGENT_PRIVATE_KEY` (the vault's agent). On startup it logs the vault's ARGt balance, caps and spentToday. **Before going live, replace the wallets in `config/suppliers.json` with the ones allowlisted on-chain** and set `avgAmount` and `website` to real values.

## Env vars (root `.env`, optional `agent/.env` overrides)
| Var | Use |
| --- | --- |
| `MOCK_CHAIN` | `true` (default) fake vault, `false` real PolicyVault |
| `AGENT_PORT` | default `8787` |
| `ARBITRUM_RPC_URL` | default `https://arb1.arbitrum.io/rpc` |
| `AGENT_PRIVATE_KEY` | live mode only; never logged |
| `LLM_API_KEY` | Anthropic API key. Unset = heuristic extractor + template reasons |
| `LLM_MODEL` | default `claude-opus-5-5` (provider lives only in `src/llm.ts`) |
| `FIRECRAWL_API_KEY` | website check; unset = skipped |

## API
Exactly `SHARED_CONTRACTS.md` section B: `POST /invoices` (multipart `file` or JSON `{ "text": "..." }`), `GET /decisions`, `GET /decisions/:id`, `GET /rules`, `GET /events` (SSE, one full Decision per message), `POST /demo/reset`. Also `GET /health`. CORS is open.

```bash
curl -F file=@test/fixtures/invoices/02-impersonation.txt localhost:8787/invoices
curl -N localhost:8787/events
```

Every Decision is validated with ajv against `shared/decision.schema.json` before it is stored or streamed. Decisions persist in `agent/data/decisions.json` (gitignored).

## Notes for the team
- **Additive Decision fields** (allowed by the schema): `quote.minAmountOut` (the slippage floor sent on-chain) and `quote.referenceRate` (Belo BRL per ARS, only when Belo answered). `POST /invoices` also returns `duplicate: true|false`.
- **Execution failure** (RPC down after one retry): the execute step is `failed` and the status is `blocked`, because the schema has no "failed" status; the reason says the network failed and nothing moved.
- **Belo**: `api.belo.app` was unreachable from the build sandbox, so the response is parsed defensively (USDT/USD vs ARS and BRL, ask/bid/price). The first response is logged; tighten `beloUsdRates` in `src/quote.ts` once someone has curled it.
- **Curve pools** are cryptoswap pools (`get_dy(uint256,uint256,uint256)`), index 0 = ARGt/BRAt, index 1 = USDT0 (checked on-chain).
- Website check: if a supplier's `website` is a placeholder, Firecrawl will flag `website_mismatch` (+25, not a block on its own).
