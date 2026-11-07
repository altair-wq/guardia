import { Check as CheckIcon, X } from "lucide-react";
import type { Check } from "@/lib/checks";
import { cn } from "@/lib/cn";

export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul aria-label="Controles del agente" className="flex flex-wrap gap-x-5 gap-y-2">
      {checks.map((c) => (
        <li key={c.label} className={cn("inline-flex items-center gap-1.5 text-base", c.ok ? "text-fg-muted" : "font-semibold text-block-fg")}>
          {c.ok ? <CheckIcon aria-hidden className="h-4 w-4 text-pass" strokeWidth={2.5} /> : <X aria-hidden className="h-4 w-4" strokeWidth={2.5} />}
          {c.label}
          <span className="sr-only">{c.ok ? ": bien" : ": falló"}</span>
        </li>
      ))}
    </ul>
  );
}
