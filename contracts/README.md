# PolicyVault

The "final wall" of Guardia. The company's ARGt sits in this contract; the AI agent can only ask it to pay, and the contract enforces the owner's rules. Even if someone tricks the AI, money cannot leave outside them.

Interface: `IPolicyVault` in [`SHARED_CONTRACTS.md`](../SHARED_CONTRACTS.md) section A, implemented exactly (`src/IPolicyVault.sol`).

## Rules (one line each)

| Rule | What it does |
| --- | --- |
| Agent only | Only the `agent()` address can call `pay()`; anyone else reverts (`NotAgent`). |
| Allowlist | Only suppliers added with `setSupplier` can be paid, and only in their registered token (ARGt or BRAt; any other token reverts). Otherwise: `PaymentRejected("not_allowlisted")`. |
| Per-payment cap | A single payment above `perPaymentCap()` emits `PaymentRejected("over_payment_cap")`. |
| Daily cap | Executed payments in the current UTC day (`block.timestamp / 1 days`) cannot exceed `dailyCap()`; else `PaymentRejected("over_daily_cap")`. Resets when the day changes. Rejections do not count. |
| Single-use invoice | Every `invoiceId` can be used once, paid **or** rejected; reusing it reverts (`AlreadyPaid`). |
| Slippage guard | BRAt payments revert if the supplier would receive less than `minAmountOut`. |
| Kill switch | Owner can `pause()`; `pay()` reverts while paused. |
| Emergency exit | Owner can `withdraw(token, to, amount)`. |
| Two-step ownership | `Ownable2Step`: ownership transfer must be accepted by the new owner. |

Rule violations **do not revert**: they emit `PaymentRejected` and return, so the demo has a tx hash proving the rejection.

## Payment route

- Supplier paid in **ARGt**: direct transfer, `amountOut = amountIn`.
- Supplier paid in **BRAt**: ARGt -> USDT0 (ARGt/USDT0 pool) -> BRAt (BRAt/USDT0 pool, sent straight to the supplier). Exact `forceApprove` per hop, no infinite approvals.

### Curve pools (checked on Arbitrum with `cast`, Nov 7 2026)

Both pools are **Curve twocrypto-ng** (`version()` = `v3.0.0`), not stableswap. That means **`uint256` coin indices**, not `int128`:

| Pool | coins(0) | coins(1) |
| --- | --- | --- |
| ARGt/USDT0 `0x356d…f853` | ARGt (18 dec) | USDT0 `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` (6 dec) |
| BRAt/USDT0 `0xeef4…f8d5` | BRAt (18 dec) | USDT0 (same) |

- Swap: `exchange(uint256 i, uint256 j, uint256 dx, uint256 min_dy, address receiver)`. `exchange(int128,…)` does **not** exist.
- Quote view for the agent: **`get_dy(uint256 i, uint256 j, uint256 dx)(uint256)`**. To quote an ARGt -> BRAt payment of `x` ARGt (wei):
  ```bash
  cast call 0x356d349da9add7efb56a35fab939a2c6d852f853 "get_dy(uint256,uint256,uint256)(uint256)" 0 1 <x>      # -> usdt
  cast call 0xeef48df5f1c509cd9730774b4e8a4464626ef8d5 "get_dy(uint256,uint256,uint256)(uint256)" 1 0 <usdt>   # -> BRAt wei
  ```
  Then pass e.g. 99% of that as `minAmountOut`. At inspection time 1,000 ARGt ≈ 0.60 USDT0 ≈ 3.3 BRAt.
- The constructor reads `coins(0)`/`coins(1)` of both pools, stores the indices, and reverts if they don't share the same USDT0. Nothing is hardcoded in the contract.

## Test

Fork tests against Arbitrum One (15 tests: ARGt payment, BRAt two-pool swap with minAmountOut, slippage revert, not allowlisted, both caps, day reset with `vm.warp`, non-agent, reused id, paused, owner-only admin, withdraw):

```bash
cd contracts
forge test --fork-url $ARBITRUM_RPC_URL     # e.g. https://arb1.arbitrum.io/rpc
```

## Deploy

```bash
cp .env.example .env    # fill keys, caps (whole ARGt), supplier wallets
source .env
forge script script/Deploy.s.sol --rpc-url arbitrum --broadcast --verify
```

The script prints deployer and agent ETH balances and stops if either is zero. It deploys, sets the agent, sets caps and allowlists the 3 demo suppliers (2 BRAt, 1 ARGt). Then:

```bash
# fund the vault with ARGt
cast send 0x59863989d080B22476DB95656d0C3CC18be92214 "transfer(address,uint256)" <vault> <amount_wei> --private-key $DEPLOYER_PRIVATE_KEY --rpc-url arbitrum
# write deployments/arbitrum.json for the agent module
./script/export-deployment.sh <vault>
```

Caps: set `PER_PAYMENT_CAP_ARGT` to ~40% of the ARGt balance and `DAILY_CAP_ARGT` to ~100%, so the demo shows one payment executing and an over-cap rejection.

### Verify (if `--verify` was skipped)

```bash
forge verify-contract <vault> src/PolicyVault.sol:PolicyVault --chain 42161 \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address,address)" <owner> \
  0x59863989d080B22476DB95656d0C3CC18be92214 0xC4ed6Aba5373D78E160F4df39e011F078Be54df8 \
  0x356d349da9add7efb56a35fab939a2c6d852f853 0xeef48df5f1c509cd9730774b4e8a4464626ef8d5)
```

### Demo: "the contract said no"

```bash
POLICY_VAULT=<vault> forge script script/ForceBadPayment.s.sol --rpc-url arbitrum --broadcast
```

The agent key calls `pay()` to a non-allowlisted address. The tx succeeds, moves no funds and emits `PaymentRejected(..., "not_allowlisted")`; forge prints the tx hash.

## Outputs for other modules

- `deployments/PolicyVault.abi.json`: ABI, available now so the agent can code against it.
- `deployments/arbitrum.json`: `{ chainId, policyVault, agent, abi }`, written after deploy.

Extra public getters (additive to the interface): `perPaymentCap()`, `dailyCap()`, `agent()`, `payTokenOf(address)`, `used(bytes32)`, `ARGT()`, `BRAT()`, `USDT0()`, `ARGT_POOL()`, `BRAT_POOL()`, `paused()`, `owner()`.

## Deployed

| Chain | PolicyVault | Explorer |
| --- | --- | --- |
| Arbitrum One (42161) | _pending_ | _pending_ |
