import { Check, ChevronDown, X } from "lucide-react";
import type { Decision } from "@/lib/types";
import { CHECKS } from "@/lib/checks";
import { SIGNAL_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";

const LEVEL = { low: "bajo", medium: "medio", high: "alto" } as const;

/** Score plus a collapsible per-category breakdown. Pass/fail comes from the agent's signals (no invented sub-scores). */
export function RiskScore({ d }: { d: Decision }) {
  const { risk } = d;
  const high = risk.level === "high";
  const scored = d.steps.find((s) => s.name === "score")?.status === "done";
  return (
    <div>
      <div className="flex items-end gap-3">
        <span className={cn("text-5xl font-bold leading-none tracking-[-0.02em] tabular", high ? "text-block-fg" : risk.level === "medium" ? "text-fg" : "text-pass-fg")}>
          {risk.score}
        </span>
        <span className="pb-1 text-base text-fg-muted">de 100, riesgo {LEVEL[risk.level]}</span>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-ink-800"
        role="meter"
        aria-label="Puntaje de riesgo"
        aria-valuenow={risk.score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("h-full rounded-full", high ? "bg-block" : risk.level === "medium" ? "bg-amber-500" : "bg-pass")} style={{ width: `${risk.score}%` }} />
      </div>

      {scored ? (
        <details open className="group mt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold [&::-webkit-details-marker]:hidden">
            Desglose por control
            <ChevronDown aria-hidden className="h-4 w-4 text-fg-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-3 divide-y divide-line">
            {CHECKS.map((c) => {
              const hits = c.failsOn.filter((s) => risk.signals.includes(s));
              const ok = hits.length === 0;
              return (
                <li key={c.category} className="flex items-start justify-between gap-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-base">{c.category}</span>
                    {!ok && <span className="block text-sm text-fg-muted">{hits.map((h) => SIGNAL_LABEL[h]).join(", ")}</span>}
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold",
                      ok ? "bg-pass-soft text-pass-fg" : "bg-block-soft text-block-fg",
                    )}
                  >
                    {ok ? <Check aria-hidden className="h-3.5 w-3.5" /> : <X aria-hidden className="h-3.5 w-3.5" />}
                    {ok ? "Pasó" : "Falló"}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      ) : (
        <p className="mt-4 text-base text-fg-muted">{d.status === "rejected_onchain" ? "El agente no evaluó este intento: fue directo al contrato." : "Todavía evaluando."}</p>
      )}
    </div>
  );
}
