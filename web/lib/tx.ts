import type { Decision, Quote, Step } from "./types";
import { USE_FIXTURES } from "./source";

/** shared/fixtures use fake tx hashes starting with this prefix. */
export const FIXTURE_HASH_PREFIX = "0xf100";

/**
 * A transaction is simulated (no real Arbiscan page) when the fixtures source is active,
 * the agent fell back to its mock fixed rate, or the hash is a fixture hash.
 */
export function isSimulatedTx(d: Pick<Decision, "quote" | "txHash">): boolean {
  if (USE_FIXTURES) return true;
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
