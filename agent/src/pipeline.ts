import { explain } from "./explain.js";
import { extract, normalizeCurrency } from "./extract.js";
import { sha256, toText } from "./intake.js";
import { currencyReason, PENDING_REASON, PENDING_TIMEOUT_REASON, REVERTED_REASON, type Outcome } from "./reasons.js";
import { quote } from "./quote.js";
import { score } from "./score.js";
import type { Decision, Signal, StepName, StepStatus, Supplier } from "./types.js";
import { explorerUrl, PendingReceiptError, type PayResult, type VaultClient } from "./execute.js";
import { verify } from "./verify.js";
import type { Store } from "./store.js";

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export interface PipelineOptions {
  /** Background receipt polling for a broadcast tx whose receipt timed out. */
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}

export class Pipeline {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly polls = new Set<Promise<void>>();
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;

  constructor(
    private readonly store: Store,
    private readonly vault: VaultClient,
    private readonly registry: () => Supplier[],
    private readonly log: (m: string) => void = (m) => console.log(m),
    opts: PipelineOptions = {},
  ) {
    this.pollIntervalMs = opts.pollIntervalMs ?? 10_000;
    this.pollTimeoutMs = opts.pollTimeoutMs ?? 5 * 60_000;
  }

  /** Resolves when every background receipt poll has settled (tests). */
  async pollsSettled(): Promise<void> {
    await Promise.all([...this.polls]);
  }

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

  private track(p: Promise<void>): void {
    const t = p.catch((e) => this.log(`receipt poll error: ${(e as Error).message}`)).finally(() => this.polls.delete(t));
    this.polls.add(t);
  }

  /** Poll a broadcast tx until its receipt lands (or the poll budget runs out). Never resends. */
  private async pollReceipt(d: Decision, txHash: string, settle: (r: PayResult) => Promise<void>, log: (m: string) => void): Promise<void> {
    const deadline = Date.now() + this.pollTimeoutMs;
    const stillTracked = () => this.store.get(d.invoiceId)?.txHash === txHash; // false after /demo/reset
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
      if (!stillTracked()) return;
      let r: PayResult | null = null;
      try {
        r = await this.vault.checkReceipt(txHash);
      } catch (e) {
        log(`receipt poll failed, will retry: ${(e as Error).message.split("\n")[0]}`);
      }
      if (r) {
        log(`receipt landed for ${txHash}: ${r.outcome}`);
        return settle(r);
      }
    }
    if (!stillTracked()) return;
    log(`no receipt for ${txHash} after ${Math.round(this.pollTimeoutMs / 1000)} s; leaving it as processing`);
    d.reason = PENDING_TIMEOUT_REASON;
    this.store.save(d);
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

    // Final state from a mined tx (used inline and by the background receipt poller).
    let signals: Signal[] = [];
    let level: Decision["risk"]["level"] = "low";
    const settle = async (r: PayResult): Promise<void> => {
      d.txHash = r.txHash;
      d.explorerUrl = explorerUrl(r.txHash);
      if (r.outcome === "reverted") {
        // Mined but reverted (e.g. AlreadyPaid, slippage): the vault moved nothing.
        step("execute", "failed");
        d.status = "blocked";
        d.reason = REVERTED_REASON;
        save();
        log(`blocked (tx reverted ${r.txHash})`);
        return;
      }
      step("execute", "done");
      if (r.outcome === "rejected") return finish("rejected_onchain", "rejected_onchain", { signals, onchainReason: r.reason });
      return finish("paid", level === "medium" ? "paid_medium" : "paid", { signals });
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
      if (ex.injectionDetected && ex.injectionQuote) d.injectionQuote = ex.injectionQuote.slice(0, 300);
      const cur = normalizeCurrency(ex.currency);
      d.amount = { value: ex.amount || "0", currency: cur.code };
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
      signals = v.signals;
      level = s.level;
      step("score", "done");

      if (!cur.ok) {
        // Deterministic: the vault only holds ARGt, never pay an amount stated in another currency.
        step("execute", "skipped");
        d.reason = currencyReason(cur.label, v.signals);
        d.status = "blocked";
        save();
        log(`blocked: currency ${cur.code}`);
        return;
      }
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
        return settle(r);
      } catch (e) {
        if (e instanceof PendingReceiptError) {
          // Broadcast but unconfirmed: money MAY have moved. Never say otherwise, never resend.
          log(`tx ${e.txHash} broadcast, receipt pending: ${e.message}`);
          d.txHash = e.txHash;
          d.explorerUrl = explorerUrl(e.txHash);
          d.status = "processing";
          d.reason = PENDING_REASON;
          step("execute", "running");
          this.track(this.pollReceipt(d, e.txHash, settle, log));
          return;
        }
        const msg = (e as Error).message.split("\n")[0];
        log(`execute failed (nothing broadcast): ${msg}`);
        step("execute", "failed");
        return finish("blocked", "execute_failed", { signals: v.signals });
      }
    } catch (e) {
      log(`pipeline error: ${(e as Error).stack ?? e}`);
      if (d.txHash) {
        // A tx exists: do not claim nothing moved.
        d.status = "processing";
        d.reason = PENDING_REASON;
        save();
        return;
      }
      for (const st of d.steps) if (st.status === "running" || st.status === "pending") st.status = st.status === "running" ? "failed" : "skipped";
      d.reason = "No pude procesar la factura, así que no pagué. No se movió nada.";
      d.status = "blocked";
      save();
    }
  }
}
