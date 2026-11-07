import type { Decision } from "./types";

export interface Stats {
  paidToday: number;
  blockedCount: number;
  protectedAmount: number;
}

/** Derived from decisions, never hardcoded. The agent keeps one demo day per run (POST /demo/reset), so every decision counts as "hoy". */
export function deriveStats(decisions: Decision[]): Stats {
  let paidToday = 0;
  let blockedCount = 0;
  let protectedAmount = 0;
  for (const d of decisions) {
    const v = Number(d.amount.value) || 0;
    if (d.status === "paid") paidToday += v;
    if (d.status === "blocked" || d.status === "rejected_onchain") {
      blockedCount += 1;
      protectedAmount += v;
    }
  }
  return { paidToday, blockedCount, protectedAmount };
}
