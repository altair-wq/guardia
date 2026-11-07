"use client";
import { useState } from "react";
import { ScanEye } from "lucide-react";
import type { Decision } from "@/lib/types";

/** The agent sends `injectionQuote` (verbatim hidden text); fall back to a quoted bit of `reason`. */
function maliciousLine(d: Decision): string | null {
  if (d.injectionQuote?.trim()) return d.injectionQuote.trim();
  const m = d.reason.match(/[“"«]([^”"»]{8,})[”"»]/);
  return m ? m[1] : null;
}

/** "X-ray": reveal the hidden layer of the invoice with the injected text highlighted. */
export function InjectionBlock({ d }: { d: Decision }) {
  const [open, setOpen] = useState(false);
  const line = maliciousLine(d);
  return (
    <section aria-labelledby="inj-title" className="shadow-card rounded-card border border-block/25 bg-block-soft p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="inj-title" className="flex items-center gap-2 text-lg font-semibold text-block-fg">
          <ScanEye aria-hidden className="h-5 w-5" />
          Instrucciones ocultas para la IA
        </h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="inj-xray"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-[40px] items-center rounded-chip border border-block/30 bg-ink-900 px-3 text-sm font-semibold text-block-fg hover:bg-block-soft"
        >
          {open ? "Ocultar texto oculto" : "Ver texto oculto"}
        </button>
      </div>
      <p className="mt-3 text-base text-fg">
        Guardia no obedece lo que dice una factura: lo trata como dato, no como orden. Ignoró el texto y bloqueó el pago.
      </p>
      {open && (
        <div id="inj-xray" className="mt-4 rounded-chip border-2 border-pink-600 bg-pink-50 p-4">
          <p className="text-sm font-semibold text-pink-800">Texto oculto detectado en la factura</p>
          <blockquote className="mt-2 break-words font-mono text-base text-pink-900">
            {line ? <mark className="rounded bg-pink-200/70 px-1 text-pink-900">“{line}”</mark> : "El texto estaba dirigido al agente, no a una persona."}
          </blockquote>
        </div>
      )}
    </section>
  );
}
