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
    <section aria-labelledby="inj-title" className="rounded-card border border-block/30 bg-block-soft p-6">
      <h2 id="inj-title" className="flex items-center gap-2 text-lg font-semibold text-block-fg">
        <ScanEye aria-hidden className="h-5 w-5" />
        Instrucciones ocultas para la IA
      </h2>
      {line ? (
        <blockquote className="mt-4 rounded-chip bg-ink-900 p-4 font-mono text-base text-block-fg">
          <mark className="bg-transparent text-block-fg">“{line}”</mark>
        </blockquote>
      ) : (
        <p className="mt-4 rounded-chip bg-ink-900 p-4 text-base text-fg">
          La factura traía texto escondido dirigido al agente, no a una persona.
        </p>
      )}
      <p className="mt-4 text-base text-fg">Guardia no obedece lo que dice una factura: lo trata como dato, no como orden. Las ignoró y bloqueó el pago.</p>
    </section>
  );
}
