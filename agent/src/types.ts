// Mirrors SHARED_CONTRACTS.md section C. Never rename fields.

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
  /** Additive: the slippage floor sent to PolicyVault.pay (human units of the pay token). */
  minAmountOut?: string;
  /** Additive: Belo reference rate (pay-token units per 1 ARGt), only when Belo answered. */
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
}

export interface Supplier {
  name: string;
  country: string;
  wallet: string;
  payToken: Currency;
  website?: string;
  avgAmount: string;
}

export interface Extraction {
  supplierName: string;
  wallet: string;
  amount: string;
  currency: string;
  dueDate: string;
  notes: string;
  urgentLanguage: boolean;
  injectionDetected: boolean;
  injectionQuote: string;
}
