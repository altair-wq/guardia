// Mirrors SHARED_CONTRACTS.md (sections B and C) and shared/decision.schema.json.
// Never rename fields here; additive optional fields only.

export type Currency = "ARGt" | "BRAt" | "COLt" | "PERt" | "MEXt" | "CHLt" | "BOLt";
export type DecisionStatus = "received" | "processing" | "paid" | "blocked" | "rejected_onchain";
export type RiskLevel = "low" | "medium" | "high";
export type Signal =
  | "wallet_changed"
  | "lookalike_address"
  | "unknown_supplier"
  | "amount_anomaly"
  | "urgent_language"
  | "prompt_injection"
  | "website_mismatch";
export type StepName = "extract" | "verify" | "score" | "execute";
export type StepStatus = "pending" | "running" | "done" | "skipped" | "failed";

export interface Step {
  name: StepName;
  status: StepStatus;
  at?: string;
}

export interface Quote {
  route: string[];
  amountOut: string;
  source: string;
  /** Additive (agent, 11:20): slippage floor sent to PolicyVault.pay. */
  minAmountOut?: string;
  /** Additive (agent, 11:20): Belo reference rate, pay-token units per 1 ARGt. */
  referenceRate?: string;
}

export interface Decision {
  invoiceId: string;
  receivedAt: string;
  supplier: { name: string; wallet: string; country: string; currency: Currency };
  amount: { value: string; currency: string };
  quote: Quote | null;
  risk: { score: number; level: RiskLevel; signals: Signal[] };
  status: DecisionStatus;
  reason: string;
  steps: Step[];
  txHash: string | null;
  explorerUrl: string | null;
  /** Not in the shared contract yet. Rendered if the agent ever sends it. */
  injectionQuote?: string;
}

export interface RulesSupplier {
  name: string;
  country: string;
  wallet: string;
  payToken: Currency | string;
  website?: string;
}

export interface Rules {
  vault: string;
  chain: string;
  balance: { value: string; currency: string };
  perPaymentCap: string;
  dailyCap: string;
  spentToday: string;
  suppliers: RulesSupplier[];
}

export type ConnectionState = "connecting" | "live" | "reconnecting" | "replay";

export const STEP_ORDER: StepName[] = ["extract", "verify", "score", "execute"];
