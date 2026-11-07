import { describe, expect, it } from "vitest";
import { checkWriteAccess, isLocalRequest, originAllowed } from "../src/access.js";
import { MockVault, PendingReceiptError, currentRunNonce, invoiceIdHash, rotateRunNonce, type PayResult, type VaultClient } from "../src/execute.js";
import { heuristicExtract, normalizeCurrency, totalLine } from "../src/extract.js";
import { Pipeline } from "../src/pipeline.js";
import { Store } from "../src/store.js";
import type { Decision, Supplier } from "../src/types.js";
import { loadSuppliers } from "../src/config.js";

// The mock vault allowlists config/suppliers.json, so use the real AR wallet from there.
const AR: Supplier = loadSuppliers().find((s) => s.country === "AR")!;
const invoice = (total: string) =>
  Buffer.from(`FACTURA N° 0002-00000415\nProveedor: Insumos del Litoral SRL\nBilletera: ${AR.wallet}\nTotal a pagar: ${total}\n`);

class FakeVault implements VaultClient {
  readonly address = "0xfake";
  calls = 0;
  receipts: (PayResult | null)[] = [];
  constructor(private readonly payImpl: () => Promise<PayResult>) {}
  async pay() {
    this.calls++;
    return this.payImpl();
  }
  async checkReceipt() {
    return this.receipts.shift() ?? null;
  }
  async state() {
    return { vault: this.address, balance: "0", perPaymentCap: "0", dailyCap: "0", spentToday: "0" };
  }
  reset() {}
}

async function runOne(vault: VaultClient, buf: Buffer, opts = {}): Promise<{ d: Decision; p: Pipeline; store: Store }> {
  const store = new Store(null);
  const p = new Pipeline(store, vault, () => [AR], () => {}, opts);
  const { invoiceId } = await p.submit(buf, "inv.txt");
  await p.idle();
  return { d: store.get(invoiceId)!, p, store };
}

const HASH = `0x${"ab".repeat(32)}`;

describe("currency normalisation", () => {
  for (const c of ["ARGt", "ARS", "$", "AR$", "pesos", "Pesos", ""]) it(`"${c}" -> ARGt`, () => expect(normalizeCurrency(c)).toEqual({ ok: true, code: "ARGt" }));
  const bad: [string, string][] = [["BRL", "reales"], ["R$", "reales"], ["reais", "reales"], ["BRAt", "reales"], ["USD", "dólares"], ["US$", "dólares"], ["dólares", "dólares"], ["EUR", "euros"]];
  for (const [c, label] of bad) it(`"${c}" is refused as ${label}`, () => expect(normalizeCurrency(c)).toMatchObject({ ok: false, label }));

  it("reads the currency from the total line, not the payout token", () => {
    const ex = heuristicExtract("Recebemos em BRAt (Twin)\nTOTAL A PAGAR: 450000 ARGt\ncarteira 0x7a3f0000000000000000000000000000000091c2");
    expect(ex.currency).toBe("ARGt");
    expect(ex.amount).toBe("450000");
    expect(totalLine("Total a pagar: R$ 12.500,00")).toEqual({ amount: "12.500,00", currency: "R$" });
    expect(totalLine("Total: US$ 300")?.currency).toBe("US$");
  });
});

describe("non-ARGt invoices are blocked", () => {
  it("BRL invoice: blocked, nothing sent to the vault", async () => {
    const vault = new FakeVault(async () => ({ outcome: "executed", txHash: HASH }));
    const { d } = await runOne(vault, invoice("R$ 12.500,00"));
    expect(d.status).toBe("blocked");
    expect(d.reason).toContain("La factura está en una moneda que no pagamos (reales). Solo pagamos facturas en pesos (ARGt).");
    expect(d.steps.find((s) => s.name === "execute")?.status).toBe("skipped");
    expect(d.risk.signals).toEqual([]); // no new signal values
    expect(vault.calls).toBe(0);
  });
  it("USD invoice: blocked as dólares", async () => {
    const vault = new FakeVault(async () => ({ outcome: "executed", txHash: HASH }));
    const { d } = await runOne(vault, invoice("USD 300"));
    expect(d.status).toBe("blocked");
    expect(d.reason).toContain("(dólares)");
    expect(vault.calls).toBe(0);
  });
  it("ARS / $ invoice: paid", async () => {
    for (const total of ["ARGt 900.000,00", "$ 900.000,00", "ARS 900.000,00"]) {
      const vault = new FakeVault(async () => ({ outcome: "executed", txHash: HASH }));
      const { d } = await runOne(vault, invoice(total));
      expect(d.status, total).toBe("paid");
      expect(d.amount.currency).toBe("ARGt");
      expect(d.quote?.source).toBe("direct");
    }
  });
});

describe("on-chain invoice id", () => {
  it("differs across run nonces for the same local id", () => {
    expect(invoiceIdHash("inv_001", "a")).not.toBe(invoiceIdHash("inv_001", "b"));
    expect(invoiceIdHash("inv_001", "a")).toBe(invoiceIdHash("inv_001", "a"));
    const before = currentRunNonce();
    const h1 = invoiceIdHash("inv_001");
    rotateRunNonce();
    expect(currentRunNonce()).not.toBe(before);
    expect(invoiceIdHash("inv_001")).not.toBe(h1);
  });
});

