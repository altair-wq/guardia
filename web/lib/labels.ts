import type { DecisionStatus, Signal, StepName, StepStatus } from "./types";

export const SIGNAL_LABEL: Record<Signal, string> = {
  wallet_changed: "billetera cambiada",
  lookalike_address: "dirección parecida",
  unknown_supplier: "proveedor desconocido",
  amount_anomaly: "monto inusual",
  urgent_language: "lenguaje urgente",
  prompt_injection: "inyección de prompt",
  website_mismatch: "web no coincide",
};

export const STATUS_LABEL: Record<DecisionStatus, string> = {
  received: "Recibida",
  processing: "Procesando",
  paid: "Pagado",
  blocked: "Bloqueado",
  rejected_onchain: "Rechazado por el contrato",
};

export const STEP_LABEL: Record<StepName, string> = {
  extract: "Extraer",
  verify: "Verificar",
  score: "Evaluar",
  execute: "Ejecutar",
};

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  pending: "pendiente",
  running: "en curso",
  done: "listo",
  skipped: "salteado",
  failed: "falló",
};

export const REJECT_REASON_LABEL: Record<string, string> = {
  not_allowlisted: "fuera de la lista",
  over_payment_cap: "supera el tope por pago",
  over_daily_cap: "supera el tope diario",
  not_verified_business: "empresa no verificada",
};
