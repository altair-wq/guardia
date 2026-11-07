import { explain } from "./explain.js";
import { extract } from "./extract.js";
import { sha256, toText } from "./intake.js";
import type { Outcome } from "./reasons.js";
import { quote } from "./quote.js";
import { score } from "./score.js";
import type { Decision, Signal, StepName, StepStatus, Supplier } from "./types.js";
import { explorerUrl, type VaultClient } from "./execute.js";
import { verify } from "./verify.js";
import type { Store } from "./store.js";

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export class Pipeline {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: Store,
    private readonly vault: VaultClient,
    private readonly registry: () => Supplier[],
    private readonly log: (m: string) => void = (m) => console.log(m),
  ) {}

  /** Intake: idempotent on file contents. Runs are serialised so nonces and caps stay consistent. */
  submit = async (buf: Buffer, filename: string): Promise<{ invoiceId: string; duplicate: boolean }> => {
    const hash = sha256(buf);
    const existing = this.store.byHash(hash);
    if (existing) return { invoiceId: existing, duplicate: true };

    const d: Decision = {
      invoiceId: this.store.nextId(),
      receivedAt: now(),
      supplier: { name: "", wallet: "", country: "", currency: "ARGt" },
      amount: { value: "0", currency: "ARGt" },
      quote: null,
      risk: { score: 0, level: "low", signals: [] },
      status: "received",
      reason: "Factura recibida.",
      steps: (["extract", "verify", "score", "execute"] as StepName[]).map((name) => ({ name, status: "pending" as StepStatus })),
      txHash: null,
      explorerUrl: null,
    };
    this.store.save(d, hash);
    const run = this.queue.then(() => this.run(d, buf, filename));
    this.queue = run.catch(() => {});
    return { invoiceId: d.invoiceId, duplicate: false };
  };

  /** Resolves when every queued run has finished (used by demo:once). */
  idle(): Promise<unknown> {
    return this.queue;
  }

  private async run(d: Decision, buf: Buffer, filename: string): Promise<void> {
    const log = (m: string) => this.log(`[${d.invoiceId}] ${m}`);
    const save = () => this.store.save(d);
    const step = (name: StepName, status: StepStatus) => {
      const s = d.steps.find((x) => x.name === name)!;
      s.status = status;
      s.at = now();
      save();
    };
    const finish = async (status: Decision["status"], outcome: Outcome, ctx: { signals?: Signal[]; onchainReason?: string; detail?: string }) => {
      d.reason = await explain(outcome, { supplierName: d.supplier.name, ...ctx }, log);
      d.status = status;
      save();
      log(`${status}: ${d.reason}`);
    };

    try {
      d.status = "processing";
      d.reason = "Analizando la factura.";
      step("extract", "running");

      // 0-1. Intake + extract
      const text = await toText(buf, filename);
      const { data: ex, usedLlm } = await extract(text, log);
      log(`extracted (${usedLlm ? "llm" : "heuristic"}): ${ex.supplierName} / ${ex.amount} ${ex.currency}`);
      d.supplier.name = ex.supplierName || "Proveedor desconocido";
      d.supplier.wallet = ex.wallet;
      d.amount = { value: ex.amount || "0", currency: "ARGt" };
      step("extract", "done");

      // 2. Verify
      step("verify", "running");
      const v = await verify(ex, this.registry(), { log });
      if (v.supplier) {
        d.supplier.name = v.supplier.name;
        d.supplier.country = v.supplier.country;
        d.supplier.currency = v.supplier.payToken;
      }
      d.risk.signals = v.signals;
      step("verify", "done");

      // 3. Score (deterministic; the LLM never changes this)
      step("score", "running");
      const s = score(v.signals);
      d.risk.score = s.score;
      d.risk.level = s.level;
      step("score", "done");

      if (s.blocked) {
        step("execute", "skipped");
        return finish("blocked", "blocked", { signals: v.signals });
      }
      const amountOk = Number(ex.amount) > 0;
      if (!amountOk || !/^0x[0-9a-fA-F]{40}$/.test(ex.wallet)) {
        step("execute", "skipped");
        return finish("blocked", "invalid_invoice", { detail: amountOk ? "una billetera válida" : "el monto a pagar" });
      }

      // 4-5. Quote + execute
      step("execute", "running");
      let txHash: string;
      try {
        const q = await quote(ex.amount, d.supplier.currency, log);
        d.quote = q.quote;
        save();
        const r = await this.vault.pay(d.invoiceId, ex.wallet, ex.amount, q.minAmountOutWei);
        txHash = r.txHash;
        d.txHash = txHash;
        d.explorerUrl = explorerUrl(txHash);
        step("execute", "done");
        if (r.outcome === "rejected") return finish("rejected_onchain", "rejected_onchain", { signals: v.signals, onchainReason: r.reason });
      } catch (e) {
        const msg = (e as Error).message.split("\n")[0];
        log(`execute failed: ${msg}`);
        step("execute", "failed");
        return finish("blocked", "execute_failed", { signals: v.signals });
      }
      return finish("paid", s.level === "medium" ? "paid_medium" : "paid", { signals: v.signals });
    } catch (e) {
      log(`pipeline error: ${(e as Error).stack ?? e}`);
      for (const st of d.steps) if (st.status === "running" || st.status === "pending") st.status = st.status === "running" ? "failed" : "skipped";
      d.reason = "No pude procesar la factura, así que no pagué. No se movió nada.";
      d.status = "blocked";
      save();
    }
  }
}
