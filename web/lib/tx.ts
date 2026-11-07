import type { Decision, Quote, Step } from "./types";
import { chainIsSimulated } from "./source";

/** shared/fixtures use fake tx hashes starting with this prefix. */
export const FIXTURE_HASH_PREFIX = "0xf100";

/**
 * A transaction is simulated (no real Arbiscan page) when the fixtures source is active,
 * the agent runs MOCK_CHAIN (per GET /health), the agent fell back to its mock fixed rate,
 * or the hash is a fixture hash.
 */
export function isSimulatedTx(d: Pick<Decision, "quote" | "txHash">): boolean {
  if (chainIsSimulated()) return true;
  if (d.quote?.source === "mock-fixed-rate") return true;
  return !!d.txHash && d.txHash.toLowerCase().startsWith(FIXTURE_HASH_PREFIX);
}

/** Broadcast but no receipt yet: the agent keeps it `processing` with a txHash. */
export function isAwaitingConfirmation(d: Pick<Decision, "status" | "txHash">): boolean {
  return d.status === "processing" && !!d.txHash;
}

/** While awaiting confirmation, the execute step always reads as running. */
export function displaySteps(d: Pick<Decision, "status" | "txHash" | "steps">): Step[] {
  if (!isAwaitingConfirmation(d)) return d.steps;
  return d.steps.map((s) => (s.name === "execute" && s.status !== "running" ? { ...s, status: "running" } : s));
}

/** Blocked because the invoice is not in pesos (agent reasons.ts: "...una moneda que no pagamos..."). */
export function isCurrencyBlock(d: Pick<Decision, "status" | "reason">): boolean {
  return d.status === "blocked" && /moneda/i.test(d.reason);
}

const QUOTE_SOURCE_LABEL: Record<string, string> = {
  curve: "cotizado en Curve",
  direct: "pago directo en ARGt",
  "mock-fixed-rate": "cotización simulada",
  "belo-price-api": "cotizado con Belo", // legacy fixtures
};

export function quoteSourceLabel(source: string): string {
  return QUOTE_SOURCE_LABEL[source] ?? source;
}

/** referenceRate is pay-token units per 1 ARGt; show its inverse: "1 BRAt ≈ N ARGt". */
export function referenceLine(q: Quote): string | null {
  const r = Number(q.referenceRate);
  if (!q.referenceRate || !Number.isFinite(r) || r <= 0) return null;
  const target = q.route[q.route.length - 1];
  const token = target && target !== "ARGt" ? target : "BRAt";
  const n = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(1 / r);
  return `Referencia Belo: 1 ${token} ≈ ${n} ARGt`;
}

/**
 * FX snapshot locked at execution: how many ARGt one unit of the pay token cost, from the agent's quote.
 * Time = when the execute step ran (or the quote was taken at verify), else when the invoice arrived.
 */
export function fxSnapshot(d: Pick<Decision, "amount" | "quote" | "steps" | "receivedAt">): { target: string; argtPerUnit: number; at: string } | null {
  const q = d.quote;
  if (!q || q.route.length < 2) return null;
  const out = Number(q.amountOut);
  const inn = Number(d.amount.value);
  if (!(out > 0) || !(inn > 0)) return null;
  const at = d.steps.find((s) => s.name === "execute")?.at ?? d.steps.find((s) => s.name === "verify")?.at ?? d.receivedAt;
  return { target: q.route[q.route.length - 1], argtPerUnit: inn / out, at };
}
