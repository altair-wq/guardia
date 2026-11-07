# Prompt 1: PolicyVault contract

Open a coding-agent session in the repo root and paste everything below the line.

---

You are the smart-contract engineer of a hackathon team. First read `CLAUDE.md`, `SHARED_CONTRACTS.md` and `contracts/CLAUDE.md`. Work only inside `contracts/`. Use Foundry, Solidity ^0.8.24, OpenZeppelin (Ownable2Step, SafeERC20, ReentrancyGuard, Pausable). Commit after every working step with a clear message.

## Product context
An autonomous AI agent pays a small Argentine company's suppliers across Latin America in Twin local stablecoins. The company's payment rules live in this contract, so even if someone tricks the AI, money cannot leave outside them. This contract is the "final wall" of the product and the centre of our pitch to the Twin and Avalanche juries, so it must be small, readable and obviously correct.

## Implement IPolicyVault exactly as in SHARED_CONTRACTS.md
Do not rename functions, events or parameters. You may ADD public getters (they are additive): `perPaymentCap()`, `dailyCap()`, `agent()`, `payTokenOf(address)`, `used(bytes32)`.

## Behaviour
1. Roles: owner (the company) sets suppliers, limits and the agent address. Only the agent address may call `pay()`. Owner can `pause()` / `unpause()`; `pay()` reverts while paused.
2. `setSupplier(supplier, payToken, allowed)`: allowlist a supplier wallet and the token it must be paid in. For the demo, `payToken` is ARGt or BRAt; reject any other token with a revert.
3. Limits in ARGt units (18 decimals): `perPaymentCap` and `dailyCap`. Day window = `block.timestamp / 1 days`; reset the spent amount when the day changes.
4. `pay(invoiceId, supplier, amountInARGt, minAmountOut)`:
   - A reused `invoiceId` reverts (`AlreadyPaid`). A non-agent caller reverts.
   - Rule violations DO NOT revert: emit `PaymentRejected(invoiceId, supplier, reason)` and return, with reason `"not_allowlisted"`, `"over_payment_cap"` or `"over_daily_cap"`. The demo needs a transaction hash that proves the rejection. Mark the invoiceId as used in this case too.
   - `payToken == ARGt`: transfer ARGt directly; `amountOut = amountIn`.
   - `payToken == BRAt`: swap ARGt -> USDT0 in the ARGt/USDT0 Curve pool, then USDT0 -> BRAt in the BRAt/USDT0 pool, enforce `minAmountOut` on the final output (revert if below), transfer BRAt to the supplier.
   - Count the amount against the daily cap only when the payment executes. Emit `PaymentExecuted`.
5. Owner `withdraw(token, to, amount)` for emergencies.

## Curve integration (check before coding)
- Use `cast` against an Arbitrum RPC to inspect each pool before writing the swap: `cast call <pool> "coins(uint256)(address)" 0` and `1`, and confirm which `exchange` signature exists: `exchange(int128,int128,uint256,uint256)` (classic stableswap / stableswap-ng). If a `get_dy(int128,int128,uint256)(uint256)` view exists, note it in the README; the agent will use it for quotes.
- Do NOT hardcode coin indices or the USDT0 address: in the constructor read `coins(0)` and `coins(1)` of both pools, find ARGt / BRAt / USDT0, and store the indices. Revert in the constructor if the two pools do not share the same USDT0.
- `forceApprove` exact amounts per swap; never leave infinite approvals.

## Addresses (Arbitrum One, chain id 42161)
From the table in `SHARED_CONTRACTS.md`. Pass them as constructor arguments; keep them in the deploy script, never hardcoded in the contract.

## Real-token constraints (important)
- Twin hands out only small test amounts of real ARGt/BRAt on mainnet. Ask the human how much ARGt the team received before setting caps, and set `perPaymentCap` / `dailyCap` in the deploy script to values that fit that balance (for example cap = 40% of the balance per payment) so the demo can show both a successful payment and an over-cap rejection.
- The deployer and agent wallets need a little ETH on Arbitrum for gas. Print both addresses and their ETH balance in the deploy script and stop with a clear message if either is zero.

## Tests (forge test --fork-url $ARBITRUM_RPC_URL)
- allowlisted ARGt payment executes and emits `PaymentExecuted`
- allowlisted BRAt payment swaps through both pools and the supplier receives >= `minAmountOut`
- non-allowlisted supplier emits `PaymentRejected("not_allowlisted")`, balances unchanged, invoiceId marked used
- over per-payment cap and over daily cap emit the right reasons; the daily window resets the next day (`vm.warp`)
- non-agent caller reverts; reused invoiceId reverts; paused vault reverts
Use `deal()` to fund the vault with ARGt in tests.

## Deliverables
- `src/PolicyVault.sol` (aim for under 200 lines, a NatSpec comment on each rule), `test/PolicyVault.t.sol`, `script/Deploy.s.sol` (deploy, set agent, add the 3 demo suppliers with wallets the team controls, set caps, fund instructions)
- Verify on Arbiscan. Write `contracts/deployments/arbitrum.json` with `{ chainId, policyVault, agent, abi }` exactly as in SHARED_CONTRACTS.md, and commit it immediately: the agent module is waiting for it.
- `script/ForceBadPayment.s.sol`: calls `pay()` from the agent key to a non-allowlisted address, for the live demo's "the contract said no" moment. Print the tx hash.
- `contracts/README.md`: what each rule does in one line, how to test, deploy, verify, and the deployed address with its explorer link.

## If we move to Avalanche (only if a Twin mentor confirms ARGt there)
Create `src/PolicyVaultAvax.sol`: same contract without the Curve path (ARGt direct only), plus a KUMPLY gate: before paying, require the supplier to pass KUMPLY's `isBusiness()` attestation check; otherwise emit `PaymentRejected` with reason `"not_verified_business"`. Deploy and verify on Fuji or C-Chain, write `deployments/avalanche.json`, and add a "Why Avalanche" section to the README (fast finality for B2B settlement, KYB attestations for compliance). State in the README that Fuji attestations are demo attestations without real identity verification.
