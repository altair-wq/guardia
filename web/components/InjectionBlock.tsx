import { ScanEye } from "lucide-react";
import type { Decision } from "@/lib/types";

/** Best effort: the shared contract has no quote field yet, so use `injectionQuote` if sent, else a quoted bit of `reason`. */
function maliciousLine(d: Decision): string | null {
  if (d.injectionQuote?.trim()) return d.injectionQuote.trim();
  const m = d.reason.match(/[“"«]([^”"»]{8,})[”"»]/);
  return m ? m[1] : null;
}

export function InjectionBlock({ d }: { d: Decision }) {
  const line = maliciousLine(d);
  return (
    <section aria-labelledby="inj-title" className="rounded-card border-2 border-block bg-block-soft p-4 sm:p-5">
      <h2 id="inj-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide text-block-fg">
        <ScanEye aria-hidden className="h-5 w-5" />
        Instrucciones ocultas para la IA
      </h2>
      {line ? (
        <blockquote className="mt-3 rounded-chip border border-block/60 bg-ink-950 p-3 font-mono text-base text-block-fg sm:text-lg">
          <mark className="bg-transparent text-block-fg">“{line}”</mark>
        </blockquote>
      ) : (
        <p className="mt-3 rounded-chip border border-block/60 bg-ink-950 p-3 text-base text-fg">
          La factura traía texto escondido dirigido al agente, no a una persona.
        </p>
      )}
      <p className="mt-3 text-sm text-fg">Guardia no obedece lo que dice una factura: lo trata como dato, no como orden. Las ignoró y bloqueó el pago.</p>
    </section>
  );
}
