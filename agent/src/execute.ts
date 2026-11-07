import { randomBytes } from "node:crypto";
import {
  createWalletClient,
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
  outcome: "executed" | "rejected";
  reason?: string;
  txHash: string;
}

export interface VaultState {
  vault: string;
  balance: string;
  perPaymentCap: string;
  dailyCap: string;
  spentToday: string;
}

export interface VaultClient {
  pay(invoiceId: string, supplier: string, amountARGt: string, minAmountOutWei: bigint): Promise<PayResult>;
  state(): Promise<VaultState>;
  reset(): void;
}

export const explorerUrl = (hash: string) => `https://arbiscan.io/tx/${hash}`;
export const invoiceIdHash = (invoiceId: string) => keccak256(toBytes(invoiceId));

// ---------------------------------------------------------------------------
// MOCK_CHAIN=true: same allowlist and caps as config/, applied in memory.
export class MockVault implements VaultClient {
  private spent = 0;
  private readonly cfg = loadMockVault();
  private readonly allow = new Set(loadSuppliers().map((s) => s.wallet.toLowerCase()));
  private readonly paid = new Set<string>();

  async pay(invoiceId: string, supplier: string, amountARGt: string): Promise<PayResult> {
    await new Promise((r) => setTimeout(r, 2000));
    const txHash = `0x${randomBytes(32).toString("hex")}`;
    const amount = Number(amountARGt);
    let reason: string | undefined;
    if (!this.allow.has(supplier.toLowerCase())) reason = "not_allowlisted";
    else if (amount > Number(this.cfg.perPaymentCap)) reason = "over_payment_cap";
    else if (this.spent + amount > Number(this.cfg.dailyCap)) reason = "over_daily_cap";
    if (reason) return { outcome: "rejected", reason, txHash };
    if (this.paid.has(invoiceId)) throw new Error("invoice already paid");
    this.paid.add(invoiceId);
    this.spent += amount;
    return { outcome: "executed", txHash };
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
    this.paid.clear();
  }
}

// ---------------------------------------------------------------------------
// MOCK_CHAIN=false: PolicyVault on Arbitrum, address + ABI from contracts/deployments/arbitrum.json.
const ERC20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);

function isRpcError(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? "";
  // Contract reverts are deterministic: retrying will not help.
  return !/ContractFunctionRevertedError|ContractFunctionExecutionError/.test(name);
}

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

  async pay(invoiceId: string, supplier: string, amountARGt: string, minAmountOutWei: bigint): Promise<PayResult> {
    const args = [invoiceIdHash(invoiceId), supplier as `0x${string}`, parseUnits(amountARGt, 18), minAmountOutWei] as const;
    const send = () =>
      this.wallet.writeContract({ address: this.dep.policyVault, abi: this.abi, functionName: "pay", args, chain: arbitrum });

    let hash: `0x${string}`;
    try {
      hash = await send();
    } catch (e) {
      if (!isRpcError(e)) throw e;
      console.warn(`[vault] pay send failed, retrying once: ${(e as Error).message.split("\n")[0]}`);
      hash = await send();
    }

    const wait = () => publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    let receipt;
    try {
      receipt = await wait();
    } catch (e) {
      console.warn(`[vault] receipt wait failed, retrying once: ${(e as Error).message.split("\n")[0]}`);
      receipt = await wait(); // only re-wait: never resend a tx that may already be mined
    }
    if (receipt.status !== "success") throw new Error(`tx reverted (${hash})`);

    const logs = parseEventLogs({ abi: this.abi, logs: receipt.logs }) as unknown as {
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
    // On-chain state cannot be reset; the daily cap rolls over on its own.
  }
}

export function createVault(): VaultClient {
  return cfg.mockChain ? new MockVault() : new LiveVault();
}
