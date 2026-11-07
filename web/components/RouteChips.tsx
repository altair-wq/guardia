import { ArrowRight } from "lucide-react";
import type { Quote } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  "belo-price-api": "cotizado con Belo",
  curve: "cotizado en Curve",
  direct: "pago directo, sin conversión",
};

export function RouteChips({ quote }: { quote: Quote }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Ruta de conversión">
        {quote.route.map((t, i) => (
          <li key={`${t}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRight aria-label="a" className="h-4 w-4 text-fg-subtle" />}
            <span className="rounded-chip border border-line bg-ink-800 px-2 py-0.5 font-mono text-sm font-medium text-fg">{t}</span>
          </li>
        ))}
      </ol>
      <span className="text-sm text-fg-muted">{SOURCE_LABEL[quote.source] ?? quote.source}</span>
    </div>
  );
}