describe("mock vault", () => {
  it("marks ids used on rejection too (like PolicyVault)", async () => {
    const v = new MockVault(0);
    const r = await v.pay("inv_900", "0xbad0c0ffee5ca1ab1e0000000000000000000666", "100");
    expect(r.outcome).toBe("rejected");
    expect(v.used.has(invoiceIdHash("inv_900"))).toBe(true);
    await expect(v.pay("inv_900", AR.wallet, "100")).rejects.toThrow(/AlreadyPaid/);
  });
  it("reset rotates the nonce so the same local id is usable again", async () => {
    const v = new MockVault(0);
    await v.pay("inv_901", AR.wallet, "100");
    v.reset();
    expect((await v.pay("inv_901", AR.wallet, "100")).outcome).toBe("executed");
  });
});

describe("local vs remote requests", () => {
  it("loopback without proxy headers is local", () => {
    expect(isLocalRequest("127.0.0.1", {})).toBe(true);
    expect(isLocalRequest("::1", {})).toBe(true);
    expect(isLocalRequest("::ffff:127.0.0.1", {})).toBe(true);
  });
  it("tunnel traffic (loopback + proxy header) and LAN traffic are remote", () => {
    expect(isLocalRequest("127.0.0.1", { "cf-connecting-ip": "1.2.3.4" })).toBe(false);
    expect(isLocalRequest("127.0.0.1", { "x-forwarded-for": "1.2.3.4" })).toBe(false);
    expect(isLocalRequest("::1", { "x-real-ip": "1.2.3.4" })).toBe(false);
    expect(isLocalRequest("192.168.1.20", {})).toBe(false);
    expect(isLocalRequest(undefined, {})).toBe(false);
  });
  it("key check", () => {
    const tunnel = { "cf-connecting-ip": "1.2.3.4" };
    expect(checkWriteAccess("127.0.0.1", {}, "")).toEqual({ ok: true });
    expect(checkWriteAccess("127.0.0.1", tunnel, "")).toMatchObject({ ok: false, code: 403 });
    expect(checkWriteAccess("127.0.0.1", tunnel, "k3y")).toMatchObject({ ok: false, code: 401 });
    expect(checkWriteAccess("127.0.0.1", { ...tunnel, "x-guardia-key": "nope" }, "k3y")).toMatchObject({ ok: false, code: 403 });
    expect(checkWriteAccess("127.0.0.1", { ...tunnel, "x-guardia-key": "k3y" }, "k3y")).toEqual({ ok: true });
  });
  it("CORS origins", () => {
    expect(originAllowed("http://localhost:3000", "")).toBe(true);
    expect(originAllowed("https://guardia-git-main-team.vercel.app", "")).toBe(true);
    expect(originAllowed("https://evil.com", "")).toBe(false);
    expect(originAllowed("https://vercel.app.evil.com", "")).toBe(false);
    expect(originAllowed("https://guardia.example", "https://guardia.example, http://localhost:3000")).toBe(true);
    expect(originAllowed("https://x.vercel.app", "https://guardia.example")).toBe(false);
  });
});

describe("broadcast but receipt timed out", () => {
  it("stays processing with the hash, never says nothing moved, then settles from the background poll", async () => {
    const vault = new FakeVault(async () => {
      throw new PendingReceiptError(HASH, "timeout");
    });
    vault.receipts = [null, { outcome: "executed", txHash: HASH }];
    const { d, p, store } = await runOne(vault, invoice("ARGt 900.000,00"), { pollIntervalMs: 5, pollTimeoutMs: 2000 });
    expect(d.status).toBe("processing");
    expect(d.txHash).toBe(HASH);
    expect(d.explorerUrl).toBe(`https://arbiscan.io/tx/${HASH}`);
    expect(d.steps.find((s) => s.name === "execute")?.status).toBe("running");
    expect(d.reason).toBe("Pago enviado, esperando confirmación en la red. Verificalo en Arbiscan.");
    expect(d.reason).not.toMatch(/no se movió/i);

    await p.pollsSettled();
    const after = store.get(d.invoiceId)!;
    expect(after.status).toBe("paid");
    expect(after.steps.find((s) => s.name === "execute")?.status).toBe("done");
    expect(vault.calls).toBe(1); // never resent
  });
  it("settles to rejected_onchain when the receipt carries PaymentRejected", async () => {
    const vault = new FakeVault(async () => {
      throw new PendingReceiptError(HASH);
    });
    vault.receipts = [{ outcome: "rejected", reason: "over_daily_cap", txHash: HASH }];
    const { d, p, store } = await runOne(vault, invoice("ARGt 900.000,00"), { pollIntervalMs: 5, pollTimeoutMs: 2000 });
    await p.pollsSettled();
    expect(store.get(d.invoiceId)!.status).toBe("rejected_onchain");
  });
  it("still processing (not blocked) when the poll budget runs out", async () => {
    const vault = new FakeVault(async () => {
      throw new PendingReceiptError(HASH);
    });
    const { d, p, store } = await runOne(vault, invoice("ARGt 900.000,00"), { pollIntervalMs: 5, pollTimeoutMs: 30 });
    await p.pollsSettled();
    const after = store.get(d.invoiceId)!;
    expect(after.status).toBe("processing");
    expect(after.txHash).toBe(HASH);
    expect(after.reason).not.toMatch(/no se movió/i);
  });
  it("no hash (never broadcast): blocked and says nothing moved", async () => {
    const vault = new FakeVault(async () => {
      throw new Error("fetch failed");
    });
    const { d } = await runOne(vault, invoice("ARGt 900.000,00"));
    expect(d.status).toBe("blocked");
    expect(d.txHash).toBeNull();
    expect(d.reason).toMatch(/no se movió nada/i);
  });
});
