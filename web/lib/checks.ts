import type { Decision, Signal } from "./types";

// Stripe-Radar-style "risk insights": the checks the agent ran, in plain words, pass or fail.
// Each check reads correctly on its own: the label changes when it fails (no "✕ Sin ..." double negatives).
export const CHECKS: { category: string; ok: string; fail: string; failsOn: Signal[] }[] = [
  { category: "Proveedor en la lista", ok: "Proveedor en la lista", fail: "Proveedor desconocido", failsOn: ["unknown_supplier"] },
  { category: "Billetera coincide con el registro", ok: "Billetera registrada", fail: "Billetera distinta", failsOn: ["wallet_changed", "lookalike_address"] },
  { category: "Instrucciones ocultas para la IA", ok: "Sin órdenes ocultas", fail: "Órdenes ocultas para la IA", failsOn: ["prompt_injection"] },
  { category: "Monto habitual del proveedor", ok: "Monto habitual", fail: "Monto inusual", failsOn: ["amount_anomaly"] },
  { category: "Lenguaje de urgencia", ok: "Sin urgencia", fail: "Pide pagar ya", failsOn: ["urgent_language", "website_mismatch"] },
];

export interface Check {
  label: string;
  ok: boolean;
}

/** Only once the agent has scored the invoice; contract-level rejections skip the agent checks. */
export function checksFor(d: Decision): Check[] | null {
  const scored = d.steps.find((s) => s.name === "score")?.status === "done";
  if (!scored || d.status === "rejected_onchain") return null;
  return CHECKS.map((c) => {
    const ok = !c.failsOn.some((s) => d.risk.signals.includes(s));
    return { label: ok ? c.ok : c.fail, ok };
  });
}
