# Shared contracts

These three interfaces are the ONLY coupling between modules. Every agent reads this file first.
Rule: add fields if you must, never rename or remove them, and tell the team in the group chat.

## A. Vault interface (contract -> agent)

```solidity
interface IPolicyVault {
    event SupplierSet(address indexed supplier, address payToken, bool allowed);
    event PaymentExecuted(bytes32 indexed invoiceId, address indexed supplier, address payToken, uint256 amountIn, uint256 amountOut);
    event PaymentRejected(bytes32 indexed invoiceId, address indexed supplier, string reason);

    function setSupplier(address supplier, address payToken, bool allowed) external; // owner only
    function setLimits(uint256 perPaymentCap, uint256 dailyCap) external;           // owner only, in ARGt (18 decimals)
    function setAgent(address agent) external;                                       // owner only
    function pay(bytes32 invoiceId, address supplier, uint256 amountInARGt, uint256 minAmountOut) external; // agent only
    function isAllowed(address supplier) external view returns (bool);
    function spentToday() external view returns (uint256);
}
```

- A rule violation (not allowlisted, over a cap) does NOT revert: it emits `PaymentRejected` and returns, so the demo has a tx hash proving the rejection.
- `PaymentRejected.reason` is one of: `not_allowlisted`, `over_payment_cap`, `over_daily_cap`, `not_verified_business` (Avalanche/KUMPLY variant only).
- After deploy, the contracts module writes `contracts/deployments/arbitrum.json`:

```json
{ "chainId": 42161, "policyVault": "0x...", "agent": "0x...", "abi": [ ... ] }
```

## B. Agent API (agent -> dashboard)

Base URL: `http://localhost:8787` locally, `NEXT_PUBLIC_AGENT_URL` in the dashboard.

| Method | Path | Returns |
| --- | --- | --- |
| POST | `/invoices` | Accepts an invoice (PDF or text) and starts the autonomous run; returns `{ "invoiceId": "inv_007" }` |
| GET | `/decisions` | Array of Decision objects, newest first |
| GET | `/decisions/:invoiceId` | One Decision, including its step trace |
| GET | `/rules` | Rules object (below) |
| GET | `/events` | Server-sent events: each message's data is one full Decision (JSON) whenever it changes |
| POST | `/demo/reset` | Clears stored decisions and `demo/inbox` so the live demo can be rerun; returns `{ "ok": true }` |

Rules object:

```json
{
  "vault": "0x...",
  "chain": "arbitrum",
  "balance": { "value": "12400000", "currency": "ARGt" },
  "perPaymentCap": "1500000",
  "dailyCap": "5000000",
  "spentToday": "3480000",
  "suppliers": [
    { "name": "Autopeças Sul Ltda", "country": "BR", "wallet": "0x...", "payToken": "BRAt" }
  ]
}
```

## C. Decision object (the one JSON everyone shares)

Schema: `shared/decision.schema.json`. Fixtures: `shared/fixtures/decisions.json`.

```json
{
  "invoiceId": "inv_003",
  "receivedAt": "2026-11-07T15:02:11Z",
  "supplier": { "name": "Autopeças Sul Ltda", "wallet": "0x...", "country": "BR", "currency": "BRAt" },
  "amount": { "value": "1250000", "currency": "ARGt" },
  "quote": { "route": ["ARGt", "USDT0", "BRAt"], "amountOut": "7480.12", "source": "belo-price-api" },
  "risk": { "score": 82, "level": "high", "signals": ["wallet_changed", "urgent_language", "prompt_injection"] },
  "status": "blocked",
  "reason": "La billetera no coincide con la registrada para este proveedor y la factura contiene instrucciones ocultas.",
  "steps": [
    { "name": "extract", "status": "done" },
    { "name": "verify", "status": "done" },
    { "name": "score", "status": "done" },
    { "name": "execute", "status": "skipped" }
  ],
  "txHash": null,
  "explorerUrl": null
}
```

- `status`: `received` | `processing` | `paid` | `blocked` | `rejected_onchain`
- `risk.level`: `low` | `medium` | `high`
- `risk.signals`: `wallet_changed` | `lookalike_address` | `unknown_supplier` | `amount_anomaly` | `urgent_language` | `prompt_injection` | `website_mismatch`
- `steps[].name`: `extract` | `verify` | `score` | `execute`; `steps[].status`: `pending` | `running` | `done` | `skipped` | `failed`
- Amounts are decimal strings in human units (not wei).

## Addresses (Arbitrum One, chain id 42161)

| What | Address |
| --- | --- |
| ARGt | `0x59863989d080B22476DB95656d0C3CC18be92214` |
| BRAt | `0xC4ed6Aba5373D78E160F4df39e011F078Be54df8` |
| ARGt/USDT0 Curve pool | `0x356d349da9add7efb56a35fab939a2c6d852f853` |
| BRAt/USDT0 Curve pool | `0xeef48df5f1c509cd9730774b4e8a4464626ef8d5` |
| Belo price API | `https://api.belo.app/public/price` |

Deploys are not deterministic across chains: always use address + chain together.

## Updates from the modules (11:20)

- **Curve pools are twocrypto-ng, not classic stableswap.** Indices are `uint256`: `get_dy(uint256,uint256,uint256)` and `exchange(uint256,uint256,uint256,uint256,address)`. In both pools ARGt/BRAt is coin 0 and USDT0 (6 decimals) is coin 1. Rough rate at 11:00: 1,000 ARGt ≈ 0.60 USDT0 ≈ 3.3 BRAt.
- **Agent additions (optional, additive):** `quote.minAmountOut`, `quote.referenceRate`; `POST /invoices` also returns `duplicate: boolean`.
- **Agent behaviour:** a `high` score blocks even without a hard signal; if the chain call fails after one retry, the execute step is `failed` and the decision is `blocked` with a reason saying nothing moved.
- **ABI available before deploy:** `contracts/deployments/PolicyVault.abi.json`.
