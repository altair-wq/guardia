import type { RiskLevel, Signal } from "./types.js";

export const WEIGHTS: Record<Signal, number> = {
  wallet_changed: 60,
  lookalike_address: 70,
  unknown_supplier: 80,
  prompt_injection: 90,
  amount_anomaly: 30,
  urgent_language: 20,
  website_mismatch: 25,
};

export const HARD_SIGNALS: Signal[] = ["wallet_changed", "lookalike_address", "unknown_supplier", "prompt_injection"];

export function levelFor(score: number): RiskLevel {
  if (score < 30) return "low";
  if (score < 60) return "medium";
  return "high";
}

export interface ScoreResult {
  score: number;
  level: RiskLevel;
  blocked: boolean;
  hard: Signal[];
}

/**
 * Deterministic score. HARD RULE: any hard signal blocks, regardless of score or LLM opinion.
 * A high score without a hard signal also blocks. Medium without a hard signal still pays
 * (there is no human to escalate to) and the reason says so.
 */
export function score(signals: Signal[]): ScoreResult {
  const total = Math.min(100, signals.reduce((s, sig) => s + WEIGHTS[sig], 0));
  const level = levelFor(total);
  const hard = signals.filter((s) => HARD_SIGNALS.includes(s));
  return { score: total, level, blocked: hard.length > 0 || level === "high", hard };
}
