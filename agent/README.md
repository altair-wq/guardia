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
| `PORT` / `AGENT_PORT` | listen port: `PORT`, else `AGENT_PORT`, else `8787` |
| `GUARDIA_API_KEY` | secret for non-local `POST /invoices` and `POST /demo/reset` (header `x-guardia-key`). Unset = those POSTs are refused (403) unless they come from this machine |
| `ALLOWED_ORIGINS` | comma-separated CORS origins. Unset = `http://localhost:3000` plus any `https://*.vercel.app` |
| `ARBITRUM_RPC_URL` | default `https://arb1.arbitrum.io/rpc` |
| `AGENT_PRIVATE_KEY` | live mode only; never logged |
| `LLM_API_KEY` | Anthropic API key. Unset = heuristic extractor + template reasons |
| `LLM_MODEL` | default `claude-opus-5-5` (provider lives only in `src/llm.ts`) |
| `FIRECRAWL_API_KEY` | website check; unset = skipped |

## API
Exactly `SHARED_CONTRACTS.md` section B: `POST /invoices` (multipart `file` or JSON `{ "text": "..." }`), `GET /decisions`, `GET /decisions/:id`, `GET /rules`, `GET /events` (SSE, one full Decision per message), `POST /demo/reset`. Also `GET /health` -> `{ ok, mockChain, vault }`.

**Access.** A request is *local* when its socket address is loopback and it carries no proxy header (`x-forwarded-for`, `cf-connecting-ip`, `x-real-ip`). Local requests need no key, so `demo/run.sh` and the inbox watcher work as before. Non-local `POST /invoices` and `POST /demo/reset` need `x-guardia-key: $GUARDIA_API_KEY` (401 missing, 403 wrong or key unset). All GETs (`/decisions`, `/decisions/:id`, `/rules`, `/events`, `/health`) stay open. CORS only answers allowed origins (see `ALLOWED_ORIGINS`).

```bash
curl -F file=@test/fixtures/invoices/02-impersonation.txt localhost:8787/invoices
curl -N localhost:8787/events
```

Every Decision is validated with ajv against `shared/decision.schema.json` before it is stored or streamed. Decisions persist in `agent/data/decisions.json` (gitignored).

## Notes for the team
- **Additive Decision fields** (allowed by the schema): `quote.minAmountOut` (the slippage floor sent on-chain) and `quote.referenceRate` (Belo BRL per ARS, only when Belo answered). `POST /invoices` also returns `duplicate: true|false`.
- **Execution failure, nothing broadcast** (RPC down after one retry, no tx hash): the execute step is `failed` and the status is `blocked`; the reason says nothing moved.
- **Broadcast but unconfirmed** (we have a tx hash, receipt not seen after the retry): status stays `processing`, `txHash`/`explorerUrl` are set, execute step `running`, reason "Pago enviado, esperando confirmación en la red. Verificalo en Arbiscan." The receipt is polled every 10 s for up to 5 min and the decision moves to `paid` / `rejected_onchain`. The tx is never resent (it is signed once; a retry rebroadcasts the same bytes).
- **Currency**: only invoices whose total is in pesos are paid (`ARGt`, `ARS`, `$`, `AR$`, `pesos`, or no currency stated -> `ARGt`). Anything else (BRL, R$, USD, US$, reais, dólares, euros...) is `blocked` with a reason like "La factura está en una moneda que no pagamos (reales). Solo pagamos facturas en pesos (ARGt)." The currency is read from the total line, not from the payout token ("Recebemos em BRAt" is fine).
- **`quote.source`** says who determined `amountOut`: `curve` (on-chain `get_dy`), `mock-fixed-rate` (mock mode, RPC down) or `direct` (ARGt supplier, no swap). Belo is never the source; it only appears as `quote.referenceRate`.
- **Belo**: `api.belo.app` was unreachable from the build sandbox, so the response is parsed defensively (USDT/USD vs ARS and BRL, ask/bid/price). The first response is logged; tighten `beloUsdRates` in `src/quote.ts` once someone has curled it.
- **Curve pools** are cryptoswap pools (`get_dy(uint256,uint256,uint256)`), index 0 = ARGt/BRAt, index 1 = USDT0 (checked on-chain).
- **On-chain invoice ids never repeat**: PolicyVault marks every id used (paid or rejected) and reverts `AlreadyPaid` on reuse. The on-chain id is `keccak256(invoiceId + ":" + runNonce)`, where `runNonce` is random per process and rotated on `POST /demo/reset`, so `inv_001` from a new run never collides. `/demo/reset` still keeps the local counter (`lastSeq` in `agent/data/decisions.json`). The mock vault burns ids the same way.
- Website check: if a supplier's `website` is a placeholder, Firecrawl will flag `website_mismatch` (+25, not a block on its own).

## Exposing the agent to the Vercel dashboard

The agent stays on the presenting laptop; a Cloudflare quick tunnel gives the Vercel dashboard an https URL.

1. Set a key in `agent/.env` (or the root `.env`): `GUARDIA_API_KEY=<long random string>` (e.g. `openssl rand -hex 24`).
2. Start the agent: `cd agent && npm start` (listens on `PORT` / `AGENT_PORT` / 8787).
3. In another terminal: `agent/scripts/tunnel.sh`. It prints a URL like `https://<random>.trycloudflare.com`. Check it: `curl https://<random>.trycloudflare.com/health`.
4. In Vercel -> Project -> Settings -> Environment Variables set `NEXT_PUBLIC_AGENT_URL=https://<random>.trycloudflare.com` and `NEXT_PUBLIC_USE_FIXTURES=false`, then redeploy (NEXT_PUBLIC_* are baked in at build time).
5. The dashboard reads `/decisions`, `/rules` and `/events` with no key. Through the tunnel, `POST /demo/reset` and `POST /invoices` need the header `x-guardia-key`; `demo/run.sh` on the laptop talks to localhost and needs nothing.

The quick-tunnel URL changes every time `tunnel.sh` restarts, so start it once before the pitch and redeploy once. If the dashboard runs on a custom domain, add it to `ALLOWED_ORIGINS`.
