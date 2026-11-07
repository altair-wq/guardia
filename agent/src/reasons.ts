// Template reasons (rioplatense Spanish) so the dashboard never shows an empty reason.
import type { Signal } from "./types.js";

export type Outcome =
  | "paid"
  | "paid_medium"
  | "blocked"
  | "rejected_onchain"
  | "execute_failed"
  | "invalid_invoice";

const SIGNAL_TEXT: Record<Signal, string> = {
  wallet_changed: "la billetera no coincide con la registrada para este proveedor",
  lookalike_address: "la billetera se parece a una registrada pero no es la misma (posible dirección clonada)",
  unknown_supplier: "el proveedor no está en nuestro registro",
  prompt_injection: "la factura trae instrucciones ocultas dirigidas a la IA",
  amount_anomaly: "el monto es mucho más alto que lo habitual para este proveedor",
  urgent_language: "el mensaje presiona para pagar con urgencia",
  website_mismatch: "la página web del proveedor no confirma sus datos",
};

const ONCHAIN_TEXT: Record<string, string> = {
  not_allowlisted: "la billetera no está habilitada en la bóveda",
  over_payment_cap: "el monto supera el tope por pago que fijó el dueño",
  over_daily_cap: "con este pago se pasaría del tope diario que fijó el dueño",
  not_verified_business: "el proveedor no figura como empresa verificada",
};

function joinEs(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function templateReason(
  outcome: Outcome,
  ctx: { supplierName?: string; signals?: Signal[]; onchainReason?: string; detail?: string },
): string {
  const sigs = (ctx.signals ?? []).map((s) => SIGNAL_TEXT[s]);
  const who = ctx.supplierName ? ` a ${ctx.supplierName}` : "";
  switch (outcome) {
    case "paid":
      return `Todo en orden: proveedor y billetera verificados. Le pagué${who} sin problemas.`;
    case "paid_medium":
      return `Pagué${who}, aunque ${joinEs(sigs)}. No había señales graves y los topes de la bóveda siguen protegiendo los fondos.`;
    case "blocked":
      return sigs.length
        ? `${cap(joinEs(sigs))}. Bloqueé el pago y no se movió nada.`
        : "Bloqueé el pago por precaución y no se movió nada.";
    case "rejected_onchain":
      return `La bóveda rechazó el pago porque ${ONCHAIN_TEXT[ctx.onchainReason ?? ""] ?? "no cumple las reglas del dueño"}. No se movió nada.`;
    case "execute_failed":
      return `No pude enviar el pago por un problema de conexión con la red${ctx.detail ? ` (${ctx.detail})` : ""}. No se movió nada.`;
    case "invalid_invoice":
      return `No pude leer ${ctx.detail ?? "los datos de pago"} en la factura, así que no pagué. No se movió nada.`;
  }
}

/** Broadcast, receipt not seen yet: money may have moved, so never say it did not. */
export const PENDING_REASON = "Pago enviado, esperando confirmación en la red. Verificalo en Arbiscan.";
export const PENDING_TIMEOUT_REASON =
  "Pago enviado, pero la red todavía no lo confirmó. No lo reenvío para no pagar dos veces. Verificalo en Arbiscan.";
export const REVERTED_REASON = "La red revirtió la transacción, así que el pago no se hizo. No se movió nada.";

/** Fixed text (no LLM) for an invoice in a currency we do not pay. */
export function currencyReason(label: string, signals: Signal[] = []): string {
  const base = `La factura está en una moneda que no pagamos (${label}). Solo pagamos facturas en pesos (ARGt).`;
  const sigs = signals.map((s) => SIGNAL_TEXT[s]);
  return `${base}${sigs.length ? ` Además, ${joinEs(sigs)}.` : ""} Bloqueé el pago y no se movió nada.`;
}

export { SIGNAL_TEXT, ONCHAIN_TEXT };
