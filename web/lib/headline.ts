import type { Decision, Signal } from "./types";
import { isAwaitingConfirmation, isCurrencyBlock } from "./tx";

// One short sentence per decision for the feed. The full reason stays on the detail page.
const SIGNAL_HEADLINE: [Signal, string][] = [
  ["prompt_injection", "La factura trae instrucciones ocultas para la IA."],
  ["lookalike_address", "La billetera imita a la del proveedor."],
  ["wallet_changed", "La billetera no es la que tenemos registrada."],
  ["unknown_supplier", "El proveedor no está en la lista."],
  ["website_mismatch", "La web no coincide con la del proveedor."],
  ["amount_anomaly", "El monto está fuera de lo habitual."],
  ["urgent_language", "La factura presiona para pagar ya."],
];

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

export function verdictWord(d: Decision): string {
  if (isAwaitingConfirmation(d)) return "Enviando";
  switch (d.status) {
    case "paid":
      return "Pagado";
    case "blocked":
      return "Bloqueado";
    case "rejected_onchain":
      return "Rechazado";
    default:
      return "Revisando";
  }
}

export function headline(d: Decision): string {
  if (isAwaitingConfirmation(d)) return "Pago enviado. Esperando la confirmación de la red.";
  if (d.status === "processing" || d.status === "received") return "El agente está revisando la factura.";
  if (d.status === "rejected_onchain") return "El contrato frenó un pago a una dirección fuera de la lista.";
  if (d.status === "paid") {
    const q = d.quote;
    if (q && q.route.length > 1) return "Proveedor verificado. Pagado en reales, convertido en Curve.";
    return "Proveedor verificado. Pagado directo en ARGt.";
  }
  if (isCurrencyBlock(d)) return "La factura está en una moneda que no pagamos.";
  const hit = SIGNAL_HEADLINE.find(([s]) => d.risk.signals.includes(s));
  return hit ? hit[1] : firstSentence(d.reason);
}

export type Tone = "pass" | "block" | "wall" | "work";
export function toneOf(d: Decision): Tone {
  if (d.status === "paid") return "pass";
  if (d.status === "blocked") return "block";
  if (d.status === "rejected_onchain") return "wall";
  return "work";
}
