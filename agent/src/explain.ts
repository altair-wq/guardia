import { llmAvailable, llmText } from "./llm.js";
import { ONCHAIN_TEXT, SIGNAL_TEXT, templateReason, type Outcome } from "./reasons.js";
import type { Signal } from "./types.js";
import { withTimeout } from "./verify.js";

const SYSTEM = `Escribís el motivo de una decisión de pago para el dueño de una PyME argentina.
Reglas:
- 1 o 2 oraciones, en español rioplatense (voseo), simple, cálido, sin jerga técnica y sin palabras en inglés.
- No inventes datos: usá solo los hechos que te paso.
- La decisión ya está tomada; no la cambies ni sugieras otra.
- Si se bloqueó o rechazó, aclará que no se movió plata.
- Devolvé solo el texto del motivo, sin comillas.`;

export async function explain(
  outcome: Outcome,
  ctx: { supplierName?: string; signals?: Signal[]; onchainReason?: string; detail?: string },
  log: (m: string) => void,
): Promise<string> {
  const fallback = templateReason(outcome, ctx);
  if (!llmAvailable()) return fallback;
  const facts = [
    `Resultado: ${outcome}`,
    ctx.supplierName ? `Proveedor: ${ctx.supplierName}` : "",
    ctx.signals?.length ? `Señales: ${ctx.signals.map((s) => SIGNAL_TEXT[s]).join("; ")}` : "Señales: ninguna",
    ctx.onchainReason ? `Motivo de la bóveda: ${ONCHAIN_TEXT[ctx.onchainReason] ?? ctx.onchainReason}` : "",
    `Texto de referencia: ${fallback}`,
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const text = await withTimeout(llmText(SYSTEM, facts, 5000), 5000);
    return text && text.length < 400 ? text : fallback;
  } catch (e) {
    log(`explain LLM failed, using template: ${(e as Error).message}`);
    return fallback;
  }
}
