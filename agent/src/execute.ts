import { randomBytes } from "node:crypto";
import {
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  http,
  keccak256,
  parseAbi,
  parseEventLogs,
  parseUnits,
  toBytes,
  type Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { ADDR, cfg, loadDeployment, loadMockVault, loadSuppliers } from "./config.js";
import { publicClient } from "./quote.js";

export interface PayResult {
  /** "reverted": the tx was mined but reverted (e.g. AlreadyPaid, slippage), so nothing moved. */
  outcome: "executed" | "rejected" | "reverted";
  reason?: string;
  txHash: string;
}

/**
 * The tx was broadcast (we have its hash) but no receipt arrived in time. Money MAY have moved:
 * never report "nothing moved" and never resend. Poll with VaultClient.checkReceipt instead.
 */
export class PendingReceiptError extends Error {
  constructor(readonly txHash: string, cause?: string) {
    super(`receipt not available for ${txHash}${cause ? `: ${cause}` : ""}`);
    this.name = "PendingReceiptError";
  }
}

export interface VaultState {
  vault: string;
  balance: string;
  perPaymentCap: string;
  dailyCap: string;
  spentToday: string;
}

export interface VaultClient {
  /** Vault address (sync, for /health). */
  readonly address: string;
  /** Throws PendingReceiptError when the tx was broadcast but its receipt could not be read. */
  pay(invoiceId: string, supplier: string, amountARGt: string, minAmountOutWei: bigint): Promise<PayResult>;
  /** One receipt lookup for a broadcast tx: null while it is not mined yet. */
  checkReceipt(txHash: string): Promise<PayResult | null>;
  state(): Promise<VaultState>;
  /** Called on POST /demo/reset: clears mock state and rotates the run nonce. */
  reset(): void;
}

export const explorerUrl = (hash: string) => `https://arbiscan.io/tx/${hash}`;

// ---------------------------------------------------------------------------
// On-chain invoice ids. PolicyVault marks every id as used (paid OR rejected) and reverts
// AlreadyPaid on reuse. Local ids (inv_001...) restart whenever agent/data is wiped or demo:once
// runs with an in-memory store, so the on-chain id mixes in a random nonce per run.
const newNonce = () => randomBytes(16).toString("hex");
let runNonce = newNonce();
export const currentRunNonce = () => runNonce;
export function rotateRunNonce(): string {
  runNonce = newNonce();
  return runNonce;
}
export const invoiceIdHash = (invoiceId: string, nonce: string = runNonce) => keccak256(toBytes(`${invoiceId}:${nonce}`));

// ---------------------------------------------------------------------------
// MOCK_CHAIN=true: same allowlist and caps as config/, applied in memory.
export class MockVault implements VaultClient {
  private spent = 0;
  private readonly cfg = loadMockVault();
  private readonly allow = new Set(loadSuppliers().map((s) => s.wallet.toLowerCase()));
  /** On-chain ids already used (paid or rejected), like PolicyVault.used. */
  readonly used = new Set<string>();
  readonly address = this.cfg.vault;

  constructor(private readonly delayMs = 2000) {}

  async pay(invoiceId: string, supplier: string, amountARGt: string): Promise<PayResult> {
    await new Promise((r) => setTimeout(r, this.delayMs));
    const id = invoiceIdHash(invoiceId);
    // Same order as PolicyVault.pay: reuse reverts before any rule is checked, then the id is burnt.
    if (this.used.has(id)) throw new Error(`AlreadyPaid(${id})`);
    this.used.add(id);
    const txHash = `0x${randomBytes(32).toString("hex")}`;
    const amount = Number(amountARGt);
    let reason: string | undefined;
    if (!this.allow.has(supplier.toLowerCase())) reason = "not_allowlisted";
    else if (amount > Number(this.cfg.perPaymentCap)) reason = "over_payment_cap";
    else if (this.spent + amount > Number(this.cfg.dailyCap)) reason = "over_daily_cap";
    if (reason) return { outcome: "rejected", reason, txHash };
    this.spent += amount;
    return { outcome: "executed", txHash };
  }

  async checkReceipt(): Promise<PayResult | null> {
    return null; // the mock never leaves a tx pending
  }

  async state(): Promise<VaultState> {
    return {
      vault: this.cfg.vault,
      balance: String(Number(this.cfg.balance) - this.spent),
      perPaymentCap: this.cfg.perPaymentCap,
      dailyCap: this.cfg.dailyCap,
      spentToday: String(this.spent),
    };
  }

  reset(): void {
    this.spent = 0;
    this.used.clear();
    rotateRunNonce();
  }
}

// ---------------------------------------------------------------------------
// MOCK_CHAIN=false: PolicyVault on Arbitrum, address + ABI from contracts/deployments/arbitrum.json.
const ERC20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export class LiveVault implements VaultClient {
  private readonly dep = loadDeployment();
  private readonly abi = this.dep.abi as Abi;
  private readonly account = (() => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(cfg.agentPrivateKey)) throw new Error("AGENT_PRIVATE_KEY missing or malformed");
    return privateKeyToAccount(cfg.agentPrivateKey as `0x${string}`);
  })();
  private readonly wallet = createWalletClient({ account: this.account, chain: arbitrum, transport: http(cfg.rpcUrl) });

  constructor() {
    if (this.dep.chainId !== 42161) throw new Error(`deployment chainId ${this.dep.chainId} is not Arbitrum One`);
    if (this.dep.agent && this.dep.agent.toLowerCase() !== this.account.address.toLowerCase()) {
      console.warn(`[vault] AGENT_PRIVATE_KEY address ${this.account.address} != deployment agent ${this.dep.agent}`);
    }
  }

  readonly address: string = this.dep.policyVault;

  async pay(invoiceId: string, supplier: string, amountARGt: string, minAmountOutWei: bigint): Promise<PayResult> {
    const onchainId = invoiceIdHash(invoiceId);
    console.log(`[vault] ${invoiceId} -> on-chain id ${onchainId} (run nonce ${currentRunNonce()})`);
    const args = [onchainId, supplier as `0x${string}`, parseUnits(amountARGt, 18), minAmountOutWei] as const;
    const data = encodeFunctionData({ abi: this.abi, functionName: "pay", args });

    // Prepare (nonce, gas: a revert here means nothing was broadcast) and sign locally, so the
    // hash is known before broadcasting and a retry rebroadcasts the SAME signed tx, never a new one.
    const request = await this.wallet.prepareTransactionRequest({ account: this.account, to: this.dep.policyVault, data, chain: arbitrum });
    const serializedTransaction = await this.wallet.signTransaction(request as Parameters<typeof this.wallet.signTransaction>[0]);
    const hash = keccak256(serializedTransaction);
    try {
      await this.wallet.sendRawTransaction({ serializedTransaction });
    } catch (e) {
      console.warn(`[vault] broadcast failed, rebroadcasting the same signed tx once: ${(e as Error).message.split("\n")[0]}`);
      try {
        await this.wallet.sendRawTransaction({ serializedTransaction });
      } catch (e2) {
        const msg = (e2 as Error).message;
        // The node already has it: the first broadcast went through.
        if (!/already known|known transaction|nonce too low|already imported/i.test(msg)) {
          const seen = await publicClient.getTransaction({ hash }).catch(() => null);
          if (!seen) throw e2; // never reached the network: nothing moved
        }
      }
    }

    const wait = () => publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    let receipt;
    try {
      receipt = await wait();
    } catch (e) {
      console.warn(`[vault] receipt wait failed, retrying once: ${(e as Error).message.split("\n")[0]}`);
      try {
        receipt = await wait(); // only re-wait: never resend a tx that may already be mined
      } catch (e2) {
        throw new PendingReceiptError(hash, (e2 as Error).message.split("\n")[0]);
      }
    }
    return this.decode(receipt, hash);
  }

  async checkReceipt(txHash: string): Promise<PayResult | null> {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` }).catch(() => null);
    return receipt ? this.decode(receipt, txHash) : null;
  }

  private decode(receipt: { status: string; logs: unknown[] }, hash: string): PayResult {
    if (receipt.status !== "success") return { outcome: "reverted", txHash: hash };
    const logs = parseEventLogs({ abi: this.abi, logs: receipt.logs as never }) as unknown as {
      eventName: string;
      args: Record<string, unknown>;
    }[];
    const rejected = logs.find((l) => l.eventName === "PaymentRejected");
    if (rejected) return { outcome: "rejected", reason: String(rejected.args.reason), txHash: hash };
    if (logs.some((l) => l.eventName === "PaymentExecuted")) return { outcome: "executed", txHash: hash };
    throw new Error(`no PaymentExecuted/PaymentRejected event in ${hash}`);
  }

  private async readOptional(fn: string): Promise<bigint | null> {
    const has = this.abi.some((x) => x.type === "function" && x.name === fn);
    if (!has) return null;
    try {
      return (await publicClient.readContract({ address: this.dep.policyVault, abi: this.abi, functionName: fn })) as bigint;
    } catch {
      return null;
    }
  }

  async state(): Promise<VaultState> {
    const [bal, spent, perCap, dayCap] = await Promise.all([
      publicClient.readContract({ address: ADDR.ARGt, abi: ERC20, functionName: "balanceOf", args: [this.dep.policyVault] }),
      this.readOptional("spentToday"),
      this.readOptional("perPaymentCap"),
      this.readOptional("dailyCap"),
    ]);
    const f = (v: bigint | null) => (v === null ? "0" : formatUnits(v, 18));
    return {
      vault: this.dep.policyVault,
      balance: formatUnits(bal, 18),
      perPaymentCap: f(perCap),
      dailyCap: f(dayCap),
      spentToday: f(spent),
    };
  }

  reset(): void {
    // On-chain state cannot be reset (the daily cap rolls over on its own); only the run nonce changes.
    rotateRunNonce();
  }
}

export function createVault(): VaultClient {
  return cfg.mockChain ? new MockVault() : new LiveVault();
}
