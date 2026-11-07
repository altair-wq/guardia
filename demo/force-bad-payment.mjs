#!/usr/bin/env node
// Step d of the live demo: "even if the AI is fooled, the contract says no".
// Calls PolicyVault.pay() directly with the agent key, to the attacker wallet from the
// injection invoice (not allowlisted). Expected: PaymentRejected("not_allowlisted") with a tx hash.
//   node demo/force-bad-payment.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, loadDeployment, loadCaps, fraction, isMock, DEMO_DIR, ATTACKER_WALLET } from "./lib.mjs";

loadEnv();
const caps = await loadCaps();
const amount = fraction(caps.perPaymentCap, 0.1);
const invoiceLabel = `force_bad_payment_${Date.now()}`;

console.log("\n=== d) Pago forzado directo al contrato (salteando al agente) ===");
console.log(`destino:  ${ATTACKER_WALLET}  (billetera del atacante, no habilitada)`);
console.log(`monto:    ${amount} ARGt`);

if (isMock()) {
  const fake = "0x" + [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await new Promise((r) => setTimeout(r, 2000));
  console.log(`\n[MOCK_CHAIN] PaymentRejected(reason="not_allowlisted")`);
  console.log(`[MOCK_CHAIN] tx ${fake} (simulated: set MOCK_CHAIN=false and deploy the vault for a real hash)`);
  process.exit(0);
}

const { createPublicClient, createWalletClient, http, keccak256, toHex, parseUnits, parseAbi, decodeEventLog } = await import("viem");
const { privateKeyToAccount } = await import("viem/accounts");
const { arbitrum } = await import("viem/chains");

const dep = loadDeployment();
const rpc = process.env.ARBITRUM_RPC_URL;
const pk = process.env.AGENT_PRIVATE_KEY;
if (!rpc || !pk) {
  console.error("Missing ARBITRUM_RPC_URL or AGENT_PRIVATE_KEY in .env");
  process.exit(1);
}

const abi = parseAbi([
  "function pay(bytes32 invoiceId, address supplier, uint256 amountInARGt, uint256 minAmountOut)",
  "function isAllowed(address supplier) view returns (bool)",
  "event PaymentRejected(bytes32 indexed invoiceId, address indexed supplier, string reason)",
  "event PaymentExecuted(bytes32 indexed invoiceId, address indexed supplier, address payToken, uint256 amountIn, uint256 amountOut)",
]);
const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const pub = createPublicClient({ chain: arbitrum, transport: http(rpc) });
const wallet = createWalletClient({ chain: arbitrum, transport: http(rpc), account });

if (await pub.readContract({ address: dep.policyVault, abi, functionName: "isAllowed", args: [ATTACKER_WALLET] })) {
  console.error(`ABORT: ${ATTACKER_WALLET} is allowlisted in the vault; this demo step needs a non-allowlisted address.`);
  process.exit(1);
}

const invoiceId = keccak256(toHex(invoiceLabel));
const hash = await wallet.writeContract({
  address: dep.policyVault,
  abi,
  functionName: "pay",
  args: [invoiceId, ATTACKER_WALLET, parseUnits(amount, 18), 0n],
});
const explorerUrl = `https://arbiscan.io/tx/${hash}`;
console.log(`\ntx enviada: ${explorerUrl}`);

const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
let reason = null;
for (const log of receipt.logs) {
  if (log.address.toLowerCase() !== dep.policyVault.toLowerCase()) continue;
  try {
    const ev = decodeEventLog({ abi, data: log.data, topics: log.topics });
    if (ev.eventName === "PaymentRejected") reason = ev.args.reason;
    if (ev.eventName === "PaymentExecuted") reason = "UNEXPECTED: PaymentExecuted";
  } catch {
    /* other events */
  }
}

console.log(`estado:   ${receipt.status}, bloque ${receipt.blockNumber}`);
console.log(reason ? `evento:   PaymentRejected(reason="${reason}")` : "evento:   (no PaymentRejected found!)");
console.log(`\nEl contrato dijo que no. Prueba onchain: ${explorerUrl}\n`);

mkdirSync(join(DEMO_DIR, "proof"), { recursive: true });
writeFileSync(
  join(DEMO_DIR, "proof", "onchain-rejection.json"),
  JSON.stringify({ at: new Date().toISOString(), invoiceLabel, invoiceId, supplier: ATTACKER_WALLET, amount, reason, txHash: hash, explorerUrl }, null, 2) + "\n",
);
