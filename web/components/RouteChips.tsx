import { ArrowRight } from "lucide-react";
import type { Quote } from "@/lib/types";
import { quoteSourceLabel, referenceLine } from "@/lib/tx";
import { TokenBadge } from "./TokenBadge";

export function RouteChips({ quote }: { quote: Quote }) {
  const ref = referenceLine(quote);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ol className="flex flex-wrap items-center gap-1.5" aria-label="Ruta de conversión">
          {quote.route.map((t, i) => (
            <li key={`${t}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ArrowRight aria-label="a" className="h-4 w-4 text-fg-subtle" />}
              <TokenBadge token={t} className="text-sm" />
            </li>
          ))}
        </ol>
        <span className="text-sm text-fg-muted">{quoteSourceLabel(quote.source)}</span>
      </div>
      {ref && <p className="mt-1 text-xs text-fg-subtle tabular">{ref}</p>}
    </div>
  );
}
