# Prompt 1: PolicyVault contract

Open a coding-agent session in the repo root and paste everything below the line.

---

You are building the smart contract module of a hackathon project. First read `CLAUDE.md`, `SHARED_CONTRACTS.md` and `contracts/CLAUDE.md`. Work only inside `contracts/`. Use Foundry, Solidity ^0.8.24, OpenZeppelin (Ownable, SafeERC20, ReentrancyGuard).

PRODUCT CONTEXT
An autonomous AI agent pays a small company's suppliers across Latin America in Twin local stablecoins. The company's payment rules live in this contract so that even a tricked AI cannot move funds outside them. The vault holds ARGt (Argentine peso stablecoin, 18 decimals) and pays suppliers in their own currency.

IMPLEMENT the IPolicyVault interface exactly as given in `SHARED_CONTRACTS.md` (do not rename functions, events or parameters).

BEHAVIOUR
1. Roles: owner (the company) sets suppliers, limits and the agent address. Only the agent address may call pay().
2. setSupplier(supplier, payToken, allowed): allowlist a supplier wallet and the token it must be paid in (ARGt or BRAt for the demo).
3. Limits in ARGt units: perPaymentCap and dailyCap. Daily window = block.timestamp / 1 days; reset the spent amount when the day changes.
4. pay(invoiceId, supplier, amountInARGt, minAmountOut):
   - If supplier is not allowlisted, or amount > perPaymentCap, or spentToday + amount > dailyCap: emit PaymentRejected(invoiceId, supplier, reason) with reason "not_allowlisted" / "over_payment_cap" / "over_daily_cap" and RETURN without moving funds. Do not revert: the demo needs a transaction hash that proves the rejection.
   - If payToken == ARGt: transfer ARGt directly to supplier.
   - If payToken == BRAt: swap through two Curve pools on Arbitrum: ARGt -> USDT0 in the ARGt/USDT0 pool, then USDT0 -> BRAt in the BRAt/USDT0 pool, enforce minAmountOut on the final output, transfer BRAt to supplier.
   - Emit PaymentExecuted with amountIn and amountOut; mark invoiceId as used so it cannot be paid twice (a reused invoiceId reverts).
5. Curve pools: call exchange(int128 i, int128 j, uint256 dx, uint256 min_dy). Do NOT hardcode coin indices: in the constructor read coins(0) and coins(1) of each pool and store which index is which token. Approve exact amounts per swap.
6. Owner can withdraw tokens (emergency).

ADDRESSES (Arbitrum One, chain id 42161): see the table in `SHARED_CONTRACTS.md`. Pass all addresses as constructor arguments; keep them in the deploy script, not hardcoded in the contract.

TESTS (forge test with --fork-url $ARBITRUM_RPC_URL)
- allowlisted ARGt payment succeeds and emits PaymentExecuted
- allowlisted BRAt payment swaps and the supplier receives >= minAmountOut
- non-allowlisted supplier emits PaymentRejected and balances do not change
- over per-payment cap and over daily cap are rejected
- non-agent caller reverts; same invoiceId cannot be paid twice
Use deal() to give the vault test ARGt.

DELIVERABLES
- `src/PolicyVault.sol`, `test/PolicyVault.t.sol`, `script/Deploy.s.sol` (deploys, sets agent, adds the three demo suppliers from `shared/fixtures/rules.json` using real wallets we control instead of the fixture addresses, sets caps)
- Verify on Arbiscan; write the deployed address, agent address and ABI to `contracts/deployments/arbitrum.json` in the shape given in `SHARED_CONTRACTS.md`.
- `contracts/README.md`: how to test, deploy and verify.
- Keep the contract small and readable; comment each rule. Commit after each working step.

IF WE MOVE TO AVALANCHE (only if a Twin mentor confirms ARGt there): same contract without the Curve path (ARGt direct only), plus a KUMPLY gate: before paying, require isBusiness(supplier) from KUMPLY's onchain verifier; otherwise emit PaymentRejected with reason "not_verified_business". Deploy and verify on Fuji or C-Chain, and add a "Why Avalanche" section to `contracts/README.md`.
